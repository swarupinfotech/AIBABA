"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/readings", label: "Readings" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "AI & settings" },
  { href: "/admin/audit", label: "Audit trail" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 lg:flex-col" aria-label="Admin navigation">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-[0.8rem] font-medium transition-colors ${
              active ? "bg-[#22205a] text-[#faf7f0]" : "text-[#5b5775] hover:bg-[rgba(34,32,90,.06)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
