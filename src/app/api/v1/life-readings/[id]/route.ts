import { jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { readingDraftPatchSchema } from "@/lib/validation/reading";
import { deleteReading, getReadingOrThrow, updateDraft } from "@/modules/life-reading/service";
import { readingDetailView } from "@/modules/life-reading/views";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "reading:get", 240);
    const { id } = await params;
    const reading = await getReadingOrThrow(id, user.id);
    return jsonOk(await readingDetailView(reading, user.id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:patch", 120);
    const { id } = await params;
    const patch = await readJson(request, readingDraftPatchSchema);
    const result = await updateDraft(id, user.id, patch);
    return jsonOk(result);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:delete", 10);
    const { id } = await params;
    await deleteReading(id, user.id);
    return jsonOk({ id, status: "DELETED" });
  });
}
