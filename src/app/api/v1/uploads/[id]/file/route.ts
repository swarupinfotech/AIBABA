import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { verifyExpiringUrl } from "@/lib/security/crypto";
import { storage } from "@/services/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(null, async () => {
    const user = await requireUser();
    const { id } = await params;
    const url = new URL(request.url);
    const expires = Number(url.searchParams.get("expires") ?? 0);
    const sig = url.searchParams.get("sig") ?? "";
    if (!verifyExpiringUrl("asset", id, expires, sig)) {
      throw new AppError(ERROR_CODES.FORBIDDEN, "This image link has expired.", 403);
    }

    const asset = await prisma.uploadedAsset.findUnique({ where: { id } });
    if (!asset || asset.userId !== user.id || asset.processingStatus === "DELETED") {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Image not found.", 404);
    }

    const buffer = await storage().get(asset.storageKey);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="palm-${asset.id}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
