import { z } from "zod";
import { jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { CONSENT_PURPOSES } from "@/lib/validation/reading";
import { submitReading } from "@/modules/life-reading/service";

const SubmitSchema = z.object({
  consents: z.partialRecord(z.enum(CONSENT_PURPOSES), z.boolean()),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:submit", 10);
    const { id } = await params;
    const body = await readJson(request, SubmitSchema);
    const result = await submitReading(id, user.id, body.consents);
    return jsonOk(result, { status: 202 });
  });
}
