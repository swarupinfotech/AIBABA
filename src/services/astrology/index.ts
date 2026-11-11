import {
  Body,
  Ecliptic,
  GeoMoon,
  GeoVector,
  MakeTime,
  SiderealTime,
  e_tilt,
} from "astronomy-engine";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const PROVIDER = "aibaba-astronomy-engine";
export const PROVIDER_VERSION = "2.1.x-lahiri-v1";

export const RASHIS = [
  { name: "Aries", sanskrit: "Mesha", lord: "Mars" },
  { name: "Taurus", sanskrit: "Vrishabha", lord: "Venus" },
  { name: "Gemini", sanskrit: "Mithuna", lord: "Mercury" },
  { name: "Cancer", sanskrit: "Karka", lord: "Moon" },
  { name: "Leo", sanskrit: "Simha", lord: "Sun" },
  { name: "Virgo", sanskrit: "Kanya", lord: "Mercury" },
  { name: "Libra", sanskrit: "Tula", lord: "Venus" },
  { name: "Scorpio", sanskrit: "Vrishchika", lord: "Mars" },
  { name: "Sagittarius", sanskrit: "Dhanu", lord: "Jupiter" },
  { name: "Capricorn", sanskrit: "Makara", lord: "Saturn" },
  { name: "Aquarius", sanskrit: "Kumbha", lord: "Saturn" },
  { name: "Pisces", sanskrit: "Meena", lord: "Jupiter" },
] as const;

export const NAKSHATRAS = [
  { name: "Ashwini", lord: "Ketu" },
  { name: "Bharani", lord: "Venus" },
  { name: "Krittika", lord: "Sun" },
  { name: "Rohini", lord: "Moon" },
  { name: "Mrigashira", lord: "Mars" },
  { name: "Ardra", lord: "Rahu" },
  { name: "Punarvasu", lord: "Jupiter" },
  { name: "Pushya", lord: "Saturn" },
  { name: "Ashlesha", lord: "Mercury" },
  { name: "Magha", lord: "Ketu" },
  { name: "Purva Phalguni", lord: "Venus" },
  { name: "Uttara Phalguni", lord: "Sun" },
  { name: "Hasta", lord: "Moon" },
  { name: "Chitra", lord: "Mars" },
  { name: "Swati", lord: "Rahu" },
  { name: "Vishakha", lord: "Jupiter" },
  { name: "Anuradha", lord: "Saturn" },
  { name: "Jyeshtha", lord: "Mercury" },
  { name: "Mula", lord: "Ketu" },
  { name: "Purva Ashadha", lord: "Venus" },
  { name: "Uttara Ashadha", lord: "Sun" },
  { name: "Shravana", lord: "Moon" },
  { name: "Dhanishta", lord: "Mars" },
  { name: "Shatabhisha", lord: "Rahu" },
  { name: "Purva Bhadrapada", lord: "Jupiter" },
  { name: "Uttara Bhadrapada", lord: "Saturn" },
  { name: "Revati", lord: "Mercury" },
] as const;

export const DASHA_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"] as const;
const YEAR_DAYS = 365.2425;

export function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function signIndex(longitude: number): number {
  return Math.floor(normalize360(longitude) / 30) % 12;
}

export function degreeInSign(longitude: number): number {
  return normalize360(longitude) % 30;
}

/**
 * Lahiri (Chitrapaksha) ayanamsa approximation: the standard J2000 value plus
 * IAU general precession. Accurate to a few arcseconds for 1900–2100 when
 * compared with Swiss Ephemeris Lahiri; the value is stored with every reading.
 */
export function lahiriAyanamsa(date: Date): number {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const precessionArcsec =
    5028.796195 * t + 1.1054348 * t * t + 0.00007964 * t * t * t - 0.000023857 * t * t * t * t;
  return 23.853056 + precessionArcsec / 3600;
}

export function siderealLongitude(tropical: number, date: Date): number {
  return normalize360(tropical - lahiriAyanamsa(date));
}

export function tropicalLongitude(body: Body, date: Date): number {
  if (body === Body.Moon) {
    return Ecliptic(GeoMoon(date)).elon;
  }
  return Ecliptic(GeoVector(body, date, true)).elon;
}

export function meanLunarNode(date: Date): number {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const omega =
    125.0445479 -
    1934.1362891 * t +
    0.0020754 * t * t +
    (t * t * t) / 467441 -
    (t * t * t * t) / 60_616_000;
  return normalize360(omega);
}

export function obliquity(date: Date): number {
  return e_tilt(MakeTime(date)).tobl;
}

/** Local apparent sidereal time in degrees. */
export function localSiderealDegrees(date: Date, longitude: number): number {
  const gastHours = SiderealTime(date);
  return normalize360(gastHours * 15 + longitude);
}

/**
 * Ecliptic longitude of the eastern horizon (ascendant). Verified in tests by
 * asserting the resulting point has zero altitude and is rising.
 */
export function ascendantLongitude(date: Date, latitude: number, longitude: number): number {
  const ramc = localSiderealDegrees(date, longitude) * DEG2RAD;
  const eps = obliquity(date) * DEG2RAD;
  const phi = Math.max(-89.5, Math.min(89.5, latitude)) * DEG2RAD;
  const asc = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)),
  );
  return normalize360(asc * RAD2DEG);
}

export interface NakshatraPosition {
  index: number;
  name: string;
  lord: string;
  pada: 1 | 2 | 3 | 4;
  degreeInNakshatra: number;
}

export function nakshatraFor(sidereal: number): NakshatraPosition {
  const lon = normalize360(sidereal);
  const span = 360 / 27;
  // A tiny epsilon avoids floating-point drift at exact nakshatra boundaries
  // (e.g. 20° would otherwise round down from Bharani pada 3 to pada 2).
  let index = Math.floor((lon + 1e-9) / span);
  if (index > 26) index = 26;
  const within = Number((lon - index * span).toFixed(6));
  const pada = Math.min(4, Math.floor(within / (span / 4)) + 1) as 1 | 2 | 3 | 4;
  return {
    index,
    name: NAKSHATRAS[index].name,
    lord: NAKSHATRAS[index].lord,
    pada,
    degreeInNakshatra: Number(within.toFixed(4)),
  };
}

export function navamsaSignIndex(sidereal: number): number {
  return Math.floor(normalize360(sidereal) / (30 / 9)) % 12;
}

export interface PlanetPosition {
  name: string;
  longitude: number;
  signIndex: number;
  sign: string;
  sanskrit: string;
  degreeInSign: number;
  nakshatra: NakshatraPosition;
  house: number | null;
  retrograde: boolean;
}

function planetRetrograde(name: string, date: Date): boolean {
  if (name === "Sun" || name === "Moon") return false;
  if (name === "Rahu" || name === "Ketu") return true;
  const before = tropicalLongitude(name as Body, new Date(date.getTime() - 12 * 3600_000));
  const after = tropicalLongitude(name as Body, new Date(date.getTime() + 12 * 3600_000));
  let delta = after - before;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

export function computePlanets(date: Date, ascSignIndex: number | null): PlanetPosition[] {
  const bodies: Array<{ name: string; longitude: number }> = [
    { name: "Sun", longitude: tropicalLongitude(Body.Sun, date) },
    { name: "Moon", longitude: tropicalLongitude(Body.Moon, date) },
    { name: "Mars", longitude: tropicalLongitude(Body.Mars, date) },
    { name: "Mercury", longitude: tropicalLongitude(Body.Mercury, date) },
    { name: "Jupiter", longitude: tropicalLongitude(Body.Jupiter, date) },
    { name: "Venus", longitude: tropicalLongitude(Body.Venus, date) },
    { name: "Saturn", longitude: tropicalLongitude(Body.Saturn, date) },
    { name: "Rahu", longitude: meanLunarNode(date) },
    { name: "Ketu", longitude: normalize360(meanLunarNode(date) + 180) },
  ];

  return bodies.map(({ name, longitude }) => {
    const sidereal = siderealLongitude(longitude, date);
    const si = signIndex(sidereal);
    return {
      name,
      longitude: Number(sidereal.toFixed(4)),
      signIndex: si,
      sign: RASHIS[si].name,
      sanskrit: RASHIS[si].sanskrit,
      degreeInSign: Number(degreeInSign(sidereal).toFixed(4)),
      nakshatra: nakshatraFor(sidereal),
      house: ascSignIndex === null ? null : ((si - ascSignIndex + 12) % 12) + 1,
      retrograde: planetRetrograde(name, date),
    };
  });
}

export interface DashaPeriod {
  lord: string;
  start: string;
  end: string;
  years: number;
  isBalanceAtBirth: boolean;
}

export function vimsottariPeriods(
  moonSidereal: number,
  birthUtc: Date,
  count = 9,
): { periods: DashaPeriod[]; currentLord: string; balanceYears: number } {
  const nak = nakshatraFor(moonSidereal);
  const span = 360 / 27;
  const fractionElapsed = (moonSidereal % span) / span;
  const startLordIndex = DASHA_ORDER.indexOf(nak.lord as (typeof DASHA_ORDER)[number]);
  const firstYears = DASHA_YEARS[nak.lord];
  const balance = (1 - fractionElapsed) * firstYears;

  const periods: DashaPeriod[] = [];
  let cursor = birthUtc.getTime();
  for (let i = 0; i < count; i += 1) {
    const lord = DASHA_ORDER[(startLordIndex + i) % 9];
    const years = i === 0 ? balance : DASHA_YEARS[lord];
    const end = cursor + years * YEAR_DAYS * 86_400_000;
    periods.push({
      lord,
      start: new Date(cursor).toISOString(),
      end: new Date(end).toISOString(),
      years: Number(years.toFixed(4)),
      isBalanceAtBirth: i === 0,
    });
    cursor = end;
  }

  const now = Date.now();
  const current = periods.find((p) => new Date(p.start).getTime() <= now && new Date(p.end).getTime() > now);
  return { periods, currentLord: current?.lord ?? periods[periods.length - 1].lord, balanceYears: Number(balance.toFixed(4)) };
}

export interface HouseInfo {
  house: number;
  signIndex: number;
  sign: string;
  planets: string[];
}

export function wholeSignHouses(ascSign: number, planets: PlanetPosition[]): HouseInfo[] {
  return Array.from({ length: 12 }, (_, i) => {
    const si = (ascSign + i) % 12;
    return {
      house: i + 1,
      signIndex: si,
      sign: RASHIS[si].name,
      planets: planets.filter((p) => p.signIndex === si).map((p) => p.name),
    };
  });
}

export interface AstrologyInput {
  dateOfBirth: string;
  birthTime?: string;
  birthTimeAccuracy: "EXACT" | "APPROXIMATE" | "UNKNOWN";
  birthplace: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  ayanamsa?: "LAHIRI";
  localToUtc: (date: string, time: string, tz: string) => { utc: Date; offsetMinutes: number };
}

export interface AstrologyResult {
  provider: string;
  providerVersion: string;
  settings: {
    zodiac: "SIDEREAL";
    ayanamsa: "LAHIRI";
    ayanamsaValue: number;
    houseSystem: "WHOLE_SIGN";
    nodeType: "MEAN_NODE";
  };
  birth: {
    date: string;
    time: string | null;
    timezone: string;
    utc: string;
    assumedTime: boolean;
    offsetMinutes: number;
  };
  ascendant: {
    longitude: number;
    signIndex: number;
    sign: string;
    degreeInSign: number;
    nakshatra: NakshatraPosition;
    rangeDegrees?: [number, number];
  } | null;
  planets: PlanetPosition[];
  houses: HouseInfo[] | null;
  charts: {
    d1: { ascendantSignIndex: number | null; houses: HouseInfo[] | null; planets: PlanetPosition[] } | null;
    d9: {
      ascendantSignIndex: number | null;
      placements: Array<{ name: string; signIndex: number; sign: string }>;
    } | null;
  };
  dasha: {
    system: "VIMSHOTTARI";
    moonNakshatra: string;
    balanceYears: number;
    currentLord: string;
    periods: DashaPeriod[];
  } | null;
  transits: {
    asOf: string;
    planets: PlanetPosition[];
    note: string;
  };
  uncertainty: {
    level: "LOW" | "MEDIUM" | "HIGH";
    notes: string[];
    moonRange?: { min: number; max: number; mayChangeNakshatra: boolean };
  };
  calculatedAt: string;
}

export function calculateAstrology(input: AstrologyInput): AstrologyResult {
  const accuracy = input.birthTimeAccuracy;
  const hasTime = accuracy !== "UNKNOWN" && Boolean(input.birthTime);
  const assumedTime = !hasTime;

  if (!assumedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime ?? "")) {
    throw new Error("INVALID_BIRTH_TIME");
  }

  const time = hasTime ? (input.birthTime as string) : "12:00";
  const { utc, offsetMinutes } = input.localToUtc(input.dateOfBirth, time, input.birthplace.timezone);
  const ayanamsa = lahiriAyanamsa(utc);

  const notes: string[] = [];
  if (assumedTime) {
    notes.push(
      "Birth time was not provided. Planetary positions are a date-only snapshot computed for 12:00 local time; the Moon can move about 6° in 12 hours, so its nakshatra and all house-based data are withheld.",
    );
  }
  if (accuracy === "APPROXIMATE") {
    notes.push(
      "Birth time was marked approximate. The ascendant and whole-sign house cusps are shown as approximate; a difference of a few minutes can change the ascendant near a sign boundary.",
    );
  }
  if (Math.abs(input.birthplace.latitude) > 66) {
    notes.push("At high latitudes the ascendant changes very rapidly; house-based interpretations are less reliable.");
  }

  const scrubbed = {
    ...input.birthplace,
    name: input.birthplace.name.slice(0, 120),
    country: input.birthplace.country.slice(0, 120),
  };
  void scrubbed;

  const asc = hasTime
    ? ascendantLongitude(utc, input.birthplace.latitude, input.birthplace.longitude)
    : null;
  const ascSign = asc === null ? null : signIndex(asc);
  let ascRange: [number, number] | undefined;
  if (asc !== null && accuracy === "APPROXIMATE") {
    const before = ascendantLongitude(
      new Date(utc.getTime() - 15 * 60_000),
      input.birthplace.latitude,
      input.birthplace.longitude,
    );
    const after = ascendantLongitude(
      new Date(utc.getTime() + 15 * 60_000),
      input.birthplace.latitude,
      input.birthplace.longitude,
    );
    ascRange = [Number(before.toFixed(4)), Number(after.toFixed(4))];
  }

  const planets = computePlanets(utc, ascSign);
  const houses = ascSign === null ? null : wholeSignHouses(ascSign, planets);
  const moon = planets.find((p) => p.name === "Moon")!;

  let dasha: AstrologyResult["dasha"] = null;
  if (hasTime) {
    const d = vimsottariPeriods(moon.longitude, utc);
    dasha = {
      system: "VIMSHOTTARI",
      moonNakshatra: moon.nakshatra.name,
      balanceYears: d.balanceYears,
      currentLord: d.currentLord,
      periods: d.periods,
    };
  }

  let moonRange: AstrologyResult["uncertainty"]["moonRange"];
  if (!hasTime) {
    const startLocal = input.localToUtc(input.dateOfBirth, "00:00", input.birthplace.timezone).utc;
    const endLocal = input.localToUtc(input.dateOfBirth, "23:59", input.birthplace.timezone).utc;
    const m1 = siderealLongitude(tropicalLongitude(Body.Moon, startLocal), startLocal);
    const m2 = siderealLongitude(tropicalLongitude(Body.Moon, endLocal), endLocal);
    const min = Math.min(m1, m2);
    const max = Math.max(m1, m2);
    moonRange = {
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      mayChangeNakshatra: nakshatraFor(m1).index !== nakshatraFor(m2).index,
    };
    if (moonRange.mayChangeNakshatra) {
      notes.push("Because the Moon may cross a nakshatra boundary on this date, Moon-based Dasha and nakshatra readings are not asserted.");
    }
  }

  const d9 = planets.map((p) => {
    const nsi = navamsaSignIndex(p.longitude);
    return { name: p.name, signIndex: nsi, sign: RASHIS[nsi].name };
  });

  const charts: AstrologyResult["charts"] = {
    d1: {
      ascendantSignIndex: ascSign,
      houses,
      planets,
    },
    d9: ascSign === null ? null : {
      ascendantSignIndex: navamsaSignIndex(asc as number),
      placements: d9,
    },
  };

  const now = new Date();
  const transitPlanets = computePlanets(now, null);
  const level: AstrologyResult["uncertainty"]["level"] = assumedTime
    ? "HIGH"
    : accuracy === "APPROXIMATE"
      ? "MEDIUM"
      : "LOW";
  if (assumedTime) {
    notes.push("Ascendant, houses, divisional charts and Vimshottari Dasha are intentionally not presented as facts for unknown birth times.");
  }

  return {
    provider: PROVIDER,
    providerVersion: PROVIDER_VERSION,
    settings: {
      zodiac: "SIDEREAL",
      ayanamsa: "LAHIRI",
      ayanamsaValue: Number(ayanamsa.toFixed(6)),
      houseSystem: "WHOLE_SIGN",
      nodeType: "MEAN_NODE",
    },
    birth: {
      date: input.dateOfBirth,
      time: hasTime ? input.birthTime! : null,
      timezone: input.birthplace.timezone,
      utc: utc.toISOString(),
      assumedTime,
      offsetMinutes,
    },
    ascendant:
      asc === null || ascSign === null
        ? null
        : {
            longitude: Number(asc.toFixed(4)),
            signIndex: ascSign,
            sign: RASHIS[ascSign].name,
            degreeInSign: Number(degreeInSign(asc).toFixed(4)),
            nakshatra: nakshatraFor(asc),
            rangeDegrees: ascRange,
          },
    planets,
    houses,
    charts,
    dasha,
    transits: {
      asOf: now.toISOString(),
      planets: transitPlanets,
      note: "Current sidereal planetary positions are shown for reflection only; they are not event predictions.",
    },
    uncertainty: {
      level,
      notes,
      moonRange,
    },
    calculatedAt: now.toISOString(),
  };
}

export const ASTROLOGY_DISCLAIMER =
  "Vedic chart data is calculated by a dedicated astronomical engine using the sidereal zodiac and Lahiri ayanamsa. It is a traditional interpretive framework, not a scientifically verified prediction.";
