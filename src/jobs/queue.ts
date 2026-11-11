import { prisma } from "@/lib/database/prisma";
import { toJson } from "@/lib/json";

export const JOB_TYPES = [
  "PALM_IMAGE_ANALYZE",
  "NUMEROLOGY_CALCULATE",
  "ASTROLOGY_CALCULATE",
  "LIFE_REPORT_SYNTHESIS",
  "PDF_GENERATE",
  "ASSET_DELETE",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export async function enqueueJob(input: {
  readingId?: string | null;
  jobType: JobType;
  idempotencyKey: string;
  payload?: unknown;
  availableAt?: Date;
  maxAttempts?: number;
}): Promise<void> {
  try {
    await prisma.backgroundJob.create({
      data: {
        readingId: input.readingId ?? null,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload === undefined ? null : toJson(input.payload),
        availableAt: input.availableAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? 4,
      },
    });
  } catch (error) {
    // Unique idempotency key — the job already exists, which is the goal.
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
}

export async function enqueueReadingJobs(readingId: string, modules: string[]): Promise<void> {
  if (modules.includes("PALMISTRY")) {
    await enqueueJob({ readingId, jobType: "PALM_IMAGE_ANALYZE", idempotencyKey: `${readingId}:PALM_IMAGE_ANALYZE:v1` });
  }
  if (modules.includes("NUMEROLOGY")) {
    await enqueueJob({ readingId, jobType: "NUMEROLOGY_CALCULATE", idempotencyKey: `${readingId}:NUMEROLOGY_CALCULATE:v1` });
  }
  if (modules.includes("ASTROLOGY")) {
    await enqueueJob({ readingId, jobType: "ASTROLOGY_CALCULATE", idempotencyKey: `${readingId}:ASTROLOGY_CALCULATE:v1` });
  }
}

const TERMINAL_FAILURE = new Set(["FAILED", "DEAD", "CANCELLED"]);

/**
 * Synthesis is only queued when every selected component has reached a terminal
 * state. A failed component produces a transparent partial report; it is never
 * replaced with invented data.
 */
export async function maybeEnqueueSynthesis(readingId: string): Promise<void> {
  const reading = await prisma.completeReading.findUnique({
    where: { id: readingId },
    include: { palmAnalysis: true, numerology: true, astrology: true, jobs: true },
  });
  if (!reading) return;
  if (["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "DELETED", "CANCELLED", "DELETION_PENDING"].includes(reading.status)) {
    return;
  }

  let modules: string[] = [];
  try {
    modules = JSON.parse(reading.selectedModules);
  } catch {
    modules = [];
  }
  if (!modules.length) return;

  const failedJobs = new Set(
    reading.jobs
      .filter((j) => j.jobType !== "LIFE_REPORT_SYNTHESIS" && TERMINAL_FAILURE.has(j.status))
      .map((j) => j.jobType),
  );

  const terminal = (module: string): boolean => {
    const jobType =
      module === "PALMISTRY"
        ? "PALM_IMAGE_ANALYZE"
        : module === "NUMEROLOGY"
          ? "NUMEROLOGY_CALCULATE"
          : "ASTROLOGY_CALCULATE";
    if (failedJobs.has(jobType)) return true;
    const analysis =
      module === "PALMISTRY" ? reading.palmAnalysis : module === "NUMEROLOGY" ? reading.numerology : reading.astrology;
    if (!analysis) return false;
    const status =
      module === "ASTROLOGY"
        ? (analysis as { calculationStatus: string }).calculationStatus
        : (analysis as { status: string }).status;
    return ["COMPLETED", "LIMITED", "FAILED"].includes(status);
  };

  if (!modules.every(terminal)) return;

  await prisma.completeReading.updateMany({
    where: { id: readingId, status: { in: ["QUEUED", "PROCESSING", "READY"] } },
    data: { status: "PROCESSING" },
  });

  await enqueueJob({
    readingId,
    jobType: "LIFE_REPORT_SYNTHESIS",
    idempotencyKey: `${readingId}:LIFE_REPORT_SYNTHESIS:v1`,
    maxAttempts: 3,
  });
}

export async function resetJobForRetry(jobId: string): Promise<void> {
  await prisma.backgroundJob.update({
    where: { id: jobId },
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
