import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";

export async function GET(request: Request) {
  return runApi(null, async () => {
    await requireRole("SUPPORT");
    limit(request, "admin:jobs", 60);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const jobs = await prisma.backgroundJob.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        readingId: true,
        jobType: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        errorCode: true,
        lastError: true,
        createdAt: true,
        completedAt: true,
      },
    });
    return jsonOk({ jobs });
  });
}
