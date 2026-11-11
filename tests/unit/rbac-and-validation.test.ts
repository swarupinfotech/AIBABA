import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  hasRole,
  isRole,
  ROLES,
} from "@/lib/permissions/rbac";
import {
  CONSENT_PURPOSES,
  ageOnDate,
  consentRecordSchema,
  isValidDateOnly,
  isValidTimezone,
  requiredConsents,
  validateDraftForSubmission,
  readingDraftSchema,
} from "@/lib/validation/reading";

describe("RBAC hierarchy", () => {
  it("recognises only declared roles", () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole("user")).toBe(false);
    expect(isRole("")).toBe(false);
  });

  it("compares role levels rather than exact matches", () => {
    expect(hasRole("SUPER_ADMIN", "SUPPORT")).toBe(true);
    expect(hasRole("OPERATIONS_ADMIN", "CONTENT_EDITOR")).toBe(true);
    expect(hasRole("CONTENT_EDITOR", "SUPPORT")).toBe(true);
    expect(hasRole("SUPPORT", "CONTENT_EDITOR")).toBe(false);
    expect(hasRole("USER", "SUPPORT")).toBe(false);
    expect(hasRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("excludes normal users and unknown roles from the admin area", () => {
    expect(canAccessAdmin("USER")).toBe(false);
    expect(canAccessAdmin("SUPPORT")).toBe(true);
    expect(canAccessAdmin("SUPER_ADMIN")).toBe(true);
    expect(canAccessAdmin("ADMIN")).toBe(false);
  });
});

describe("date of birth validation", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDateOnly("1990-05-15")).toBe(true);
    expect(isValidDateOnly("2000-02-29")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidDateOnly("1990-02-30")).toBe(false);
    expect(isValidDateOnly("1999-02-29")).toBe(false);
    expect(isValidDateOnly("15/05/1990")).toBe(false);
    expect(isValidDateOnly("1990-13-01")).toBe(false);
    expect(isValidDateOnly("")).toBe(false);
  });

  it("computes age without timezone drift", () => {
    const on = new Date("2026-05-14T23:59:59Z");
    expect(ageOnDate("1990-05-15", on)).toBe(35);
    expect(ageOnDate("1990-05-15", new Date("2026-05-15T00:00:00Z"))).toBe(36);
  });

  it("accepts IANA timezones and rejects unknown names", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("reading draft validation", () => {
  const baseDraft = readingDraftSchema.parse({
    fullName: "Sample Person",
    dateOfBirth: "1990-05-15",
    methods: ["NUMEROLOGY"],
    numerologySystem: "CHALDEAN",
    numerologyName: "Sample Person",
  });

  it("accepts a complete numerology-only draft", () => {
    expect(validateDraftForSubmission(baseDraft)).toEqual([]);
  });

  it("requires a name, a birth date and at least one method", () => {
    const errors = validateDraftForSubmission(
      readingDraftSchema.parse({ fullName: "A", dateOfBirth: "1990-02-30", methods: [] }),
    );
    expect(errors).toContain("Enter your full name.");
    expect(errors).toContain("Enter a valid date of birth.");
    expect(errors).toContain("Select at least one reading method.");
  });

  it("requires a Latin spelling and system for numerology", () => {
    const errors = validateDraftForSubmission(
      readingDraftSchema.parse({
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        methods: ["NUMEROLOGY"],
        numerologyName: "राहुल",
      }),
    );
    expect(errors).toContain("Choose a numerology system.");
    expect(errors.join(" ")).toMatch(/Latin-alphabet spelling/);
  });

  it("requires a resolved birthplace for astrology but allows an unknown time", () => {
    const missingPlace = validateDraftForSubmission(
      readingDraftSchema.parse({
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        methods: ["ASTROLOGY"],
        birthTimeAccuracy: "UNKNOWN",
      }),
    );
    expect(missingPlace).toContain("Resolve and confirm a birthplace.");

    const complete = validateDraftForSubmission(
      readingDraftSchema.parse({
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        methods: ["ASTROLOGY"],
        birthTimeAccuracy: "UNKNOWN",
        birthplace: {
          name: "New Delhi",
          country: "India",
          latitude: 28.6139,
          longitude: 77.209,
          timezone: "Asia/Kolkata",
        },
      }),
    );
    expect(complete).toEqual([]);
  });

  it("requires a birth time when accuracy is exact or approximate", () => {
    const errors = validateDraftForSubmission(
      readingDraftSchema.parse({
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        methods: ["ASTROLOGY"],
        birthTimeAccuracy: "EXACT",
        birthplace: {
          name: "New Delhi",
          country: "India",
          latitude: 28.6139,
          longitude: 77.209,
          timezone: "Asia/Kolkata",
        },
      }),
    );
    expect(errors.join(" ")).toMatch(/Enter a birth time/);
  });

  it("requires a dominant hand for palmistry", () => {
    const errors = validateDraftForSubmission(
      readingDraftSchema.parse({
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        methods: ["PALMISTRY"],
      }),
    );
    expect(errors).toContain("Select your dominant hand for palmistry.");
  });

  it("never bundles research consent with the essential purposes", () => {
    const numerologyOnly = requiredConsents(baseDraft);
    expect(numerologyOnly).toEqual(["PERSONAL_DATA_PROCESSING", "AI_PROCESSING", "SAVE_HISTORY"]);
    expect(numerologyOnly).not.toContain("PALM_IMAGE_PROCESSING");
    expect(numerologyOnly).not.toContain("PRODUCT_RESEARCH");

    const withPalm = requiredConsents(
      readingDraftSchema.parse({
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        methods: ["PALMISTRY"],
        dominantHand: "RIGHT",
      }),
    );
    expect(withPalm).toContain("PALM_IMAGE_PROCESSING");
    expect(withPalm).not.toContain("PRODUCT_RESEARCH");
  });

  it("declares every consent purpose exactly once", () => {
    expect(new Set(CONSENT_PURPOSES).size).toBe(CONSENT_PURPOSES.length);
  });

  it("accepts a partial consent payload so the service can explain what is missing", () => {
    const parsed = consentRecordSchema.safeParse({ PERSONAL_DATA_PROCESSING: true });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({ PERSONAL_DATA_PROCESSING: true });
    // Unknown purposes and non-boolean values are still rejected.
    expect(consentRecordSchema.safeParse({ NOT_A_PURPOSE: true }).success).toBe(false);
    expect(consentRecordSchema.safeParse({ PRODUCT_RESEARCH: "yes" }).success).toBe(false);
  });
});
