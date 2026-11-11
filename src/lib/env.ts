import { z } from "zod";

const boolFromString = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32).default("dev-only-secret-9f3a1c7e5b2d4a8f6c0e1b3d5a7c9e2f"),
  DATA_ENCRYPTION_KEY: z.string().optional().default(""),
  AI_PROVIDER: z.enum(["local", "openai", "gemini"]).default("local"),
  AI_MODEL: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2500),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(5),
  ASTROLOGY_PROVIDER: z.enum(["internal", "external"]).default("internal"),
  ASTROLOGY_PROVIDER_API_KEY: z.string().optional().default(""),
  ASTROLOGY_PROVIDER_URL: z.string().optional().default(""),
  ASTROLOGY_DEFAULT_AYANAMSA: z.string().default("LAHIRI"),
  STORAGE_PROVIDER: z.enum(["local", "s3", "vercel"]).default("local"),
  // Vercel Blob. Private stores require the read/write token for server-side reads.
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),
  BLOB_ACCESS: z.enum(["public", "private"]).default("private"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_SECRET_KEY: z.string().optional().default(""),
  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_REGION: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("readings@aibaba.local"),
  CHROMIUM_EXECUTABLE_PATH: z.string().optional().default(""),
  // Vercel cron invocations send `Authorization: Bearer $CRON_SECRET`.
  CRON_SECRET: z.string().optional().default(""),
  PAYMENTS_ENABLED: boolFromString,
  PAYMENT_PROVIDER: z.string().default("razorpay"),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.parse(process.env);

if (parsed.NODE_ENV === "production") {
  const weak = [
    parsed.AUTH_SECRET === "dev-only-secret-9f3a1c7e5b2d4a8f6c0e1b3d5a7c9e2f",
    parsed.AUTH_SECRET.startsWith("change-me"),
  ];
  if (weak.some(Boolean)) {
    throw new Error("AUTH_SECRET must be replaced with a strong random value in production.");
  }
  if (parsed.DATA_ENCRYPTION_KEY && parsed.DATA_ENCRYPTION_KEY.length < 32) {
    throw new Error("DATA_ENCRYPTION_KEY is too short.");
  }
}

export const env = parsed;
export const isProduction = parsed.NODE_ENV === "production";
export const isTest = parsed.NODE_ENV === "test";
