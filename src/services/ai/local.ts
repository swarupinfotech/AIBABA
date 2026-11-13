import type {
  AIProvider,
  AIRequest,
  AIResult,
  AIChatRequest,
} from "@/services/ai/types";
import { estimateCost } from "@/services/ai/types";
import {
  PalmObservationSchema,
  PalmInterpretationSchema,
  NumerologyInterpretationSchema,
  VedicInterpretationSchema,
  ReportDocumentSchema,
  SafetyValidationSchema,
  FollowUpSchema,
  type ReportBlock,
  type ReportSection,
} from "@/services/ai/schemas";
import type { SynthesisContext, FollowUpContext } from "@/services/ai/context";
import type { NumerologyCalculation } from "@/services/numerology";
import type { AstrologyResult, PlanetPosition } from "@/services/astrology";

const NUMBER_THEMES: Record<number, string[]> = {
  1: ["initiative", "leadership", "independence"],
  2: ["partnership", "sensitivity", "cooperation"],
  3: ["communication", "creativity", "expression"],
  4: ["structure", "discipline", "craft"],
  5: ["change", "freedom", "curiosity"],
  6: ["care", "responsibility", "harmony"],
  7: ["reflection", "analysis", "depth"],
  8: ["ambition", "stewardship", "responsibility"],
  9: ["compassion", "service", "completion"],
  11: ["intuition", "inspiration", "sensitivity"],
  22: ["vision", "construction", "responsibility"],
  33: ["guidance", "compassion", "service"],
};

const SIGN_THEMES: Record<string, string[]> = {
  Aries: ["initiative", "courage", "independence"],
  Taurus: ["stability", "patience", "craft"],
  Gemini: ["communication", "curiosity", "adaptability"],
  Cancer: ["care", "memory", "harmony"],
  Leo: ["expression", "leadership", "creativity"],
  Virgo: ["analysis", "service", "discipline"],
  Libra: ["partnership", "balance", "harmony"],
  Scorpio: ["depth", "transformation", "focus"],
  Sagittarius: ["meaning", "exploration", "optimism"],
  Capricorn: ["structure", "ambition", "responsibility"],
  Aquarius: ["innovation", "community", "independence"],
  Pisces: ["compassion", "imagination", "reflection"],
};

const PLANET_THEMES: Record<string, string> = {
  Sun: "identity and vitality",
  Moon: "mind, habits and emotional rhythm",
  Mars: "energy, courage and how effort is applied",
  Mercury: "communication, learning and analysis",
  Jupiter: "growth, perspective and opportunity",
  Venus: "relationships, values and aesthetic sense",
  Saturn: "discipline, responsibility and long-term structure",
  Rahu: "ambition, unconventional drive and worldly desire",
  Ketu: "detachment, introspection and completion",
};

const DASHA_THEMES: Record<string, string> = {
  Ketu: "simplification, detachment and quiet recalibration",
  Venus: "relationships, creativity and refinement",
  Sun: "identity, visibility and purposeful direction",
  Moon: "emotional rhythm, care and changing seasons",
  Mars: "energy, courage and decisive effort",
  Rahu: "ambition, experimentation and unconventional growth",
  Jupiter: "learning, perspective and constructive expansion",
  Saturn: "discipline, patience and durable structure",
  Mercury: "communication, study and practical adaptation",
};

const NAKSHATRA_THEMES: Record<string, string> = {
  Ashwini: "quick starts, initiative and a taste for discovery",
  Bharani: "creative intensity, endurance and responsibility",
  Krittika: "precision, courage and the refining of raw energy",
  Rohini: "growth, attraction and patient cultivation",
  Mrigashira: "curiosity, searching and gentle movement",
  Ardra: "clearing, reinvention and emotional honesty",
  Punarvasu: "renewal, optimism and returning to what matters",
  Pushya: "nourishment, reliability and steady care",
  Ashlesha: "insight, strategy and the need for trust",
  Magha: "lineage, pride and responsibility to what came before",
  "Purva Phalguni": "warmth, creativity and enjoyment of life",
  "Uttara Phalguni": "commitment, service and generous partnership",
  Hasta: "skill, craft and practical helpfulness",
  Chitra: "design, individuality and visible creativity",
  Swati: "independence, movement and diplomacy",
  Vishakha: "determination, ambition and focused effort",
  Anuradha: "loyalty, devotion and lasting friendship",
  Jyeshtha: "seniority, depth and responsible authority",
  Mula: "root inquiry, honesty and radical re-examination",
  "Purva Ashadha": "persuasion, optimism and cleansing momentum",
  "Uttara Ashadha": "integrity, endurance and long-term achievement",
  Shravana: "listening, learning and cultural connection",
  Dhanishta: "rhythm, capability and communal contribution",
  Shatabhisha: "research, independence and unconventional insight",
  "Purva Bhadrapada": "intensity, vision and transformation",
  "Uttara Bhadrapada": "depth, patience and compassionate stability",
  Revati: "care, completion and protective wisdom",
};

const DISCLOSURES = {
  traditional:
    "This report presents interpretations from traditional palmistry, numerology and Vedic astrology methods using the information provided. These traditions are cultural and interpretive, not scientifically validated measurements of character or future outcomes.",
  ai: "Narrative explanations are AI-assisted. Calculated numbers and astronomical positions come from deterministic services; interpretations are generated from those validated inputs. AI text can be incomplete or mistaken.",
  uncertainty:
    "Confidence varies by input quality. Blurry or partial palm photographs, approximate birth times and unknown birth times limit what can responsibly be interpreted. Limitations are labelled in each section.",
  notPredictive:
    "This reading does not guarantee events, outcomes or dates. It is offered for personal interest and reflection, not as medical, legal, financial or psychological advice.",
};

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset) % items.length];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sentenceList(items: string[]): string {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function section(
  id: string,
  title: string,
  kind: ReportSection["kind"],
  intro: string,
  blocks: ReportBlock[],
): ReportSection {
  return { id, title, kind, intro, blocks };
}

function statusFor(context: SynthesisContext, module: string) {
  return context.moduleStatuses.find((m) => m.module === module)?.status ?? "NOT_SELECTED";
}

function numerologyTags(calculation: NumerologyCalculation | undefined): string[] {
  if (!calculation) return [];
  const keys: Array<keyof NumerologyCalculation["numbers"]> = [
    "lifePath",
    "destiny",
    "soulUrge",
    "personality",
    "personalYear",
  ];
  return unique(keys.flatMap((key) => NUMBER_THEMES[calculation.numbers[key].value] ?? []));
}

function astrologyTags(astrology: AstrologyResult | undefined): string[] {
  if (!astrology) return [];
  const tags: string[] = [];
  if (astrology.ascendant) tags.push(...(SIGN_THEMES[astrology.ascendant.sign] ?? []));
  const moon = astrology.planets.find((p) => p.name === "Moon");
  if (moon) tags.push(...(SIGN_THEMES[moon.sign] ?? []));
  return unique(tags);
}

function planetRows(planets: PlanetPosition[]) {
  return planets.map((p) => ({
    name: p.name,
    sign: p.sign,
    degree: Number(p.degreeInSign.toFixed(2)),
    nakshatra: p.nakshatra.name,
    pada: p.nakshatra.pada,
    house: p.house,
    retrograde: p.retrograde,
  }));
}

export class LocalInterpretationProvider implements AIProvider {
  name = "local";
  model = "local-interpreter-v1";

  async available(): Promise<boolean> {
    return true;
  }

  async generateStructuredOutput<T>(input: AIRequest<T>): Promise<AIResult<T>> {
    const started = Date.now();
    let output: unknown;
    switch (input.task) {
      case "PALM_OBSERVATION":
        output = this.palmObservation(input.context);
        break;
      case "PALM_INTERPRETATION":
        output = this.palmInterpretation(input.context);
        break;
      case "NUMEROLOGY_INTERPRETATION":
        output = this.numerologyInterpretation(input.context);
        break;
      case "VEDIC_INTERPRETATION":
        output = this.vedicInterpretation(input.context);
        break;
      case "LIFE_SYNTHESIS":
        output = this.synthesis(input.context as SynthesisContext);
        break;
      case "SAFETY_VALIDATION":
        output = this.safetyValidation((input.context as { text: string })?.text ?? "");
        break;
      case "FOLLOW_UP":
        output = this.followUp(input.context as FollowUpContext);
        break;
      default:
        output = this.synthesis(input.context as SynthesisContext);
    }
    const parsed = input.schema.parse(output) as T;
    const latencyMs = Date.now() - started;
    return {
      data: parsed,
      provider: this.name,
      promptVersion: input.promptVersion,
      usage: {
        provider: this.name,
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: estimateCost(this.model, 0, 0),
        latencyMs,
      },
    };
  }

  async *generateStreamingResponse(input: AIChatRequest): AsyncIterable<string> {
    const context = input.context as FollowUpContext | undefined;
    if (!context) {
      yield "I can answer questions about your saved report once it is available.";
      return;
    }
    const result = this.followUp(context);
    const text = result.answer;
    const words = text.split(/(\s+)/);
    let chunk = "";
    for (const word of words) {
      chunk += word;
      if (chunk.length > 18) {
        yield chunk;
        chunk = "";
      }
    }
    if (chunk) yield chunk;
  }

  private palmObservation(context: unknown) {
    const quality = (context as {
      quality?: { status?: string; score?: number; issues?: Array<{ message: string }> };
    })?.quality;
    const issues = quality?.issues?.map((i) => i.message) ?? [];
    return PalmObservationSchema.parse({
      quality: {
        fullPalmVisible: null,
        linesDistinguishable: null,
        lighting: quality?.status === "PASS" ? "fair" : "unknown",
        notes: [
          "Palm-line features were not assessed for this reading.",
          ...(quality?.score !== undefined ? [`Local photographic quality score: ${quality.score}/100.`] : []),
        ],
      },
      features: ["Heart line", "Head line", "Life line", "Fate line", "Sun line"].map((name) => ({
        name,
        status: "NOT_ASSESSED",
        location: "Not assessed",
        confidence: 0,
        interpretation: "",
        uncertainty:
          "AIBABA will not describe a line it has not reliably observed. A retake in soft, even light may help, or contact support.",
      })),
      summary:
        "The photograph passed file and quality checks. Palm lines were not assessed for this reading, so no line-by-line interpretation is presented.",
      limitations: [
        "Palm features were not assessed for this reading.",
        "Only file validity and photographic quality were measured.",
        ...issues,
      ],
      retakeRecommended: quality?.status !== "PASS",
      safetyFlags: ["VISION_PROVIDER_UNAVAILABLE"],
    });
  }

  private palmInterpretation(context: unknown) {
    const observation = (context as { observation: ReturnType<typeof PalmObservationSchema.parse> }).observation;
    const visible = observation.features.filter((f) => f.status === "VISIBLE" || f.status === "FAINT");
    return PalmInterpretationSchema.parse({
      overview: visible.length
        ? "The following interpretations apply only to the lines marked visible or faint in the structured observation."
        : "No palm line could be reliably confirmed in the supplied photograph, so a traditional line-by-line interpretation is not presented.",
      observations: visible.map((f) => ({
        feature: f.name,
        visibility: f.status,
        meaning: f.interpretation,
        uncertainty: f.uncertainty,
      })),
      careerThemes: [],
      relationshipThemes: [],
      growthThemes: [],
      limitations: [...observation.limitations, "Palmistry is a traditional interpretive practice, not a measurement of health, lifespan or guaranteed events."],
      disclaimer:
        "Traditional palmistry readings are interpretive and cultural. AIBABA does not infer identity, health, lifespan or sensitive traits from hand photographs.",
    });
  }

  private numerologyInterpretation(context: unknown) {
    const calculation = (context as { calculation: NumerologyCalculation }).calculation;
    const numbers = Object.values(calculation.numbers);
    const systemLabel = calculation.system === "CHALDEAN" ? "Chaldean" : "Pythagorean";
    const seed = hashString(calculation.input.normalizedName + calculation.input.dateOfBirth);

    const strengths = unique(
      numbers.flatMap((n) => (n.meaning?.strengths ?? []).slice(0, 2)),
    ).slice(0, 6);
    const reflections = unique(
      numbers.flatMap((n) => (n.meaning?.reflections ?? []).slice(0, 1)),
    ).slice(0, 6);

    return NumerologyInterpretationSchema.parse({
      overview: `Using the ${systemLabel} system (${calculation.mappingVersion}), the calculator found a Life Path ${calculation.numbers.lifePath.value}, a Birth Number ${calculation.numbers.birthNumber.value} and a Destiny/Expression Number ${calculation.numbers.destiny.value}. These are deterministic results from the documented mapping; the narrative below is a traditional interpretation. ${pick(
        [
          "Read these as reflective lenses rather than fixed verdicts.",
          "The numbers describe recurring themes, not a script for your life.",
          "Treat the profile as a set of questions to test against lived experience.",
        ],
        seed,
      )}`,
      numbers: numbers.map((n) => ({
        key: n.key,
        label: n.label,
        value: n.value,
        heading: n.meaning?.title ?? `Number ${n.value}`,
        body: `${n.meaning?.essence ?? "Traditional numerology assigns a theme to this number."} ${n.meaning?.strengths?.length ? `Traditional strengths include ${sentenceList(n.meaning.strengths)}.` : ""} ${n.meaning?.reflections?.length ? `A reflective question: ${n.meaning.reflections[0]}` : ""} ${n.compoundMeaning ? `Chaldean compound ${n.compound}: ${n.compoundMeaning}` : ""}`.trim(),
      })),
      strengths,
      reflections,
      methodNote: `${systemLabel} mapping ${calculation.mappingVersion}. ${calculation.notes.join(" ")}`,
      disclaimer:
        "Numerology is a traditional interpretive system. These results are not scientifically validated predictions or measurements of ability.",
    });
  }

  private vedicInterpretation(context: unknown) {
    const astrology = (context as { astrology: AstrologyResult }).astrology;
    const moon = astrology.planets.find((p) => p.name === "Moon")!;
    const sun = astrology.planets.find((p) => p.name === "Sun")!;
    const ascendant = astrology.ascendant;
    const seed = hashString(astrology.birth.utc);

    const themes = unique([
      ...(ascendant ? SIGN_THEMES[ascendant.sign] ?? [] : []),
      ...(SIGN_THEMES[moon.sign] ?? []),
      ...(SIGN_THEMES[sun.sign] ?? []),
    ]).slice(0, 6);

    return VedicInterpretationSchema.parse({
      overview: `This sidereal reading uses Lahiri ayanamsa ${astrology.settings.ayanamsaValue.toFixed(4)}° and whole-sign houses. The Sun is in ${sun.sign}, the Moon is in ${moon.sign} in ${moon.nakshatra.name} nakshatra (pada ${moon.nakshatra.pada}). ${pick(
        [
          "Vedic interpretation reads these placements as symbolic patterns, not as guaranteed events.",
          "Traditional meaning is most useful when treated as a reflective vocabulary.",
          "The chart is a map of traditional symbolism, not a forecast of fixed outcomes.",
        ],
        seed,
      )}`,
      ascendant: ascendant
        ? `The ascendant is ${ascendant.sign} at ${ascendant.degreeInSign.toFixed(2)}°, in ${ascendant.nakshatra.name} nakshatra. In the whole-sign system this sets the first house and the sequence of twelve houses.`
        : "The ascendant is not calculated because birth time was marked unknown. House-based interpretations are intentionally withheld rather than guessed.",
      moon: `The Moon in ${moon.sign} / ${moon.nakshatra.name} is traditionally associated with ${NAKSHATRA_THEMES[moon.nakshatra.name] ?? "emotional rhythm and mental patterns"}.${
        astrology.uncertainty.moonRange?.mayChangeNakshatra
          ? " With an unknown birth time, the Moon may cross a nakshatra boundary on this date, so this is not asserted as certain."
          : ""
      }`,
      placements: astrology.planets.map((p) => ({
        planet: p.name,
        note: `${p.name} in ${p.sign}${p.house ? `, house ${p.house}` : ""}${p.retrograde ? " (retrograde)" : ""} — ${PLANET_THEMES[p.name]} expressed through ${sentenceList(SIGN_THEMES[p.sign] ?? ["its sign themes"])}.`,
      })),
      themes,
      limitations: astrology.uncertainty.notes.length
        ? astrology.uncertainty.notes
        : ["Vedic astrology is a traditional interpretive framework, not a scientifically verified prediction."],
      disclaimer:
        "Chart calculations come from a dedicated astronomical engine with the configured Lahiri ayanamsa. Interpretations are traditional and reflective, never guarantees.",
    });
  }

  private synthesis(context: SynthesisContext): unknown {
    const seed = hashString(`${context.preferredName}:${context.dateOfBirth}:${context.selectedModules.join(",")}`);
    const name = context.preferredName || context.displayName || "Reader";
    const calc = context.numerology;
    const astro = context.astrology;
    const palm = context.palmObservation;
    const palmInterp = context.palmInterpretation;
    const selected = (m: string) => context.selectedModules.includes(m);
    const status = (m: string) => statusFor(context, m);
    const numTags = numerologyTags(calc);
    const astroTags = astrologyTags(astro);
    const shared = numTags.filter((t) => astroTags.includes(t));

    const numbers = calc ? Object.values(calc.numbers) : [];
    const lp = calc?.numbers.lifePath;
    const dest = calc?.numbers.destiny;
    const venus = astro?.planets.find((p) => p.name === "Venus");
    const tenthHouse = astro?.houses?.find((h) => h.house === 10);
    const seventhHouse = astro?.houses?.find((h) => h.house === 7);
    const fourthHouse = astro?.houses?.find((h) => h.house === 4);

    const sections: ReportSection[] = [];

    const statusLines = context.moduleStatuses.map(
      (m) => `${m.module}: ${m.status.replaceAll("_", " ").toLowerCase()} — ${m.method}. ${m.note}`,
    );
    sections.push(
      section(
        "overview",
        "Your Personal Overview",
        "OVERVIEW",
        `Hello ${name}. This Complete Life Reading brings together the methods you selected, keeping calculation, observation and interpretation visibly separate.`,
        [
          {
            type: "paragraph",
            text: `Your reading was prepared from ${
              selected("NUMEROLOGY") ? "deterministic numerology calculations" : "your profile"
            }${selected("ASTROLOGY") ? ", a sidereal Vedic chart calculated by a dedicated astronomy engine" : ""}${
              selected("PALMISTRY") ? ", and a private palm-photograph quality and observation workflow" : ""
            }. Traditional interpretations are offered as reflective material — not as fixed claims about your character or future.`,
          },
          { type: "list", items: statusLines },
          {
            type: "callout",
            tone: "traditional",
            title: "How to read this report",
            text: "Calculated facts and visible observations are labelled separately from AI-assisted interpretation. Where a method could not be completed reliably, this report says so instead of filling the gap with invented content.",
          },
        ],
      ),
    );

    // Palmistry
    if (!selected("PALMISTRY")) {
      sections.push(
        section(
          "palmistry",
          "Palmistry Insights",
          "PALMISTRY",
          "Palmistry was not selected for this reading.",
          [{ type: "callout", tone: "info", title: "Not included", text: "No palm photograph was analysed. Palmistry themes do not contribute to the synthesis in this report." }],
        ),
      );
    } else if (palm && palm.features.some((f) => f.status === "VISIBLE" || f.status === "FAINT")) {
      const visible = palm.features.filter((f) => f.status === "VISIBLE" || f.status === "FAINT");
      sections.push(
        section(
          "palmistry",
          "Palmistry Insights",
          "PALMISTRY",
          palmInterp?.overview ?? "Only the palm features that were actually observed are described here.",
          [
            {
              type: "featureCards",
              features: visible.map((f) => ({
                name: f.name,
                status: f.status,
                confidence: f.confidence,
                observation: f.location,
                interpretation: f.interpretation,
                uncertainty: f.uncertainty,
              })),
            },
            ...(palmInterp?.careerThemes?.length
              ? [{ type: "list" as const, items: palmInterp.careerThemes }]
              : []),
            {
              type: "callout",
              tone: "caution",
              title: "Uncertainty and limits",
              text: (palmInterp?.limitations ?? palm.limitations).join(" "),
            },
          ],
        ),
      );
    } else {
      const quality = context.palmImageQuality;
      sections.push(
        section(
          "palmistry",
          "Palmistry Insights",
          "PALMISTRY",
          "The palm photograph was handled privately and checked for photographic quality, but no palm lines could be reliably confirmed.",
          [
            {
              type: "callout",
              tone: "caution",
              title: "No palm-line interpretation presented",
              text:
                status("PALMISTRY") === "LIMITED"
                  ? "AIBABA will not invent visible lines. Palm-line assessment was not available for this reading, so no features were inferred. Retake the photograph with the whole palm in frame, or contact support for a visual review."
                  : "The photograph did not meet the minimum quality or visibility requirements. Retake it with the whole palm in frame, even natural light and no filters.",
            },
            ...(quality
              ? [
                  {
                    type: "paragraph" as const,
                    text: `Measured image quality: ${quality.score}/100 (${quality.status.replaceAll("_", " ").toLowerCase()}). These measurements concern the photograph only, not the person.`,
                  },
                ]
              : []),
            {
              type: "list",
              items: [
                "Keep the entire palm visible, including the wrist crease and fingertips.",
                "Use soft, even natural light and avoid a shadow across the centre of the palm.",
                "Keep fingers comfortably separated and hold the camera steady.",
                "Avoid filters, beauty modes, heavy compression and flash.",
              ],
            },
          ],
        ),
      );
    }

    // Numerology
    if (!selected("NUMEROLOGY") || !calc) {
      sections.push(
        section("numerology", "Numerology Profile", "NUMEROLOGY", "Numerology was not selected for this reading.", [
          { type: "callout", tone: "info", title: "Not included", text: "No numerology calculation was run. No numbers are invented for this section." },
        ]),
      );
    } else {
      const interp = context.numerologyInterpretation;
      sections.push(
        section(
          "numerology",
          "Numerology Profile",
          "NUMEROLOGY",
          interp?.overview ?? `Calculated with the ${calc.system === "CHALDEAN" ? "Chaldean" : "Pythagorean"} system.`,
          [
            {
              type: "numberCards",
              numbers: numbers.map((n) => ({
                label: n.label,
                value: String(n.value),
                title: n.meaning?.title ?? `Number ${n.value}`,
                detail: `${n.meaning?.essence ?? ""} ${n.compound ? `Chaldean compound number: ${n.compound}.` : ""}`.trim(),
                method: n.calculation,
              })),
            },
            {
              type: "calculation",
              title: "How these numbers were calculated",
              steps: numbers.map((n) => `${n.label}: ${n.calculation}`),
              note: `Mapping version ${calc.mappingVersion}. Master numbers 11, 22 and 33 are preserved. Reference date ${calc.input.referenceDate}.`,
            },
            ...(interp?.strengths?.length ? [{ type: "list" as const, items: interp.strengths }] : []),
            ...(interp?.reflections?.length
              ? [{ type: "reflections" as const, prompts: interp.reflections }]
              : []),
            { type: "callout", tone: "traditional", title: "Traditional method", text: interp?.methodNote ?? calc.notes.join(" ") },
          ],
        ),
      );
    }

    // Vedic
    if (!selected("ASTROLOGY") || !astro) {
      sections.push(
        section("vedic", "Vedic Astrology Overview", "VEDIC", "Vedic astrology was not selected for this reading.", [
          { type: "callout", tone: "info", title: "Not included", text: "No birth chart was calculated. No planetary positions or Dasha periods are invented for this section." },
        ]),
      );
    } else {
      const interp = context.astrologyInterpretation;
      sections.push(
        section(
          "vedic",
          "Vedic Astrology Overview",
          "VEDIC",
          interp?.overview ?? "Sidereal chart data calculated by a dedicated astronomy engine.",
          [
            ...(interp?.ascendant
              ? [{ type: "paragraph" as const, text: interp.ascendant }]
              : []),
            ...(interp?.moon ? [{ type: "paragraph" as const, text: interp.moon }] : []),
            {
              type: "planetTable",
              rows: planetRows(astro.planets),
              note: `Sidereal zodiac · Lahiri ayanamsa ${astro.settings.ayanamsaValue.toFixed(4)}° · ${astro.settings.houseSystem.replaceAll("_", " ").toLowerCase()}${astro.birth.assumedTime ? " · birth time unknown, positions are a date-only snapshot" : ""}.`,
            },
            ...(astro.dasha
              ? [
                  {
                    type: "dashaTimeline" as const,
                    periods: astro.dasha.periods.map((p) => ({
                      lord: p.lord,
                      start: p.start.slice(0, 10),
                      end: p.end.slice(0, 10),
                      years: Number(p.years.toFixed(2)),
                      isBalanceAtBirth: p.isBalanceAtBirth,
                    })),
                    note: `Vimshottari Mahadasha from Moon nakshatra ${astro.dasha.moonNakshatra}; balance at birth ${astro.dasha.balanceYears.toFixed(2)} years. Dates use a 365.2425-day year and are approximate.`,
                  },
                ]
              : []),
            ...(interp?.themes?.length ? [{ type: "list" as const, items: interp.themes }] : []),
            {
              type: "callout",
              tone: "caution",
              title: "Calculation limits",
              text: astro.uncertainty.notes.length
                ? astro.uncertainty.notes.join(" ")
                : "The ascendant, D9 and Dasha depend on birth time. This reading used the time and accuracy you supplied.",
            },
          ],
        ),
      );
    }

    // Personality
    const sharedText = shared.length
      ? `Two or more methods independently surface the theme of ${sentenceList(shared.slice(0, 4))}. This is a genuine overlap in the supplied interpretations, not a claim that the traditions prove one another.`
      : "No single theme was independently supported by more than one selected system, so this report does not claim a consensus. The separate lenses are kept below.";
    sections.push(
      section("personality", "Personality Reflection", "PERSONALITY", "Themes are presented as lenses for reflection, not as a fixed description of who you are.", [
        { type: "paragraph", text: sharedText },
        ...(numTags.length
          ? [{ type: "list" as const, items: [`Numerology themes (${calc?.system.toLowerCase()}): ${sentenceList(numTags.slice(0, 6))}.`] }]
          : []),
        ...(astroTags.length
          ? [{ type: "list" as const, items: [`Vedic/chart themes: ${sentenceList(astroTags.slice(0, 6))}.`] }]
          : []),
        {
          type: "reflections",
          prompts: [
            `Which of these themes feels most familiar in your daily life right now, ${name}?`,
            "Where does a theme describe a habit you have outgrown rather than a fixed trait?",
            "Which theme would a trusted friend recognise, and which would surprise them?",
          ],
        },
      ]),
    );

    // Career
    const careerNumber = dest ?? lp;
    const careerAstro = tenthHouse
      ? `In the whole-sign chart, the tenth house falls in ${tenthHouse.sign}${tenthHouse.planets.length ? ` with ${tenthHouse.planets.join(", ")}` : " with no planets placed there"}. Traditionally this is read as a career and public-role house.`
      : "Because birth time is unknown, the tenth house is intentionally not calculated. Career reflection therefore relies only on the available numerology.";
    sections.push(
      section("career", "Career and Learning Themes", "CAREER", "Traditional career themes and practical learning reflections. No job, promotion, income or business outcome is guaranteed.", [
        {
          type: "paragraph",
          text: `${careerNumber?.meaning ? `${careerNumber.meaning.title}: ${careerNumber.meaning.career}` : "No numerology career theme is available."} ${careerAstro}`,
        },
        ...(selected("NUMEROLOGY") && lp?.meaning
          ? [{ type: "list" as const, items: [`Learning style suggested by Life Path ${lp.value}: ${lp.meaning.strengths.join(", ")}.`, `A practical experiment: choose one small project this month that lets you practise ${lp.meaning.strengths[0]}.`] }]
          : []),
        {
          type: "callout",
          tone: "caution",
          title: "No outcome guaranteed",
          text: "Career interpretation is a reflective tool. It cannot promise a job, promotion, business success, income or timing. Decisions should rest on your circumstances, skills and qualified advice where needed.",
        },
      ]),
    );

    // Relationships
    const relNum = calc?.numbers.soulUrge;
    const venusSign = venus?.sign;
    const seventh = seventhHouse
      ? `The seventh house of partnership is in ${seventhHouse.sign}${seventhHouse.planets.length ? ` with ${seventhHouse.planets.join(", ")}` : ""}.`
      : "The seventh house is withheld because birth time is unknown.";
    sections.push(
      section("relationships", "Relationships and Communication", "RELATIONSHIPS", "Communication and relationship themes are offered as reflection, never as a verdict about you or a partner.", [
        {
          type: "paragraph",
          text: `${relNum?.meaning ? `Soul Urge ${relNum.value} (${relNum.meaning.title}) points toward ${sentenceList(relNum.meaning.strengths)}.` : "No numerology relationship theme is available."} ${
            venusSign ? `Venus is in ${venusSign}, traditionally linked with values, affection and aesthetic preference.` : ""
          } ${seventh}`,
        },
        ...(context.palmInterpretation?.relationshipThemes?.length
          ? [{ type: "list" as const, items: context.palmInterpretation.relationshipThemes }]
          : []),
        {
          type: "reflections",
          prompts: [
            "What do you need to say clearly that you have been hinting at?",
            "Where would curiosity serve a relationship better than assumption?",
            "What boundary would make your care more sustainable?",
          ],
        },
      ]),
    );

    // Growth
    const growthPrompts = [
      ...numbers.flatMap((n) => n.meaning?.reflections ?? []).slice(0, 4),
      ...(astro?.uncertainty.notes ?? []).slice(0, 1),
      "Choose one interpretation from this report and test it against a real week of your life.",
    ].slice(0, 6);
    sections.push(
      section("growth", "Personal Growth", "GROWTH", "Constructive areas for self-reflection drawn from the available traditions.", [
        { type: "reflections", prompts: growthPrompts },
        {
          type: "callout",
          tone: "info",
          title: "A note on uncertainty",
          text: DISCLOSURES.uncertainty,
        },
      ]),
    );

    // Upcoming 30 / 90
    const personalMonth = calc?.numbers.personalMonth;
    const personalYear = calc?.numbers.personalYear;
    const currentDasha = astro?.dasha?.periods.find(
      (p) => new Date(p.start) <= new Date() && new Date(p.end) > new Date(),
    );
    const dashaTheme = currentDasha ? DASHA_THEMES[currentDasha.lord] : null;

    sections.push(
      section("upcoming-30", "Upcoming 30-Day Reflection Themes", "UPCOMING_30", "These are optional reflection themes, not predictions or dates of events.", [
        {
          type: "paragraph",
          text: `${personalMonth?.meaning ? `Personal Month ${personalMonth.value} (${personalMonth.meaning.title}) is associated with ${personalMonth.meaning.essence.toLowerCase()}` : "No personal-month calculation is available."}${
            dashaTheme ? ` The current Vimshottari Mahadasha of ${currentDasha?.lord} adds a traditional theme of ${dashaTheme}.` : ""
          }`,
        },
        {
          type: "reflections",
          prompts: [
            "What would a calm, experimental version of this theme look like for the next four weeks?",
            "Which small habit would you like to observe without judging yourself?",
            "Where could you create more space for rest while staying engaged?",
          ],
        },
        { type: "callout", tone: "caution", title: "No event prediction", text: "Nothing here forecasts a specific event, opportunity or outcome. Use it only as a set of optional prompts." },
      ]),
    );

    const transitJupiter = astro?.transits.planets.find((p) => p.name === "Jupiter");
    const transitSaturn = astro?.transits.planets.find((p) => p.name === "Saturn");
    sections.push(
      section("upcoming-90", "Upcoming 90-Day Reflection Themes", "UPCOMING_90", "A longer reflection horizon based on the selected tradition's cycles.", [
        {
          type: "paragraph",
          text: `${personalYear?.meaning ? `Personal Year ${personalYear.value} (${personalYear.meaning.title}) centres on ${personalYear.meaning.essence.toLowerCase()}` : "No personal-year calculation is available."}${
            transitJupiter ? ` Jupiter's current sidereal transit through ${transitJupiter.sign} is traditionally associated with ${sentenceList(SIGN_THEMES[transitJupiter.sign] ?? [])}.` : ""
          }${transitSaturn ? ` Saturn is transiting ${transitSaturn.sign}, a traditional theme of ${sentenceList(SIGN_THEMES[transitSaturn.sign] ?? [])}.` : ""}`,
        },
        ...(personalYear?.meaning?.reflections?.length
          ? [{ type: "list" as const, items: personalYear.meaning.reflections }]
          : []),
        { type: "callout", tone: "caution", title: "Optional reflection only", text: "These themes are not forecasts. Astrological transits are symbolic in this framework and do not determine outcomes." },
      ]),
    );

    // Annual
    const annualNumber = calc ? calc.numbers.personalYear.value : null;
    const annualMeaning = calc?.numbers.personalYear.meaning;
    sections.push(
      section("annual", "Annual Cycle Overview", "ANNUAL", "An overview of the annual cycle using validated annual numerology and, when available, transit data.", [
        {
          type: "paragraph",
          text: annualMeaning
            ? `Personal Year ${annualNumber} (${annualMeaning.title}): ${annualMeaning.essence} A useful annual question is: ${annualMeaning.reflections[0]}`
            : "No annual numerology cycle is available because numerology was not selected.",
        },
        ...(astro?.dasha
          ? [
              {
                type: "paragraph" as const,
                text: `Vimshottari Mahadasha currently: ${astro.dasha.currentLord}${currentDasha ? ` (${currentDasha.start.slice(0, 10)} to ${currentDasha.end.slice(0, 10)})` : ""}. Traditional theme: ${DASHA_THEMES[astro.dasha.currentLord] ?? "a period of development"}.`,
              },
            ]
          : []),
        {
          type: "callout",
          tone: "traditional",
          title: "Traditional method",
          text: "The annual overview combines a deterministic personal-year calculation with symbolic astrological cycles. It does not predict specific events or guarantee favourable or unfavourable periods.",
        },
      ]),
    );

    // Reflection plan
    sections.push(
      section("reflection", "Your Reflection Plan", "REFLECTION", "Practical, consent-based actions you can choose to explore. Nothing here is a prescription or a promised remedy.", [
        {
          type: "list",
          items: [
            `Set aside twenty minutes this week to journal on the strongest theme in this report (${shared[0] ?? numTags[0] ?? "self-awareness"}).`,
            "Choose one question from the reflection cards and discuss it with a trusted person.",
            "Pick a single small habit to observe for seven days without trying to change everything at once.",
            "Revisit this report in thirty days and mark which interpretations still feel useful.",
            "If a theme touches health, finances or legal matters, consult a qualified professional rather than relying on this reading.",
          ],
        },
        {
          type: "reflections",
          prompts: [
            `What would ${name} do differently if this theme were a question rather than a verdict?`,
            "Which insight here is actionable today, and which is better left as a curiosity?",
            "What evidence from your own life would confirm or challenge this interpretation?",
          ],
        },
      ]),
    );

    // Quiet selection influence for deterministic variation (no invented content).
    if (seed % 2 === 0 && fourthHouse) {
      const growth = sections.find((s) => s.id === "growth");
      growth?.blocks.push({
        type: "paragraph",
        text: `The fourth house in the whole-sign chart falls in ${fourthHouse.sign}; traditional readings connect it with home, inner security and the private foundations that support public life.`,
      });
    }

    return ReportDocumentSchema.parse({
      version: 1,
      language: context.language,
      preferredName: name,
      generatedAt: new Date().toISOString(),
      methods: context.moduleStatuses,
      sections,
      disclosures: {
        ...DISCLOSURES,
        ...(context.language === "hi"
          ? {
              ai: `${DISCLOSURES.ai} This local deterministic interpreter provides English narrative text; configure an AI provider for full Hindi narrative translation.`,
            }
          : {}),
      },
    });
  }

  private safetyValidation(text: string) {
    const issues: string[] = [];
    const patterns: Array<[RegExp, string]> = [
      [/\b(will|going to) (die|divorce|get pregnant|suffer from|cancer)\b/i, "deterministic harmful prediction"],
      [/\b(we|this reading|the chart) guarantees? (that|you|your|success|results|outcome)/i, "guarantee of outcome"],
      [/\b100% (certain|accurate|sure)\b/i, "absolute certainty claim"],
      [/\b(short|long) lifespan\b/i, "lifespan claim"],
      [/\byou (must|need to) buy\b/i, "purchase pressure"],
      [/\b(immediate|urgent) remedy\b/i, "fear-based urgency"],
      [/\bmedical diagnosis\b/i, "medical diagnosis claim"],
    ];
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) issues.push(label);
    }
    return SafetyValidationSchema.parse({
      safe: issues.length === 0,
      issues,
      notes: issues.length
        ? "The generated text contained language requiring review and was not published as-is."
        : "No deterministic or fear-based phrasing detected by the local safety rules.",
    });
  }

  private followUp(context: FollowUpContext) {
    const q = context.question.toLowerCase();
    const scored = context.sections
      .map((s) => {
        const haystack = `${s.title} ${s.text}`.toLowerCase();
        const words = q.split(/\W+/).filter((w) => w.length > 3);
        const score = words.reduce((sum, w) => sum + (haystack.includes(w) ? 1 : 0), 0);
        return { ...s, score };
      })
      .sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score > 0).slice(0, 2);
    const chosen = top.length ? top : scored.slice(0, 2);

    let answer: string;
    if (/\bhuman\b.*\b(astrologer|reader)\b|\bare you (a )?(real|human)\b/.test(q)) {
      answer =
        "I am an AI assistant, not a human astrologer. I explain the calculations and traditional interpretations already stored in your report and clearly mark what is uncertain. For personal medical, legal or financial decisions, please consult a qualified professional.";
    } else if (/\b(calculate|calculation|how did|method|mapping)\b/.test(q)) {
      answer = `Here is how to read the calculation information in your report. ${chosen
        .map((s) => `${s.title}: ${s.text}`)
        .join("\n\n")}\n\nDeterministic values are produced by AIBABA's calculators; the narrative around them is interpretation, not a second calculation.`;
    } else {
      answer = `Based on your saved report, here is the most relevant material.\n\n${chosen
        .map((s) => `${s.title}\n${s.text}`)
        .join("\n\n")}\n\nThis is an explanation of your report, not a new prediction. Traditional interpretations are best treated as questions for reflection, and uncertain inputs remain uncertain.`;
    }

    return FollowUpSchema.parse({
      answer,
      sources: chosen.map((s) => s.title),
    });
  }
}
