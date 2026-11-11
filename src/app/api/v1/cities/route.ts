import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";

export async function GET(request: Request) {
  return runApi(null, async () => {
    limit(request, "cities", 180);
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const cities = await prisma.city.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { region: { contains: query } },
              { country: { contains: query } },
            ],
          }
        : undefined,
      orderBy: [{ country: "asc" }, { name: "asc" }],
      take: 20,
      select: {
        id: true,
        name: true,
        region: true,
        country: true,
        latitude: true,
        longitude: true,
        timezone: true,
      },
    });
    return jsonOk({ cities });
  });
}
