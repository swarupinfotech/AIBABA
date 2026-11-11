"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/complete-life-reading", label: "The reading" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link"
          data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
        >
          {link.label}
        </Link>
      ))}
      {isAdmin && (
        <Link href="/admin" className="nav-link" data-active={pathname.startsWith("/admin")}>
          Admin
        </Link>
      )}
    </>
  );
}
