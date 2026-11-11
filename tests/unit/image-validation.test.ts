import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  PalmValidationError,
  assessImageQuality,
  detectImageMime,
  extensionOf,
  validateAndProcessPalmImage,
} from "@/services/image-analysis/validate";

async function noisyPng(width = 640, height = 640): Promise<Buffer> {
  // A neutral checkerboard is deterministic, high-contrast and sharp, but
  // contains no skin-tone pixels — so only the framing hint should fire.
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 30 : 225;
      const i = (y * width + x) * 3;
      raw[i] = value;
      raw[i + 1] = value;
      raw[i + 2] = value;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function blankPng(width = 640, height = 640): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
}

function expectCode(promise: Promise<unknown>, code: string, status?: number) {
  return promise.then(
    () => {
      throw new Error(`Expected PalmValidationError ${code}`);
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(PalmValidationError);
      const palmError = error as PalmValidationError;
      expect(palmError.code).toBe(code);
      if (status !== undefined) expect(palmError.status).toBe(status);
    },
  );
}

describe("file signature detection", () => {
  it("detects PNG, JPEG and WebP from content, not the filename", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
      .jpeg()
      .toBuffer();
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
      .webp()
      .toBuffer();

    expect(detectImageMime(png)).toBe("image/png");
    expect(detectImageMime(jpeg)).toBe("image/jpeg");
    expect(detectImageMime(webp)).toBe("image/webp");
    expect(detectImageMime(Buffer.from("not an image at all"))).toBeNull();
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });

  it("reads lowercased extensions", () => {
    expect(extensionOf("Palm.JPG")).toBe(".jpg");
    expect(extensionOf("hand.webp")).toBe(".webp");
    expect(extensionOf("no-extension")).toBe("");
  });
});

describe("upload validation", () => {
  it("rejects empty files", async () => {
    await expectCode(
      validateAndProcessPalmImage(Buffer.alloc(0), "image/png", "palm.png"),
      "EMPTY_FILE",
      400,
    );
  });

  it("rejects files above the size limit before decoding", async () => {
    const oversized = Buffer.alloc(MAX_FILE_BYTES + 1, 0);
    await expectCode(
      validateAndProcessPalmImage(oversized, "image/jpeg", "palm.jpg"),
      "FILE_TOO_LARGE",
      413,
    );
  });

  it("rejects unsupported extensions and declared MIME types", async () => {
    const png = await blankPng(32, 32);
    await expectCode(validateAndProcessPalmImage(png, "image/png", "palm.gif"), "BAD_EXTENSION", 415);
    await expectCode(validateAndProcessPalmImage(png, "image/gif", "palm.png"), "UNSUPPORTED_TYPE", 415);
    await expectCode(validateAndProcessPalmImage(png, "image/heic", "palm.heic"), "BAD_EXTENSION", 415);
  });

  it("rejects a file whose contents do not match the declared type", async () => {
    const png = await blankPng(32, 32);
    await expectCode(validateAndProcessPalmImage(png, "image/jpeg", "palm.jpg"), "MIME_MISMATCH", 415);
  });

  it("rejects bytes with no recognised signature", async () => {
    await expectCode(
      validateAndProcessPalmImage(Buffer.from("GIF89a not really"), "image/png", "palm.png"),
      "INVALID_SIGNATURE",
      415,
    );
  });

  it("rejects images below the minimum dimensions", async () => {
    const tiny = await blankPng(120, 120);
    await expectCode(validateAndProcessPalmImage(tiny, "image/png", "palm.png"), "RESOLUTION_TOO_LOW", 422);
  });

  it("accepts a structurally valid image and re-encodes it", async () => {
    const input = await noisyPng();
    const result = await validateAndProcessPalmImage(input, "image/png", "palm.png");

    expect(result.mimeType).toBe("image/png");
    expect(result.width).toBe(640);
    expect(result.height).toBe(640);
    expect(result.originalBytes).toBe(input.length);
    expect(result.checksum).toBe(createHash("sha256").update(result.buffer).digest("hex"));
    expect(result.quality.measuredAt).toBeTruthy();
    expect(result.quality.score).toBeGreaterThan(0);
    // The re-encoded buffer must not be byte-identical to the raw upload.
    expect(result.buffer.equals(input)).toBe(false);
  });

  it("stores no EXIF metadata after re-encoding", async () => {
    const withExif = await sharp({
      create: { width: 640, height: 640, channels: 3, background: { r: 120, g: 120, b: 120 } },
    })
      .withMetadata({ exif: { IFD0: { Copyright: "secret-location" } } })
      .jpeg()
      .toBuffer();
    const result = await validateAndProcessPalmImage(withExif, "image/jpeg", "palm.jpg");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.exif).toBeUndefined();
  });
});

describe("image quality assessment", () => {
  it("flags a featureless, over-bright image for re-upload", async () => {
    const blank = await blankPng(640, 640);
    const quality = await assessImageQuality(blank, 640, 640);
    expect(quality.status).toBe("NEEDS_REUPLOAD");
    expect(quality.issues.some((issue) => issue.code === "TOO_BRIGHT")).toBe(true);
    expect(quality.issues.some((issue) => issue.code === "LOW_CONTRAST")).toBe(true);
    expect(quality.score).toBeLessThan(55);
  });

  it("passes a sharp, well-exposed, high-contrast frame", async () => {
    const noisy = await noisyPng();
    const quality = await assessImageQuality(noisy, 640, 640);
    expect(quality.status).toBe("PASS");
    expect(quality.sharpness).toBeGreaterThan(45);
    expect(quality.contrast).toBeGreaterThan(26);
    // Framing hint only — it never blocks a structurally valid image.
    expect(quality.issues.some((issue) => issue.code === "LOW_HAND_COVERAGE")).toBe(true);
    expect(quality.notes.join(" ")).toMatch(/not used for identification/i);
  });

  it("flags a low-resolution measurement", async () => {
    const tiny = await noisyPng(240, 240);
    const quality = await assessImageQuality(tiny, 240, 240);
    expect(quality.issues.some((issue) => issue.code === "RESOLUTION_TOO_LOW")).toBe(true);
  });
});

describe("random data is never treated as an image", () => {
  it("rejects random bytes with a JPEG extension", async () => {
    const random = randomBytes(2048);
    await expectCode(
      validateAndProcessPalmImage(random, "image/jpeg", "palm.jpg"),
      "INVALID_SIGNATURE",
      415,
    );
  });
});
