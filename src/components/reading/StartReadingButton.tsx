"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartReadingButton({
  label = "Start a new reading",
  className = "btn btn-primary btn-lg",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/v1/life-readings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ language: "en" }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              setError(payload?.error?.message ?? "Could not start a reading. Please try again.");
              return;
            }
            router.push(`/onboarding?reading=${payload.data.id}`);
          } catch {
            setError("The network did not respond. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing…" : label}
      </button>
      {error && (
        <p className="text-[0.78rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
