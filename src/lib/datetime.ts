/** Timezone-safe conversion helpers. No silent UTC assumptions. */

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of a timezone at a given instant, in milliseconds (east positive). */
export function timezoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a local wall-clock birth time in an IANA timezone to UTC.
 * Ambiguous/nonexistent DST times are resolved with the timezone's standard
 * behavior and flagged by the caller using `ambiguousLocalTime`.
 */
export function localToUtc(
  date: string,
  time: string,
  timeZone: string,
): { utc: Date; offsetMinutes: number } {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Invalid date/time");
  }
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = timezoneOffsetMs(new Date(guess), timeZone);
  let utc = new Date(guess - offset);
  // Second pass accounts for a DST boundary crossed by the first estimate.
  const offset2 = timezoneOffsetMs(utc, timeZone);
  if (offset2 !== offset) {
    utc = new Date(guess - offset2);
    offset = offset2;
  }
  return { utc, offsetMinutes: Math.round(offset / 60_000) };
}

export function ambiguousLocalTime(date: string, time: string, timeZone: string): boolean {
  const { utc } = localToUtc(date, time, timeZone);
  const roundTrip = zonedParts(utc, timeZone);
  const [h, m] = time.split(":").map(Number);
  return roundTrip.hour !== h || roundTrip.minute !== m;
}

export function formatUtcForDisplay(utc: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(utc);
}

/** Returns true when `date` is at or before the current instant. */
export function isExpired(date: Date, now = Date.now()): boolean {
  return date.getTime() <= now;
}

/** Formats an ISO date with locale, defaulting to English and the user's timezone. */
export function formatDate(iso: string | Date, locale = "en-GB", timeZone = "UTC"): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
