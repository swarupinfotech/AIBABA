"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
        router.push("/");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
