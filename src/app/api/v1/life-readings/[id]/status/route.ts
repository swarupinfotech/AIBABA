import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { summaryView } from "@/modules/life-reading/views";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "reading:status", 600);
    const { id } = await params;
    const reading = await getReadingOrThrow(id, user.id);
    return jsonOk({
      reading: summaryView(reading),
      components: {
        palm: reading.palmAnalysis?.status ?? null,
        numerology: reading.numerology?.status ?? null,
        astrology: reading.astrology?.calculationStatus ?? null,
      },
      jobs: reading.jobs.map((job) => ({
        id: job.id,
        type: job.jobType,
        status: job.status,
        attempt: job.attemptCount,
        maxAttempts: job.maxAttempts,
        errorCode: job.errorCode,
      })),
    });
  });
}
