import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { encryptField, decryptField } from "@/lib/security/crypto";
import {
  CONSENT_PURPOSES,
  CONSENT_VERSION,
  requiredConsents,
  readingDraftSchema,
  validateDraftForSubmission,
  type ConsentPurpose,
  type ReadingDraft,
} from "@/lib/validation/reading";
import { parseJson, toJson } from "@/lib/json";
import { enqueueReadingJobs } from "@/jobs/queue";
import { audit } from "@/lib/audit";
import { notify } from "@/services/notifications";
import { storage } from "@/services/storage";

export const READING_INCLUDE = {
  birthProfile: true,
  assets: { where: { processingStatus: "VALIDATED" } },
  palmAnalysis: true,
  numerology: true,
  astrology: true,
  reports: { orderBy: { version: "desc" as const }, take: 3 },
  jobs: { orderBy: { createdAt: "desc" as const } },
  consents: true,
} as const;

export async function createDraft(userId: string, language = "en") {
  const reading = await prisma.completeReading.create({
    data: {
      userId,
      language,
      status: "DRAFT",
      selectedModules: "[]",
      draftData: encryptField(toJson(readingDraftSchema.parse({ language, step: 1 }))),
      currentStep: 1,
    },
  });
  await audit({ actorUserId: userId, action: "READING_DRAFT_CREATED", resourceType: "CompleteReading", resourceId: reading.id });
  return reading;
}

export async function getReadingOrThrow(
  id: string,
  userId: string,
  options: { includeContent?: boolean; allowDeleted?: boolean } = {},
) {
  const reading = await prisma.completeReading.findUnique({
    where: { id },
    include: READING_INCLUDE,
  });
  if (!reading || reading.userId !== userId) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
  }
  if (reading.status === "DELETED" && !options.allowDeleted) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
  }
  return reading;
}

export async function listReadings(userId: string) {
  return prisma.completeReading.findMany({
    where: { userId, status: { notIn: ["DELETED"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      selectedModules: true,
      language: true,
      reportVersion: true,
      createdAt: true,
      completedAt: true,
      errorCode: true,
      reports: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true, createdAt: true },
      },
    },
  });
}

export function parseDraft(reading: { draftData: string | null; language: string }): ReadingDraft {
  if (!reading.draftData) {
    return readingDraftSchema.parse({ language: reading.language });
  }
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(reading.draftData) as Record<string, unknown>;
  } catch {
    try {
      raw = JSON.parse(decryptField(reading.draftData)) as Record<string, unknown>;
    } catch {
      raw = {};
    }
  }
  const parsed = readingDraftSchema.safeParse({ ...raw, language: raw.language ?? reading.language });
  return parsed.success ? parsed.data : readingDraftSchema.parse({ language: reading.language });
}

export async function updateDraft(
  id: string,
  userId: string,
  patch: Partial<ReadingDraft>,
): Promise<{ id: string; draft: ReadingDraft }> {
  const reading = await getReadingOrThrow(id, userId);
  if (!reading.draftData || !["DRAFT", "AWAITING_CONSENT"].includes(reading.status)) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "This reading can no longer be edited.", 409);
  }
  const current = parseDraft(reading);
  const merged = readingDraftSchema.parse({
    ...current,
    ...patch,
    methods: patch.methods ? [...new Set(patch.methods)] : current.methods,
  });
  await prisma.completeReading.update({
    where: { id },
    data: {
      draftData: encryptField(toJson(merged)),
      language: merged.language,
      currentStep: merged.step ?? reading.currentStep,
      selectedModules: toJson(merged.methods),
    },
  });
  return { id, draft: merged };
}

export interface SubmitResult {
  id: string;
  status: string;
  modules: string[];
}

export async function submitReading(
  id: string,
  userId: string,
  consents: Partial<Record<ConsentPurpose, boolean>>,
): Promise<SubmitResult> {
  const reading = await getReadingOrThrow(id, userId);
  if (!["DRAFT", "AWAITING_CONSENT"].includes(reading.status)) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "This reading has already been submitted.", 409);
  }
  const draft = parseDraft(reading);
  const errors = validateDraftForSubmission(draft);
  if (errors.length) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Some information is missing or invalid.", 422, { errors });
  }

  const required = requiredConsents(draft);
  const missing = required.filter((purpose) => consents[purpose] !== true);
  if (missing.length) {
    throw new AppError(ERROR_CODES.CONSENT_REQUIRED, "Required consent must be granted before processing.", 403, {
      missing,
    });
  }

  const validatedAssets = reading.assets.filter((a) => a.processingStatus === "VALIDATED");
  if (draft.methods.includes("PALMISTRY")) {
    const hasPalm = validatedAssets.some((a) => a.assetType === "PALM_LEFT" || a.assetType === "PALM_RIGHT");
    if (!hasPalm) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        "Upload at least one validated palm photograph before submitting.",
        422,
        { errors: ["A palm photograph is required for the palmistry module."] },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const birthProfile = await tx.birthProfile.create({
      data: {
        userId,
        encryptedFullName: encryptField(draft.fullName.trim()),
        encryptedDateOfBirth: encryptField(draft.dateOfBirth),
        birthTime: draft.birthTimeAccuracy === "UNKNOWN" ? null : draft.birthTime || null,
        birthTimeAccuracy: draft.birthTimeAccuracy,
        birthplaceName: draft.birthplace?.name ?? null,
        latitude: draft.birthplace?.latitude ?? null,
        longitude: draft.birthplace?.longitude ?? null,
        timezone: draft.birthplace?.timezone ?? null,
      },
    });

    await tx.consentRecord.createMany({
      data: CONSENT_PURPOSES.map((purpose) => ({
        userId,
        readingId: id,
        purpose,
        consentVersion: CONSENT_VERSION,
        granted: consents[purpose] === true,
        grantedAt: consents[purpose] === true ? new Date() : null,
        metadata: toJson({ source: "reading_submission" }),
      })),
    });

    await tx.completeReading.update({
      where: { id },
      data: {
        status: "QUEUED",
        selectedModules: toJson(draft.methods),
        language: draft.language,
        birthProfileId: birthProfile.id,
        submittedAt: new Date(),
        currentStep: 7,
        inputSnapshotVersion: { increment: 1 },
        errorCode: null,
      },
    });

    if (draft.preferredName.trim()) {
      await tx.userProfile.upsert({
        where: { userId },
        update: { displayName: draft.preferredName.trim() },
        create: { userId, displayName: draft.preferredName.trim(), country: draft.country || null },
      });
    }
  });

  await enqueueReadingJobs(id, draft.methods);
  await notify({
    userId,
    readingId: id,
    type: "READING_SUBMITTED",
    title: "Your reading is being prepared",
    body: "Your selected methods are running. You can follow progress on the reading page.",
  });
  await audit({
    actorUserId: userId,
    action: "READING_SUBMITTED",
    resourceType: "CompleteReading",
    resourceId: id,
    metadata: { modules: draft.methods.join(","), inputVersion: reading.inputSnapshotVersion + 1 },
  });

  return { id, status: "QUEUED", modules: draft.methods };
}

export async function continueWithoutPalm(id: string, userId: string): Promise<void> {
  const reading = await getReadingOrThrow(id, userId);
  if (!reading.palmAnalysis) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "No palm analysis is pending.", 409);
  }
  if (reading.selectedModules && !parseJson<string[]>(reading.selectedModules, []).includes("PALMISTRY")) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "Palmistry is not part of this reading.", 409);
  }
  await prisma.palmAnalysis.update({
    where: { readingId: id },
    data: {
      status: "FAILED",
      errorCode: "USER_CONTINUED_WITHOUT_PALM",
    },
  });
  const { maybeEnqueueSynthesis } = await import("@/jobs/queue");
  await maybeEnqueueSynthesis(id);
}

/**
 * Purges reading content and assets, leaving a minimal tombstone for audit and
 * to prevent accidental reuse of the identifier.
 */
export async function deleteReading(id: string, userId: string): Promise<void> {
  const reading = await getReadingOrThrow(id, userId, { allowDeleted: true });
  if (reading.status === "DELETED") return;

  await prisma.completeReading.update({ where: { id }, data: { status: "DELETION_PENDING" } });

  const objectKeys = new Set<string>();
  for (const asset of await prisma.uploadedAsset.findMany({ where: { readingId: id } })) {
    objectKeys.add(asset.storageKey);
  }

  await prisma.$transaction(async (tx) => {
    await tx.aIConversation.deleteMany({ where: { readingId: id, userId } });
    await tx.completeLifeReport.deleteMany({ where: { readingId: id } });
    await tx.palmAnalysis.deleteMany({ where: { readingId: id } });
    await tx.numerologyAnalysis.deleteMany({ where: { readingId: id } });
    await tx.astrologyCalculation.deleteMany({ where: { readingId: id } });
    await tx.consentRecord.deleteMany({ where: { readingId: id } });
    await tx.reportShare.deleteMany({ where: { readingId: id } });
    await tx.notification.deleteMany({ where: { readingId: id } });
    await tx.uploadedAsset.updateMany({
      where: { readingId: id },
      data: { processingStatus: "DELETED", retentionStatus: "DELETED", deletedAt: new Date() },
    });

    const profileId = reading.birthProfileId;
    await tx.completeReading.update({
      where: { id },
      data: {
        status: "DELETED",
        draftData: null,
        birthProfileId: null,
        selectedModules: "[]",
        reportVersion: 0,
        errorCode: null,
        completedAt: new Date(),
      },
    });
    if (profileId) {
      const remaining = await tx.completeReading.count({ where: { birthProfileId: profileId } });
      if (remaining === 0) await tx.birthProfile.delete({ where: { id: profileId } }).catch(() => undefined);
    }
    await tx.dataDeletionRequest.upsert({
      where: { readingId: id },
      update: { status: "COMPLETED", processedAt: new Date() },
      create: { userId, readingId: id, status: "COMPLETED", processedAt: new Date() },
    });
  });

  for (const key of objectKeys) {
    await storage().delete(key).catch(() => undefined);
  }

  await notify({
    userId,
    type: "DELETION_RECEIVED",
    title: "Reading deleted",
    body: "Your reading, report, palm photographs and related conversations were deleted. A minimal deletion record is retained for audit.",
  });
  await audit({
    actorUserId: userId,
    action: "READING_DELETED",
    resourceType: "CompleteReading",
    resourceId: id,
    metadata: { assetsDeleted: objectKeys.size },
  });
}

export async function latestReport(readingId: string, userId: string) {
  const report = await prisma.completeLifeReport.findFirst({
    where: { readingId, userId },
    orderBy: { version: "desc" },
  });
  if (!report) return null;
  return report;
}
