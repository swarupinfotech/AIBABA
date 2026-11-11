import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { parseJson } from "@/lib/json";
import { ReportDocumentSchema } from "@/services/ai/schemas";
import { renderReportPdf } from "@/services/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "report:pdf", 10);
    const { id, reportId } = await params;

    const report = await prisma.completeLifeReport.findFirst({
      where: { id: reportId, readingId: id, userId: user.id },
    });
    if (!report) throw new AppError(ERROR_CODES.NOT_FOUND, "Report not found.", 404);

    const parsed = ReportDocumentSchema.safeParse(parseJson<unknown>(report.reportContent, null));
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "This report cannot be rendered as a PDF.", 409);
    }

    let pdf: Buffer;
    try {
      pdf = await renderReportPdf(parsed.data);
    } catch (error) {
      if (error instanceof Error && error.message === "PDF_RENDERER_UNAVAILABLE") {
        throw new AppError(
          ERROR_CODES.PROVIDER_UNAVAILABLE,
          "PDF rendering is not available on this server. Install Chrome/Edge or set CHROMIUM_EXECUTABLE_PATH.",
          503,
        );
      }
      throw error;
    }

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="aibaba-complete-life-reading-v${report.version}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
