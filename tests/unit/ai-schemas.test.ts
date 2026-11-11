import { describe, expect, it } from "vitest";
import {
  FollowUpSchema,
  PalmObservationSchema,
  ReportDocumentSchema,
  SafetyValidationSchema,
  VedicInterpretationSchema,
} from "@/services/ai/schemas";

function omit(value: object, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value };
  delete copy[key];
  return copy;
}

const validObservation = {
  quality: {
    fullPalmVisible: true,
    linesDistinguishable: true,
    lighting: "good" as const,
    notes: ["Even light across the palm."],
  },
  features: [
    {
      name: "Heart line" as const,
      status: "VISIBLE" as const,
      location: "Upper palm, curving toward the index finger.",
      confidence: 0.72,
      interpretation: "Traditional readings associate this curve with warmth in communication.",
      uncertainty: "Photographic contrast limits certainty about the line's end point.",
    },
  ],
  summary: "The palm is fully framed and the major lines are partly distinguishable.",
  limitations: ["Finer secondary lines cannot be judged."],
  retakeRecommended: false,
  safetyFlags: [],
};

const validReport = {
  version: 1 as const,
  language: "en",
  preferredName: "Sample",
  generatedAt: "2026-11-11T00:00:00.000Z",
  methods: [
    {
      module: "NUMEROLOGY",
      status: "COMPLETED" as const,
      method: "Chaldean, mapping chaldean-v1",
      note: "Numbers produced by the deterministic calculator.",
    },
  ],
  sections: [
    {
      id: "overview",
      title: "Your Personal Overview",
      kind: "OVERVIEW" as const,
      intro: "This reading combines validated inputs.",
      blocks: [{ type: "paragraph" as const, text: "A labelled reflection." }],
    },
  ],
  disclosures: {
    traditional: "Traditional interpretation, not measurement.",
    ai: "Language assisted by AI.",
    uncertainty: "Missing data is labelled.",
    notPredictive: "No events are guaranteed.",
  },
};

describe("palm observation schema", () => {
  it("accepts a structured observation with uncertainty", () => {
    expect(PalmObservationSchema.safeParse(validObservation).success).toBe(true);
  });

  it("rejects invented feature names", () => {
    const parsed = PalmObservationSchema.safeParse({
      ...validObservation,
      features: [{ ...validObservation.features[0], name: "Wealth line" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects confidence outside 0–1 and unknown visibility states", () => {
    expect(
      PalmObservationSchema.safeParse({
        ...validObservation,
        features: [{ ...validObservation.features[0], confidence: 1.4 }],
      }).success,
    ).toBe(false);
    expect(
      PalmObservationSchema.safeParse({
        ...validObservation,
        features: [{ ...validObservation.features[0], status: "CERTAIN" }],
      }).success,
    ).toBe(false);
  });

  it("allows null quality flags when the model genuinely cannot tell", () => {
    const parsed = PalmObservationSchema.safeParse({
      ...validObservation,
      quality: { ...validObservation.quality, fullPalmVisible: null, linesDistinguishable: null },
    });
    expect(parsed.success).toBe(true);
  });

  it("requires limitations to be listed", () => {
    expect(PalmObservationSchema.safeParse(omit(validObservation, "limitations")).success).toBe(false);
  });
});

describe("report document schema", () => {
  it("accepts a minimal complete report", () => {
    expect(ReportDocumentSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects an unknown version", () => {
    expect(ReportDocumentSchema.safeParse({ ...validReport, version: 2 }).success).toBe(false);
  });

  it("rejects unknown section kinds", () => {
    const parsed = ReportDocumentSchema.safeParse({
      ...validReport,
      sections: [{ ...validReport.sections[0], kind: "FUTURE_GUARANTEE" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("validates discriminated blocks and rejects malformed ones", () => {
    const parsed = ReportDocumentSchema.safeParse({
      ...validReport,
      sections: [
        {
          ...validReport.sections[0],
          blocks: [{ type: "planetTable", rows: [{ name: "Sun" }] }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("requires all four disclosures", () => {
    expect(
      ReportDocumentSchema.safeParse({
        ...validReport,
        disclosures: omit(validReport.disclosures, "traditional"),
      }).success,
    ).toBe(false);
  });

  it("limits section count", () => {
    const sections = Array.from({ length: 15 }, (_, index) => ({
      ...validReport.sections[0],
      id: `section-${index}`,
    }));
    expect(ReportDocumentSchema.safeParse({ ...validReport, sections }).success).toBe(false);
  });
});

describe("safety and follow-up schemas", () => {
  it("validates the safety verdict", () => {
    expect(SafetyValidationSchema.safeParse({ safe: true, issues: [], notes: "No unsafe claims." }).success).toBe(
      true,
    );
    expect(SafetyValidationSchema.safeParse({ safe: "maybe", issues: [] }).success).toBe(false);
  });

  it("caps follow-up answers and sources", () => {
    expect(FollowUpSchema.safeParse({ answer: "A helpful explanation.", sources: ["numerology"] }).success).toBe(
      true,
    );
    expect(
      FollowUpSchema.safeParse({
        answer: "ok",
        sources: Array.from({ length: 9 }, () => "s"),
      }).success,
    ).toBe(false);
  });

  it("requires limitations on Vedic interpretation", () => {
    const base = {
      overview: "A chart summary.",
      ascendant: "Virgo rising, with uncertainty.",
      moon: "Moon in Uttara Ashadha.",
      placements: [],
      themes: [],
      limitations: ["Unknown birth time removes house data."],
      disclaimer: "Traditional interpretation only.",
    };
    expect(VedicInterpretationSchema.safeParse(base).success).toBe(true);
    expect(VedicInterpretationSchema.safeParse(omit(base, "limitations")).success).toBe(false);
  });
});
