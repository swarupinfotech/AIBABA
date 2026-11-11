import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { pageRole } from "@/lib/auth/page";
import { hasRole, isRole, type Role } from "@/lib/permissions/rbac";
import { UserRoleSelect } from "@/components/admin/UserRoleSelect";

export const metadata = { title: "Admin users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await pageRole("/admin/users", "SUPPORT");
  const canChangeRoles = hasRole(admin.role, "SUPER_ADMIN");
  const { q = "" } = await searchParams;
  const query = q.trim();

  const users = await prisma.user.findMany({
    where: query ? { OR: [{ email: { contains: query } }, { name: { contains: query } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { readings: true, sessions: true } },
    },
  });

  return (
    <div className="stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#10152b]">Users</h2>
          <p className="mt-1 text-[0.78rem] text-[#6b6785]">
            {canChangeRoles
              ? "Super admins may change roles. Every change is written to the audit trail."
              : "Role changes require super-admin access."}
          </p>
        </div>
        <form className="flex flex-wrap gap-2" action="/admin/users">
          <input
            className="input w-56"
            name="q"
            defaultValue={q}
            placeholder="Search name or email"
            aria-label="Search users"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[0.78rem]">
          <thead className="border-b border-[var(--line)] bg-[rgba(103,70,200,.04)] text-[0.66rem] uppercase tracking-[0.08em] text-[#8a86a0]">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Readings</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#8a86a0]">
                  No users match this search.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const role: Role = isRole(user.role) ? user.role : "USER";
              return (
                <tr key={user.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#2f2c47]">{user.name}</p>
                    <p className="text-[0.66rem] text-[#8a86a0]">{user.email}</p>
                    <p className="text-[0.62rem] text-[#a29fb3]">
                      {user.emailVerifiedAt ? "email verified" : "email unverified"} · {user._count.sessions} session
                      {user._count.sessions === 1 ? "" : "s"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        user.accountStatus === "ACTIVE"
                          ? "badge-success"
                          : user.accountStatus === "LOCKED"
                            ? "badge-danger"
                            : "badge-muted"
                      }`}
                    >
                      {user.accountStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/readings?q=${encodeURIComponent(user.email)}`}
                      className="text-[0.72rem] font-semibold text-[#6746c8]"
                    >
                      {user._count.readings}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <UserRoleSelect userId={user.id} initialRole={role} disabled={!canChangeRoles || user.id === admin.id} />
                    {user.id === admin.id && <p className="mt-1 text-[0.62rem] text-[#8a86a0]">your account</p>}
                  </td>
                  <td className="px-4 py-3 text-[0.7rem] text-[#8a86a0]">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
