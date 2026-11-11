import { z } from "zod";

export const MODULES = ["PALMISTRY", "NUMEROLOGY", "ASTROLOGY"] as const;
export type ReadingModule = (typeof MODULES)[number];

export const LANGUAGES = ["en", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];

export const NUMEROLOGY_SYSTEMS = ["CHALDEAN", "PYTHAGOREAN"] as const;
export type NumerologySystem = (typeof NUMEROLOGY_SYSTEMS)[number];

export const BIRTH_TIME_ACCURACIES = ["EXACT", "APPROXIMATE", "UNKNOWN"] as const;
export type BirthTimeAccuracy = (typeof BIRTH_TIME_ACCURACIES)[number];

export const CONSENT_PURPOSES = [
  "PERSONAL_DATA_PROCESSING",
  "AI_PROCESSING",
  "PALM_IMAGE_PROCESSING",
  "SAVE_HISTORY",
  "PRODUCT_RESEARCH",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_VERSION = "2026-11-v1";

export const CONSENT_LABELS: Record<ConsentPurpose, string> = {
  PERSONAL_DATA_PROCESSING: "Process my birth details for calculations",
  AI_PROCESSING: "Send selected reading data to an AI service for interpretation",
  PALM_IMAGE_PROCESSING: "Process my palm photographs for visual analysis",
  SAVE_HISTORY: "Save my reading history and reports to my account",
  PRODUCT_RESEARCH: "Optional: use de-identified data to improve AIBABA (never required)",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateOnly(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function ageOnDate(dob: string, on = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = on.getUTCFullYear() - y;
  const beforeBirthday =
    on.getUTCMonth() + 1 < m || (on.getUTCMonth() + 1 === m && on.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export const dateOnlySchema = z
  .string()
  .regex(datePattern, "Use the YYYY-MM-DD date format.")
  .refine((v) => isValidDateOnly(v), "Enter a real calendar date.")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    return Date.UTC(y, m - 1, d) <= Date.now();
  }, "Date of birth cannot be in the future.")
  .refine((v) => ageOnDate(v) >= 13, "You must be at least 13 years old to use this service.")
  .refine((v) => ageOnDate(v) <= 120, "Please check the year of birth.");

export const citySchema = z.object({
  name: z.string().min(1).max(120),
  region: z.string().max(120).optional().default(""),
  country: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(80),
});

export type CityInput = z.infer<typeof citySchema>;

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const consentRecordSchema = z.partialRecord(z.enum(CONSENT_PURPOSES), z.boolean());

export const readingDraftSchema = z.object({
  methods: z.array(z.enum(MODULES)).max(3).default([]),
  fullName: z.string().max(120).optional().default(""),
  preferredName: z.string().max(60).optional().default(""),
  dateOfBirth: z.string().optional().default(""),
  language: z.enum(LANGUAGES).optional().default("en"),
  country: z.string().max(120).optional().default(""),
  numerologySystem: z.enum(NUMEROLOGY_SYSTEMS).optional(),
  numerologyName: z.string().max(160).optional().default(""),
  dominantHand: z.enum(["LEFT", "RIGHT"]).optional(),
  birthTime: z.string().optional().default(""),
  birthTimeAccuracy: z.enum(BIRTH_TIME_ACCURACIES).optional().default("UNKNOWN"),
  birthplace: citySchema.optional(),
  consents: consentRecordSchema.optional(),
  step: z.number().int().min(0).max(6).optional().default(0),
});

export type ReadingDraft = z.infer<typeof readingDraftSchema>;

export const readingDraftPatchSchema = readingDraftSchema.partial();

export function validateDraftForSubmission(draft: ReadingDraft): string[] {
  const errors: string[] = [];
  if (!draft.fullName.trim() || draft.fullName.trim().length < 2) {
    errors.push("Enter your full name.");
  }
  if (!isValidDateOnly(draft.dateOfBirth)) {
    errors.push("Enter a valid date of birth.");
  } else if (ageOnDate(draft.dateOfBirth) < 13) {
    errors.push("You must be at least 13 years old to use this service.");
  }
  if (!draft.methods.length) errors.push("Select at least one reading method.");

  if (draft.methods.includes("NUMEROLOGY")) {
    if (!draft.numerologySystem) errors.push("Choose a numerology system.");
    if (!/[A-Za-z]/.test(draft.numerologyName)) {
      errors.push("Provide the Latin-alphabet spelling used for the numerology calculation.");
    }
  }
  if (draft.methods.includes("ASTROLOGY")) {
    if (!draft.birthplace) errors.push("Resolve and confirm a birthplace.");
    else if (!isValidTimezone(draft.birthplace.timezone)) errors.push("The birthplace timezone is invalid.");
    if (draft.birthTimeAccuracy !== "UNKNOWN" && !timePattern.test(draft.birthTime)) {
      errors.push("Enter a birth time, or mark it as unknown.");
    }
  }
  if (draft.methods.includes("PALMISTRY") && !draft.dominantHand) {
    errors.push("Select your dominant hand for palmistry.");
  }
  return errors;
}

export function requiredConsents(draft: ReadingDraft): ConsentPurpose[] {
  const required: ConsentPurpose[] = ["PERSONAL_DATA_PROCESSING", "AI_PROCESSING", "SAVE_HISTORY"];
  if (draft.methods.includes("PALMISTRY")) required.push("PALM_IMAGE_PROCESSING");
  return required;
}
