import { z } from "zod";

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  CONSENT_REQUIRED: "CONSENT_REQUIRED",
  INVALID_STATE: "INVALID_STATE",
  UNSUPPORTED_MEDIA: "UNSUPPORTED_MEDIA",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { ...init, status: init?.status ?? 200 });
}

export function jsonError(
  code: ErrorCode,
  message: string,
  status = 400,
  details?: unknown,
): Response {
  return Response.json({ error: { code, message, details } }, { status });
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof AppError) {
    return jsonError(error.code, error.message, error.status, error.details);
  }
  if (error instanceof z.ZodError) {
    return jsonError(ERROR_CODES.VALIDATION_ERROR, "Please check the submitted information.", 422, {
      fields: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  // Never leak stack traces or provider payloads to clients.
  console.error("[api] unhandled error", error instanceof Error ? error.message : "unknown");
  return jsonError(ERROR_CODES.INTERNAL_ERROR, "Something went wrong. Please try again.", 500);
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_MEDIA, "Expected an application/json request.", 415);
  }
  const body = await request.json().catch(() => {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Request body is not valid JSON.", 400);
  });
  return schema.parse(body);
}

/** Same-origin enforcement for cookie-authenticated mutations (CSRF defense). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser clients; SameSite cookie still applies
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Invalid request origin.", 403);
  }
  const requestHost = request.headers.get("host");
  const allowed = new Set<string>();
  if (requestHost) allowed.add(requestHost);
  try {
    allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host);
  } catch {
    /* ignore */
  }
  if (!allowed.has(originHost)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Cross-origin request blocked.", 403);
  }
}
