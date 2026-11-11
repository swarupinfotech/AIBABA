import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { runApi, limit } from "@/lib/api/guard";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const LoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return runApi(request, async () => {
    limit(request, "auth:login", 10, 15 * 60_000);
    const body = await readJson(request, LoginSchema);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED, "Email or password is incorrect.", 401);
    }
    if (user.accountStatus !== "ACTIVE") {
      throw new AppError(ERROR_CODES.FORBIDDEN, "This account is not available. Please contact support.", 403);
    }

    await createSession(user.id);
    await audit({
      actorUserId: user.id,
      action: "ACCOUNT_LOGIN",
      resourceType: "User",
      resourceId: user.id,
    });

    return jsonOk({ id: user.id, email: user.email, name: user.name, role: user.role });
  });
}
