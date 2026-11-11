import type { z } from "zod";

export const BASE_SYSTEM_INSTRUCTION = `You are AIBABA, an AI-powered assistant that explains traditional palmistry, numerology and astrology interpretations.

You must use only validated information supplied by the application's trusted calculation and observation services.
Never invent palm lines, planetary positions, numerical calculations, birth details, chart placements or Dasha periods.
Clearly identify the traditional method used.
Distinguish calculated information, visible observations and AI-generated interpretations.
Avoid absolute predictions or guarantees.
Do not predict death, lifespan, disease, pregnancy, criminal behavior or unavoidable events.
Do not provide medical, legal or investment decisions.
Never create fear, dependency, urgency or pressure to buy remedies, gemstones, rituals, consultations or premium reports.
If information is incomplete or uncertain, explain the limitation.
Never pretend to be a real human astrologer.
Always respect the user's selected language and privacy.
Return only the requested JSON object with no markdown fences.`;

export interface PromptDefinition {
  version: string;
  task: string;
  build: (payload: string, language: string) => string;
}

const languageLine = (language: string) =>
  language === "hi"
    ? "Write all narrative text in natural, simple Hindi (Devanagari). Keep technical labels bilingual where helpful."
    : "Write all narrative text in clear, warm English.";

export const PROMPTS = {
  palmObservation: {
    version: "palm-observation-v1",
    task: "PALM_OBSERVATION",
    build: (_payload: string, language: string) => `${languageLine(language)}

Analyse the supplied palm photograph(s). Describe only features that are clearly visible. For each of the five major lines, use status VISIBLE, FAINT, NOT_VISIBLE or NOT_ASSESSED. If the photograph is blurry, cropped, filtered, poorly lit, or the full palm is not visible, set retakeRecommended true and do not invent lines. Confidence must reflect visual certainty. Do not identify the person, infer health, lifespan, pregnancy, religion, caste, sexuality or any biometric trait. Provide no traditional interpretation here; that is a separate step.`,
  },
  palmInterpretation: {
    version: "palm-interpretation-v1",
    task: "PALM_INTERPRETATION",
    build: (payload: string, language: string) => `${languageLine(language)}

Using ONLY the structured palm observations below, produce traditional palmistry interpretations. Describe each visible or faint line separately; omit lines marked NOT_VISIBLE or NOT_ASSESSED. Include the uncertainty for each observation. Never claim that a line proves personality, health, lifespan or future events. If nothing is visible, return an honest limited reading.
OBSERVATIONS:
${payload}`,
  },
  numerology: {
    version: "numerology-interpretation-v1",
    task: "NUMEROLOGY_INTERPRETATION",
    build: (payload: string, language: string) => `${languageLine(language)}

Explain the deterministic numerology results below in the selected tradition. Do not recalculate or alter any number. Distinguish the calculated number from its traditional interpretation. Use the supplied meanings as the interpretive basis. Include strengths and reflection areas. Label the method and mapping version. Never predict events or guarantee outcomes.
CALCULATION:
${payload}`,
  },
  vedic: {
    version: "vedic-interpretation-v1",
    task: "VEDIC_INTERPRETATION",
    build: (payload: string, language: string) => `${languageLine(language)}

Explain the validated sidereal Vedic calculations below. Do not add planets, degrees, houses, nakshatras or Dasha periods that are absent. If birth time is unknown or approximate, state exactly which ascendant/house/Dasha claims are limited. Treat whole-sign houses and Lahiri ayanamsa as the configured method. Never predict events, health, lifespan, pregnancy or guaranteed outcomes.
CALCULATION:
${payload}`,
  },
  synthesis: {
    version: "life-synthesis-v1",
    task: "LIFE_SYNTHESIS",
    build: (payload: string, language: string) => `${languageLine(language)}

Create a Complete Life Reading from the validated component data and interpretations below. Follow the required JSON schema exactly. Produce all twelve sections. Keep each tradition separate and label its method. Only state that systems agree when the supplied theme tags genuinely overlap; otherwise describe differences. Never manufacture palm observations. If a module is LIMITED, UNAVAILABLE or NOT_SELECTED, say so in that section and do not fill it with invented content. Upcoming 30/90-day and annual sections must be optional reflection themes, not predictions or dates of events. The reflection plan must be practical and non-prescriptive.
VALIDATED DATA:
${payload}`,
  },
  followUp: {
    version: "follow-up-v1",
    task: "FOLLOW_UP",
    build: (payload: string, language: string) => `${languageLine(language)}

Answer the user's question about their own report using only the retrieved report sections below. If the answer is not present, say so and explain which part of the report would contain it. Never invent chart data or palm lines. Do not claim to be a human astrologer. Do not predict guaranteed events or give medical, legal or investment advice. Keep the answer clear and grounded.
RETRIEVED REPORT CONTEXT:
${payload}`,
  },
  safety: {
    version: "safety-v1",
    task: "SAFETY_VALIDATION",
    build: (payload: string, language: string) => `${languageLine(language)}

Review the AI-generated text below for forbidden deterministic predictions, fear-based pressure, medical/legal/financial advice, claims of guaranteed outcomes, or fabricated calculations. Return safe=false only when there is a substantive violation. Write the notes field in the requested language.
TEXT:
${payload}`,
  },
} as const;

export type PromptKey = keyof typeof PROMPTS;

export interface AIRequest<T> {
  task: string;
  schema: z.ZodType<T>;
  schemaName: string;
  systemPrompt?: string;
  userPrompt: string;
  promptVersion: string;
  temperature?: number;
  maxTokens?: number;
  images?: Array<{ mimeType: string; base64: string }>;
  /** Validated structured data for the deterministic local provider. */
  context?: unknown;
  userId?: string;
  readingId?: string;
}

export interface AIUsageReport {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface AIResult<T> {
  data: T;
  usage: AIUsageReport;
  promptVersion: string;
  provider: string;
}

export interface AIChatRequest {
  systemPrompt?: string;
  userPrompt: string;
  context?: unknown;
  userId?: string;
  readingId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  name: string;
  model: string;
  generateStructuredOutput<T>(input: AIRequest<T>): Promise<AIResult<T>>;
  generateStreamingResponse(input: AIChatRequest): AsyncIterable<string>;
  available(): Promise<boolean>;
}

export class AIProviderError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const table: Record<string, { input: number; output: number }> = {
    "gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "gpt-4.1": { input: 2, output: 8 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gemini-2.0-flash": { input: 0.1, output: 0.4 },
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "local-interpreter-v1": { input: 0, output: 0 },
  };
  const price = table[model] ?? { input: 1, output: 3 };
  return Number((((inputTokens * price.input + outputTokens * price.output) / 1_000_000)).toFixed(6));
}
