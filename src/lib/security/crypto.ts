import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

/**
 * Derives a stable 32-byte encryption key. In production, provide a dedicated
 * DATA_ENCRYPTION_KEY (base64, 32 bytes) backed by a managed secrets store.
 */
function encryptionKey(): Buffer {
  if (env.DATA_ENCRYPTION_KEY) {
    const raw = Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");
    if (raw.length === 32) return raw;
    if (env.DATA_ENCRYPTION_KEY.length >= 32) {
      return createHash("sha256").update(env.DATA_ENCRYPTION_KEY).digest();
    }
  }
  // Key separation from the session secret.
  return createHash("sha256").update(`aibaba-field-encryption:${env.AUTH_SECRET}`).digest();
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptField(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unsupported encrypted payload.");
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmacSign(payload: string, secret = env.AUTH_SECRET): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyHmac(payload: string, signature: string, secret = env.AUTH_SECRET): boolean {
  return safeEqual(hmacSign(payload, secret), signature);
}

/** Signs a short-lived URL payload: `<scope>:<id>:<expiresUnix>`. */
export function signExpiringUrl(scope: string, id: string, ttlSeconds = 300): { expires: number; sig: string } {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${scope}:${id}:${expires}`;
  return { expires, sig: hmacSign(payload) };
}

export function verifyExpiringUrl(scope: string, id: string, expires: number, sig: string): boolean {
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  return verifyHmac(`${scope}:${id}:${expires}`, sig);
}
