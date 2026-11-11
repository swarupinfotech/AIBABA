import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { destroySession, requireUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { deleteReading } from "@/modules/life-reading/service";

const DeleteSchema = z.object({
  confirm: z.literal("DELETE"),
  password: z.string().min(1).max(200),
  readingId: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "privacy:delete", 5, 60 * 60_000);
    const body = await readJson(request, DeleteSchema);

    const account = await prisma.user.findUnique({ where: { id: user.id } });
    if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED, "Your password is incorrect.", 401);
    }

    if (body.readingId) {
      await deleteReading(body.readingId, user.id);
      return jsonOk({ scope: "READING", id: body.readingId, status: "DELETED" });
    }

    const readings = await prisma.completeReading.findMany({
      where: { userId: user.id, status: { not: "DELETED" } },
      select: { id: true },
    });
    for (const reading of readings) {
      await deleteReading(reading.id, user.id);
    }

    await prisma.$transaction([
      prisma.dataDeletionRequest.create({
        data: { userId: user.id, status: "COMPLETED", processedAt: new Date(), reason: "USER_ACCOUNT_DELETION" },
      }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${user.id}@invalid.local`,
          name: "Deleted account",
          passwordHash: randomBytes(32).toString("hex"),
          accountStatus: "DELETED",
          preferredLanguage: "en",
        },
      }),
      prisma.userProfile.updateMany({
        where: { userId: user.id },
        data: { displayName: "Deleted", country: null, timezone: null },
      }),
      prisma.aIConversation.deleteMany({ where: { userId: user.id } }),
      prisma.notification.deleteMany({ where: { userId: user.id } }),
    ]);

    await destroySession();
    await audit({
      actorUserId: null,
      action: "ACCOUNT_DELETED",
      resourceType: "User",
      resourceId: user.id,
      metadata: { readingsPurged: readings.length },
    });
    return jsonOk({ scope: "ACCOUNT", status: "DELETED", readingsPurged: readings.length });
  });
}
