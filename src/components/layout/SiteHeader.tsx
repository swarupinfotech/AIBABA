import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/permissions/rbac";
import { Logo } from "@/components/brand/Logo";
import { NavLinks } from "@/components/layout/NavLinks";
import { SignOutButton } from "@/components/auth/SignOutButton";

export async function SiteHeader() {
  const user = await getSessionUser();
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, readAt: null } }).catch(() => 0)
    : 0;
  const isAdmin = user ? canAccessAdmin(user.role) : false;

  return (
    <header className="site-header no-print">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo compact />
          {user && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
              <NavLinks isAdmin={isAdmin} />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/notifications" className="relative hidden rounded-full p-2 text-[#4b4866] hover:bg-[rgba(34,32,90,.06)] sm:inline-flex" aria-label="Notifications">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M10 21h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {unread > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#6746c8] px-1 text-[0.6rem] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/new" className="btn btn-primary btn-sm hidden sm:inline-flex">
                New reading
              </Link>
              <div className="hidden items-center gap-1 md:flex">
                <SignOutButton />
              </div>
              <details className="relative md:hidden">
                <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--line-strong)] text-[#22205a]" aria-label="Open menu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </summary>
                <div className="card card-solid absolute right-0 top-12 z-50 w-60 p-3">
                  <div className="flex flex-col">
                    <NavLinks isAdmin={isAdmin} />
                    <Link href="/notifications" className="nav-link">
                      Notifications {unread > 0 ? `(${unread})` : ""}
                    </Link>
                    <Link href="/new" className="btn btn-primary btn-sm mt-2">
                      New reading
                    </Link>
                    <div className="mt-2 border-t border-[var(--line)] pt-2">
                      <SignOutButton className="btn btn-ghost btn-sm w-full" />
                    </div>
                  </div>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Begin your reading
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
