import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { hmacSign, safeEqual, signExpiringUrl } from "@/lib/security/crypto";
import { parseJson, toJson } from "@/lib/json";
import { storage } from "@/services/storage";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  PalmValidationError,
  extensionOf,
  validateAndProcessPalmImage,
  type ImageQuality,
} from "@/services/image-analysis/validate";

export const ASSET_TYPES = ["PALM_LEFT", "PALM_RIGHT"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

const ASSET_TTL_SECONDS = 900;
const ASSET_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function presignUpload(input: {
  userId: string;
  readingId: string;
  assetType: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}) {
  const reading = await prisma.completeReading.findUnique({ where: { id: input.readingId } });
  if (!reading || reading.userId !== input.userId) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
  }
  if (!["DRAFT", "AWAITING_CONSENT"].includes(reading.status)) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "Photographs cannot be changed after submission.", 409);
  }
  if (!ASSET_TYPES.includes(input.assetType as AssetType)) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Unknown palm photograph type.", 422);
  }
  if (!ALLOWED_MIME.includes(input.mimeType as (typeof ALLOWED_MIME)[number])) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_MEDIA, "Only JPEG, PNG and WebP images are accepted.", 415);
  }
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(input.filename))) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_MEDIA, "Use a .jpg, .jpeg, .png or .webp file.", 415);
  }
  if (input.fileSize <= 0 || input.fileSize > MAX_FILE_BYTES) {
    throw new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, "Palm photographs must be 8 MB or smaller.", 413);
  }

  const existingCount = await prisma.uploadedAsset.count({
    where: { readingId: input.readingId, userId: input.userId, processingStatus: { not: "DELETED" } },
  });
  if (existingCount >= 4) {
    throw new AppError(ERROR_CODES.CONFLICT, "Too many images for this reading. Delete one before uploading another.", 409);
  }

  const extension = ASSET_EXTENSION[input.mimeType] ?? ".bin";
  const storageKey = `${input.userId}/${input.readingId}/${randomUUID()}${extension}`;
  const asset = await prisma.uploadedAsset.create({
    data: {
      userId: input.userId,
      readingId: input.readingId,
      storageKey,
      assetType: input.assetType,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      checksum: "",
      processingStatus: "PENDING",
      retentionStatus: "ACTIVE",
    },
  });

  const expires = Math.floor(Date.now() / 1000) + ASSET_TTL_SECONDS;
  const uploadToken = hmacSign(`upload:${asset.id}:${input.userId}:${expires}`);
  const directUrl = await storage().signedUploadUrl?.(storageKey, input.mimeType, ASSET_TTL_SECONDS);

  return {
    assetId: asset.id,
    uploadToken,
    expires,
    mode: directUrl ? ("s3" as const) : ("local" as const),
    uploadUrl: directUrl ?? "/api/v1/uploads/complete",
    assetType: input.assetType,
    maxBytes: MAX_FILE_BYTES,
  };
}

export function verifyUploadToken(assetId: string, userId: string, expires: number, token: string): void {
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "The upload link has expired. Please try again.", 403);
  }
  const expected = hmacSign(`upload:${assetId}:${userId}:${expires}`);
  if (!safeEqual(expected, token)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Invalid upload authorization.", 403);
  }
}

async function removeSiblings(userId: string, readingId: string, assetType: string, keepId: string) {
  const siblings = await prisma.uploadedAsset.findMany({
    where: {
      userId,
      readingId,
      assetType,
      id: { not: keepId },
      processingStatus: { not: "DELETED" },
    },
  });
  for (const sibling of siblings) {
    await prisma.uploadedAsset.update({
      where: { id: sibling.id },
      data: { processingStatus: "DELETED", retentionStatus: "DELETED", deletedAt: new Date() },
    });
    await storage().delete(sibling.storageKey).catch(() => undefined);
  }
}

export async function completeUpload(input: {
  assetId: string;
  userId: string;
  expires: number;
  token: string;
  fileBuffer?: Buffer;
  filename?: string;
}) {
  verifyUploadToken(input.assetId, input.userId, input.expires, input.token);
  const asset = await prisma.uploadedAsset.findUnique({ where: { id: input.assetId }, include: { reading: true } });
  if (!asset || asset.userId !== input.userId || !asset.reading) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Upload not found.", 404);
  }
  if (!asset.reading || !["DRAFT", "AWAITING_CONSENT"].includes(asset.reading.status)) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "This reading is no longer accepting photographs.", 409);
  }
  if (!["PENDING", "NEEDS_REUPLOAD"].includes(asset.processingStatus)) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "This upload has already been completed.", 409);
  }

  let buffer = input.fileBuffer;
  if (!buffer) {
    buffer = await storage().get(asset.storageKey).catch(() => undefined);
    if (!buffer) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, "The uploaded object was not found in storage.", 422);
    }
  }

  let validated;
  try {
    validated = await validateAndProcessPalmImage(
      buffer,
      asset.mimeType,
      input.filename ?? `upload${ASSET_EXTENSION[asset.mimeType] ?? ".jpg"}`,
    );
  } catch (error) {
    const code = error instanceof PalmValidationError ? error.code : "INVALID_IMAGE";
    const message =
      error instanceof PalmValidationError ? error.message : "The image could not be validated.";
    await prisma.uploadedAsset.update({
      where: { id: asset.id },
      data: { processingStatus: "REJECTED", errorCode: code },
    });
    await storage().delete(asset.storageKey).catch(() => undefined);
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422, { code });
  }

  await storage().put(asset.storageKey, validated.buffer, validated.mimeType);
  const processingStatus = validated.quality.status === "PASS" ? "VALIDATED" : "NEEDS_REUPLOAD";

  const updated = await prisma.uploadedAsset.update({
    where: { id: asset.id },
    data: {
      mimeType: validated.mimeType,
      fileSize: validated.buffer.length,
      imageWidth: validated.width,
      imageHeight: validated.height,
      checksum: validated.checksum,
      qualityMetadata: toJson(validated.quality),
      processingStatus,
      errorCode: processingStatus === "NEEDS_REUPLOAD" ? "IMAGE_QUALITY" : null,
    },
  });

  // Replacing a hand photograph removes the previous file.
  await removeSiblings(input.userId, asset.readingId!, asset.assetType, asset.id);

  return {
    id: updated.id,
    assetType: updated.assetType,
    status: updated.processingStatus,
    width: updated.imageWidth,
    height: updated.imageHeight,
    quality: validated.quality,
    previewUrl: (await assetView(updated.id, input.userId)).previewUrl,
  };
}

export async function assetView(assetId: string, userId: string) {
  const asset = await prisma.uploadedAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.userId !== userId || asset.processingStatus === "DELETED") {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Image not found.", 404);
  }
  const { expires, sig } = signExpiringUrl("asset", asset.id, 300);
  return {
    id: asset.id,
    assetType: asset.assetType,
    status: asset.processingStatus,
    mimeType: asset.mimeType,
    width: asset.imageWidth,
    height: asset.imageHeight,
    fileSize: asset.fileSize,
    quality: parseJson<ImageQuality | null>(asset.qualityMetadata, null),
    previewUrl: `/api/v1/uploads/${asset.id}/file?expires=${expires}&sig=${sig}`,
    expiresAt: new Date(expires * 1000).toISOString(),
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function listAssets(readingId: string, userId: string) {
  const assets = await prisma.uploadedAsset.findMany({
    where: { readingId, userId, processingStatus: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(assets.map((a) => assetView(a.id, userId)));
}

export async function deleteAsset(assetId: string, userId: string) {
  const asset = await prisma.uploadedAsset.findUnique({ where: { id: assetId }, include: { reading: true } });
  if (!asset || asset.userId !== userId || asset.processingStatus === "DELETED") {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Image not found.", 404);
  }
  if (asset.reading && !["DRAFT", "AWAITING_CONSENT"].includes(asset.reading.status)) {
    throw new AppError(ERROR_CODES.INVALID_STATE, "Photographs cannot be changed after submission.", 409);
  }
  await prisma.uploadedAsset.update({
    where: { id: assetId },
    data: { processingStatus: "DELETED", retentionStatus: "DELETED", deletedAt: new Date() },
  });
  await storage().delete(asset.storageKey).catch(() => undefined);
}
