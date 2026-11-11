import { z } from "zod";

export const PALM_FEATURES = ["Heart line", "Head line", "Life line", "Fate line", "Sun line"] as const;

export const PalmObservationSchema = z.object({
  quality: z.object({
    fullPalmVisible: z.boolean().nullable(),
    linesDistinguishable: z.boolean().nullable(),
    lighting: z.enum(["good", "fair", "poor", "unknown"]),
    notes: z.array(z.string()).max(8),
  }),
  features: z
    .array(
      z.object({
        name: z.enum(PALM_FEATURES),
        status: z.enum(["VISIBLE", "FAINT", "NOT_VISIBLE", "NOT_ASSESSED"]),
        location: z.string().max(300),
        confidence: z.number().min(0).max(1),
        interpretation: z.string().max(800),
        uncertainty: z.string().max(400),
      }),
    )
    .max(6),
  summary: z.string().max(1200),
  limitations: z.array(z.string()).max(10),
  retakeRecommended: z.boolean(),
  safetyFlags: z.array(z.string()).max(10),
});
export type PalmObservation = z.infer<typeof PalmObservationSchema>;

export const PalmInterpretationSchema = z.object({
  overview: z.string().max(1200),
  observations: z
    .array(
      z.object({
        feature: z.string().max(80),
        visibility: z.string().max(40),
        meaning: z.string().max(800),
        uncertainty: z.string().max(400),
      }),
    )
    .max(6),
  careerThemes: z.array(z.string().max(500)).max(4),
  relationshipThemes: z.array(z.string().max(500)).max(4),
  growthThemes: z.array(z.string().max(500)).max(4),
  limitations: z.array(z.string()).max(8),
  disclaimer: z.string().max(600),
});
export type PalmInterpretation = z.infer<typeof PalmInterpretationSchema>;

export const NumerologyInterpretationSchema = z.object({
  overview: z.string().max(1800),
  numbers: z
    .array(
      z.object({
        key: z.string().max(40),
        label: z.string().max(80),
        value: z.number().int(),
        heading: z.string().max(120),
        body: z.string().max(1200),
      }),
    )
    .max(10),
  strengths: z.array(z.string().max(300)).max(8),
  reflections: z.array(z.string().max(300)).max(8),
  methodNote: z.string().max(800),
  disclaimer: z.string().max(600),
});
export type NumerologyInterpretation = z.infer<typeof NumerologyInterpretationSchema>;

export const VedicInterpretationSchema = z.object({
  overview: z.string().max(1800),
  ascendant: z.string().max(800),
  moon: z.string().max(800),
  placements: z
    .array(
      z.object({
        planet: z.string().max(40),
        note: z.string().max(600),
      }),
    )
    .max(12),
  themes: z.array(z.string().max(500)).max(8),
  limitations: z.array(z.string()).max(8),
  disclaimer: z.string().max(600),
});
export type VedicInterpretation = z.infer<typeof VedicInterpretationSchema>;

export const ReportBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().max(4000) }),
  z.object({ type: z.literal("list"), items: z.array(z.string().max(800)).max(20) }),
  z.object({
    type: z.literal("numberCards"),
    numbers: z
      .array(
        z.object({
          label: z.string().max(80),
          value: z.string().max(20),
          title: z.string().max(120),
          detail: z.string().max(1200),
          method: z.string().max(600),
        }),
      )
      .max(10),
  }),
  z.object({
    type: z.literal("featureCards"),
    features: z
      .array(
        z.object({
          name: z.string().max(80),
          status: z.string().max(40),
          confidence: z.number().min(0).max(1),
          observation: z.string().max(800),
          interpretation: z.string().max(1200),
          uncertainty: z.string().max(600),
        }),
      )
      .max(6),
  }),
  z.object({
    type: z.literal("planetTable"),
    rows: z
      .array(
        z.object({
          name: z.string().max(40),
          sign: z.string().max(40),
          degree: z.number(),
          nakshatra: z.string().max(60),
          pada: z.number().int().min(1).max(4),
          house: z.number().int().min(1).max(12).nullable(),
          retrograde: z.boolean(),
        }),
      )
      .max(12),
    note: z.string().max(600),
  }),
  z.object({
    type: z.literal("dashaTimeline"),
    periods: z
      .array(
        z.object({
          lord: z.string().max(40),
          start: z.string().max(40),
          end: z.string().max(40),
          years: z.number(),
          isBalanceAtBirth: z.boolean(),
        }),
      )
      .max(12),
    note: z.string().max(600),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "caution", "traditional"]),
    title: z.string().max(140),
    text: z.string().max(1500),
  }),
  z.object({
    type: z.literal("calculation"),
    title: z.string().max(140),
    steps: z.array(z.string().max(600)).max(20),
    note: z.string().max(600),
  }),
  z.object({
    type: z.literal("reflections"),
    prompts: z.array(z.string().max(500)).max(12),
  }),
]);

export type ReportBlock = z.infer<typeof ReportBlockSchema>;

export const REPORT_SECTION_KINDS = [
  "OVERVIEW",
  "PALMISTRY",
  "NUMEROLOGY",
  "VEDIC",
  "PERSONALITY",
  "CAREER",
  "RELATIONSHIPS",
  "GROWTH",
  "UPCOMING_30",
  "UPCOMING_90",
  "ANNUAL",
  "REFLECTION",
] as const;

export const ReportSectionSchema = z.object({
  id: z.string().max(40),
  title: z.string().max(140),
  kind: z.enum(REPORT_SECTION_KINDS),
  intro: z.string().max(2000),
  blocks: z.array(ReportBlockSchema).max(12),
});
export type ReportSection = z.infer<typeof ReportSectionSchema>;

export const ModuleStatusSchema = z.object({
  module: z.string().max(30),
  status: z.enum(["COMPLETED", "LIMITED", "UNAVAILABLE", "NOT_SELECTED"]),
  method: z.string().max(300),
  note: z.string().max(600),
});

export const ReportDocumentSchema = z.object({
  version: z.literal(1),
  language: z.string().max(8),
  preferredName: z.string().max(80),
  generatedAt: z.string().max(40),
  methods: z.array(ModuleStatusSchema).max(3),
  sections: z.array(ReportSectionSchema).min(1).max(14),
  disclosures: z.object({
    traditional: z.string().max(1200),
    ai: z.string().max(1200),
    uncertainty: z.string().max(1200),
    notPredictive: z.string().max(1200),
  }),
});
export type ReportDocument = z.infer<typeof ReportDocumentSchema>;

export const SafetyValidationSchema = z.object({
  safe: z.boolean(),
  issues: z.array(z.string().max(300)).max(12),
  notes: z.string().max(800),
});
export type SafetyValidation = z.infer<typeof SafetyValidationSchema>;

export const FollowUpSchema = z.object({
  answer: z.string().max(6000),
  sources: z.array(z.string().max(200)).max(8),
});
