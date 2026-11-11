"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, type Role } from "@/lib/permissions/rbac";

export function UserRoleSelect({
  userId,
  initialRole,
  disabled,
}: {
  userId: string;
  initialRole: Role;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return <span className="text-[0.72rem] text-[#5b5775]">{initialRole.replace(/_/g, " ")}</span>;
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        className="select w-40 py-1 text-[0.72rem]"
        value={role}
        disabled={busy}
        aria-label="Change user role"
        onChange={async (event) => {
          const next = event.target.value as Role;
          const previous = role;
          setRole(next);
          setBusy(true);
          setError(null);
          try {
            const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ role: next }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              setRole(previous);
              setError(payload?.error?.message ?? "Role change failed.");
              return;
            }
            router.refresh();
          } catch {
            setRole(previous);
            setError("Network error. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {error && <span className="max-w-40 text-[0.62rem] text-[#9a3223]">{error}</span>}
    </span>
  );
}
