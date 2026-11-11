import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { summaryView } from "@/modules/life-reading/views";
import { runDueJobs } from "@/jobs/runner";

type Params = { params: Promise<{ id: string }> };

/**
 * Advances queued work for a single reading. The dedicated worker
 * (`npm run worker`) is the production path; this endpoint lets the browser
 * drive the same idempotent queue during local development and demos.
 */
export async function POST(request: Request, { params }: Params) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:tick", 120);
    const { id } = await params;
    await getReadingOrThrow(id, user.id);
    const ran = await runDueJobs({ readingId: id, limit: 2 });
    const reading = await getReadingOrThrow(id, user.id);
    return jsonOk({ ran, reading: summaryView(reading) });
  });
}
