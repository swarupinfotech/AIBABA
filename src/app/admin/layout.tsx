import { pageRole } from "@/lib/auth/page";
import { AdminNav } from "@/components/admin/AdminNav";
import { hasRole } from "@/lib/permissions/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await pageRole("/admin", "SUPPORT");
  return (
    <div className="container-page py-10 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="display mt-2 text-4xl text-[#10152b]">Admin console</h1>
        </div>
        <div className="text-right">
          <p className="text-[0.78rem] font-medium text-[#22205a]">{user.name}</p>
          <p className="text-[0.66rem] uppercase tracking-[0.1em] text-[#8a86a0]">{user.role.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[180px_1fr]">
        <aside>
          <AdminNav />
          <div className="mt-6 rounded-xl border border-[var(--line)] bg-white/50 p-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#8a86a0]">Access note</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-[#6b6785]">
              Reading content is not displayed here. Access events are written to the audit trail.
            </p>
            {hasRole(user.role, "SUPER_ADMIN") && (
              <p className="mt-2 text-[0.66rem] font-semibold text-[#4b3797]">Super admin: user roles enabled</p>
            )}
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
