import sharp from "sharp";
import { createHash } from "node:crypto";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MIN_DIMENSION = 480;
export const MAX_DIMENSION = 6000;

export class PalmValidationError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = "PalmValidationError";
    this.code = code;
    this.status = status;
  }
}

export function detectImageMime(buffer: Buffer): AllowedMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export interface ImageQualityIssue {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface ImageQuality {
  status: "PASS" | "NEEDS_REUPLOAD";
  score: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  skinToneRatio: number;
  width: number;
  height: number;
  issues: ImageQualityIssue[];
  measuredAt: string;
  notes: string[];
}

async function laplacianVariance(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer)
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const value =
        data[i - w] + data[i + w] + data[i - 1] + data[i + 1] - 4 * data[i];
      sum += value;
      sumSquares += value * value;
      count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return Math.max(0, sumSquares / count - mean * mean);
}

async function measureSkinToneRatio(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .resize({ width: 128, height: 128, fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let skin = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b) {
      skin += 1;
    }
  }
  return pixels ? skin / pixels : 0;
}

export async function assessImageQuality(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<ImageQuality> {
  const stats = await sharp(buffer).greyscale().stats();
  const channel = stats.channels[0];
  const brightness = channel.mean;
  const contrast = channel.stdev;
  const sharpness = await laplacianVariance(buffer);
  const skinToneRatio = await measureSkinToneRatio(buffer);

  const issues: ImageQualityIssue[] = [];
  let score = 100;

  if (Math.min(width, height) < MIN_DIMENSION) {
    issues.push({
      code: "RESOLUTION_TOO_LOW",
      message: `Image is ${width}×${height}. Upload at least ${MIN_DIMENSION}×${MIN_DIMENSION}.`,
      severity: "error",
    });
    score -= 40;
  }
  if (brightness < 45) {
    issues.push({
      code: "TOO_DARK",
      message: "The photograph is dark. Use soft, even natural light so the palm lines are visible.",
      severity: "error",
    });
    score -= 30;
  } else if (brightness > 225) {
    issues.push({
      code: "TOO_BRIGHT",
      message: "The photograph is overexposed. Avoid direct flash or strong light on the palm.",
      severity: "error",
    });
    score -= 25;
  } else if (brightness < 70) {
    issues.push({
      code: "LOW_LIGHT",
      message: "Lighting is low; some palm lines may be hard to see.",
      severity: "warning",
    });
    score -= 10;
  }

  if (contrast < 16) {
    issues.push({
      code: "LOW_CONTRAST",
      message: "The image has little contrast. Use an uncluttered, plain background and even light.",
      severity: "error",
    });
    score -= 25;
  } else if (contrast < 26) {
    issues.push({
      code: "SOFT_CONTRAST",
      message: "Contrast is soft; finer palm lines may be unclear.",
      severity: "warning",
    });
    score -= 10;
  }

  if (sharpness < 18) {
    issues.push({
      code: "BLURRY",
      message: "The photograph appears blurry. Hold the camera steady and allow it to focus before capturing.",
      severity: "error",
    });
    score -= 35;
  } else if (sharpness < 45) {
    issues.push({
      code: "SLIGHT_BLUR",
      message: "Some areas are soft. A sharper photograph will improve line visibility.",
      severity: "warning",
    });
    score -= 12;
  }

  if (skinToneRatio < 0.08) {
    issues.push({
      code: "LOW_HAND_COVERAGE",
      message: "The image does not appear to be dominated by a hand. Frame the whole palm clearly.",
      severity: "warning",
    });
    score -= 10;
  }

  const hasError = issues.some((i) => i.severity === "error");
  const status = hasError || score < 55 ? "NEEDS_REUPLOAD" : "PASS";

  return {
    status,
    score: Math.max(0, Math.min(100, Math.round(score))),
    brightness: Number(brightness.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    sharpness: Number(sharpness.toFixed(2)),
    skinToneRatio: Number(skinToneRatio.toFixed(4)),
    width,
    height,
    issues,
    measuredAt: new Date().toISOString(),
    notes: [
      "These are photographic quality measurements only. They do not identify palm lines or any personal characteristic.",
      "Skin-tone coverage is a framing hint and is not used for identification or sensitive-trait inference.",
    ],
  };
}

export interface ValidatedPalmImage {
  buffer: Buffer;
  mimeType: AllowedMime;
  width: number;
  height: number;
  format: string;
  checksum: string;
  quality: ImageQuality;
  originalBytes: number;
}

export async function validateAndProcessPalmImage(
  input: Buffer,
  declaredMime: string,
  filename: string,
): Promise<ValidatedPalmImage> {
  if (input.length === 0) {
    throw new PalmValidationError("EMPTY_FILE", "The uploaded file is empty.", 400);
  }
  if (input.length > MAX_FILE_BYTES) {
    throw new PalmValidationError("FILE_TOO_LARGE", "Palm photographs must be 8 MB or smaller.", 413);
  }
  const extension = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new PalmValidationError("BAD_EXTENSION", "Use a .jpg, .jpeg, .png or .webp file.", 415);
  }
  if (!ALLOWED_MIME.includes(declaredMime as AllowedMime)) {
    throw new PalmValidationError("UNSUPPORTED_TYPE", "Only JPEG, PNG and WebP images are accepted.", 415);
  }
  const detected = detectImageMime(input);
  if (!detected) {
    throw new PalmValidationError("INVALID_SIGNATURE", "The file is not a valid JPEG, PNG or WebP image.", 415);
  }
  if (detected !== declaredMime) {
    throw new PalmValidationError(
      "MIME_MISMATCH",
      "The file contents do not match the declared image type.",
      415,
    );
  }

  let metadata;
  try {
    metadata = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new PalmValidationError("CORRUPT_IMAGE", "The image could not be decoded. Try another photograph.", 422);
  }
  if (!metadata.width || !metadata.height) {
    throw new PalmValidationError("CORRUPT_IMAGE", "The image has no readable dimensions.", 422);
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new PalmValidationError("ANIMATED_IMAGE", "Animated images are not accepted.", 415);
  }
  if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    throw new PalmValidationError(
      "RESOLUTION_TOO_LOW",
      `Please upload an image at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels.`,
      422,
    );
  }
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    throw new PalmValidationError(
      "RESOLUTION_TOO_HIGH",
      `Please upload an image no larger than ${MAX_DIMENSION}×${MAX_DIMENSION} pixels.`,
      422,
    );
  }

  // Re-encode to strip EXIF/GPS/XMP and normalize orientation.
  let pipeline = sharp(input, { failOn: "error" }).rotate();
  if (detected === "image/jpeg") {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  } else if (detected === "image/png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.webp({ quality: 90 });
  }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  const quality = await assessImageQuality(data, info.width, info.height);
  const checksum = createHash("sha256").update(data).digest("hex");

  return {
    buffer: data,
    mimeType: detected,
    width: info.width,
    height: info.height,
    format: info.format,
    checksum,
    quality,
    originalBytes: input.length,
  };
}
