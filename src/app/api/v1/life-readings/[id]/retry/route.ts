import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { retryReadingJobs } from "@/jobs/runner";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:retry", 10);
    const { id } = await params;
    await retryReadingJobs(id, user.id);
    return jsonOk({ id, status: "PROCESSING" }, { status: 202 });
  });
}
