import { timingSafeEqual } from "node:crypto";
import { jsonError, jsonOk } from "@/lib/api/response";
import { runDueJobs } from "@/jobs/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safety net for the database-backed queue on serverless deployments, where no
 * long-running worker exists. Vercel invokes this with
 * `Authorization: Bearer $CRON_SECRET`. The user-facing processing page still
 * advances its own reading through the owner-only tick endpoint; this drains
 * anything left behind (for example a reading whose tab was closed).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return jsonError("UNAUTHENTICATED", "Invalid cron credentials.", 401);
  }
  const processed = await runDueJobs({ limit: 10 });
  return jsonOk({ processed, ranAt: new Date().toISOString() });
}
