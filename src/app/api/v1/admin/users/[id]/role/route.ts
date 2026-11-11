import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";
import { ROLES } from "@/lib/permissions/rbac";
import { audit } from "@/lib/audit";

const BodySchema = z.object({ role: z.enum(ROLES) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const admin = await requireRole("SUPER_ADMIN");
    limit(request, "admin:user-role", 20);
    const { id } = await params;
    const body = await readJson(request, BodySchema);
    if (id === admin.id && body.role !== "SUPER_ADMIN") {
      throw new AppError(ERROR_CODES.INVALID_STATE, "You cannot remove your own super-admin access.", 409);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(ERROR_CODES.NOT_FOUND, "User not found.", 404);
    await prisma.user.update({ where: { id }, data: { role: body.role } });
    await audit({
      actorUserId: admin.id,
      action: "ADMIN_USER_ROLE_CHANGED",
      resourceType: "User",
      resourceId: id,
      metadata: { from: user.role, to: body.role },
    });
    return jsonOk({ id, role: body.role });
  });
}
