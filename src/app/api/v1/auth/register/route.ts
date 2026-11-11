import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { runApi, limit } from "@/lib/api/guard";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(10).max(200),
  acceptTerms: z.literal(true),
});

export async function POST(request: Request) {
  return runApi(request, async () => {
    limit(request, "auth:register", 8, 15 * 60_000);
    const body = await readJson(request, RegisterSchema);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(ERROR_CODES.CONFLICT, "An account with this email already exists.", 409);
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        role: "USER",
        accountStatus: "ACTIVE",
        emailVerifiedAt: null,
        profile: { create: { displayName: body.name.split(" ")[0] ?? body.name } },
      },
    });
    await createSession(user.id);
    await audit({
      actorUserId: user.id,
      action: "ACCOUNT_REGISTERED",
      resourceType: "User",
      resourceId: user.id,
    });

    return jsonOk(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      { status: 201 },
    );
  });
}
