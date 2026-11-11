import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { runApi } from "@/lib/api/guard";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  return runApi(null, async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ user: null });
    const [profile, unread] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: session.id } }),
      prisma.notification.count({ where: { userId: session.id, readAt: null } }),
    ]);
    return jsonOk({
      user: session,
      profile: profile
        ? { displayName: profile.displayName, country: profile.country, timezone: profile.timezone }
        : null,
      unreadNotifications: unread,
    });
  });
}
