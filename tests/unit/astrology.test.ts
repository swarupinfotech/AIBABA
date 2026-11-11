import { describe, expect, it } from "vitest";
import {
  PROVIDER,
  PROVIDER_VERSION,
  RASHIS,
  ascendantLongitude,
  calculateAstrology,
  lahiriAyanamsa,
  nakshatraFor,
  navamsaSignIndex,
  siderealLongitude,
  tropicalLongitude,
} from "@/services/astrology";
import { Body } from "astronomy-engine";
import { localToUtc } from "@/lib/datetime";

const birthplace = {
  name: "New Delhi",
  country: "India",
  latitude: 28.6139,
  longitude: 77.209,
  timezone: "Asia/Kolkata",
};

function chart(accuracy: "EXACT" | "APPROXIMATE" | "UNKNOWN", birthTime = "14:30") {
  return calculateAstrology({
    dateOfBirth: "1990-05-15",
    birthTime,
    birthTimeAccuracy: accuracy,
    birthplace,
    localToUtc,
  });
}

describe("Lahiri ayanamsa and sidereal conversion", () => {
  it("anchors at the J2000 Lahiri value", () => {
    const value = lahiriAyanamsa(new Date("2000-01-01T12:00:00Z"));
    expect(value).toBeCloseTo(23.853056, 5);
  });

  it("advances with precession over time", () => {
    const y1990 = lahiriAyanamsa(new Date("1990-05-15T09:00:00Z"));
    const y2026 = lahiriAyanamsa(new Date("2026-05-15T09:00:00Z"));
    expect(y1990).toBeCloseTo(23.7185, 2);
    expect(y2026).toBeGreaterThan(y1990);
    expect(y2026 - y1990).toBeGreaterThan(0.45); // ~50"/yr * 36 years
    expect(y2026 - y1990).toBeLessThan(0.55);
  });

  it("subtracts the ayanamsa from tropical longitude and wraps at 360", () => {
    const date = new Date("2000-01-01T12:00:00Z");
    expect(siderealLongitude(0, date)).toBeCloseTo(336.146944, 4);
    expect(siderealLongitude(23.853056, date)).toBeCloseTo(0, 4);
    expect(siderealLongitude(10, date)).toBeGreaterThanOrEqual(0);
    expect(siderealLongitude(10, date)).toBeLessThan(360);
  });

  it("computes tropical longitudes inside the ecliptic", () => {
    const sun = tropicalLongitude(Body.Sun, new Date("2026-03-20T12:00:00Z"));
    // March equinox: the Sun is near 0° tropical Aries.
    expect(Math.min(sun, 360 - sun)).toBeLessThan(1.5);
  });
});

describe("nakshatra and pada placement", () => {
  it("starts at Ashwini and wraps 360 degrees", () => {
    expect(nakshatraFor(0)).toMatchObject({ index: 0, name: "Ashwini", pada: 1 });
    expect(nakshatraFor(360)).toMatchObject({ index: 0, name: "Ashwini", pada: 1 });
  });

  it("places equal 13°20′ spans with four padas", () => {
    expect(nakshatraFor(13.34)).toMatchObject({ index: 1, name: "Bharani", pada: 1 });
    expect(nakshatraFor(360 / 27)).toMatchObject({ index: 1, name: "Bharani", pada: 1 });
    expect(nakshatraFor(20)).toMatchObject({ index: 1, name: "Bharani", pada: 3 });
  });

  it("identifies Chitra pada 1 for the verified ascendant", () => {
    expect(nakshatraFor(175.6304)).toMatchObject({
      index: 13,
      name: "Chitra",
      lord: "Mars",
      pada: 1,
    });
  });

  it("ends at Revati pada 4", () => {
    expect(nakshatraFor(359.99)).toMatchObject({ index: 26, name: "Revati", pada: 4 });
  });
});

describe("ascendant geometry", () => {
  it("returns the ecliptic degree on the eastern horizon", () => {
    const utc = new Date("1990-05-15T09:00:00Z");
    const asc = ascendantLongitude(utc, birthplace.latitude, birthplace.longitude);
    expect(asc).toBeCloseTo(175.6304, 2);
    expect(asc).toBeGreaterThanOrEqual(0);
    expect(asc).toBeLessThan(360);
  });

  it("changes with location", () => {
    const utc = new Date("1990-05-15T09:00:00Z");
    const delhi = ascendantLongitude(utc, 28.6139, 77.209);
    const london = ascendantLongitude(utc, 51.5072, -0.1276);
    expect(Math.abs(delhi - london)).toBeGreaterThan(1);
  });
});

describe("Vedic chart calculation", () => {
  it("records provider, settings and verified positions for an exact time", () => {
    const result = chart("EXACT");
    expect(result.provider).toBe(PROVIDER);
    expect(result.providerVersion).toBe(PROVIDER_VERSION);
    expect(result.settings).toMatchObject({
      zodiac: "SIDEREAL",
      ayanamsa: "LAHIRI",
      houseSystem: "WHOLE_SIGN",
      nodeType: "MEAN_NODE",
    });
    expect(result.ascendant?.sign).toBe("Virgo");
    expect(result.ascendant?.degreeInSign).toBeCloseTo(25.6304, 2);
    expect(result.ascendant?.nakshatra.name).toBe("Chitra");

    const sun = result.planets.find((p) => p.name === "Sun");
    const moon = result.planets.find((p) => p.name === "Moon");
    expect(sun).toMatchObject({ sign: "Taurus", nakshatra: { name: "Krittika", pada: 2 } });
    expect(sun?.degreeInSign).toBeCloseTo(0.56, 1);
    expect(moon).toMatchObject({
      sign: "Capricorn",
      nakshatra: { name: "Uttara Ashadha", pada: 2 },
    });
    expect(moon?.degreeInSign).toBeCloseTo(1.9, 1);
  });

  it("returns twelve whole-sign houses and a Vimshottari timeline", () => {
    const result = chart("EXACT");
    expect(result.houses).toHaveLength(12);
    expect(result.houses?.[0].sign).toBe("Virgo"); // whole-sign: first house = ascendant sign
    expect(result.dasha?.system).toBe("VIMSHOTTARI");
    expect(result.dasha?.currentLord).toBe("Rahu");
    expect(result.dasha?.periods.length).toBeGreaterThan(1);
    expect(result.charts.d1?.ascendantSignIndex).toBe(RASHIS.findIndex((r) => r.name === "Virgo"));
  });

  it("marks an approximate time as approximate and gives an ascendant range", () => {
    const result = chart("APPROXIMATE");
    expect(result.ascendant).not.toBeNull();
    expect(result.ascendant?.rangeDegrees).toBeDefined();
    expect(result.uncertainty.level).toBe("MEDIUM");
    expect(result.birth.assumedTime).toBe(false);
    expect(result.uncertainty.notes.join(" ")).toMatch(/approximate/i);
  });

  it("withholds ascendant, houses, Dasha and divisional charts for an unknown time", () => {
    const result = chart("UNKNOWN", "");
    expect(result.birth.assumedTime).toBe(true);
    expect(result.birth.time).toBeNull();
    expect(result.ascendant).toBeNull();
    expect(result.houses).toBeNull();
    expect(result.dasha).toBeNull();
    expect(result.charts.d1?.ascendantSignIndex).toBeNull();
    expect(result.charts.d1?.houses).toBeNull();
    expect(result.charts.d9).toBeNull();
    expect(result.uncertainty.level).toBe("HIGH");
    expect(result.uncertainty.moonRange).toBeDefined();
    expect(result.uncertainty.notes.join(" ")).toMatch(/Birth time was not provided/i);
    // Date-only planetary signs remain available.
    expect(result.planets.length).toBeGreaterThan(6);
  });

  it("rejects an exact time that is malformed", () => {
    expect(() => chart("EXACT", "25:99")).toThrow("INVALID_BIRTH_TIME");
  });

  it("does not silently accept an unknown time with a stray value", () => {
    const result = chart("UNKNOWN", "14:30");
    expect(result.ascendant).toBeNull();
    expect(result.birth.assumedTime).toBe(true);
  });

  it("computes navamsa (D9) placements deterministically", () => {
    expect(navamsaSignIndex(0)).toBe(0);
    expect(navamsaSignIndex(30)).toBe(9); // Taurus -> Capricorn navamsa
    expect(navamsaSignIndex(359.9)).toBe(11);
    const result = chart("EXACT");
    expect(result.charts.d9?.placements.length).toBe(result.planets.length);
  });
});
