import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { completeUpload } from "@/modules/uploads/service";
import { MAX_FILE_BYTES } from "@/services/image-analysis/validate";

export async function POST(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "uploads:complete", 30);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new AppError(ERROR_CODES.UNSUPPORTED_MEDIA, "Expected a multipart upload.", 415);
    }
    const form = await request.formData();
    const assetId = String(form.get("assetId") ?? "");
    const expires = Number(form.get("expires") ?? 0);
    const token = String(form.get("token") ?? "");
    const file = form.get("file");
    if (!assetId || !expires || !token) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, "The upload reference is incomplete.", 422);
    }
    if (file !== null && !(file instanceof File)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Choose an image to upload.", 422);
    }
    if (file instanceof File && file.size > MAX_FILE_BYTES) {
      throw new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, "Palm photographs must be 8 MB or smaller.", 413);
    }

    const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : undefined;
    const result = await completeUpload({
      assetId,
      userId: user.id,
      expires,
      token,
      fileBuffer: buffer,
      filename: file instanceof File ? file.name : undefined,
    });
    return jsonOk(result, { status: 201 });
  });
}
