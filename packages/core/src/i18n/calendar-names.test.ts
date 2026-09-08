import { describe, expect, it } from "vitest";
import {
  CALENDAR_NAMES,
  calendarNames,
  dayOfWeekLong,
  monthLong,
  monthShort,
  weekdayShortMondayFirst,
} from "./calendar-names";
import { LOCALES } from "./locale";

describe("the tables themselves", () => {
  it("names twelve months and seven days in every language", () => {
    for (const locale of LOCALES) {
      const names = CALENDAR_NAMES[locale];
      expect(names.monthLong).toHaveLength(12);
      expect(names.monthShort).toHaveLength(12);
      expect(names.weekdayLong).toHaveLength(7);
      expect(names.weekdayShort).toHaveLength(7);
    }
  });

  it("starts the weekday tables on Sunday, so Date.getDay() indexes them", () => {
    // 2026-09-06 is a Sunday.
    const sunday = new Date(2026, 8, 6);
    expect(sunday.getDay()).toBe(0);
    expect(CALENDAR_NAMES.en.weekdayLong[sunday.getDay()]).toBe("Sunday");
    expect(CALENDAR_NAMES.fr.weekdayLong[sunday.getDay()]).toBe("dimanche");
  });

  it("keeps French months and weekdays lowercase", () => {
    for (const name of [
      ...CALENDAR_NAMES.fr.monthLong,
      ...CALENDAR_NAMES.fr.monthShort,
      ...CALENDAR_NAMES.fr.weekdayLong,
      ...CALENDAR_NAMES.fr.weekdayShort,
    ]) {
      expect(name).toBe(name.toLowerCase());
    }
  });
});

describe("monthLong / monthShort", () => {
  it("take a 1-indexed month, the way every caller holds one", () => {
    expect(monthLong(9, "en")).toBe("September");
    expect(monthLong(9, "fr")).toBe("septembre");
    expect(monthShort(9, "en")).toBe("Sep");
    expect(monthShort(9, "fr")).toBe("sept.");
  });

  it("abbreviate only the French months that need it", () => {
    expect(monthShort(3, "fr")).toBe("mars");
    expect(monthShort(5, "fr")).toBe("mai");
    expect(monthShort(1, "fr")).toBe("janv.");
  });

  it("default to English", () => {
    expect(monthLong(1)).toBe("January");
  });

  it("return nothing for a month that does not exist", () => {
    expect(monthLong(0, "en")).toBe("");
    expect(monthLong(13, "en")).toBe("");
  });
});

describe("weekdayShortMondayFirst", () => {
  it("rotates the calendar grid onto a European week", () => {
    expect(weekdayShortMondayFirst("en")).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(weekdayShortMondayFirst("fr")[0]).toBe("lun.");
    expect(weekdayShortMondayFirst("fr")[6]).toBe("dim.");
  });
});

describe("dayOfWeekLong", () => {
  it("reads ISO day numbers, where 1 is Monday and 7 is Sunday", () => {
    expect(dayOfWeekLong(1, "en")).toBe("Monday");
    expect(dayOfWeekLong(7, "en")).toBe("Sunday");
    expect(dayOfWeekLong(1, "fr")).toBe("lundi");
    expect(dayOfWeekLong(7, "fr")).toBe("dimanche");
  });
});

describe("calendarNames", () => {
  it("falls back to the default for a locale it does not have", () => {
    expect(calendarNames("de" as never).monthLong[0]).toBe("January");
  });
});
