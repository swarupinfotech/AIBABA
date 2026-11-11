/**
 * Serialisable chart data shared by server components (report page) and the
 * client chart. Kept free of React and "use client" so both environments can
 * import it without turning these helpers into client references.
 *
 * The input is the stored, already-validated astrology calculation. Nothing is
 * recalculated here; malformed or incomplete data yields `null` rather than a
 * guessed chart.
 */

export const RASHI_NAMES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export interface KundliPlanet {
  name: string;
  signIndex: number;
  house: number | null;
  retrograde: boolean;
}

export interface KundliChartSet {
  ascendantSignIndex: number;
  planets: KundliPlanet[];
}

export interface KundliCharts {
  d1: KundliChartSet;
  d9: KundliChartSet | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePlanet(value: unknown): KundliPlanet | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name : null;
  const signIndex = typeof value.signIndex === "number" ? value.signIndex : null;
  if (!name || signIndex === null || signIndex < 0 || signIndex > 11) return null;
  const house =
    typeof value.house === "number" && value.house >= 1 && value.house <= 12 ? value.house : null;
  return { name, signIndex, house, retrograde: value.retrograde === true };
}

export function toKundliCharts(value: unknown): KundliCharts | null {
  if (!isRecord(value) || !isRecord(value.charts)) return null;
  const d1 = isRecord(value.charts.d1) ? value.charts.d1 : null;
  if (!d1) return null;
  const ascendantSignIndex =
    typeof d1.ascendantSignIndex === "number" && d1.ascendantSignIndex >= 0 && d1.ascendantSignIndex <= 11
      ? d1.ascendantSignIndex
      : null;
  if (ascendantSignIndex === null) return null;

  const planets = Array.isArray(d1.planets)
    ? d1.planets.map(parsePlanet).filter((planet): planet is KundliPlanet => Boolean(planet))
    : [];
  if (!planets.length) return null;

  const d9Raw = isRecord(value.charts.d9) ? value.charts.d9 : null;
  const d9Asc =
    d9Raw && typeof d9Raw.ascendantSignIndex === "number" && d9Raw.ascendantSignIndex >= 0
      ? d9Raw.ascendantSignIndex
      : null;
  const d9Planets =
    d9Raw && Array.isArray(d9Raw.placements)
      ? d9Raw.placements.map(parsePlanet).filter((planet): planet is KundliPlanet => Boolean(planet))
      : [];
  const d9 = d9Asc === null || !d9Planets.length ? null : { ascendantSignIndex: d9Asc, planets: d9Planets };

  return { d1: { ascendantSignIndex, planets }, d9 };
}

/** Whole-sign house for a placement, derived from its sign when absent. */
export function deriveHouse(planet: KundliPlanet, ascendantSignIndex: number): number {
  if (planet.house !== null) return planet.house;
  return ((planet.signIndex - ascendantSignIndex + 12) % 12) + 1;
}
