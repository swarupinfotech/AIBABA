export type NumerologySystem = "CHALDEAN" | "PYTHAGOREAN";

export const PYTHAGOREAN_MAP: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
};

export const CHALDEAN_MAP: Record<string, number> = {
  A: 1, I: 1, J: 1, Q: 1, Y: 1,
  B: 2, K: 2, R: 2,
  C: 3, G: 3, L: 3, S: 3,
  D: 4, M: 4, T: 4,
  E: 5, H: 5, N: 5, X: 5,
  U: 6, V: 6, W: 6,
  O: 7, Z: 7,
  F: 8, P: 8,
};

export const MAPPING_VERSIONS: Record<NumerologySystem, string> = {
  CHALDEAN: "chaldean-v1",
  PYTHAGOREAN: "pythagorean-v1",
};

export interface NumberMeaning {
  title: string;
  essence: string;
  strengths: string[];
  reflections: string[];
  career: string;
  relationships: string;
}

export const NUMBER_MEANINGS: Record<number, NumberMeaning> = {
  1: {
    title: "The Initiator",
    essence: "Initiative, individuality and the impulse to begin.",
    strengths: ["self-direction", "original thinking", "courage to start"],
    reflections: ["Balance independence with listening", "Let collaboration strengthen your vision"],
    career: "Traditional numerology associates 1 with leadership, enterprise and pioneering work.",
    relationships: "Warmth grows when independence is paired with consistent communication.",
  },
  2: {
    title: "The Diplomat",
    essence: "Cooperation, sensitivity and the art of partnership.",
    strengths: ["empathy", "patience", "careful listening"],
    reflections: ["Name your own needs as clearly as you notice others'", "Trust gradual progress"],
    career: "Traditional readings link 2 with mediation, support roles and collaborative craft.",
    relationships: "Partnership is a central theme; healthy boundaries keep sensitivity sustainable.",
  },
  3: {
    title: "The Expressive",
    essence: "Creativity, communication and generous self-expression.",
    strengths: ["imagination", "expression", "social warmth"],
    reflections: ["Finish what inspires you", "Let depth balance variety"],
    career: "3 is traditionally tied to communication, teaching, design and performance.",
    relationships: "Playfulness and honest conversation are natural strengths here.",
  },
  4: {
    title: "The Builder",
    essence: "Structure, reliability and patient craftsmanship.",
    strengths: ["discipline", "practicality", "steadiness"],
    reflections: ["Leave room for spontaneity", "Rest is part of sustainable effort"],
    career: "4 points toward systems, engineering, operations and long-horizon building.",
    relationships: "Dependability is a gift; emotional expression keeps it warm.",
  },
  5: {
    title: "The Explorer",
    essence: "Freedom, curiosity and adaptive movement.",
    strengths: ["adaptability", "curiosity", "resourcefulness"],
    reflections: ["Choose depth over constant novelty when it matters", "Build routines that protect freedom"],
    career: "5 is associated with travel, sales, media and change-rich environments.",
    relationships: "Space and honesty help this number feel at home in commitment.",
  },
  6: {
    title: "The Nurturer",
    essence: "Care, responsibility and harmony in close circles.",
    strengths: ["care", "loyalty", "aesthetic sense"],
    reflections: ["Care for yourself with the same generosity", "Let others carry responsibility too"],
    career: "6 is traditionally linked with healing, education, hospitality and creative care.",
    relationships: "Devotion is central; balanced giving keeps relationships mutual.",
  },
  7: {
    title: "The Seeker",
    essence: "Reflection, analysis and the search for meaning.",
    strengths: ["insight", "focus", "depth"],
    reflections: ["Share your inner world with trusted people", "Let intuition inform analysis"],
    career: "7 is associated with research, technology, writing and contemplative work.",
    relationships: "Trusted intimacy matters more than a wide social circle.",
  },
  8: {
    title: "The Steward",
    essence: "Authority, material responsibility and disciplined ambition.",
    strengths: ["organization", "resilience", "strategic judgment"],
    reflections: ["Define success on your own terms", "Use power with transparency"],
    career: "8 is traditionally connected with management, finance and large-scale responsibility.",
    relationships: "Mutual respect is the foundation; vulnerability is not a loss of strength.",
  },
  9: {
    title: "The Humanitarian",
    essence: "Compassion, perspective and contribution beyond the self.",
    strengths: ["empathy", "vision", "generosity"],
    reflections: ["Let idealism meet practical boundaries", "Complete cycles before starting anew"],
    career: "9 is linked with service, creative fields, education and humanitarian work.",
    relationships: "Wide-hearted care deepens through specific, personal attention.",
  },
  11: {
    title: "The Intuitive (Master Number)",
    essence: "Heightened sensitivity, inspiration and spiritual imagination.",
    strengths: ["intuition", "inspiration", "perception"],
    reflections: ["Ground insights in ordinary routines", "Protect your energy with clear boundaries"],
    career: "11 is traditionally associated with teaching, creative vision and guidance.",
    relationships: "Sensitivity is a strength when it is anchored in honest communication.",
  },
  22: {
    title: "The Architect (Master Number)",
    essence: "Vision joined to practical construction.",
    strengths: ["vision", "execution", "responsibility"],
    reflections: ["Scale ambition to sustainable steps", "Delegate rather than carry everything"],
    career: "22 is linked with building institutions, systems and long-lived projects.",
    relationships: "Shared purpose sustains closeness; make room for simple presence.",
  },
  33: {
    title: "The Guide (Master Number)",
    essence: "Compassionate teaching and responsible care.",
    strengths: ["compassion", "guidance", "creative service"],
    reflections: ["Avoid over-identifying with others' needs", "Teach rather than rescue"],
    career: "33 is associated with mentoring, healing arts and community leadership.",
    relationships: "Care becomes sustainable when it is reciprocal.",
  },
};

/** Short traditional themes for Chaldean compound numbers. */
export const CHALDEAN_COMPOUND_MEANINGS: Record<number, string> = {
  10: "A cycle turning from personal will toward partnership.",
  11: "Idealism and nervous sensitivity; a test of inner direction.",
  12: "Creative potential tested by sacrifice and discernment.",
  13: "Transformation through disciplined effort rather than sudden change.",
  14: "Movement, communication and adaptation to changing conditions.",
  15: "Magnetism, expression and responsibility in public life.",
  16: "A caution to build on honest foundations; sudden insights.",
  17: "Endurance, perspective and eventual recognition of quiet work.",
  18: "Ambition meeting ethical choice; conflict between material and inner life.",
  19: "Independence, recognition and the responsibility of leadership.",
  20: "Awakening, negotiation and partnership after delay.",
  21: "Expansion through creative collaboration.",
  22: "A practical vision realized through patient structure.",
  23: "Support from community; success through adaptability.",
  24: "Affection, partnership and domestic responsibility.",
  25: "Insight through experience; learning from reversals.",
  26: "Craft, counsel and the wise use of resources.",
  27: "Inventive authority; recognition through original work.",
  28: "Ambition supported by cooperation and timing.",
  29: "Emotional intensity, intuition and the need for grounding.",
  33: "Service through teaching and compassionate structure.",
  37: "Creative expression joined with analytical depth.",
  40: "Order, continuity and the value of steady systems.",
  41: "Practical insight and the courage to simplify.",
  44: "Mastery through discipline and long-term service.",
  46: "Reliable stewardship of family and community.",
  50: "Freedom discovered through responsibility.",
  52: "Leadership earned through patient understanding.",
};

export interface LetterValue {
  letter: string;
  value: number;
}

export interface ReductionStep {
  from: number;
  to: number;
  isMaster: boolean;
  explanation: string;
}

export interface NumberResult {
  key: string;
  label: string;
  value: number;
  raw: number;
  compound?: number;
  isMaster: boolean;
  calculation: string;
  steps: ReductionStep[];
  meaning: NumberMeaning | null;
  compoundMeaning?: string;
  note?: string;
}

export interface NumerologyInput {
  fullName: string;
  dateOfBirth: string;
  system: NumerologySystem;
  referenceDate?: string;
  /** Optional explicit name spelling used for mapping. Defaults to fullName. */
  calculationName?: string;
}

export interface NumerologyCalculation {
  system: NumerologySystem;
  mappingVersion: string;
  input: {
    fullName: string;
    calculationName: string;
    normalizedName: string;
    dateOfBirth: string;
    referenceDate: string;
    yRule: string;
  };
  numbers: {
    birthNumber: NumberResult;
    lifePath: NumberResult;
    destiny: NumberResult;
    soulUrge: NumberResult;
    personality: NumberResult;
    personalYear: NumberResult;
    personalMonth: NumberResult;
  };
  letters: LetterValue[];
  notes: string[];
}

const MASTER_NUMBERS = new Set([11, 22, 33]);
const BASE_VOWELS = new Set(["A", "E", "I", "O", "U"]);

export function normalizeName(raw: string): string {
  const decomposed = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  if (/[^\x00-\x7F]/.test(decomposed)) {
    throw new Error("NON_LATIN_NAME");
  }
  return decomposed.toUpperCase().replace(/[^A-Z]/g, "");
}

export function reduceNumber(value: number): { value: number; isMaster: boolean; steps: ReductionStep[] } {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid number");
  const steps: ReductionStep[] = [];
  let current = value;
  while (current > 9 && !MASTER_NUMBERS.has(current)) {
    const digits = String(current).split("").map(Number);
    const next = digits.reduce((a, b) => a + b, 0);
    steps.push({
      from: current,
      to: next,
      isMaster: MASTER_NUMBERS.has(next),
      explanation: `${current} → ${digits.join(" + ")} = ${next}`,
    });
    current = next;
  }
  return { value: current, isMaster: MASTER_NUMBERS.has(current), steps };
}

export function sumDigits(value: number): number {
  return String(value)
    .split("")
    .map(Number)
    .reduce((a, b) => a + b, 0);
}

function meaningFor(value: number): NumberMeaning | null {
  return NUMBER_MEANINGS[value] ?? null;
}

function buildNumber(
  key: string,
  label: string,
  raw: number,
  calculation: string,
  options: { includeCompound?: boolean; note?: string } = {},
): NumberResult {
  const reduced = reduceNumber(raw);
  const compound = options.includeCompound ? raw : undefined;
  const result: NumberResult = {
    key,
    label,
    value: reduced.value,
    raw,
    compound,
    isMaster: reduced.isMaster,
    calculation,
    steps: reduced.steps,
    meaning: meaningFor(reduced.value),
    note: options.note,
  };
  if (compound && CHALDEAN_COMPOUND_MEANINGS[compound]) {
    result.compoundMeaning = CHALDEAN_COMPOUND_MEANINGS[compound];
  }
  return result;
}

interface VowelInfo {
  vowels: Set<number>;
  rule: string;
}

/**
 * Deterministic Y rule (documented in docs/NUMEROLOGY.md):
 * Y acts as a vowel when the word has no A/E/I/O/U, or when Y is between two
 * consonants. Otherwise Y is treated as a consonant. Users with traditions that
 * differ can override the spelling in the wizard; the applied rule is recorded.
 */
export function vowelPositions(words: string[][]): VowelInfo {
  const vowels = new Set<number>();
  let index = 0;
  for (const word of words) {
    const hasBaseVowel = word.some((letter) => BASE_VOWELS.has(letter));
    word.forEach((letter, i) => {
      const globalIndex = index + i;
      if (BASE_VOWELS.has(letter)) {
        vowels.add(globalIndex);
      } else if (letter === "Y") {
        const betweenConsonants =
          i > 0 &&
          i < word.length - 1 &&
          !BASE_VOWELS.has(word[i - 1]) &&
          !BASE_VOWELS.has(word[i + 1]);
        if (!hasBaseVowel || betweenConsonants) vowels.add(globalIndex);
      }
    });
    index += word.length;
  }
  return { vowels, rule: "Y is a vowel when a word has no A/E/I/O/U or when Y sits between consonants." };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function calculateNumerology(input: NumerologyInput): NumerologyCalculation {
  const calculationName = (input.calculationName || input.fullName).trim();
  const normalized = normalizeName(calculationName);
  if (normalized.length === 0) throw new Error("NAME_REQUIRED");

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.dateOfBirth);
  if (!dateMatch) throw new Error("INVALID_DATE");
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    throw new Error("INVALID_DATE");
  }
  if (dateCheck.getTime() > Date.now()) throw new Error("FUTURE_DATE");

  const map = input.system === "CHALDEAN" ? CHALDEAN_MAP : PYTHAGOREAN_MAP;
  const originalWords = calculationName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);

  const letters: LetterValue[] = normalized.split("").map((letter) => ({ letter, value: map[letter] ?? 0 }));
  const wordsAsLetters = originalWords.map((word) => word.split(""));
  const { vowels, rule } = vowelPositions(wordsAsLetters);

  const nameTotal = letters.reduce((sum, l) => sum + l.value, 0);
  const vowelTotal = letters.reduce((sum, l, i) => sum + (vowels.has(i) ? l.value : 0), 0);
  const consonantTotal = nameTotal - vowelTotal;

  const dayReduced = reduceNumber(day);
  const monthReduced = reduceNumber(month);
  const yearReduced = reduceNumber(sumDigits(year));
  const lifePathRaw = dayReduced.value + monthReduced.value + yearReduced.value;

  const referenceDate = input.referenceDate ?? new Date().toISOString().slice(0, 10);
  const refYear = Number(referenceDate.slice(0, 4));
  const refMonth = Number(referenceDate.slice(5, 7));
  const refYearReduced = reduceNumber(sumDigits(refYear));
  const personalYearRaw = dayReduced.value + monthReduced.value + refYearReduced.value;
  const personalYearReduced = reduceNumber(personalYearRaw);
  const personalMonthRaw = personalYearReduced.value + refMonth;

  const includeCompound = input.system === "CHALDEAN";

  const numbers = {
    birthNumber: buildNumber(
      "birthNumber",
      "Birth Number",
      day,
      `Day of birth ${day}, reduced.`,
      { note: "Derived from the day of the month; traditional numerology treats it as the 'outer' self." },
    ),
    lifePath: buildNumber(
      "lifePath",
      "Life Path Number",
      lifePathRaw,
      `Day ${day} → ${dayReduced.value}; Month ${month} → ${monthReduced.value}; Year ${year} → ${sumDigits(year)} → ${yearReduced.value}; total ${lifePathRaw}.`,
      { note: "Each date component is reduced separately, preserving master numbers, then combined." },
    ),
    destiny: buildNumber(
      "destiny",
      "Destiny / Expression Number",
      nameTotal,
      `${input.system === "CHALDEAN" ? "Chaldean" : "Pythagorean"} values for all ${letters.length} letters total ${nameTotal}.`,
      { includeCompound },
    ),
    soulUrge: buildNumber(
      "soulUrge",
      "Soul Urge Number",
      vowelTotal,
      `Vowel values total ${vowelTotal}. ${rule}`,
      { includeCompound },
    ),
    personality: buildNumber(
      "personality",
      "Personality Number",
      consonantTotal,
      `Consonant values total ${consonantTotal}. ${rule}`,
      { includeCompound },
    ),
    personalYear: buildNumber(
      "personalYear",
      "Personal Year Number",
      personalYearRaw,
      `Birth day ${dayReduced.value} + birth month ${monthReduced.value} + current year ${refYear} (${refYearReduced.value}) = ${personalYearRaw}.`,
      { note: "Calculated for the year of the reference date supplied at generation time." },
    ),
    personalMonth: buildNumber(
      "personalMonth",
      "Personal Month Number",
      personalMonthRaw,
      `Personal year ${personalYearReduced.value} + calendar month ${refMonth} = ${personalMonthRaw}.`,
    ),
  };

  return {
    system: input.system,
    mappingVersion: MAPPING_VERSIONS[input.system],
    input: {
      fullName: input.fullName,
      calculationName,
      normalizedName: normalized,
      dateOfBirth: input.dateOfBirth,
      referenceDate,
      yRule: rule,
    },
    numbers,
    letters,
    notes: [
      `${input.system === "CHALDEAN" ? "Chaldean" : "Pythagorean"} letter-to-number mapping (${MAPPING_VERSIONS[input.system]}).`,
      "Master numbers 11, 22 and 33 are preserved when they appear as a total.",
      `Reference month: ${MONTHS[refMonth - 1] ?? refMonth} ${refYear}.`,
      "Numerology is a traditional interpretive system, not a scientific measurement.",
    ],
  };
}

export const NUMEROLOGY_DISCLAIMER =
  "Numerology results are produced by a deterministic calculator using documented traditional mappings. They are interpretive, not predictive or scientifically validated.";
