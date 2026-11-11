import { assertSameOrigin, handleRouteError } from "@/lib/api/response";
import { enforceRateLimit, clientKey } from "@/lib/rate-limit";

/**
 * Wraps a route handler with consistent error handling. Mutating routes also
 * pass `request` so the same-origin cookie guard runs before any work begins.
 */
export async function runApi(
  request: Request | null,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    if (request) assertSameOrigin(request);
    return await handler();
  } catch (error) {
    return handleRouteError(error);
  }
}

export function limit(request: Request, scope: string, maximum: number, windowMs = 60_000): void {
  enforceRateLimit(clientKey(request, scope), maximum, windowMs);
}
