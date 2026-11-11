"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryJobButton({ jobId, label = "Retry" }: { jobId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch(`/api/v1/admin/jobs/${jobId}/retry`, { method: "POST" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              setError(payload?.error?.message ?? "Retry failed.");
              return;
            }
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Retrying…" : label}
      </button>
      {error && <span className="text-[0.64rem] text-[#9a3223]">{error}</span>}
    </span>
  );
}
