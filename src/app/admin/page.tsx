import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { providerStatus } from "@/services/ai";
import { pdfAvailable } from "@/services/pdf";

export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [users, readingsToday, reportsToday, failedJobs, queuedJobs, aiUsage, recentReadings, recentAudit, ai, pdf] =
    await Promise.all([
      prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
      prisma.completeReading.count({ where: { createdAt: { gte: startOfDay }, status: { not: "DELETED" } } }),
      prisma.completeLifeReport.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.backgroundJob.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),
      prisma.backgroundJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
      prisma.aIUsage.aggregate({
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.completeReading.findMany({
        where: { status: { not: "DELETED" } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, status: true, language: true, createdAt: true, selectedModules: true },
      }),
      prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 8 }),
      providerStatus(),
      pdfAvailable(),
    ]);

  const metrics = [
    { label: "Active users", value: users, note: "Accounts in good standing" },
    { label: "Readings today", value: readingsToday, note: "Excludes deleted tombstones" },
    { label: "Reports today", value: reportsToday, note: "Published versions" },
    { label: "Queued / running", value: queuedJobs, note: "Background work" },
    { label: "Terminal failures", value: failedJobs, note: "Retry from Jobs" },
    { label: "AI spend this month", value: `$${(aiUsage._sum.costUsd ?? 0).toFixed(4)}`, note: "Recorded usage only" },
  ];

  return (
    <div className="stack">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="card p-5">
            <p className="text-[0.64rem] font-bold uppercase tracking-[0.14em] text-[#8a86a0]">{metric.label}</p>
            <p className="mt-2 font-serif text-3xl text-[#10152b]">{metric.value}</p>
            <p className="mt-1 text-[0.7rem] text-[#8a86a0]">{metric.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#10152b]">Provider health</h2>
            <span className={`badge ${ai.available ? "badge-success" : "badge-danger"}`}>
              {ai.available ? "Available" : "Unavailable"}
            </span>
          </div>
          <div className="mt-4 space-y-2 text-[0.78rem] text-[#5b5775]">
            <p>
              <span className="font-semibold text-[#2f2c47]">AI provider:</span> {ai.config.provider} · {ai.config.model}
            </p>
            <p>
              <span className="font-semibold text-[#2f2c47]">Budget:</span> ${ai.config.monthlyBudgetUsd.toFixed(2)} / month
            </p>
            <p>
              <span className="font-semibold text-[#2f2c47]">PDF renderer:</span>{" "}
              {pdf ? "Chrome/Edge detected" : "Not available — set CHROMIUM_EXECUTABLE_PATH"}
            </p>
            {!ai.available && ai.reason && <p className="text-[#9a3223]">{ai.reason}</p>}
          </div>
          <Link href="/admin/settings" className="btn btn-secondary btn-sm mt-4">
            Manage settings
          </Link>
        </div>

        <div className="card card-pad">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#10152b]">Recent readings</h2>
            <Link href="/admin/readings" className="text-[0.72rem] font-semibold text-[#6746c8]">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentReadings.length === 0 && <p className="text-[0.78rem] text-[#8a86a0]">No readings yet.</p>}
            {recentReadings.map((reading) => (
              <Link
                key={reading.id}
                href={`/admin/readings/${reading.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2 hover:bg-white/70"
              >
                <span className="font-mono text-[0.7rem] text-[#4b4866]">{reading.id.slice(0, 10)}</span>
                <span className="text-[0.68rem] text-[#8a86a0]">
                  {reading.status} · {new Date(reading.createdAt).toLocaleTimeString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#10152b]">Latest audit events</h2>
          <Link href="/admin/audit" className="text-[0.72rem] font-semibold text-[#6746c8]">
            Full trail
          </Link>
        </div>
        <div className="mt-3 divide-y divide-[var(--line)]">
          {recentAudit.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="text-[0.76rem] font-medium text-[#2f2c47]">{entry.action}</span>
              <span className="text-[0.66rem] text-[#8a86a0]">
                {entry.resourceType} · {new Date(entry.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
