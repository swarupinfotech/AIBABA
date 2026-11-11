import { prisma } from "@/lib/database/prisma";

/**
 * Operational health check. Returns 200 when the application can reach its
 * database and 503 otherwise. It never exposes configuration values, provider
 * credentials, personal data or error internals — suitable for load balancers,
 * uptime monitors and container orchestrators.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      {
        status: "ok",
        database: "connected",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        database: "unavailable",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
