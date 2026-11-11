import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { audit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:cancel", 20);
    const { id } = await params;
    const reading = await getReadingOrThrow(id, user.id);
    if (["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "DELETED", "CANCELLED"].includes(reading.status)) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "This reading cannot be cancelled.", 409);
    }
    await prisma.$transaction([
      prisma.backgroundJob.updateMany({
        where: { readingId: id, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "CANCELLED", lockedAt: null },
      }),
      prisma.completeReading.update({ where: { id }, data: { status: "CANCELLED", errorCode: "USER_CANCELLED" } }),
    ]);
    await audit({
      actorUserId: user.id,
      action: "READING_CANCELLED",
      resourceType: "CompleteReading",
      resourceId: id,
    });
    return jsonOk({ id, status: "CANCELLED" });
  });
}
