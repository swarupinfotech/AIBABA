import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { readingDetailView } from "@/modules/life-reading/views";

type Params = { params: Promise<{ id: string; module: string }> };

export async function GET(request: Request, { params }: Params) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "reading:module", 240);
    const { id, module } = await params;
    if (!["palmistry", "numerology", "astrology"].includes(module)) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Unknown reading module.", 404);
    }
    const reading = await getReadingOrThrow(id, user.id);
    const detail = await readingDetailView(reading, user.id);
    const key = module === "palmistry" ? "palm" : module === "numerology" ? "numerology" : "astrology";
    const component = detail.components[key];
    if (!component) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "This module is not part of the reading.", 404);
    }
    return jsonOk({ readingId: id, module: module.toUpperCase(), status: detail.status, component });
  });
}
