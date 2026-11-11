import { describe, expect, it } from "vitest";
import {
  ambiguousLocalTime,
  formatDate,
  isExpired,
  localToUtc,
  timezoneOffsetMs,
  zonedParts,
} from "@/lib/datetime";

describe("timezone conversion", () => {
  it("converts an Indian birth time to UTC with a +05:30 offset", () => {
    const { utc, offsetMinutes } = localToUtc("1990-05-15", "14:30", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("1990-05-15T09:00:00.000Z");
    expect(offsetMinutes).toBe(330);
  });

  it("handles a negative offset (New York in winter)", () => {
    const { utc, offsetMinutes } = localToUtc("1990-01-15", "08:00", "America/New_York");
    expect(utc.toISOString()).toBe("1990-01-15T13:00:00.000Z");
    expect(offsetMinutes).toBe(-300);
  });

  it("applies daylight saving time in summer", () => {
    const { utc, offsetMinutes } = localToUtc("1990-07-15", "08:00", "America/New_York");
    expect(utc.toISOString()).toBe("1990-07-15T12:00:00.000Z");
    expect(offsetMinutes).toBe(-240);
  });

  it("reports the zoned parts of an instant", () => {
    const parts = zonedParts(new Date("2026-11-11T18:45:00Z"), "Asia/Kolkata");
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 12, hour: 0, minute: 15 });
  });

  it("measures the offset of a zone at an instant", () => {
    expect(timezoneOffsetMs(new Date("2026-01-01T00:00:00Z"), "Asia/Kolkata")).toBe(330 * 60_000);
    expect(timezoneOffsetMs(new Date("2026-01-01T00:00:00Z"), "UTC")).toBe(0);
  });

  it("flags a local time that does not exist at a DST jump", () => {
    // 02:30 never occurs in New York on 2026-03-08.
    expect(ambiguousLocalTime("2026-03-08", "02:30", "America/New_York")).toBe(true);
    expect(ambiguousLocalTime("2026-03-08", "12:30", "America/New_York")).toBe(false);
  });

  it("rejects unparseable input instead of defaulting to UTC", () => {
    expect(() => localToUtc("not-a-date", "14:30", "Asia/Kolkata")).toThrow("Invalid date/time");
    expect(() => localToUtc("1990-05-15", "xx", "Asia/Kolkata")).toThrow("Invalid date/time");
  });
});

describe("expiry and formatting helpers", () => {
  it("treats a past or equal instant as expired", () => {
    const now = Date.parse("2026-11-11T00:00:00Z");
    expect(isExpired(new Date(now - 1), now)).toBe(true);
    expect(isExpired(new Date(now), now)).toBe(true);
    expect(isExpired(new Date(now + 1), now)).toBe(false);
  });

  it("formats a date in a requested locale and zone", () => {
    expect(formatDate("2026-11-11T18:45:00Z", "en-GB", "Asia/Kolkata")).toContain("12 November 2026");
  });
});
