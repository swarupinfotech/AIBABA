import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";

export async function GET(request: Request) {
  return runApi(null, async () => {
    await requireRole("OPERATIONS_ADMIN");
    limit(request, "admin:audit", 60);
    const entries = await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 100 });
    return jsonOk({
      entries: entries.map((entry) => ({
        id: entry.id,
        actorUserId: entry.actorUserId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.safeMetadata,
        timestamp: entry.timestamp.toISOString(),
      })),
    });
  });
}
