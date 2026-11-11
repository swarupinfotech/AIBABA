import type { NumerologyCalculation } from "@/services/numerology";
import type { AstrologyResult } from "@/services/astrology";
import type {
  PalmObservation,
  PalmInterpretation,
  NumerologyInterpretation,
  VedicInterpretation,
} from "@/services/ai/schemas";

export interface SynthesisContext {
  preferredName: string;
  displayName: string;
  language: string;
  dateOfBirth: string;
  referenceDate: string;
  selectedModules: string[];
  moduleStatuses: Array<{
    module: string;
    status: "COMPLETED" | "LIMITED" | "UNAVAILABLE" | "NOT_SELECTED";
    method: string;
    note: string;
  }>;
  numerology?: NumerologyCalculation;
  numerologyInterpretation?: NumerologyInterpretation;
  astrology?: AstrologyResult;
  astrologyInterpretation?: VedicInterpretation;
  palmObservation?: PalmObservation;
  palmInterpretation?: PalmInterpretation;
  palmImageQuality?: { status: string; score: number; issues?: string[] } | null;
}

export interface FollowUpContext {
  preferredName: string;
  language: string;
  question: string;
  sections: Array<{ title: string; text: string }>;
  readingMeta: string;
}
