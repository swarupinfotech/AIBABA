import Link from "next/link";
import { DocumentShell } from "@/components/layout/DocumentShell";

export const metadata = {
  title: "Methodology",
  description:
    "How AIBABA calculates numerology, computes Vedic astrology, assesses palm photographs and uses AI — and what it deliberately does not do.",
};

const SECTIONS = [
  { id: "principles", title: "Guiding principles" },
  { id: "numerology", title: "Numerology" },
  { id: "astrology", title: "Vedic astrology" },
  { id: "palmistry", title: "Palm observation" },
  { id: "ai", title: "AI interpretation" },
  { id: "failures", title: "Failures & retries" },
  { id: "reproducibility", title: "Reproducibility" },
  { id: "refusals", title: "What we refuse" },
];

export default function MethodologyPage() {
  return (
    <DocumentShell
      eyebrow="Trust"
      title="Methodology"
      intro="AIBABA separates three kinds of information: values that were calculated deterministically, features that were visibly observed, and language that was generated as interpretation. This page explains each layer and its limits."
      sections={SECTIONS}
      cta={{ href: "/complete-life-reading", label: "See what is included", secondary: { href: "/privacy", label: "Privacy policy" } }}
    >
      <h2 id="principles">Guiding principles</h2>
      <p>
        Traditional systems are treated as traditions, not as scientific measurement. The application may
        compute a number or a planetary longitude precisely, but that precision does not turn a traditional
        interpretation into a verified fact about a person.
      </p>
      <ul>
        <li>
          <strong>Calculated facts stay calculated.</strong> Numerology and astronomy run in deterministic code,
          separately from the language model.
        </li>
        <li>
          <strong>Observed features stay observed.</strong> Palm observations describe only what is visible in
          the supplied photograph, with a confidence note.
        </li>
        <li>
          <strong>Interpretation is labelled.</strong> AI-assisted language is clearly identified as
          interpretation.
        </li>
        <li>
          <strong>Missing data stays missing.</strong> Unknown birth time, an unusable photograph or a failed
          provider produces a labelled limitation — never invented content.
        </li>
      </ul>

      <h2 id="numerology">Numerology</h2>
      <p>
        Numerology is calculated by a standalone TypeScript engine. The language model is never asked to do
        arithmetic. Every result stores the input, system, mapping version, calculation steps and final value.
      </p>
      <h3>Systems and mappings</h3>
      <p>
        Two documented letter maps are supported: <strong>Chaldean</strong> (mapping version{" "}
        <code>chaldean-v1</code>) and <strong>Pythagorean</strong> (mapping version <code>pythagorean-v1</code>).
        Chaldean assigns values 1–8 to letters and treats 9 as sacred, so the digit 9 does not appear in its
        letter map. Pythagorean assigns A–I = 1–9, J–R = 1–9 and S–Z = 1–8. The two systems can legitimately
        produce different numbers for the same name.
      </p>
      <h3>Reduction and master numbers</h3>
      <p>
        Numbers are reduced by summing digits until a single digit is reached. The master numbers{" "}
        <strong>11, 22 and 33</strong> are preserved rather than reduced further. Chaldean results also retain
        the compound number before reduction, and a documented compound meaning is shown where one exists.
      </p>
      <h3>Names and transliteration</h3>
      <p>
        Names are normalised with Unicode decomposition, accents are removed and non-letter characters are
        ignored. Non-Latin scripts are not guessed at: the engine requires a Latin transliteration, and the
        wizard asks you to review and correct the spelling used in the calculation.
      </p>
      <h3>Numbers calculated</h3>
      <ul>
        <li>Birth Number — from the day of birth.</li>
        <li>Life Path Number — from the full date of birth.</li>
        <li>Destiny / Expression Number — from the full name.</li>
        <li>Soul Urge Number — from the vowels in the name.</li>
        <li>Personality Number — from the consonants in the name.</li>
        <li>Personal Year and Personal Month — from the birth day/month and the current cycle.</li>
      </ul>
      <p>
        The vowel rule is deterministic and documented in the engine: Y acts as a vowel when a word contains no
        A/E/I/O/U, or when Y sits between two consonants; otherwise Y is treated as a consonant. The rule used
        is printed with the result.
      </p>

      <h2 id="astrology">Vedic astrology</h2>
      <p>
        Astronomical positions come from the open-source{" "}
        <code>astronomy-engine</code> library, not from the language model. The provider name and version are
        stored with every calculation.
      </p>
      <h3>Zodiac and ayanamsa</h3>
      <p>
        The chart uses the <strong>sidereal zodiac</strong> with a <strong>Lahiri (Chitrapaksha)</strong>{" "}
        ayanamsa. The implementation uses the standard J2000 ayanamsa value plus IAU general precession, which
        is accurate to a few arcseconds for 1900–2100 when compared with Swiss Ephemeris Lahiri. It is an
        approximation, and the value used is stored with the reading.
      </p>
      <h3>Positions, houses and Dasha</h3>
      <p>
        Planetary longitudes are converted to sidereal degrees, rashis and nakshatras with padas. Houses use the{" "}
        <strong>whole-sign</strong> system. The lunar nodes use the <strong>mean node</strong>. Vimshottari
        Dasha is computed from the Moon&apos;s nakshatra position using the standard 120-year cycle.
      </p>
      <p>
        The <strong>D9 navamsa</strong> chart is derived from the same stored longitudes and is displayed with
        the rashi (D1) chart. Other divisional charts are <strong>not</strong> calculated; the report does not
        invent them rather than approximating or fabricating a placement. Transits are only described where
        validated transit data exists for the reading.
      </p>
      <h3>Unknown or approximate birth time</h3>
      <p>
        Birth time is never silently assumed. If the time is unknown, the ascendant, house-based
        interpretation and Dasha timeline are withheld and labelled unavailable; planetary sign and nakshatra
        information that does not depend on the exact time can still be shown. Approximate times are labelled
        as approximate and the resulting uncertainty is stated near the chart.
      </p>

      <h2 id="palmistry">Palm observation</h2>
      <p>
        Palm photographs are validated for MIME type, file-signature, dimensions, size and quality before any
        analysis. Files are re-encoded so unnecessary EXIF metadata is stripped, then stored privately and
        served through short-lived signed URLs.
      </p>
      <p>
        The observation step looks for the five major lines — heart, head, life, fate and sun — plus clearly
        distinguishable intersections, palm shape and mount regions. Each feature is returned with a visibility
        status, confidence indicator, traditional interpretation and an uncertainty note. A line that cannot be
        seen reliably is marked <code>NOT_ASSESSED</code>; it is not inferred.
      </p>
      <p>
        When the configured provider has no vision capability, the reading is marked{" "}
        <strong>LIMITED</strong> and every feature is <code>NOT_ASSESSED</code>. The report says the photograph
        could not be interpreted rather than manufacturing observations. Photographs are never used for
        identity recognition, biometric identification or unrelated sensitive-trait inference.
      </p>

      <h2 id="ai">AI interpretation</h2>
      <p>
        The AI layer receives only validated calculation results, validated palm observations and the language
        you selected. It is asked to explain, not to calculate or observe. The system instruction forbids
        inventing lines, positions, numbers, birth details, Dasha periods or chart placements.
      </p>
      <p>
        Output is requested as structured JSON and validated against a schema before storage. Malformed,
        incomplete or unsafe responses are rejected and the job is retried or failed transparently. Prompts and
        model identifiers are versioned and recorded with the report. Provider credentials stay server-side and
        are never exposed to the browser.
      </p>
      <p>
        The default local provider is deliberately limited: it produces honest, clearly labelled interpretation
        from the structured inputs without calling an external model. OpenAI and Gemini adapters are available
        when configured by the operator.
      </p>

      <h2 id="failures">Failures and retries</h2>
      <p>
        Each method runs as an independent, idempotent background job with an idempotency key, attempt count,
        exponential backoff and a maximum retry limit. A failed component does not get replaced with generated
        content. The reading becomes <strong>PARTIALLY_COMPLETED</strong> or <strong>FAILED</strong> with the
        failing module labelled, and eligible jobs can be retried without duplicating published output.
      </p>
      <p>
        A report is only published after the required underlying operations for the selected methods have
        succeeded or been explicitly marked unavailable. The processing page shows each component&apos;s status
        separately.
      </p>

      <h2 id="reproducibility">Reproducibility and versioning</h2>
      <p>
        Every reading records an input snapshot version, numerology mapping version, astrology provider version,
        calculation settings and report prompt/model versions. Re-running a calculation with the same inputs and
        settings produces the same numbers and positions. Interpretation wording may differ between model
        versions, which is why the model and prompt versions are printed with the report.
      </p>

      <h2 id="refusals">What AIBABA refuses to do</h2>
      <ul>
        <li>Invent a palm line, planetary degree, numerical result or Dasha period.</li>
        <li>Fill in an unknown birth time or silently choose a timezone.</li>
        <li>Guarantee money, marriage, health, lifespan, pregnancy or any future event.</li>
        <li>Predict death, disease, criminal behaviour or unavoidable harm.</li>
        <li>Provide medical, legal, financial or investment decisions.</li>
        <li>Create fear, urgency or pressure to buy remedies, gemstones or consultations.</li>
        <li>Pretend the AI is a human astrologer.</li>
      </ul>
      <p>
        This page describes the implementation. It is not a claim of scientific validity for traditional
        interpretation, and it is not legal advice. See the{" "}
        <Link href="/privacy">privacy policy</Link> and <Link href="/terms">terms</Link> for the product
        boundaries.
      </p>
    </DocumentShell>
  );
}
