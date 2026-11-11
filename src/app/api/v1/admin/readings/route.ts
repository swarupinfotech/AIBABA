import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";
import { parseJson } from "@/lib/json";

export async function GET(request: Request) {
  return runApi(null, async () => {
    await requireRole("SUPPORT");
    limit(request, "admin:readings", 60);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const query = (url.searchParams.get("q") ?? "").trim();

    const readings = await prisma.completeReading.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query ? { user: { email: { contains: query } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        language: true,
        createdAt: true,
        completedAt: true,
        errorCode: true,
        selectedModules: true,
        reportVersion: true,
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { jobs: true, reports: true } },
      },
    });

    return jsonOk({
      readings: readings.map((reading) => ({
        id: reading.id,
        status: reading.status,
        language: reading.language,
        modules: parseJson<string[]>(reading.selectedModules, []),
        createdAt: reading.createdAt.toISOString(),
        completedAt: reading.completedAt?.toISOString() ?? null,
        errorCode: reading.errorCode,
        reportVersion: reading.reportVersion,
        user: {
          id: reading.user.id,
          name: reading.user.name,
          email: `${reading.user.email.slice(0, 2)}***@${reading.user.email.split("@")[1] ?? ""}`,
        },
        jobCount: reading._count.jobs,
        reportCount: reading._count.reports,
      })),
    });
  });
}
