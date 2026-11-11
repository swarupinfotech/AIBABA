import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { runApi } from "@/lib/api/guard";
import { sha256 } from "@/lib/security/crypto";
import { parseReport } from "@/modules/life-reading/views";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  return runApi(null, async () => {
    const { token } = await params;
    const share = await prisma.reportShare.findUnique({ where: { tokenHash: sha256(token) } });
    if (!share || share.revokedAt || share.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "This shared report link is unavailable or has expired.", 404);
    }
    if (share.scope !== "REPORT_VIEW") {
      throw new AppError(ERROR_CODES.FORBIDDEN, "This link does not allow report viewing.", 403);
    }

    const report = await prisma.completeLifeReport.findFirst({
      where: { readingId: share.readingId, userId: share.userId, ...(share.reportId ? { id: share.reportId } : {}) },
      orderBy: { version: "desc" },
    });
    if (!report) throw new AppError(ERROR_CODES.NOT_FOUND, "The shared report is no longer available.", 404);

    await prisma.reportShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } });
    const { document } = parseReport(report);
    return jsonOk({
      document,
      version: report.version,
      expiresAt: share.expiresAt.toISOString(),
    });
  });
}
