import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Complete Life Reading",
  description:
    "Explore traditional palmistry, numerology and Vedic astrology interpretations together in one personalised, transparent reading.",
};

const METHODS = [
  {
    id: "01",
    name: "Palmistry",
    kicker: "What is visible",
    body: "Upload a palm photograph and explore the patterns that are actually visible. Only clearly observable features are described; missing or unclear lines are left uninterpreted.",
    points: ["Upload a palm photograph", "Explore visible palm-line patterns", "Understand traditional interpretations"],
  },
  {
    id: "02",
    name: "Numerology",
    kicker: "What is calculated",
    body: "Enter your name and date of birth. A deterministic calculator produces Chaldean or Pythagorean numbers with every reduction step shown and the mapping version recorded.",
    points: ["Enter your name and birth date", "Calculate your core numbers", "Explore traditional number interpretations"],
  },
  {
    id: "03",
    name: "Vedic astrology",
    kicker: "What is computed",
    body: "Add your birth details and a dedicated sidereal engine calculates planetary positions, nakshatras, whole-sign houses and Vimshottari Dasha. Unknown birth time stays unknown.",
    points: ["Add your birth details", "Generate a birth-chart calculation", "Explore planetary and chart interpretations"],
  },
];

const STEPS = [
  ["Choose your methods", "All three traditions, or a considered combination that suits what you want to explore."],
  ["Share the minimum", "Name, birth date and only the details the selected methods genuinely need."],
  ["Consent separately", "Birth details, AI interpretation, palm photographs and history are consented to individually."],
  ["Watch each method complete", "Every component reports its own status. A failed module is labelled, never replaced with invented content."],
  ["Read and reflect", "A structured 12-section report with methods, calculations, limitations and a printable PDF."],
];

const INCLUDED = [
  ["Personal overview", "The methods used and how to read the report."],
  ["Palm observations", "Visible features with confidence and uncertainty notes."],
  ["Numerology profile", "Core numbers, meanings and every calculation step."],
  ["Vedic overview", "Validated chart placements, nakshatras, houses and Dasha."],
  ["Personality reflection", "Traditional themes, clearly marked as interpretation."],
  ["Career & learning", "Reflective themes and skill-building prompts — never guarantees."],
  ["Relationships", "Communication and growth themes, without judging a partner."],
  ["Personal growth", "Constructive areas for self-reflection."],
  ["30-day themes", "Optional, non-deterministic reflection prompts."],
  ["90-day themes", "Seasonal themes drawn from supported data only."],
  ["Annual cycle", "Validated annual numerology and transit context where available."],
  ["Reflection plan", "Realistic questions and habits you can choose to explore."],
];

const FAQ = [
  {
    q: "Does AIBABA predict my future?",
    a: "No. The report presents traditional interpretations for personal reflection. It does not guarantee events, outcomes or dates, and it is not a scientifically verified prediction or a substitute for professional advice.",
  },
  {
    q: "What happens if my birth time is unknown?",
    a: "You can continue with a limited reading. The ascendant, house-based interpretation and Dasha timeline are withheld and clearly labelled as unavailable rather than guessed.",
  },
  {
    q: "Will you invent palm lines that are not visible?",
    a: "No. If a line cannot be seen reliably, it is not interpreted. When the photograph is too unclear, the reading asks for a replacement instead of fabricating observations.",
  },
  {
    q: "Who can see my photographs and birth details?",
    a: "Only your account. Birth details are encrypted, palm images are stored privately and served through short-lived signed links. Administrators see operational metadata, not your reading content.",
  },
  {
    q: "Can I delete everything?",
    a: "Yes. You can delete an individual reading or your whole account from Settings. Deletion removes associated assets, calculations, conversations and reports, subject to the stated retention policy.",
  },
  {
    q: "Is the AI a real astrologer?",
    a: "No. AIBABA uses AI to explain validated calculations and observations in clear language. It does not pretend to be a human astrologer and does not perform the calculations itself.",
  },
];

export default async function CompleteLifeReadingPage() {
  const user = await getSessionUser();
  const startHref = user ? "/new" : "/register";

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 45% at 82% 0%, rgba(103,70,200,.16), transparent 62%), radial-gradient(ellipse 45% 45% at 10% 90%, rgba(214,174,99,.16), transparent 60%)",
          }}
        />
        <div className="container-page relative grid gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="rise">
            <span className="eyebrow">Complete Life Reading</span>
            <h1 className="display mt-6 text-[clamp(2.7rem,6.4vw,5rem)] leading-[1.02] text-[#10152b]">
              Your Story.
              <br />
              Your Numbers.
              <br />
              <em className="text-[#6746c8]">Your Cosmic Journey.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-[#4e4a68]">
              Explore traditional palmistry, numerology and Vedic astrology interpretations together in one
              personalised, AI-assisted reading — with every calculation, observation and limitation clearly
              labelled.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={startHref} className="btn btn-primary btn-lg">
                Start My Complete Reading
              </Link>
              <a href="#how-it-works" className="btn btn-secondary btn-lg">
                Explore How It Works
              </a>
            </div>
            <p className="mt-6 text-[0.74rem] font-medium text-[#6b6785]">
              Traditional reflection, not prediction · No fear-based claims · Delete everything, any time
            </p>
          </div>

          <div className="panel-dark relative overflow-hidden rounded-[2rem] p-7 sm:p-9">
            <div aria-hidden="true" className="absolute inset-0 opacity-70">
              <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(214,174,99,.18)]" />
              <div className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(250,247,240,.12)]" />
              <div className="absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(103,70,200,.45)]" />
              <span className="absolute left-[46%] top-[12%] h-2 w-2 rounded-full bg-[#d6ae63] shadow-[0_0_18px_rgba(214,174,99,.9)]" />
            </div>
            <div className="relative">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-[#d6ae63]">Inside the reading</p>
              <div className="mt-7 space-y-3">
                {[
                  ["Palm observation", "Visible features only"],
                  ["Numerology", "Every step shown"],
                  ["Vedic chart", "Sidereal · Lahiri"],
                  ["Reflection plan", "Practical, not predictive"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(250,247,240,.12)] bg-[rgba(255,255,255,.04)] px-4 py-3"
                  >
                    <span className="text-[0.82rem] font-semibold text-[#faf7f0]">{label}</span>
                    <span className="text-[0.68rem] text-[#e8cd98]">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-[rgba(214,174,99,.25)] bg-[rgba(16,21,43,.5)] p-4">
                <p className="text-[0.72rem] leading-relaxed text-[rgba(250,247,240,.7)]">
                  Calculated facts stay calculated. Visible observations stay visible. Interpretation is
                  always labelled as interpretation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 md:py-20">
        <div className="max-w-2xl">
          <span className="eyebrow">Three independent traditions</span>
          <h2 className="display mt-5 text-[clamp(2.1rem,4.2vw,3.4rem)] text-[#10152b]">
            Kept separate, on purpose.
          </h2>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-[#5b5775]">
            Blending every tradition into one confident voice hides where a statement came from. AIBABA
            keeps each method visible, so you can see what was observed, what was calculated and what was
            interpreted.
          </p>
        </div>
        <div className="grid-3 mt-9">
          {METHODS.map((method) => (
            <article key={method.id} className="card card-hover card-pad relative overflow-hidden">
              <span className="display absolute right-5 top-2 text-[4rem] leading-none text-[rgba(34,32,90,.06)]">
                {method.id}
              </span>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#6746c8]">{method.kicker}</p>
              <h3 className="mt-2 text-[1.3rem] font-semibold text-[#10152b]">{method.name}</h3>
              <p className="mt-3 text-[0.86rem] leading-relaxed text-[#5b5775]">{method.body}</p>
              <ul className="mt-5 space-y-2 border-t border-[var(--line)] pt-4">
                {method.points.map((point) => (
                  <li key={point} className="flex gap-2 text-[0.8rem] text-[#4b4866]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6ae63]" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#10152b] py-16 text-[#faf7f0] md:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <span className="eyebrow" style={{ color: "#d6ae63" }}>
              How AIBABA works
            </span>
            <h2 className="display mt-5 text-[clamp(2.1rem,4.2vw,3.4rem)] text-[#faf7f0]">
              Considered at every step.
            </h2>
            <p className="mt-5 max-w-md text-[0.94rem] leading-relaxed text-[rgba(250,247,240,.62)]">
              Nothing is filled in silently. Each stage has its own consent, status and failure mode, and
              the report tells you what it does not know.
            </p>
            <Link href={startHref} className="btn btn-gold mt-7">
              Start the reading
            </Link>
          </div>
          <ol className="space-y-1">
            {STEPS.map(([title, body], index) => (
              <li key={title} className="flex gap-5 rounded-2xl px-4 py-4 hover:bg-[rgba(255,255,255,.04)] sm:px-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(214,174,99,.4)] font-serif text-base text-[#d6ae63]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[0.94rem] font-semibold text-[#faf7f0]">{title}</p>
                  <p className="mt-1 text-[0.82rem] leading-relaxed text-[rgba(250,247,240,.55)]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <span className="eyebrow">What you will need</span>
            <h2 className="display mt-5 text-[clamp(2rem,4vw,3rem)] text-[#10152b]">Only what the reading needs.</h2>
            <div className="mt-6 space-y-4">
              {[
                ["Name and date of birth", "Used for deterministic numerology. Your display name can differ from your full name."],
                ["A palm photograph", "Optional. A clear, evenly lit image of an open palm; one hand is enough, with the limitation stated."],
                ["Birth time and place", "Required for Vedic astrology. If the time is unknown, the reading continues with a clearly labelled limited chart."],
                ["Separate consent", "You decide whether birth details are processed, whether AI is used, whether palms are analysed and whether history is saved."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                  <p className="text-[0.88rem] font-semibold text-[#242338]">{title}</p>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-[#6b6785]">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#6746c8]">What the report includes</p>
                <h2 className="display mt-2 text-3xl text-[#10152b]">Twelve sections, one document</h2>
              </div>
              <span className="badge badge-royal badge-plain">12</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {INCLUDED.map(([title, body], index) => (
                <div key={title} className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2.5">
                  <p className="text-[0.76rem] font-semibold text-[#3b3854]">
                    <span className="mr-1.5 font-serif text-[#d6ae63]">{String(index + 1).padStart(2, "0")}</span>
                    {title}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-[#8a86a0]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#8a6a2d]">Sample preview</p>
                <h2 className="display mt-2 text-3xl text-[#10152b]">How a report reads</h2>
              </div>
              <span className="badge badge-warn">Fictional sample</span>
            </div>
            <div className="mt-5 rounded-2xl border border-[#e8dfc9] bg-[#fbf9f4] p-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#8a6a2d]">Numerology · illustration only</p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-serif text-5xl text-[#6746c8]">7</span>
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#8a86a0]">Life Path</p>
                  <p className="text-[0.86rem] font-semibold text-[#2f2c47]">The reflective analyst</p>
                </div>
              </div>
              <p className="mt-3 text-[0.82rem] leading-relaxed text-[#4e4a68]">
                In Pythagorean numerology, 14/05/1990 reduces to 1+4+0+5+1+9+9+0 = 29, then 2+9 = 11, then
                1+1 = 2. This example is illustrative and does not describe a real person.
              </p>
              <p className="mt-3 text-[0.68rem] italic text-[#8a86a0]">
                Produced by the deterministic calculator; interpretation wording is illustrative only.
              </p>
            </div>
            <p className="mt-4 text-[0.7rem] leading-relaxed text-[#8a86a0]">
              Real reports use your own validated inputs. No sample numbers, lines or chart positions are
              copied into a customer report.
            </p>
          </div>

          <div className="card card-pad">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#6746c8]">Privacy and photographs</p>
            <h2 className="display mt-2 text-3xl text-[#10152b]">Private by design</h2>
            <ul className="mt-4 space-y-3">
              {[
                "Palm images are stored privately and served through short-lived signed links, never public URLs.",
                "Birth details are encrypted at rest with an application key held outside the database.",
                "Photographs are used only for palm-line observation — never identity or biometric recognition.",
                "You can export your data or delete a reading or account from Settings.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-[0.8rem] leading-relaxed text-[#5b5775]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6746c8]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/privacy" className="btn btn-ghost btn-sm mt-5">
              Read the privacy policy
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Questions</span>
          <h2 className="display mt-4 text-[clamp(2rem,4vw,3rem)] text-[#10152b]">Before you begin</h2>
          <div className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-white/55 px-5">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none pr-6 text-[0.9rem] font-semibold text-[#242338] marker:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 max-w-2xl text-[0.82rem] leading-relaxed text-[#6b6785]">{item.a}</p>
              </details>
            ))}
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
                "radial-gradient(circle at 50% -20%, rgba(214,174,99,.24), transparent 45%), radial-gradient(circle at 90% 110%, rgba(103,70,200,.45), transparent 45%)",
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-[#d6ae63]">Begin with curiosity</p>
            <h2 className="display mt-4 text-[clamp(2.1rem,5vw,3.6rem)] text-[#faf7f0]">
              Your story, thoughtfully read.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[0.9rem] leading-relaxed text-[rgba(250,247,240,.62)]">
              Choose your methods, share only what is needed and pause at any time. The reading will tell you
              what it observed, what it calculated and what remains uncertain.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href={startHref} className="btn btn-gold btn-lg">
                Start My Complete Reading
              </Link>
              <Link href="/methodology" className="btn btn-ghost btn-lg" style={{ color: "#e8cd98" }}>
                Read the methodology
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
