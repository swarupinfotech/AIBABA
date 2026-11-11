import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { RetryJobButton } from "@/components/admin/RetryJobButton";

export const metadata = { title: "Admin jobs" };

const STATUSES = ["", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "DEAD", "CANCELLED"] as const;
const RETRYABLE = ["FAILED", "DEAD", "CANCELLED"];

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const { status = "", type = "" } = await searchParams;
  const [jobs, jobTypes] = await Promise.all([
    prisma.backgroundJob.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { jobType: type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        readingId: true,
        jobType: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        errorCode: true,
        lastError: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.backgroundJob.findMany({ distinct: ["jobType"], select: { jobType: true }, orderBy: { jobType: "asc" } }),
  ]);

  const types = jobTypes.map((job) => job.jobType);
  const counts = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#10152b]">Background jobs</h2>
          <p className="mt-1 text-[0.78rem] text-[#6b6785]">
            Idempotent queue. Retrying requeues a job without duplicating published output.
          </p>
        </div>
        <form className="flex flex-wrap gap-2" action="/admin/jobs">
          <select className="select w-40" name="status" defaultValue={status} aria-label="Filter by status">
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option || "All statuses"}
              </option>
            ))}
          </select>
          <select className="select w-44" name="type" defaultValue={type} aria-label="Filter by job type">
            <option value="">All job types</option>
            {types.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filter
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 text-[0.68rem] text-[#6b6785]">
        {Object.entries(counts).map(([key, value]) => (
          <span key={key} className="badge badge-muted">
            {key}: {value}
          </span>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[0.78rem]">
          <thead className="border-b border-[var(--line)] bg-[rgba(103,70,200,.04)] text-[0.66rem] uppercase tracking-[0.08em] text-[#8a86a0]">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Reading</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#8a86a0]">
                  No jobs match these filters.
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#2f2c47]">{job.jobType}</p>
                  <p className="font-mono text-[0.64rem] text-[#8a86a0]">{job.id.slice(0, 10)}</p>
                </td>
                <td className="px-4 py-3">
                  {job.readingId ? (
                    <Link
                      href={`/admin/readings/${job.readingId}`}
                      className="font-mono text-[0.7rem] text-[#6746c8]"
                    >
                      {job.readingId.slice(0, 10)}
                    </Link>
                  ) : (
                    <span className="text-[0.7rem] text-[#8a86a0]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      job.status === "SUCCEEDED"
                        ? "badge-success"
                        : job.status === "FAILED" || job.status === "DEAD"
                          ? "badge-danger"
                          : job.status === "RUNNING"
                            ? "badge-warn"
                            : "badge-muted"
                    }`}
                  >
                    {job.status}
                  </span>
                  {job.errorCode && <p className="mt-1 text-[0.64rem] text-[#9a3223]">{job.errorCode}</p>}
                </td>
                <td className="px-4 py-3 text-[#5b5775]">
                  {job.attemptCount}/{job.maxAttempts}
                </td>
                <td className="px-4 py-3 text-[0.7rem] text-[#8a86a0]">
                  {new Date(job.createdAt).toLocaleString()}
                  {job.completedAt ? (
                    <span className="block text-[0.64rem]">done {new Date(job.completedAt).toLocaleTimeString()}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {RETRYABLE.includes(job.status) && <RetryJobButton jobId={job.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[0.7rem] leading-relaxed text-[#8a86a0]">
        Retries are recorded in the audit trail. Last-error text may be truncated and never contains reading content.
      </p>
    </div>
  );
}
