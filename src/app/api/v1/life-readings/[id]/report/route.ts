import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { latestReport } from "@/modules/life-reading/service";
import { reportView } from "@/modules/life-reading/views";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "reading:report", 120);
    const { id } = await params;
    const report = await latestReport(id, user.id);
    if (!report) return jsonOk({ report: null });
    return jsonOk({ report: reportView(report) });
  });
}
