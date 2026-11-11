import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { parseJson } from "@/lib/json";

export const metadata = { title: "Admin readings" };

const STATUSES = ["", "QUEUED", "PROCESSING", "COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED", "DELETED"];

export default async function AdminReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "", q = "" } = await searchParams;
  const readings = await prisma.completeReading.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { user: { email: { contains: q.trim() } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      createdAt: true,
      errorCode: true,
      selectedModules: true,
      reportVersion: true,
      user: { select: { email: true, name: true } },
      _count: { select: { jobs: true } },
    },
  });

  return (
    <div className="stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#10152b]">Readings</h2>
          <p className="mt-1 text-[0.78rem] text-[#6b6785]">Metadata only. Opening a reading writes an audit event.</p>
        </div>
        <form className="flex flex-wrap gap-2" action="/admin/readings">
          <input
            className="input w-52"
            name="q"
            defaultValue={q}
            placeholder="Search account email"
            aria-label="Search account email"
          />
          <select className="select w-44" name="status" defaultValue={status} aria-label="Filter by status">
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option || "All statuses"}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filter
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[0.78rem]">
          <thead className="border-b border-[var(--line)] bg-[rgba(103,70,200,.04)] text-[0.66rem] uppercase tracking-[0.08em] text-[#8a86a0]">
            <tr>
              <th className="px-4 py-3">Reading</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Methods</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#8a86a0]">
                  No readings match these filters.
                </td>
              </tr>
            )}
            {readings.map((reading) => (
              <tr key={reading.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3 font-mono text-[0.7rem] text-[#4b4866]">{reading.id.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-[#2f2c47]">{reading.user.name}</p>
                  <p className="text-[0.66rem] text-[#8a86a0]">{reading.user.email}</p>
                </td>
                <td className="px-4 py-3 text-[#5b5775]">{parseJson<string[]>(reading.selectedModules, []).join(", ") || "—"}</td>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3 text-[0.7rem] text-[#8a86a0]">{new Date(reading.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/readings/${reading.id}`} className="text-[0.72rem] font-semibold text-[#6746c8]">
                    Inspect
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
