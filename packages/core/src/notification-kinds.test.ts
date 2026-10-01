import { describe, expect, it } from "vitest";

import {
  isQuietHour,
  readNotificationPrefs,
  wantsNotification,
} from "./notification-kinds";

describe("readNotificationPrefs", () => {
  it("keeps known kinds set to a boolean, and nothing else", () => {
    expect(
      readNotificationPrefs({
        recap: false,
        overdraft: true,
        nonsense: false,
        close: "no",
      }),
    ).toEqual({ recap: false, overdraft: true });
  });

  it("reads anything that is not an object as no choice made", () => {
    expect(readNotificationPrefs(null)).toEqual({});
    expect(readNotificationPrefs([])).toEqual({});
    expect(readNotificationPrefs("recap")).toEqual({});
  });
});

describe("wantsNotification", () => {
  it("is on unless turned off", () => {
    expect(wantsNotification({}, "recap")).toBe(true);
    expect(wantsNotification({ recap: true }, "recap")).toBe(true);
    expect(wantsNotification({ recap: false }, "recap")).toBe(false);
  });
});

describe("isQuietHour", () => {
  it("is quiet at night in Paris, summer and winter alike", () => {
    // 21:00 UTC is 23:00 in Paris in July and 22:00 in January.
    expect(isQuietHour(new Date("2026-07-14T21:00:00Z"))).toBe(true);
    expect(isQuietHour(new Date("2026-01-14T21:00:00Z"))).toBe(true);
    // 05:30 UTC is 07:30 / 06:30 in Paris: still quiet.
    expect(isQuietHour(new Date("2026-07-14T05:30:00Z"))).toBe(true);
  });

  it("is not quiet during the day in Paris", () => {
    // 08:00 UTC is 10:00 / 09:00 in Paris.
    expect(isQuietHour(new Date("2026-07-14T08:00:00Z"))).toBe(false);
    expect(isQuietHour(new Date("2026-01-14T08:00:00Z"))).toBe(false);
    // 17:00 UTC is 19:00 / 18:00 in Paris.
    expect(isQuietHour(new Date("2026-07-14T17:00:00Z"))).toBe(false);
  });

  it("starts at 21:00 and ends at 08:00 sharp, Paris time", () => {
    // 19:00 UTC in July is 21:00 in Paris.
    expect(isQuietHour(new Date("2026-07-14T19:00:00Z"))).toBe(true);
    expect(isQuietHour(new Date("2026-07-14T18:59:00Z"))).toBe(false);
    // 06:00 UTC in July is 08:00 in Paris.
    expect(isQuietHour(new Date("2026-07-14T06:00:00Z"))).toBe(false);
  });
});
