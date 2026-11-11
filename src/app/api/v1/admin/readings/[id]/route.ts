import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(null, async () => {
    const admin = await requireRole("SUPPORT");
    const { id } = await params;
    const reading = await prisma.completeReading.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        language: true,
        createdAt: true,
        submittedAt: true,
        completedAt: true,
        errorCode: true,
        selectedModules: true,
        reportVersion: true,
        user: { select: { id: true, name: true, email: true, accountStatus: true } },
        palmAnalysis: { select: { status: true, errorCode: true } },
        numerology: { select: { status: true, errorCode: true } },
        astrology: { select: { calculationStatus: true, errorCode: true } },
        jobs: {
          select: { id: true, jobType: true, status: true, attemptCount: true, maxAttempts: true, errorCode: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        reports: { select: { id: true, version: true, status: true, createdAt: true, aiModel: true } },
        shares: { select: { id: true, expiresAt: true, revokedAt: true, viewCount: true } },
      },
    });
    if (!reading) throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);

    await audit({
      actorUserId: admin.id,
      action: "ADMIN_READING_VIEWED",
      resourceType: "CompleteReading",
      resourceId: id,
      metadata: { status: reading.status },
    });

    return jsonOk({ reading });
  });
}
