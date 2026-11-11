import { AppError, ERROR_CODES } from "@/lib/api/response";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter. Production deployments should swap this adapter for
 * Redis (REDIS_URL) so limits are shared across instances; the interface is
 * intentionally identical.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }
  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    throw new AppError(
      ERROR_CODES.RATE_LIMITED,
      `Too many requests. Please try again in ${result.retryAfterSeconds} seconds.`,
      429,
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }
}

export function clientKey(request: Request, scope: string, userId?: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return `${scope}:${userId ?? ip}`;
}

/** Test helper — not used in production paths. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
