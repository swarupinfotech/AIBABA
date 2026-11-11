import { z } from "zod";
import { jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { presignUpload } from "@/modules/uploads/service";

const PresignSchema = z.object({
  readingId: z.string().min(1).max(60),
  assetType: z.enum(["PALM_LEFT", "PALM_RIGHT"]),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSize: z.number().int().positive().max(8 * 1024 * 1024),
});

export async function POST(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "uploads:presign", 30);
    const body = await readJson(request, PresignSchema);
    const result = await presignUpload({ userId: user.id, ...body });
    return jsonOk(result, { status: 201 });
  });
}
