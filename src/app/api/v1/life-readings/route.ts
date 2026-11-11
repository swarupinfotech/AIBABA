import { z } from "zod";
import { jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { createDraft, listReadings } from "@/modules/life-reading/service";
import { summaryView } from "@/modules/life-reading/views";

const CreateSchema = z.object({
  language: z.enum(["en", "hi"]).default("en"),
});

export async function GET(request: Request) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "readings:list", 120);
    const readings = await listReadings(user.id);
    return jsonOk({ readings: readings.map(summaryView) });
  });
}

export async function POST(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "readings:create", 30);
    const body = await readJson(request, CreateSchema);
    const reading = await createDraft(user.id, body.language);
    return jsonOk({ id: reading.id, status: reading.status, language: reading.language }, { status: 201 });
  });
}
