import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/database/prisma";
import { env, isProduction } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { hasRole, type Role } from "@/lib/permissions/rbac";

export const SESSION_COOKIE = "aibaba_session";
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  preferredLanguage: string;
  displayName: string | null;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return { token, expiresAt };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

/** Request-scoped cached session lookup. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });
  if (!session) return null;
  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.accountStatus !== "ACTIVE") return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    preferredLanguage: session.user.preferredLanguage,
    displayName: session.user.profile?.displayName ?? null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue.", 401);
  }
  return user;
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, minimum)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "You do not have permission to do that.", 403);
  }
  return user;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export const sessionConfig = { ttlDays: SESSION_TTL_DAYS, appUrl: env.NEXT_PUBLIC_APP_URL };
