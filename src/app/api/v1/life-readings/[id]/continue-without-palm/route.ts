import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { continueWithoutPalm } from "@/modules/life-reading/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "reading:continue-without-palm", 20);
    const { id } = await params;
    await continueWithoutPalm(id, user.id);
    return jsonOk({ id, palm: "SKIPPED" }, { status: 202 });
  });
}
