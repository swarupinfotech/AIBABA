import { describe, expect, it } from "vitest";
import {
  CHALDEAN_MAP,
  MAPPING_VERSIONS,
  PYTHAGOREAN_MAP,
  calculateNumerology,
  normalizeName,
  reduceNumber,
  sumDigits,
} from "@/services/numerology";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

describe("numerology letter mappings", () => {
  it("maps every Latin letter exactly once in both systems", () => {
    expect(Object.keys(PYTHAGOREAN_MAP).sort()).toEqual(ALPHABET);
    expect(Object.keys(CHALDEAN_MAP).sort()).toEqual(ALPHABET);
  });

  it("follows the documented Pythagorean pattern", () => {
    expect(PYTHAGOREAN_MAP.A).toBe(1);
    expect(PYTHAGOREAN_MAP.I).toBe(9);
    expect(PYTHAGOREAN_MAP.J).toBe(1);
    expect(PYTHAGOREAN_MAP.R).toBe(9);
    expect(PYTHAGOREAN_MAP.S).toBe(1);
    expect(PYTHAGOREAN_MAP.Z).toBe(8);
    for (const letter of ALPHABET) {
      expect(PYTHAGOREAN_MAP[letter]).toBeGreaterThanOrEqual(1);
      expect(PYTHAGOREAN_MAP[letter]).toBeLessThanOrEqual(9);
    }
  });

  it("never assigns 9 in the Chaldean system", () => {
    const values = Object.values(CHALDEAN_MAP);
    expect(values).not.toContain(9);
    for (const letter of ALPHABET) {
      expect(CHALDEAN_MAP[letter]).toBeGreaterThanOrEqual(1);
      expect(CHALDEAN_MAP[letter]).toBeLessThanOrEqual(8);
    }
    // Spot checks for the classic Chaldean table.
    expect(CHALDEAN_MAP.A).toBe(1);
    expect(CHALDEAN_MAP.O).toBe(7);
    expect(CHALDEAN_MAP.F).toBe(8);
    expect(CHALDEAN_MAP.P).toBe(8);
  });

  it("publishes a mapping version per system", () => {
    expect(MAPPING_VERSIONS.CHALDEAN).toBe("chaldean-v1");
    expect(MAPPING_VERSIONS.PYTHAGOREAN).toBe("pythagorean-v1");
  });
});

describe("name normalisation", () => {
  it("uppercases, strips punctuation, whitespace and diacritics", () => {
    expect(normalizeName("  José  María O'Brien ")).toBe("JOSEMARIAOBRIEN");
  });

  it("rejects non-Latin scripts instead of guessing a transliteration", () => {
    expect(() => normalizeName("राहुल")).toThrow("NON_LATIN_NAME");
    expect(() => normalizeName("李雷")).toThrow("NON_LATIN_NAME");
  });
});

describe("number reduction", () => {
  it("reduces to a single digit and records every step", () => {
    const result = reduceNumber(1990);
    expect(result.value).toBe(1);
    expect(result.isMaster).toBe(false);
    expect(result.steps.map((step) => [step.from, step.to])).toEqual([
      [1990, 19],
      [19, 10],
      [10, 1],
    ]);
  });

  it("preserves master numbers 11, 22 and 33", () => {
    for (const master of [11, 22, 33]) {
      const result = reduceNumber(master);
      expect(result.value).toBe(master);
      expect(result.isMaster).toBe(true);
      expect(result.steps).toEqual([]);
    }
  });

  it("keeps a master number reached during reduction", () => {
    const result = reduceNumber(29); // 2 + 9 = 11 (master, stop)
    expect(result.value).toBe(11);
    expect(result.isMaster).toBe(true);
    expect(result.steps).toHaveLength(1);
  });

  it("rejects negative and non-finite input", () => {
    expect(() => reduceNumber(-1)).toThrow("Invalid number");
    expect(() => reduceNumber(Number.NaN)).toThrow("Invalid number");
  });

  it("sums digits", () => {
    expect(sumDigits(2026)).toBe(10);
    expect(sumDigits(0)).toBe(0);
  });
});

describe("date-based calculations", () => {
  const referenceDate = "2026-11-11";

  it("computes life path and birth number for a documented case", () => {
    const result = calculateNumerology({
      fullName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "PYTHAGOREAN",
      referenceDate,
    });

    expect(result.numbers.birthNumber.value).toBe(6); // 15 -> 6
    expect(result.numbers.lifePath.value).toBe(3); // 6 + 5 + 1 = 12 -> 3
    expect(result.numbers.lifePath.steps.length).toBeGreaterThan(0);
    expect(result.mappingVersion).toBe("pythagorean-v1");
    expect(result.system).toBe("PYTHAGOREAN");
  });

  it("computes personal year and personal month from the reference date", () => {
    const result = calculateNumerology({
      fullName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "CHALDEAN",
      referenceDate,
    });
    // 6 (day) + 5 (month) + 1 (2026 -> 10 -> 1) = 12 -> 3
    expect(result.numbers.personalYear.value).toBe(3);
    // 3 (personal year) + 11 (November) = 14 -> 5
    expect(result.numbers.personalMonth.value).toBe(5);
  });

  it("changes the personal year with the reference year", () => {
    const result = calculateNumerology({
      fullName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "CHALDEAN",
      referenceDate: "2027-01-01",
    });
    // 6 + 5 + 11 (2027 digits sum to 11, a preserved master number) = 22
    expect(result.numbers.personalYear.value).toBe(22);
    expect(result.numbers.personalMonth.value).toBe(5); // 22 + 1 = 23 -> 5
  });

  it("records the inputs and the Y-vowel rule used", () => {
    const result = calculateNumerology({
      fullName: "John Smith",
      calculationName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "CHALDEAN",
      referenceDate,
    });
    expect(result.input.normalizedName).toBe("JOHNSMITH");
    expect(result.input.dateOfBirth).toBe("1990-05-15");
    expect(result.input.yRule).toMatch(/Y is a vowel/);
    expect(result.letters).toHaveLength(9);
  });

  it("rejects impossible calendar dates", () => {
    expect(() =>
      calculateNumerology({ fullName: "John Smith", dateOfBirth: "1990-02-30", system: "CHALDEAN" }),
    ).toThrow("INVALID_DATE");
  });

  it("rejects malformed date strings", () => {
    expect(() =>
      calculateNumerology({ fullName: "John Smith", dateOfBirth: "15/05/1990", system: "CHALDEAN" }),
    ).toThrow("INVALID_DATE");
  });

  it("rejects future birth dates", () => {
    expect(() =>
      calculateNumerology({ fullName: "John Smith", dateOfBirth: "2999-01-01", system: "CHALDEAN" }),
    ).toThrow("FUTURE_DATE");
  });
});

describe("name-based calculations", () => {
  it("computes Chaldean destiny, soul urge and personality with compound numbers", () => {
    const result = calculateNumerology({
      fullName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "CHALDEAN",
    });
    expect(result.numbers.destiny.raw).toBe(35); // J1 O7 H5 N5 S3 M4 I1 T4 H5
    expect(result.numbers.destiny.compound).toBe(35);
    expect(result.numbers.destiny.value).toBe(8);
    expect(result.numbers.soulUrge.value).toBe(8);
    expect(result.numbers.personality.value).toBe(9);
  });

  it("computes Pythagorean numbers from the same name", () => {
    const result = calculateNumerology({
      fullName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "PYTHAGOREAN",
    });
    expect(result.numbers.destiny.raw).toBe(44);
    expect(result.numbers.destiny.value).toBe(8);
    expect(result.numbers.soulUrge.value).toBe(6);
    expect(result.numbers.personality.value).toBe(11); // master number preserved
    expect(result.numbers.destiny.compound).toBeUndefined();
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      fullName: "John Smith",
      dateOfBirth: "1990-05-15",
      system: "CHALDEAN" as const,
      referenceDate: "2026-11-11",
    };
    expect(calculateNumerology(input)).toEqual(calculateNumerology(input));
  });

  it("uses the explicit calculationName for mapping when provided", () => {
    const withOverride = calculateNumerology({
      fullName: "राहुल",
      calculationName: "Rahul",
      dateOfBirth: "1990-05-15",
      system: "CHALDEAN",
    });
    expect(withOverride.input.normalizedName).toBe("RAHUL");
  });

  it("requires a usable name", () => {
    expect(() =>
      calculateNumerology({ fullName: "!!!", dateOfBirth: "1990-05-15", system: "CHALDEAN" }),
    ).toThrow("NAME_REQUIRED");
  });
});
