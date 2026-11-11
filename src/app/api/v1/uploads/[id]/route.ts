import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { deleteAsset } from "@/modules/uploads/service";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "uploads:delete", 40);
    const { id } = await params;
    await deleteAsset(id, user.id);
    return jsonOk({ id, status: "DELETED" });
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "uploads:get", 120);
    const { id } = await params;
    const asset = await prisma.uploadedAsset.findUnique({ where: { id } });
    if (!asset || asset.userId !== user.id || asset.processingStatus === "DELETED") {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Image not found.", 404);
    }
    return jsonOk({
      id: asset.id,
      assetType: asset.assetType,
      status: asset.processingStatus,
      width: asset.imageWidth,
      height: asset.imageHeight,
      fileSize: asset.fileSize,
    });
  });
}
