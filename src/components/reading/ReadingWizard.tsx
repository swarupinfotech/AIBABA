"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CONSENT_LABELS,
  CONSENT_PURPOSES,
  type ConsentPurpose,
  type ReadingDraft,
} from "@/lib/validation/reading";
import { PalmUploader, type UploadedAsset } from "@/components/reading/PalmUploader";

export interface WizardInitial {
  id: string;
  status: string;
  draft: ReadingDraft;
  assets: UploadedAsset[];
}

const STEP_LABELS: Record<number, string> = {
  1: "Methods",
  2: "About you",
  3: "Numerology",
  4: "Astrology",
  5: "Palmistry",
  6: "Review",
};

const MODULE_COPY = {
  PALMISTRY: {
    title: "Palm observation",
    body: "Private palm photographs, a quality check, and interpretation of only the features that are visible.",
    note: "Requires 1–2 photographs",
  },
  NUMEROLOGY: {
    title: "Numerology",
    body: "Chaldean or Pythagorean calculation of seven core numbers, with every reduction shown.",
    note: "Deterministic calculator",
  },
  ASTROLOGY: {
    title: "Vedic astrology",
    body: "Sidereal chart, nakshatras, whole-sign houses and Vimshottari Dasha from your validated birth details.",
    note: "Lahiri ayanamsa",
  },
} as const;

function ageOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age -= 1;
  return age;
}

function stepHref(id: string, step: number): string {
  if (step === 1) return `/onboarding?reading=${id}`;
  if (step === 2) return `/onboarding?reading=${id}&step=2`;
  if (step === 3) return `/numerology?reading=${id}`;
  if (step === 4) return `/astrology?reading=${id}`;
  if (step === 5) return `/palmistry?reading=${id}`;
  return `/review?reading=${id}`;
}

export function ReadingWizard({ initial, step }: { initial: WizardInitial; step: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReadingDraft>(initial.draft);
  const [assets, setAssets] = useState<UploadedAsset[]>(initial.assets);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consents, setConsents] = useState<Record<ConsentPurpose, boolean>>({
    PERSONAL_DATA_PROCESSING: true,
    AI_PROCESSING: true,
    PALM_IMAGE_PROCESSING: false,
    SAVE_HISTORY: true,
    PRODUCT_RESEARCH: false,
  });
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<
    Array<{ id: string; name: string; region: string; country: string; latitude: number; longitude: number; timezone: string }>
  >([]);
  const [cityLoading, setCityLoading] = useState(false);

  const methods = useMemo(() => draft.methods ?? [], [draft.methods]);
  const v = (patch: Partial<ReadingDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const steps = useMemo(() => {
    const list = [1, 2];
    if (methods.includes("NUMEROLOGY")) list.push(3);
    if (methods.includes("ASTROLOGY")) list.push(4);
    if (methods.includes("PALMISTRY")) list.push(5);
    list.push(6);
    return list;
  }, [methods]);

  const currentIndex = Math.max(0, steps.indexOf(step));
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : null;
  const nextStep = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;

  const required = useMemo(() => {
    const list: ConsentPurpose[] = ["PERSONAL_DATA_PROCESSING", "AI_PROCESSING", "SAVE_HISTORY"];
    if (methods.includes("PALMISTRY")) list.push("PALM_IMAGE_PROCESSING");
    return list;
  }, [methods]);

  const requiredGranted = required.every((purpose) => consents[purpose]);

  useEffect(() => {
    const query = cityQuery.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setCityResults([]);
        setCityLoading(false);
        return;
      }
      setCityLoading(true);
      try {
        const response = await fetch(`/api/v1/cities?q=${encodeURIComponent(query)}`);
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) setCityResults(payload?.data?.cities ?? []);
      } catch {
        if (!cancelled) setCityResults([]);
      } finally {
        if (!cancelled) setCityLoading(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityQuery]);

  async function save(patch: Partial<ReadingDraft> = {}): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const merged = { ...draft, ...patch, step: Math.min(6, Math.max(0, step)) };
      const response = await fetch(`/api/v1/life-readings/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error?.message ?? "Your changes could not be saved.");
        return false;
      }
      setDraft(payload.data.draft);
      return true;
    } catch {
      setError("The network did not respond. Your changes are still in this browser tab.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function validateStep(): string | null {
    if (step === 1 && !methods.length) return "Choose at least one method to continue.";
    if (step === 2) {
      if (!draft.fullName || draft.fullName.trim().length < 2) return "Enter your full name.";
      if (!draft.dateOfBirth) return "Enter your date of birth.";
      const age = ageOf(draft.dateOfBirth);
      if (age < 13) return "You must be at least 13 years old to use this service.";
      if (age > 120) return "Please check the year of birth.";
    }
    if (step === 3) {
      if (!draft.numerologySystem) return "Choose a numerology system.";
      if (!/[A-Za-z]/.test(draft.numerologyName ?? "")) return "Enter the Latin-alphabet spelling for the calculation.";
    }
    if (step === 4) {
      if (!draft.birthplace) return "Search for and confirm your birthplace.";
      if (draft.birthTimeAccuracy !== "UNKNOWN" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.birthTime ?? "")) {
        return "Enter a birth time, or mark it as unknown.";
      }
    }
    if (step === 5) {
      if (!draft.dominantHand) return "Select your dominant hand.";
      if (!assets.some((asset) => asset.status === "VALIDATED")) {
        return "Upload at least one palm photograph that passes the quality check, or remove palmistry from the reading.";
      }
    }
    return null;
  }

  async function next() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    const ok = await save();
    if (ok && nextStep) router.push(stepHref(initial.id, nextStep));
  }

  async function back() {
    if (!previousStep) return;
    await save();
    router.push(stepHref(initial.id, previousStep));
  }

  async function submit() {
    if (!requiredGranted) {
      setError("Grant the required consents before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ok = await save();
      if (!ok) return;
      const response = await fetch(`/api/v1/life-readings/${initial.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consents }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error?.message ?? "The reading could not be submitted.");
        return;
      }
      router.push(`/processing/${initial.id}`);
    } catch {
      setError("The network did not respond. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const missingModule = (step === 3 && !methods.includes("NUMEROLOGY")) ||
    (step === 4 && !methods.includes("ASTROLOGY")) ||
    (step === 5 && !methods.includes("PALMISTRY"));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Step {currentIndex + 1} of {steps.length}</p>
          <h1 className="display mt-3 text-4xl text-[#10152b] md:text-5xl">{STEP_LABELS[step]}.</h1>
        </div>
        <Link href="/history" className="btn btn-ghost btn-sm">
          Save & exit
        </Link>
      </div>

      <div className="stepper mb-8" aria-label="Reading progress">
        {steps.map((item, index) => (
          <span key={item} className="step-dot" data-active={item === step} data-done={index < currentIndex}>
            {String(index + 1).padStart(2, "0")} · {STEP_LABELS[item]}
          </span>
        ))}
      </div>

      {missingModule ? (
        <div className="card card-pad text-center">
          <h2 className="text-xl font-semibold text-[#10152b]">This method is not part of your reading.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6b6785]">
            Go back and choose the methods you would like included, or continue to review.
          </p>
          <Link href={`/onboarding?reading=${initial.id}`} className="btn btn-secondary mt-5">
            Change methods
          </Link>
        </div>
      ) : (
        <div className="card card-pad">
          {step === 1 && (
            <StepMethods
              methods={methods}
              language={draft.language ?? "en"}
              onToggle={(method) =>
                v({
                  methods: methods.includes(method) ? methods.filter((item) => item !== method) : [...methods, method],
                })
              }
              onLanguage={(language) => v({ language })}
            />
          )}

          {step === 2 && (
            <StepAbout draft={draft} onChange={v} />
          )}

          {step === 3 && (
            <StepNumerology draft={draft} onChange={v} />
          )}

          {step === 4 && (
            <StepAstrology
              draft={draft}
              onChange={v}
              cityQuery={cityQuery}
              setCityQuery={setCityQuery}
              cityResults={cityResults}
              cityLoading={cityLoading}
            />
          )}

          {step === 5 && (
            <StepPalm
              draft={draft}
              onChange={v}
              readingId={initial.id}
              assets={assets}
              setAssets={setAssets}
            />
          )}

          {step === 6 && (
            <StepReview
              draft={draft}
              assets={assets}
              consents={consents}
              setConsents={setConsents}
              required={required}
              onEdit={(target) => router.push(stepHref(initial.id, target))}
            />
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-[#f2c9c1] bg-[#fff4f2] px-4 py-3 text-[0.82rem] text-[#9a3223]" role="alert">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-6">
            <button type="button" className="btn btn-ghost" onClick={back} disabled={!previousStep || saving || submitting}>
              ← Back
            </button>
            {step === 6 ? (
              <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting || saving || !requiredGranted}>
                {submitting ? "Submitting…" : "Submit reading"}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={next} disabled={saving}>
                {saving ? "Saving…" : "Continue →"}
              </button>
            )}
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-[0.72rem] leading-relaxed text-[#8a86a0]">
        Drafts are encrypted at rest. Nothing is calculated until you submit, and you can delete the
        draft or reading at any point.
      </p>
    </div>
  );
}

function StepMethods({
  methods,
  language,
  onToggle,
  onLanguage,
}: {
  methods: string[];
  language: string;
  onToggle: (method: "PALMISTRY" | "NUMEROLOGY" | "ASTROLOGY") => void;
  onLanguage: (language: "en" | "hi") => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#10152b]">What would you like to explore?</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-[#6b6785]">
        Choose one, two or all three. The final report will clearly separate each method and state if a
        component could not be completed.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {(Object.keys(MODULE_COPY) as Array<keyof typeof MODULE_COPY>).map((key) => {
          const copy = MODULE_COPY[key];
          const selected = methods.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(key)}
              className="rounded-2xl border p-5 text-left transition-all"
              style={{
                borderColor: selected ? "rgba(103,70,200,.55)" : "var(--line-strong)",
                background: selected ? "rgba(103,70,200,.06)" : "rgba(255,255,255,.65)",
                boxShadow: selected ? "0 18px 40px -28px rgba(34,32,90,.55)" : "none",
              }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border text-white"
                style={{ background: selected ? "#6746c8" : "transparent", borderColor: selected ? "#6746c8" : "#c9c4da" }}
              >
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <p className="mt-4 text-[0.98rem] font-semibold text-[#10152b]">{copy.title}</p>
              <p className="mt-2 text-[0.8rem] leading-relaxed text-[#5b5775]">{copy.body}</p>
              <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#8a6a2d]">{copy.note}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <p className="label">Report language</p>
        <div className="mt-2 flex gap-2">
          {[
            { value: "en", label: "English" },
            { value: "hi", label: "हिन्दी · Hindi" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn ${language === option.value ? "btn-primary" : "btn-secondary"} btn-sm`}
              onClick={() => onLanguage(option.value as "en" | "hi")}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="hint mt-2">Calculations stay the same; narrative text and the PDF use this language.</p>
      </div>
    </div>
  );
}

function StepAbout({
  draft,
  onChange,
}: {
  draft: ReadingDraft;
  onChange: (patch: Partial<ReadingDraft>) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#10152b]">Tell us the minimum we need.</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-[#6b6785]">
        Your full name is used for numerology and is encrypted. A preferred name is what appears in the
        report and conversation.
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="fullName">
            Full name <span className="text-[#9a3223]">*</span>
          </label>
          <input
            id="fullName"
            className="input"
            autoComplete="name"
            maxLength={120}
            value={draft.fullName ?? ""}
            onChange={(event) => onChange({ fullName: event.target.value })}
            placeholder="As you would like it used for calculation"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="preferredName">
            Preferred name
          </label>
          <input
            id="preferredName"
            className="input"
            autoComplete="nickname"
            maxLength={60}
            value={draft.preferredName ?? ""}
            onChange={(event) => onChange({ preferredName: event.target.value })}
            placeholder="What should the report call you?"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="dob">
            Date of birth <span className="text-[#9a3223]">*</span>
          </label>
          <input
            id="dob"
            type="date"
            className="input"
            max={new Date().toISOString().slice(0, 10)}
            value={draft.dateOfBirth ?? ""}
            onChange={(event) => onChange({ dateOfBirth: event.target.value })}
          />
          <p className="hint">Used for birth number, life path and — if selected — the Vedic chart.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="country">
            Country
          </label>
          <input
            id="country"
            className="input"
            autoComplete="country-name"
            maxLength={120}
            value={draft.country ?? ""}
            onChange={(event) => onChange({ country: event.target.value })}
            placeholder="India"
          />
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[#fbf9f4] px-4 py-3 text-[0.76rem] leading-relaxed text-[#6b6785]">
        AIBABA is intended for people aged 13 and over. Birth details are encrypted with AES-256-GCM
        before storage and are never placed in logs or analytics.
      </div>
    </div>
  );
}

function StepNumerology({
  draft,
  onChange,
}: {
  draft: ReadingDraft;
  onChange: (patch: Partial<ReadingDraft>) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#10152b]">How should the numbers be read?</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-[#6b6785]">
        Both systems reduce letters and dates deterministically. Master numbers 11, 22 and 33 are
        preserved rather than reduced further. The mapping version is recorded in your report.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          {
            value: "CHALDEAN" as const,
            title: "Chaldean",
            body: "An older letter-value system. The letter Y is treated as a vowel when it carries a vowel sound.",
          },
          {
            value: "PYTHAGOREAN" as const,
            title: "Pythagorean",
            body: "The familiar 1–9 letter mapping, with vowels, consonants and full name calculated separately.",
          },
        ].map((option) => {
          const selected = draft.numerologySystem === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ numerologySystem: option.value })}
              className="rounded-2xl border p-5 text-left transition-all"
              style={{
                borderColor: selected ? "rgba(103,70,200,.55)" : "var(--line-strong)",
                background: selected ? "rgba(103,70,200,.06)" : "rgba(255,255,255,.65)",
              }}
            >
              <p className="text-[0.95rem] font-semibold text-[#10152b]">{option.title}</p>
              <p className="mt-2 text-[0.8rem] leading-relaxed text-[#5b5775]">{option.body}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 field">
        <label className="label" htmlFor="numerologyName">
          Latin-alphabet spelling for calculation <span className="text-[#9a3223]">*</span>
        </label>
        <input
          id="numerologyName"
          className="input"
          maxLength={160}
          value={draft.numerologyName ?? ""}
          onChange={(event) => onChange({ numerologyName: event.target.value })}
          placeholder="e.g. Aarav Sharma"
        />
        <p className="hint">
          Use the spelling you identify with. Devanagari or other scripts are not transliterated
          automatically, because a guessed spelling would change the result.
        </p>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {["Life Path", "Birth Number", "Destiny / Expression", "Soul Urge", "Personality", "Personal Year"].map(
          (item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6ae63]" />
              <span className="text-[0.78rem] font-medium text-[#4b4866]">{item}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

type City = {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

function StepAstrology({
  draft,
  onChange,
  cityQuery,
  setCityQuery,
  cityResults,
  cityLoading,
}: {
  draft: ReadingDraft;
  onChange: (patch: Partial<ReadingDraft>) => void;
  cityQuery: string;
  setCityQuery: (query: string) => void;
  cityResults: City[];
  cityLoading: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#10152b]">Place and time, handled honestly.</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-[#6b6785]">
        The chart uses a sidereal zodiac, Lahiri ayanamsa and whole-sign houses. If you do not know your
        birth time, the ascendant, houses, divisional charts and Dasha will be withheld and labelled.
      </p>

      <div className="mt-6">
        <p className="label">Birth time accuracy</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { value: "EXACT", label: "Exact time" },
            { value: "APPROXIMATE", label: "Approximate" },
            { value: "UNKNOWN", label: "Unknown" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-sm ${draft.birthTimeAccuracy === option.value ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onChange({ birthTimeAccuracy: option.value as "EXACT" | "APPROXIMATE" | "UNKNOWN" })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {draft.birthTimeAccuracy !== "UNKNOWN" && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="birthTime">
              Birth time (24-hour)
            </label>
            <input
              id="birthTime"
              type="time"
              className="input"
              value={draft.birthTime ?? ""}
              onChange={(event) => onChange({ birthTime: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="label">Why this matters</label>
            <p className="hint pt-2">
              Even a 15-minute difference can change the ascendant. Approximate times keep the reading
              honest by limiting time-sensitive claims.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="label">Birthplace</p>
        {draft.birthplace ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(103,70,200,.35)] bg-[rgba(103,70,200,.05)] px-4 py-3">
            <div>
              <p className="text-[0.9rem] font-semibold text-[#22205a]">
                {draft.birthplace.name}
                {draft.birthplace.region ? `, ${draft.birthplace.region}` : ""}, {draft.birthplace.country}
              </p>
              <p className="mt-1 text-[0.7rem] text-[#6b6785]">
                {draft.birthplace.latitude.toFixed(4)}, {draft.birthplace.longitude.toFixed(4)} ·{" "}
                {draft.birthplace.timezone}
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ birthplace: undefined })}>
              Change
            </button>
          </div>
        ) : (
          <div className="relative mt-2">
            <input
              className="input"
              value={cityQuery}
              onChange={(event) => setCityQuery(event.target.value)}
              placeholder="Search a city, e.g. Delhi, Mumbai, London…"
              aria-label="Search birthplace city"
            />
            {(cityResults.length > 0 || cityLoading) && (
              <div className="card card-solid absolute z-20 mt-2 max-h-64 w-full overflow-auto p-1.5">
                {cityLoading && <p className="px-3 py-2 text-[0.78rem] text-[#8a86a0]">Searching…</p>}
                {cityResults.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-[rgba(103,70,200,.06)]"
                    onClick={() => {
                      onChange({
                        birthplace: {
                          name: city.name,
                          region: city.region,
                          country: city.country,
                          latitude: city.latitude,
                          longitude: city.longitude,
                          timezone: city.timezone,
                        },
                      });
                      setCityQuery("");
                    }}
                  >
                    <span className="text-[0.82rem] font-medium text-[#22205a]">
                      {city.name}
                      {city.region ? `, ${city.region}` : ""}
                    </span>
                    <span className="text-[0.68rem] text-[#8a86a0]">
                      {city.country} · {city.timezone}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="hint mt-2">
              Coordinates and IANA timezone are stored with the reading so the calculation is
              reproducible. Need a city that is not listed? Contact support rather than approximating.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepPalm({
  draft,
  onChange,
  readingId,
  assets,
  setAssets,
}: {
  draft: ReadingDraft;
  onChange: (patch: Partial<ReadingDraft>) => void;
  readingId: string;
  assets: UploadedAsset[];
  setAssets: (assets: UploadedAsset[]) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#10152b]">Palm photographs, without invention.</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-[#6b6785]">
        Relax your hand, palm up, in soft even light. A quality check runs before submission. If the
        image cannot support reliable observation, the reading will say so rather than invent lines.
      </p>

      <div className="mt-6">
        <p className="label">Dominant hand</p>
        <div className="mt-2 flex gap-2">
          {[
            { value: "LEFT", label: "Left" },
            { value: "RIGHT", label: "Right" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-sm ${draft.dominantHand === option.value ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onChange({ dominantHand: option.value as "LEFT" | "RIGHT" })}
            >
              {option.label} hand
            </button>
          ))}
        </div>
        <p className="hint mt-2">
          The dominant hand is treated as the active hand; the other may be supplied as a comparison.
        </p>
      </div>

      <div className="mt-6">
        <PalmUploader readingId={readingId} assets={assets} onChange={setAssets} />
      </div>

      <div className="mt-6 rounded-xl border border-[#efdcae] bg-[#fdf6e6] px-4 py-3 text-[0.76rem] leading-relaxed text-[#8a6420]">
        <strong>What the palm module can and cannot do.</strong> With the local development interpreter,
        no vision model is configured, so palm features are marked NOT_ASSESSED and the component returns a
        LIMITED result. That is deliberate: the application never fabricates line readings.
      </div>
    </div>
  );
}

function StepReview({
  draft,
  assets,
  consents,
  setConsents,
  required,
  onEdit,
}: {
  draft: ReadingDraft;
  assets: UploadedAsset[];
  consents: Record<ConsentPurpose, boolean>;
  setConsents: (value: Record<ConsentPurpose, boolean>) => void;
  required: ConsentPurpose[];
  onEdit: (step: number) => void;
}) {
  const methods = draft.methods ?? [];
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#10152b]">One last look before we begin.</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-[#6b6785]">
        Check the details that will drive the calculations. You can go back to any step without losing
        your draft.
      </p>

      <div className="mt-6 grid gap-3">
        <ReviewRow label="Methods" onEdit={() => onEdit(1)}>
          {methods.length ? methods.join(" · ") : "None selected"}
        </ReviewRow>
        <ReviewRow label="Name" onEdit={() => onEdit(2)}>
          {draft.fullName || "—"}
          {draft.preferredName ? ` (preferred: ${draft.preferredName})` : ""}
        </ReviewRow>
        <ReviewRow label="Date of birth" onEdit={() => onEdit(2)}>
          {draft.dateOfBirth || "—"}
        </ReviewRow>
        <ReviewRow label="Language" onEdit={() => onEdit(1)}>
          {draft.language === "hi" ? "Hindi" : "English"}
        </ReviewRow>
        {methods.includes("NUMEROLOGY") && (
          <ReviewRow label="Numerology" onEdit={() => onEdit(3)}>
            {draft.numerologySystem ?? "Not chosen"} · {draft.numerologyName || "spelling missing"}
          </ReviewRow>
        )}
        {methods.includes("ASTROLOGY") && (
          <ReviewRow label="Astrology" onEdit={() => onEdit(4)}>
            {draft.birthplace
              ? `${draft.birthplace.name}, ${draft.birthplace.country} · ${
                  draft.birthTimeAccuracy === "UNKNOWN" ? "time unknown" : draft.birthTime || "time missing"
                }`
              : "Birthplace missing"}
          </ReviewRow>
        )}
        {methods.includes("PALMISTRY") && (
          <ReviewRow label="Palmistry" onEdit={() => onEdit(5)}>
            {draft.dominantHand ? `${draft.dominantHand.toLowerCase()} hand dominant` : "Hand missing"} ·{" "}
            {assets.filter((asset) => asset.status === "VALIDATED").length} validated photograph(s)
          </ReviewRow>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-[0.95rem] font-semibold text-[#10152b]">Consent, one purpose at a time.</h3>
        <p className="mt-1 text-[0.78rem] text-[#6b6785]">
          Required consents are marked. Research is always optional and never a condition of the reading.
        </p>
        <div className="mt-4 grid gap-2">
          {CONSENT_PURPOSES.map((purpose) => {
            const isRequired = required.includes(purpose);
            return (
              <label key={purpose} className="check">
                <input
                  type="checkbox"
                  checked={consents[purpose]}
                  onChange={(event) => setConsents({ ...consents, [purpose]: event.target.checked })}
                />
                <span>
                  <span className="text-[0.82rem] font-medium text-[#2f2c47]">{CONSENT_LABELS[purpose]}</span>
                  <span className="ml-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#8a86a0]">
                    {isRequired ? "Required" : "Optional"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[#fbf9f4] px-4 py-3 text-[0.72rem] leading-relaxed text-[#6b6785]">
        By submitting, you understand that this is a traditional reflective reading. It is not a
        prediction, diagnosis, legal opinion or financial recommendation, and it does not guarantee
        outcomes.
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  children,
  onEdit,
}: {
  label: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#8a86a0]">{label}</p>
        <p className="mt-1 text-[0.85rem] font-medium text-[#2f2c47]">{children}</p>
      </div>
      <button type="button" className="text-[0.72rem] font-semibold text-[#6746c8] hover:underline" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}
