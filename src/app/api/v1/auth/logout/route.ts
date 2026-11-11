import { jsonOk } from "@/lib/api/response";
import { runApi } from "@/lib/api/guard";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  return runApi(request, async () => {
    const user = await getSessionUser();
    await destroySession();
    if (user) {
      await audit({ actorUserId: user.id, action: "ACCOUNT_LOGOUT", resourceType: "User", resourceId: user.id });
    }
    return jsonOk({ ok: true });
  });
}
