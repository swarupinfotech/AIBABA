import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

export interface StorageService {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Short-lived URL when the backend supports it (S3). Local storage is served via the app's signed route. */
  signedUrl?(key: string, ttlSeconds: number): Promise<string>;
  signedUploadUrl?(key: string, contentType: string, ttlSeconds: number): Promise<string>;
}

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

export function assertSafeStorageKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.startsWith("/")) {
    throw new Error("Invalid storage key");
  }
}

function localStorageRoot(): string {
  // `STORAGE_DIR` is a deployment-time mount, so the target is intentionally
  // outside the bundle. Tell Turbopack not to trace the whole project because
  // of this dynamic path.
  return path.resolve(
    /* turbopackIgnore: true */ process.env.STORAGE_DIR ?? path.join(process.cwd(), ".data", "uploads"),
  );
}

export class LocalStorageService implements StorageService {
  private resolve(key: string): string {
    assertSafeStorageKey(key);
    const root = localStorageRoot();
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Private S3-compatible storage. Credentials stay server-side. Objects are
 * never public; downloads use short-lived presigned URLs or the signed app route.
 */
export class S3StorageService implements StorageService {
  private async client() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: env.STORAGE_REGION || "auto",
      endpoint: env.STORAGE_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
      forcePathStyle: Boolean(env.STORAGE_ENDPOINT),
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertSafeStorageKey(key);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    assertSafeStorageKey(key);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    const result = await client.send(new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error("Object not found");
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key);
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.get(key);
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    assertSafeStorageKey(key);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }

  async signedUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<string> {
    assertSafeStorageKey(key);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
      { expiresIn: ttlSeconds },
    );
  }
}

let cached: StorageService | null = null;

export function storage(): StorageService {
  if (!cached) {
    cached = env.STORAGE_PROVIDER === "s3" ? new S3StorageService() : new LocalStorageService();
  }
  return cached;
}
