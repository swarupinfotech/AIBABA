import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";

export async function GET(request: Request) {
  return runApi(null, async () => {
    await requireRole("SUPPORT");
    limit(request, "admin:users", 60);
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const users = await prisma.user.findMany({
      where: query
        ? { OR: [{ email: { contains: query } }, { name: { contains: query } }] }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        _count: { select: { readings: true } },
      },
    });
    return jsonOk({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt.toISOString(),
        readingCount: user._count.readings,
      })),
    });
  });
}
