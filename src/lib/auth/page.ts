import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { hasRole, type Role } from "@/lib/permissions/rbac";

export async function pageUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function pageRole(next: string, minimum: Role): Promise<SessionUser> {
  const user = await pageUser(next);
  if (!hasRole(user.role, minimum)) redirect("/");
  return user;
}
