import { describe, expect, it } from "vitest";
import {
  RASHI_NAMES,
  deriveHouse,
  toKundliCharts,
  type KundliPlanet,
} from "@/components/astrology/chart-data";

const VIRGO = 5;
const CAPRICORN = 9;

function planet(overrides: Partial<KundliPlanet> = {}): KundliPlanet {
  return { name: "Sun", signIndex: VIRGO, house: 1, retrograde: false, ...overrides };
}

/** Shape of the stored AstrologyResult used by the chart (also used by the tests). */
function storedCalculation() {
  return {
    provider: "astronomy-engine",
    providerVersion: "2.1.19",
    settings: { zodiac: "SIDEREAL", ayanamsa: "LAHIRI", houseSystem: "WHOLE_SIGN" },
    charts: {
      d1: {
        ascendantSignIndex: VIRGO,
        houses: Array.from({ length: 12 }, (_, index) => ({ house: index + 1 })),
        planets: [
          { name: "Sun", signIndex: VIRGO, house: 1, retrograde: false },
          { name: "Moon", signIndex: CAPRICORN, house: 5, retrograde: false },
          { name: "Saturn", signIndex: 10, house: 6, retrograde: true },
        ],
      },
      d9: {
        ascendantSignIndex: CAPRICORN,
        placements: [
          { name: "Sun", signIndex: CAPRICORN, house: 1, retrograde: false },
          { name: "Moon", signIndex: 2, house: 6, retrograde: false },
        ],
      },
    },
  };
}

describe("toKundliCharts", () => {
  it("extracts only the D1/D9 fields the drawing needs", () => {
    const charts = toKundliCharts(storedCalculation());
    expect(charts).not.toBeNull();
    expect(charts?.d1.ascendantSignIndex).toBe(VIRGO);
    expect(charts?.d1.planets.map((p) => p.name)).toEqual(["Sun", "Moon", "Saturn"]);
    expect(charts?.d1.planets[2]).toEqual({ name: "Saturn", signIndex: 10, house: 6, retrograde: true });
    expect(charts?.d9?.ascendantSignIndex).toBe(CAPRICORN);
    expect(charts?.d9?.planets.map((p) => p.name)).toEqual(["Sun", "Moon"]);
  });

  it("returns null when no usable ascendant exists (unknown birth time)", () => {
    const calculation = storedCalculation();
    calculation.charts.d1 = null as never;
    expect(toKundliCharts(calculation)).toBeNull();
  });

  it("returns null when the ascendant index is missing or out of range", () => {
    const missing = storedCalculation();
    delete (missing.charts.d1 as { ascendantSignIndex?: number }).ascendantSignIndex;
    expect(toKundliCharts(missing)).toBeNull();

    const outOfRange = storedCalculation();
    outOfRange.charts.d1.ascendantSignIndex = 12;
    expect(toKundliCharts(outOfRange)).toBeNull();
  });

  it("returns null when there are no valid planets to draw", () => {
    const empty = storedCalculation();
    empty.charts.d1.planets = [] as never;
    expect(toKundliCharts(empty)).toBeNull();

    const malformed = storedCalculation();
    malformed.charts.d1.planets = [{ name: "Sun", signIndex: 42 }] as never;
    expect(toKundliCharts(malformed)).toBeNull();
  });

  it("drops D9 when its placements are absent instead of guessing", () => {
    const noD9 = storedCalculation();
    noD9.charts.d9 = null as never;
    expect(toKundliCharts(noD9)?.d9).toBeNull();

    const emptyD9 = storedCalculation();
    emptyD9.charts.d9.placements = [] as never;
    expect(toKundliCharts(emptyD9)?.d9).toBeNull();
  });

  it("tolerates malformed or unknown input", () => {
    expect(toKundliCharts(null)).toBeNull();
    expect(toKundliCharts("not-a-chart")).toBeNull();
    expect(toKundliCharts({})).toBeNull();
    expect(toKundliCharts({ charts: {} })).toBeNull();
  });
});

describe("deriveHouse", () => {
  it("uses a stored whole-sign house when present", () => {
    expect(deriveHouse(planet({ house: 7 }), VIRGO)).toBe(7);
  });

  it("derives the house from the sign and ascendant when absent", () => {
    expect(deriveHouse(planet({ house: null, signIndex: VIRGO }), VIRGO)).toBe(1);
    expect(deriveHouse(planet({ house: null, signIndex: CAPRICORN }), VIRGO)).toBe(5);
    expect(deriveHouse(planet({ house: null, signIndex: 4 }), VIRGO)).toBe(12);
  });

  it("issues no house outside 1–12", () => {
    for (let sign = 0; sign < 12; sign += 1) {
      for (let asc = 0; asc < 12; asc += 1) {
        const house = deriveHouse(planet({ house: null, signIndex: sign }), asc);
        expect(house).toBeGreaterThanOrEqual(1);
        expect(house).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe("rashi labels", () => {
  it("lists the twelve signs in zodiacal order", () => {
    expect(RASHI_NAMES).toHaveLength(12);
    expect(RASHI_NAMES[0]).toBe("Aries");
    expect(RASHI_NAMES[5]).toBe("Virgo");
    expect(RASHI_NAMES[11]).toBe("Pisces");
  });
});
