import { prisma } from "@/lib/database/prisma";
import { pageRole } from "@/lib/auth/page";
import { parseJson } from "@/lib/json";

export const metadata = { title: "Admin audit trail" };

interface AuditMetadata {
  [key: string]: unknown;
}

function formatMetadata(value: string | null): string {
  const parsed = parseJson<AuditMetadata | null>(value, null);
  if (!parsed) return "—";
  const entries = Object.entries(parsed).map(([key, item]) => {
    const rendered = Array.isArray(item) ? item.join(", ") : String(item);
    return `${key}=${rendered.length > 60 ? `${rendered.slice(0, 60)}…` : rendered}`;
  });
  return entries.join(" · ") || "—";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; actor?: string }>;
}) {
  await pageRole("/admin/audit", "OPERATIONS_ADMIN");
  const { q = "", actor = "" } = await searchParams;
  const action = q.trim();
  const actorId = actor.trim();

  const entries = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: { contains: action } } : {}),
      ...(actorId ? { actorUserId: { contains: actorId } } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 200,
    select: {
      id: true,
      actorUserId: true,
      action: true,
      resourceType: true,
      resourceId: true,
      safeMetadata: true,
      timestamp: true,
    },
  });

  return (
    <div className="stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#10152b]">Audit trail</h2>
          <p className="mt-1 text-[0.78rem] text-[#6b6785]">
            Append-only. Metadata excludes reading content, birth details, images and secrets.
          </p>
        </div>
        <form className="flex flex-wrap gap-2" action="/admin/audit">
          <input
            className="input w-48"
            name="q"
            defaultValue={q}
            placeholder="Filter action"
            aria-label="Filter by action"
          />
          <input
            className="input w-44"
            name="actor"
            defaultValue={actor}
            placeholder="Actor user id"
            aria-label="Filter by actor id"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Filter
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[0.78rem]">
          <thead className="border-b border-[var(--line)] bg-[rgba(103,70,200,.04)] text-[0.66rem] uppercase tracking-[0.08em] text-[#8a86a0]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#8a86a0]">
                  No audit events match these filters.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-[var(--line)] align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-[0.68rem] text-[#8a86a0]">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="badge badge-muted font-mono text-[0.62rem]">{entry.action}</span>
                </td>
                <td className="px-4 py-3 text-[0.7rem] text-[#5b5775]">
                  {entry.resourceType}
                  {entry.resourceId ? (
                    <span className="block font-mono text-[0.62rem] text-[#a29fb3]">{entry.resourceId}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-[0.62rem] text-[#8a86a0]">
                  {entry.actorUserId ? entry.actorUserId.slice(0, 12) : "system"}
                </td>
                <td className="px-4 py-3 text-[0.68rem] leading-relaxed text-[#6b6785]">
                  {formatMetadata(entry.safeMetadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[0.7rem] text-[#8a86a0]">Showing the 200 most recent events.</p>
    </div>
  );
}
