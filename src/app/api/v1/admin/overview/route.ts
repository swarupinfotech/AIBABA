import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  return runApi(null, async () => {
    await requireRole("SUPPORT");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [users, readings, reports, failedJobs, aiUsage, recentReadings, recentAudit] = await Promise.all([
      prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
      prisma.completeReading.count({ where: { createdAt: { gte: startOfDay }, status: { not: "DELETED" } } }),
      prisma.completeLifeReport.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.backgroundJob.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),
      prisma.aIUsage.aggregate({
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.completeReading.findMany({
        where: { status: { not: "DELETED" }, createdAt: { gte: startOfDay } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, status: true, language: true, createdAt: true, completedAt: true, selectedModules: true },
      }),
      prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 10 }),
    ]);

    return jsonOk({
      users,
      readingsToday: readings,
      reportsToday: reports,
      failedJobs,
      aiUsageThisMonth: aiUsage._sum,
      recentReadings,
      recentAudit: recentAudit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        resourceType: entry.resourceType,
        timestamp: entry.timestamp.toISOString(),
      })),
    });
  });
}
