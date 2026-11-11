import Link from "next/link";

export function DocumentShell({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  children,
  cta,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated?: string;
  sections?: Array<{ id: string; title: string }>;
  children: React.ReactNode;
  cta?: { href: string; label: string; secondary?: { href: string; label: string } };
}) {
  return (
    <div className="container-page py-12 md:py-16">
      <header className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-4 text-[clamp(2.4rem,5vw,4rem)] text-[#10152b]">{title}</h1>
        <p className="mt-5 text-[1rem] leading-relaxed text-[#5b5775]">{intro}</p>
        {updated && <p className="mt-4 text-[0.72rem] text-[#8a86a0]">Last updated {updated}</p>}
      </header>

      <div className={`mt-10 ${sections?.length ? "grid gap-10 lg:grid-cols-[220px_1fr]" : ""}`}>
        {sections?.length ? (
          <aside className="no-print hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">On this page</p>
              <nav className="mt-3 space-y-0.5 border-l border-[var(--line-strong)]">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block border-l-2 border-transparent py-1.5 pl-3 text-[0.74rem] leading-snug text-[#6b6785] transition-colors hover:border-[#6746c8] hover:text-[#22205a]"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 max-w-3xl">
          <article className="report-prose legal-prose">{children}</article>

          {cta && (
            <div className="mt-12 rounded-2xl border border-[var(--line)] bg-white/60 p-6">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Continue</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={cta.href} className="btn btn-primary">
                  {cta.label}
                </Link>
                {cta.secondary && (
                  <Link href={cta.secondary.href} className="btn btn-secondary">
                    {cta.secondary.label}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
