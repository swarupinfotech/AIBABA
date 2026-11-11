import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";
import { resetJobForRetry } from "@/jobs/queue";
import { audit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return runApi(request, async () => {
    const admin = await requireRole("OPERATIONS_ADMIN");
    limit(request, "admin:job-retry", 30);
    const { id } = await params;
    const job = await prisma.backgroundJob.findUnique({ where: { id } });
    if (!job) throw new AppError(ERROR_CODES.NOT_FOUND, "Job not found.", 404);
    if (!["FAILED", "DEAD", "CANCELLED"].includes(job.status)) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "Only terminal jobs can be retried.", 409);
    }
    await resetJobForRetry(id);
    await audit({
      actorUserId: admin.id,
      action: "ADMIN_JOB_RETRIED",
      resourceType: "BackgroundJob",
      resourceId: id,
      metadata: { jobType: job.jobType },
    });
    return jsonOk({ id, status: "QUEUED" }, { status: 202 });
  });
}
