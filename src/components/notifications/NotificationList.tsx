"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface NotificationItem {
  id: string;
  readingId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = items.filter((item) => !item.readAt).length;

  async function markAll() {
    setBusy(true);
    try {
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Updates</p>
          <h1 className="display mt-3 text-[clamp(2.4rem,5vw,3.6rem)] text-[#10152b]">Notifications.</h1>
          <p className="mt-2 text-[0.88rem] text-[#6b6785]">
            Status changes for your readings. We do not send marketing messages here.
          </p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={markAll} disabled={busy}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-2">
        {items.length === 0 && (
          <div className="card card-pad text-center">
            <p className="text-sm text-[#6b6785]">No notifications yet. Reading updates will appear here.</p>
          </div>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className={`rounded-2xl border px-5 py-4 ${
              item.readAt ? "border-[var(--line)] bg-white/50" : "border-[rgba(103,70,200,.3)] bg-[rgba(103,70,200,.04)]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.88rem] font-semibold text-[#22205a]">{item.title}</p>
                <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-[#5b5775]">{item.body}</p>
                <p className="mt-2 text-[0.68rem] text-[#8a86a0]">
                  {new Date(item.createdAt).toLocaleString()}
                  {item.readAt ? "" : " · unread"}
                </p>
              </div>
              <div className="flex gap-2">
                {item.readingId && (
                  <Link href={`/report/${item.readingId}`} className="btn btn-ghost btn-sm">
                    Open
                  </Link>
                )}
                {!item.readAt && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void markOne(item.id)}>
                    Mark read
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
