import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { audit } from "@/lib/audit";

const SHARE_TTL_DAYS = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:share", 20);
    const { id } = await params;

    const reading = await prisma.completeReading.findUnique({
      where: { id },
      include: { reports: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!reading || reading.userId !== user.id || reading.status === "DELETED") {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
    }
    if (!reading.reports[0]) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "Your report is not ready to share yet.", 409);
    }

    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const share = await prisma.reportShare.create({
      data: {
        userId: user.id,
        readingId: id,
        reportId: reading.reports[0].id,
        tokenHash: sha256(token),
        scope: "REPORT_VIEW",
        expiresAt,
      },
    });
    await audit({
      actorUserId: user.id,
      action: "REPORT_SHARE_CREATED",
      resourceType: "ReportShare",
      resourceId: share.id,
      metadata: { readingId: id, expiresAt: expiresAt.toISOString() },
    });

    return jsonOk(
      {
        id: share.id,
        url: `/share/${token}`,
        expiresAt: expiresAt.toISOString(),
        scope: share.scope,
      },
      { status: 201 },
    );
  });
}
