import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";

const MODALITIES = [
  {
    id: "01",
    name: "Palm observation",
    kicker: "What is visible",
    body: "A quality-checked photograph is assessed for the five major lines. Only features that are actually visible are described. If the image cannot support a reliable observation, the reading says so.",
    limit: "No invented lines · no biometric identification",
  },
  {
    id: "02",
    name: "Deterministic numerology",
    kicker: "What is calculated",
    body: "Chaldean or Pythagorean mapping produces your core numbers with every reduction step shown. The calculator is separate from the language model, so the arithmetic can be checked line by line.",
    limit: "Master numbers preserved · mapping version recorded",
  },
  {
    id: "03",
    name: "Vedic astrology",
    kicker: "What is computed",
    body: "A dedicated sidereal engine calculates planetary positions, nakshatras, whole-sign houses and Vimshottari Dasha using Lahiri ayanamsa. Unknown birth time is handled honestly, not filled in.",
    limit: "Sidereal · Lahiri · uncertainty labelled",
  },
];

const STEPS = [
  { n: "1", title: "Choose your methods", body: "Palmistry, numerology, Vedic astrology — or a considered combination." },
  { n: "2", title: "Share the minimum", body: "Birth details are encrypted. Photographs stay private and are served through signed links." },
  { n: "3", title: "Separate consent", body: "Calculations, AI interpretation, palm processing and history are consented to separately." },
  { n: "4", title: "Watch it come together", body: "Each component reports its own status. Failures are labelled, never papered over." },
  { n: "5", title: "Read, reflect, revisit", body: "A structured report with methods, limitations, calculation steps and a printable PDF." },
];

export default async function HomePage() {
  const user = await getSessionUser();
  const primaryHref = user ? "/new" : "/register";

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 78% 8%, rgba(103,70,200,.15), transparent 62%), radial-gradient(ellipse 40% 40% at 15% 78%, rgba(214,174,99,.14), transparent 60%)",
          }}
        />
        <div className="container-page relative grid items-center gap-14 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="rise">
            <span className="eyebrow">AIBABA · Complete Life Reading</span>
            <h1 className="display mt-6 text-[clamp(2.8rem,7vw,5.4rem)] text-[#10152b]">
              Three traditions.
              <br />
              <em className="text-[#6746c8]">One honest</em> reading.
            </h1>
            <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-[#4e4a68]">
              Palm observation, deterministic numerology and sidereal Vedic astrology — brought
              together with unusual care. Calculated facts stay calculated. Visible observations stay
              visible. Interpretation is clearly labelled as interpretation.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={primaryHref} className="btn btn-primary btn-lg">
                Begin your reading
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/complete-life-reading" className="btn btn-secondary btn-lg">
                See what is included
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[0.76rem] font-medium text-[#6b6785]">
              <span className="inline-flex items-center gap-1.5">
                <Check /> No fear-based predictions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> No guaranteed outcomes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> Delete everything, any time
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="panel-dark relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
              <div aria-hidden="true" className="absolute inset-0 opacity-60">
                <div className="orbit absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(214,174,99,.16)]" />
                <div className="absolute left-1/2 top-1/2 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(250,247,240,.12)]" />
                <div className="absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(103,70,200,.5)]" />
                <span className="absolute left-[48%] top-[9%] h-2 w-2 rounded-full bg-[#d6ae63] shadow-[0_0_20px_rgba(214,174,99,.9)]" />
                <span className="absolute right-[12%] top-[48%] h-1.5 w-1.5 rounded-full bg-[#e8cd98]" />
                <span className="absolute bottom-[18%] left-[22%] h-1.5 w-1.5 rounded-full bg-[#8a6fe0]" />
              </div>
              <div className="relative">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-[#d6ae63]">
                  Your reading, in three voices
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    { label: "Palmistry", note: "Observed, not imagined", value: "Visible features only" },
                    { label: "Numerology", note: "Deterministic calculator", value: "Every step shown" },
                    { label: "Vedic astrology", note: "Sidereal · Lahiri", value: "Uncertainty labelled" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(250,247,240,.12)] bg-[rgba(255,255,255,.04)] px-4 py-3.5 backdrop-blur-sm"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#faf7f0]">{row.label}</p>
                        <p className="mt-0.5 text-[0.7rem] text-[rgba(250,247,240,.55)]">{row.note}</p>
                      </div>
                      <span className="text-right text-[0.68rem] font-medium text-[#e8cd98]">{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-2xl border border-[rgba(214,174,99,.25)] bg-[rgba(16,21,43,.5)] p-4">
                  <p className="text-[0.7rem] leading-relaxed text-[rgba(250,247,240,.72)]">
                    “The report will tell you what it does not know. That is the difference between a
                    reading and a performance.”
                  </p>
                  <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#d6ae63]">
                    AIBABA principle
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        <div className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,255,255,.55)] p-5 sm:grid-cols-3 sm:p-6">
          {[
            { k: "Deterministic", v: "Numbers and chart positions are computed, versioned and reproducible." },
            { k: "Transparent", v: "Method, mapping version, provider and limitations are printed in the report." },
            { k: "Private by design", v: "Encrypted birth details, private images, signed access, full deletion." },
          ].map((item) => (
            <div key={item.k} className="flex gap-3">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[rgba(103,70,200,.1)] text-[#6746c8]">
                <Check />
              </span>
              <div>
                <p className="text-[0.82rem] font-bold text-[#22205a]">{item.k}</p>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-[#6b6785]">{item.v}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="methods" className="container-page py-16 md:py-24">
        <div className="max-w-2xl">
          <span className="eyebrow">Three methods, kept distinct</span>
          <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] text-[#10152b]">
            A reading that shows its work.
          </h2>
          <p className="mt-5 text-[0.98rem] leading-relaxed text-[#5b5775]">
            Most “complete” readings blend everything into one confident voice. AIBABA keeps the
            traditions separate, labels each source, and lets you see exactly where a statement came
            from.
          </p>
        </div>
        <div className="grid-3 mt-10">
          {MODALITIES.map((item) => (
            <article key={item.id} className="card card-hover card-pad relative overflow-hidden">
              <span className="display absolute right-5 top-3 text-[4rem] leading-none text-[rgba(34,32,90,.06)]">
                {item.id}
              </span>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#6746c8]">{item.kicker}</p>
              <h3 className="mt-2 text-[1.25rem] font-semibold text-[#10152b]">{item.name}</h3>
              <p className="mt-3 text-[0.88rem] leading-relaxed text-[#5b5775]">{item.body}</p>
              <p className="mt-5 border-t border-[var(--line)] pt-4 text-[0.72rem] font-medium text-[#8a6a2d]">
                {item.limit}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#10152b] py-16 text-[#faf7f0] md:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="eyebrow" style={{ color: "#d6ae63" }}>
              How it unfolds
            </span>
            <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] text-[#faf7f0]">
              Considered at every step.
            </h2>
            <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-[rgba(250,247,240,.62)]">
              You are never asked for more than the reading needs. Every stage has its own consent,
              status and failure mode — and nothing is fabricated to smooth the experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryHref} className="btn btn-gold">
                Start the five-step reading
              </Link>
              <Link href="/methodology" className="btn btn-ghost" style={{ color: "#e8cd98" }}>
                Read the methodology
              </Link>
            </div>
          </div>
          <ol className="space-y-1">
            {STEPS.map((step) => (
              <li key={step.n} className="group flex gap-5 rounded-2xl px-4 py-4 transition-colors hover:bg-[rgba(255,255,255,.04)] sm:px-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(214,174,99,.4)] font-serif text-base text-[#d6ae63]">
                  {step.n}
                </span>
                <div>
                  <p className="text-[0.95rem] font-semibold text-[#faf7f0]">{step.title}</p>
                  <p className="mt-1 text-[0.82rem] leading-relaxed text-[rgba(250,247,240,.55)]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="card card-pad">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#6746c8]">
                  Report anatomy
                </p>
                <h2 className="display mt-2 text-3xl text-[#10152b]">What you actually receive</h2>
              </div>
              <span className="badge badge-royal badge-plain">12 sections</span>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                "Overview & method notes",
                "Palmistry — visible features",
                "Numerology — cards & steps",
                "Vedic chart & Dasha",
                "Personality themes",
                "Career reflection",
                "Relationships & growth",
                "30 / 90 day reflections",
                "Annual reflection themes",
                "Practical reflection plan",
                "Uncertainty disclosures",
                "Attribution & versions",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2.5">
                  <span className="font-serif text-sm text-[#d6ae63]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-[0.78rem] font-medium text-[#3b3854]">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[0.72rem] leading-relaxed text-[#8a86a0]">
              Upcoming and annual sections are framed as reflection themes, never dated predictions.
              The PDF uses embedded Unicode fonts for English and Hindi.
            </p>
          </div>

          <div>
            <span className="eyebrow">What AIBABA refuses to do</span>
            <h2 className="display mt-5 text-[clamp(2rem,4vw,3.2rem)] text-[#10152b]">
              Restraint is part of the craft.
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                ["Invent a palm line", "If a line is not visible, it is not interpreted."],
                ["Fill an unknown birth time", "Ascendant, houses, divisional charts and Dasha are withheld and labelled."],
                ["Guarantee an outcome", "No promises about money, marriage, health, lifespan or pregnancy."],
                ["Sell urgency", "No fear, no remedies, no pressure, no manufactured countdowns."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#e3d6bb] text-[#b8862f]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[0.92rem] font-semibold text-[#242338]">{title}</p>
                    <p className="mt-1 text-[0.82rem] leading-relaxed text-[#6b6785]">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="panel-dark relative overflow-hidden rounded-[2rem] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% -20%, rgba(214,174,99,.25), transparent 45%), radial-gradient(circle at 90% 110%, rgba(103,70,200,.45), transparent 45%)",
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-[#d6ae63]">
              Your next chapter, without the theatre
            </p>
            <h2 className="display mt-5 text-[clamp(2.2rem,5vw,3.8rem)] text-[#faf7f0]">
              Begin with curiosity.
              <br />
              Leave with clarity.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[0.92rem] leading-relaxed text-[rgba(250,247,240,.62)]">
              The reading takes a few minutes to prepare. You can pause, choose fewer methods, or delete
              everything afterwards.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={primaryHref} className="btn btn-gold btn-lg">
                {user ? "Start a new reading" : "Create your account"}
              </Link>
              {!user && (
                <Link href="/login" className="btn btn-ghost btn-lg" style={{ color: "#e8cd98" }}>
                  I already have an account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
