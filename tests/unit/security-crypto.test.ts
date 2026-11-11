import { describe, expect, it } from "vitest";
import {
  decryptField,
  encryptField,
  hmacSign,
  randomToken,
  safeEqual,
  sha256,
  signExpiringUrl,
  verifyExpiringUrl,
  verifyHmac,
} from "@/lib/security/crypto";

describe("field encryption", () => {
  it("round-trips Unicode personal data", () => {
    const plaintext = "राहुल शर्मा · 1990-05-15 · 28.6139,77.2090";
    const sealed = encryptField(plaintext);
    expect(sealed).not.toContain("राहुल");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(decryptField(sealed)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptField("same value")).not.toBe(encryptField("same value"));
  });

  it("rejects tampered or malformed payloads", () => {
    const sealed = encryptField("sensitive");
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -4) + "AAAA";
    expect(() => decryptField(parts.join("."))).toThrow();
    expect(() => decryptField("not-encrypted")).toThrow("Unsupported encrypted payload.");
  });
});

describe("hashes and tokens", () => {
  it("hashes deterministically", () => {
    expect(sha256("aibaba")).toBe(sha256("aibaba"));
    expect(sha256("aibaba")).toHaveLength(64);
    expect(sha256("aibaba")).not.toBe(sha256("Aibaba"));
  });

  it("generates unguessable tokens", () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("compares secrets without length leakage errors", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("HMAC signatures", () => {
  it("verifies an untampered signature", () => {
    const signature = hmacSign("payload");
    expect(verifyHmac("payload", signature)).toBe(true);
    expect(verifyHmac("payload!", signature)).toBe(false);
    expect(verifyHmac("payload", "forged")).toBe(false);
  });
});

describe("short-lived signed URLs", () => {
  it("accepts a valid, unexpired signature", () => {
    const { expires, sig } = signExpiringUrl("asset", "asset-1", 300);
    expect(expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifyExpiringUrl("asset", "asset-1", expires, sig)).toBe(true);
  });

  it("rejects an expired signature", () => {
    const { expires, sig } = signExpiringUrl("asset", "asset-1", -1);
    expect(verifyExpiringUrl("asset", "asset-1", expires, sig)).toBe(false);
  });

  it("binds the signature to the scope and resource id", () => {
    const { expires, sig } = signExpiringUrl("asset", "asset-1", 300);
    expect(verifyExpiringUrl("report", "asset-1", expires, sig)).toBe(false);
    expect(verifyExpiringUrl("asset", "asset-2", expires, sig)).toBe(false);
  });

  it("rejects a tampered expiry or signature", () => {
    const { expires, sig } = signExpiringUrl("report", "report-1", 300);
    expect(verifyExpiringUrl("report", "report-1", expires + 60, sig)).toBe(false);
    expect(verifyExpiringUrl("report", "report-1", expires, `${sig.slice(0, -2)}xx`)).toBe(false);
    expect(verifyExpiringUrl("report", "report-1", Number.NaN, sig)).toBe(false);
  });
});
