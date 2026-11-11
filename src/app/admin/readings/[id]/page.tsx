import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { audit } from "@/lib/audit";
import { pageRole } from "@/lib/auth/page";
import { isExpired } from "@/lib/datetime";
import { RetryJobButton } from "@/components/admin/RetryJobButton";

export const metadata = { title: "Admin reading detail" };

export default async function AdminReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageRole("/admin/readings", "SUPPORT");
  const { id } = await params;
  const reading = await prisma.completeReading.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      language: true,
      createdAt: true,
      submittedAt: true,
      completedAt: true,
      errorCode: true,
      selectedModules: true,
      reportVersion: true,
      user: { select: { id: true, name: true, email: true, accountStatus: true } },
      palmAnalysis: { select: { status: true, errorCode: true } },
      numerology: { select: { status: true, errorCode: true } },
      astrology: { select: { calculationStatus: true, errorCode: true } },
      jobs: {
        select: { id: true, jobType: true, status: true, attemptCount: true, maxAttempts: true, errorCode: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      reports: { select: { id: true, version: true, status: true, createdAt: true, aiModel: true } },
      shares: { select: { id: true, expiresAt: true, revokedAt: true, viewCount: true } },
    },
  });
  if (!reading) notFound();

  await audit({
    actorUserId: admin.id,
    action: "ADMIN_READING_VIEWED",
    resourceType: "CompleteReading",
    resourceId: id,
    metadata: { status: reading.status },
  });

  return (
    <div className="stack">
      <Link href="/admin/readings" className="text-[0.74rem] font-medium text-[#6b6785]">
        ← All readings
      </Link>

      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.72rem] text-[#8a86a0]">{reading.id}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#10152b]">
              {reading.user.name} <span className="text-[0.8rem] font-normal text-[#8a86a0]">({reading.user.email})</span>
            </h2>
            <p className="mt-1 text-[0.76rem] text-[#6b6785]">
              {reading.language} · created {new Date(reading.createdAt).toLocaleString()}
              {reading.completedAt ? ` · completed ${new Date(reading.completedAt).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`badge ${
                reading.status === "COMPLETED"
                  ? "badge-success"
                  : reading.status === "PARTIALLY_COMPLETED"
                    ? "badge-warn"
                    : reading.status === "FAILED"
                      ? "badge-danger"
                      : "badge-muted"
              }`}
            >
              {reading.status}
            </span>
            {reading.errorCode && <p className="mt-1 text-[0.68rem] text-[#9a3223]">{reading.errorCode}</p>}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Palmistry", reading.palmAnalysis?.status ?? "not selected", reading.palmAnalysis?.errorCode],
            ["Numerology", reading.numerology?.status ?? "not selected", reading.numerology?.errorCode],
            ["Astrology", reading.astrology?.calculationStatus ?? "not selected", reading.astrology?.errorCode],
          ].map(([label, status, code]) => (
            <div key={String(label)} className="rounded-xl border border-[var(--line)] px-3 py-2.5">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#8a86a0]">{label}</p>
              <p className="mt-1 text-[0.8rem] font-medium text-[#2f2c47]">{status}</p>
              {code && <p className="text-[0.64rem] text-[#9a3223]">{code}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="text-lg font-semibold text-[#10152b]">Jobs</h3>
        <div className="mt-3 divide-y divide-[var(--line)]">
          {reading.jobs.length === 0 && <p className="py-3 text-[0.78rem] text-[#8a86a0]">No jobs.</p>}
          {reading.jobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-[0.8rem] font-medium text-[#2f2c47]">{job.jobType}</p>
                <p className="mt-0.5 text-[0.66rem] text-[#8a86a0]">
                  {job.status} · attempt {job.attemptCount}/{job.maxAttempts}
                  {job.errorCode ? ` · ${job.errorCode}` : ""} · {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              {["FAILED", "DEAD", "CANCELLED"].includes(job.status) && <RetryJobButton jobId={job.id} />}
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="text-lg font-semibold text-[#10152b]">Reports & shares</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#8a86a0]">Reports</p>
            {reading.reports.length === 0 ? (
              <p className="mt-2 text-[0.76rem] text-[#8a86a0]">No published reports.</p>
            ) : (
              reading.reports.map((report) => (
                <p key={report.id} className="mt-2 text-[0.76rem] text-[#4b4866]">
                  v{report.version} · {report.status} · {new Date(report.createdAt).toLocaleString()}
                </p>
              ))
            )}
          </div>
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#8a86a0]">Share links</p>
            {reading.shares.length === 0 ? (
              <p className="mt-2 text-[0.76rem] text-[#8a86a0]">No share links.</p>
            ) : (
              reading.shares.map((share) => (
                <p key={share.id} className="mt-2 text-[0.76rem] text-[#4b4866]">
                  {share.revokedAt ? "revoked" : isExpired(share.expiresAt) ? "expired" : "active"} ·{" "}
                  {share.viewCount} views
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="text-[0.7rem] leading-relaxed text-[#8a86a0]">
        Report content, birth details and palm images are intentionally excluded from this admin view.
        Support access to content should be handled through a separate, user-authorised process.
      </p>
    </div>
  );
}
