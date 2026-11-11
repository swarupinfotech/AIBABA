import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="no-print mt-20 border-t border-[var(--line)] bg-[rgba(255,255,255,.5)]">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
            A considered reading that separates calculated facts, visible observations and AI-assisted
            interpretation — without fear, guarantees or invented detail.
          </p>
        </div>
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Reading</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[#4b4866]">
            <Link href="/complete-life-reading">What is included</Link>
            <Link href="/palmistry">Palmistry</Link>
            <Link href="/numerology">Numerology</Link>
            <Link href="/astrology">Vedic astrology</Link>
          </div>
        </div>
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Account</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[#4b4866]">
            <Link href="/history">Your readings</Link>
            <Link href="/settings">Privacy & settings</Link>
            <Link href="/notifications">Notifications</Link>
          </div>
        </div>
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Trust</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[#4b4866]">
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/methodology">Methodology</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--line)]">
        <div className="container-page flex flex-col gap-2 py-5 text-[0.72rem] text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AIBABA. A reflective tradition, thoughtfully presented.</p>
          <p>Traditional interpretation is not medical, legal or financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
