"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface HistoryItem {
  id: string;
  status: string;
  modules: string[];
  createdAt: string;
  completedAt: string | null;
  reportId: string | null;
  errorCode: string | null;
}

const ACTIVE = ["DRAFT", "AWAITING_CONSENT", "QUEUED", "PROCESSING", "READY"];

function statusTone(status: string): string {
  if (status === "COMPLETED") return "badge-success";
  if (status === "PARTIALLY_COMPLETED") return "badge-warn";
  if (status === "FAILED" || status === "CANCELLED") return "badge-danger";
  if (status === "DELETED") return "badge-muted";
  return "badge-royal";
}

function hrefFor(item: HistoryItem): string {
  if (item.status === "COMPLETED" || item.status === "PARTIALLY_COMPLETED") return `/report/${item.id}`;
  if (ACTIVE.includes(item.status) && item.status !== "DRAFT" && item.status !== "AWAITING_CONSENT") {
    return `/processing/${item.id}`;
  }
  return `/onboarding?reading=${item.id}`;
}

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/life-readings/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message ?? "The reading could not be deleted.");
        return;
      }
      setConfirmId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-xl border border-[#f2c9c1] bg-[#fff4f2] px-4 py-3 text-[0.8rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="card card-hover p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${statusTone(item.status)}`}>{item.status.replace(/_/g, " ")}</span>
                  <span className="text-[0.7rem] text-[#8a86a0]">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <h2 className="mt-2.5 text-[1.02rem] font-semibold text-[#10152b]">
                  {item.modules.length ? item.modules.join(" · ") : "Draft with no methods chosen"}
                </h2>
                <p className="mt-1 text-[0.74rem] text-[#8a86a0]">
                  {item.status === "COMPLETED" || item.status === "PARTIALLY_COMPLETED"
                    ? "Report available"
                    : item.status === "FAILED"
                      ? `Reading failed${item.errorCode ? ` (${item.errorCode})` : ""} — you can review or retry`
                      : "In progress"}
                  {item.completedAt ? ` · completed ${new Date(item.completedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={hrefFor(item)} className="btn btn-secondary btn-sm">
                  {item.status === "COMPLETED" || item.status === "PARTIALLY_COMPLETED"
                    ? "Open report"
                    : ACTIVE.includes(item.status)
                      ? "Continue"
                      : "View status"}
                </Link>
                {confirmId === item.id ? (
                  <div className="flex items-center gap-2 rounded-full border border-[#f2c9c1] bg-[#fff4f2] px-2 py-1">
                    <span className="pl-1 text-[0.68rem] text-[#9a3223]">Delete permanently?</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busyId === item.id}
                      onClick={() => void remove(item.id)}
                    >
                      {busyId === item.id ? "Deleting…" : "Yes"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>
                      No
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmId(item.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
