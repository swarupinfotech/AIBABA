import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "notifications:list", 120);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return jsonOk({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        readingId: notification.readingId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      })),
      unread: notifications.filter((notification) => !notification.readAt).length,
    });
  });
}

const PatchSchema = z.object({
  id: z.string().max(60).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "notifications:patch", 120);
    const body = await readJson(request, PatchSchema);
    if (!body.id && !body.all) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Choose a notification or mark all as read.", 422);
    }
    if (body.all) {
      await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    } else if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { readAt: new Date() },
      });
    }
    return jsonOk({ ok: true });
  });
}
