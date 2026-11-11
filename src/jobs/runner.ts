import { prisma } from "@/lib/database/prisma";
import { AIProviderError } from "@/services/ai/types";
import { AppError } from "@/lib/api/response";
import { truncate } from "@/lib/json";
import { maybeEnqueueSynthesis } from "@/jobs/queue";
import {
  runAstrologyJob,
  runNumerologyJob,
  runPalmJob,
  runSynthesisJob,
} from "@/jobs/handlers";
import { notify } from "@/services/notifications";

const JOB_TIMEOUT_MS = 120_000;
const STALE_LOCK_MS = 10 * 60_000;

const COMPONENT_JOB_TYPES = new Set(["PALM_IMAGE_ANALYZE", "NUMEROLOGY_CALCULATE", "ASTROLOGY_CALCULATE"]);

function handlerFor(jobType: string): ((readingId: string) => Promise<void>) | null {
  switch (jobType) {
    case "PALM_IMAGE_ANALYZE":
      return runPalmJob;
    case "NUMEROLOGY_CALCULATE":
      return runNumerologyJob;
    case "ASTROLOGY_CALCULATE":
      return runAstrologyJob;
    case "LIFE_REPORT_SYNTHESIS":
      return runSynthesisJob;
    default:
      return null;
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof AIProviderError) return error.retryable;
  if (error instanceof AppError) return error.status >= 500;
  return true;
}

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof AIProviderError) return { code: error.code, message: error.message };
  if (error instanceof AppError) return { code: error.code, message: error.message };
  if (error instanceof Error) {
    return { code: "JOB_ERROR", message: truncate(error.message.replace(/[\r\n]+/g, " "), 300) };
  }
  return { code: "JOB_ERROR", message: "Unknown job failure." };
}

async function markComponentFailure(readingId: string, jobType: string, code: string): Promise<void> {
  if (jobType === "PALM_IMAGE_ANALYZE") {
    await prisma.palmAnalysis.updateMany({ where: { readingId }, data: { status: "FAILED", errorCode: code } });
  } else if (jobType === "NUMEROLOGY_CALCULATE") {
    await prisma.numerologyAnalysis.updateMany({ where: { readingId }, data: { status: "FAILED", errorCode: code } });
  } else if (jobType === "ASTROLOGY_CALCULATE") {
    await prisma.astrologyCalculation.updateMany({
      where: { readingId },
      data: { calculationStatus: "FAILED", errorCode: code },
    });
  }
}

async function claimJob(readingId?: string) {
  const now = new Date();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  await prisma.backgroundJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: staleBefore } },
    data: { status: "QUEUED", lockedAt: null, availableAt: now },
  });

  const candidate = await prisma.backgroundJob.findFirst({
    where: {
      status: "QUEUED",
      availableAt: { lte: now },
      ...(readingId ? { readingId } : {}),
      jobType: { in: ["PALM_IMAGE_ANALYZE", "NUMEROLOGY_CALCULATE", "ASTROLOGY_CALCULATE", "LIFE_REPORT_SYNTHESIS"] },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.backgroundJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      attemptCount: { increment: 1 },
      startedAt: now,
      lockedAt: now,
      errorCode: null,
      lastError: null,
    },
  });
  if (claimed.count === 0) return null;
  return prisma.backgroundJob.findUnique({ where: { id: candidate.id } });
}

async function executeJob(jobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job || !job.readingId) return;
  const handler = handlerFor(job.jobType);
  if (!handler) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "FAILED", completedAt: new Date(), errorCode: "UNSUPPORTED_JOB" },
    });
    return;
  }

  await prisma.completeReading.updateMany({
    where: { id: job.readingId, status: { in: ["QUEUED", "READY"] } },
    data: { status: "PROCESSING" },
  });

  try {
    await Promise.race([
      handler(job.readingId),
      new Promise((_, reject) => setTimeout(() => reject(new Error("JOB_TIMEOUT")), JOB_TIMEOUT_MS)),
    ]);
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, errorCode: null, lastError: null },
    });
    if (COMPONENT_JOB_TYPES.has(job.jobType)) {
      await maybeEnqueueSynthesis(job.readingId);
    }
  } catch (error) {
    const { code, message } = safeError(error);
    const retryable = isRetryable(error);
    const canRetry = retryable && job.attemptCount < job.maxAttempts;

    if (canRetry) {
      const delay = Math.min(60_000, 2 ** job.attemptCount * 2_000);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          lockedAt: null,
          availableAt: new Date(Date.now() + delay),
          errorCode: code,
          lastError: message,
        },
      });
      return;
    }

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        lockedAt: null,
        errorCode: code,
        lastError: message,
      },
    });

    if (COMPONENT_JOB_TYPES.has(job.jobType)) {
      await markComponentFailure(job.readingId, job.jobType, code);
      await maybeEnqueueSynthesis(job.readingId);
      await notify({
        userId: (await prisma.completeReading.findUnique({ where: { id: job.readingId } }))?.userId ?? "",
        readingId: job.readingId,
        type: "REPORT_FAILED",
        title: "One method could not be completed",
        body: "AIBABA did not substitute generated content. The remaining valid methods will be included and the missing component will be labelled.",
      }).catch(() => undefined);
    }

    if (job.jobType === "LIFE_REPORT_SYNTHESIS") {
      await prisma.completeReading.update({
        where: { id: job.readingId },
        data: { status: "FAILED", errorCode: code },
      });
      const reading = await prisma.completeReading.findUnique({ where: { id: job.readingId } });
      if (reading) {
        await notify({
          userId: reading.userId,
          readingId: reading.id,
          type: "REPORT_FAILED",
          title: "Report generation failed",
          body: "No report was published because the synthesis step did not complete. You can retry from the reading page.",
        }).catch(() => undefined);
      }
    }
  }
}

export async function runDueJobs(options: { limit?: number; readingId?: string } = {}): Promise<number> {
  const limit = Math.max(1, Math.min(options.limit ?? 3, 10));
  let ran = 0;
  for (let i = 0; i < limit; i += 1) {
    const job = await claimJob(options.readingId);
    if (!job) break;
    await executeJob(job.id);
    ran += 1;
  }
  return ran;
}

export async function retryReadingJobs(readingId: string, userId: string): Promise<void> {
  const reading = await prisma.completeReading.findUnique({ where: { id: readingId } });
  if (!reading || reading.userId !== userId) throw new AppError("NOT_FOUND", "Reading not found.", 404);
  if (reading.status === "DELETED") throw new AppError("INVALID_STATE", "Reading was deleted.", 409);
  const jobs = await prisma.backgroundJob.findMany({
    where: { readingId, status: { in: ["FAILED", "DEAD"] }, jobType: { in: ["PALM_IMAGE_ANALYZE", "NUMEROLOGY_CALCULATE", "ASTROLOGY_CALCULATE", "LIFE_REPORT_SYNTHESIS"] } },
  });
  for (const job of jobs) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        attemptCount: 0,
        availableAt: new Date(),
        lockedAt: null,
        startedAt: null,
        completedAt: null,
        errorCode: null,
        lastError: null,
      },
    });
  }
  await prisma.completeReading.update({
    where: { id: readingId },
    data: { status: "PROCESSING", errorCode: null },
  });
}
