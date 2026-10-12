import { describe, expect, it } from "vitest";
import {
  changelogMonths,
  changelogPulse,
  daysBetween,
  entriesSince,
  isLaterEntry,
  isNewerVersion,
  unseenEntries,
  weekMonday,
  type ChangelogEntry,
} from "./changelog";
import { CHANGELOG, CHANGELOG_STATS, ROADMAP } from "./changelog-entries";
import { todayIsoLocal } from "./constants";

function entry(id: string, date: string): ChangelogEntry {
  return {
    id,
    date,
    kind: "new",
    platforms: ["web"],
    fr: { title: id, body: id },
    en: { title: id, body: id },
  };
}

describe("entriesSince", () => {
  const list = [
    entry("c", "2026-10-03"),
    entry("b", "2026-10-02"),
    entry("a", "2026-10-01"),
  ];

  it("gives the entries above the one last seen, newest first", () => {
    expect(entriesSince(list, "a").map((e) => e.id)).toEqual(["c", "b"]);
    expect(entriesSince(list, "c")).toEqual([]);
  });

  it("calls nothing new on a first visit, or for a marker no longer listed", () => {
    expect(entriesSince(list, null)).toEqual([]);
    expect(entriesSince(list, "gone")).toEqual([]);
  });
});

describe("daysBetween", () => {
  it("counts calendar days, across a month and a clock change", () => {
    expect(daysBetween("2026-10-12", "2026-10-12")).toBe(0);
    expect(daysBetween("2026-09-30", "2026-10-02")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("changelogMonths", () => {
  it("groups by month, then by Monday-to-Sunday weeks cut at the month's edge", () => {
    const months = changelogMonths([
      entry("oct-12", "2026-10-12"),
      entry("oct-09", "2026-10-09"),
      entry("oct-02", "2026-10-02"),
      entry("sep-29", "2026-09-29"),
    ]);
    expect(months.map((m) => m.key)).toEqual(["2026-10", "2026-09"]);
    expect(months[0]!.weeks).toEqual([
      { start: "2026-10-12", end: "2026-10-18", entries: [expect.anything()] },
      { start: "2026-10-05", end: "2026-10-11", entries: [expect.anything()] },
      // The week of Monday 28 September, from the 1st under October…
      { start: "2026-10-01", end: "2026-10-04", entries: [expect.anything()] },
    ]);
    // …and to the 30th under September.
    expect(months[1]!.weeks[0]).toMatchObject({
      start: "2026-09-28",
      end: "2026-09-30",
    });
  });
});

describe("weekMonday and changelogPulse", () => {
  it("finds the Monday of a week, across a month", () => {
    expect(weekMonday("2026-10-12")).toBe("2026-10-12");
    expect(weekMonday("2026-10-04")).toBe("2026-09-28");
    expect(weekMonday("2026-10-01")).toBe("2026-09-28");
  });

  it("counts each week from the first to the last, quiet ones as 0", () => {
    const pulse = changelogPulse(
      [
        entry("a", "2026-10-13"),
        entry("b", "2026-10-12"),
        entry("c", "2026-09-29"),
      ],
      "2026-09-30",
      "2026-10-14",
    );
    expect(pulse).toEqual([
      { week: "2026-09-28", count: 1 },
      { week: "2026-10-05", count: 0 },
      { week: "2026-10-12", count: 2 },
    ]);
  });
});

describe("unseenEntries", () => {
  const list = [
    entry("2026-10-12-c", "2026-10-12"),
    entry("2026-10-01-b", "2026-10-01"),
    entry("2026-09-02-a", "2026-09-02"),
  ];

  it("gives what is above the marker", () => {
    expect(
      unseenEntries(list, "2026-09-02-a", "2026-10-12").map((e) => e.id),
    ).toEqual(["2026-10-12-c", "2026-10-01-b"]);
    expect(unseenEntries(list, "2026-10-12-c", "2026-10-12")).toEqual([]);
  });

  it("gives the last two weeks to someone who has never looked", () => {
    expect(unseenEntries(list, null, "2026-10-12").map((e) => e.id)).toEqual([
      "2026-10-12-c",
      "2026-10-01-b",
    ]);
    expect(unseenEntries(list, "gone", "2026-10-12")).toHaveLength(2);
  });
});

describe("isLaterEntry and isNewerVersion", () => {
  it("never moves the marker back a day", () => {
    expect(isLaterEntry("2026-10-12-a", null)).toBe(true);
    expect(isLaterEntry("2026-10-12-a", "2026-10-12-b")).toBe(true);
    expect(isLaterEntry("2026-10-09-a", "2026-10-12-b")).toBe(false);
  });

  it("compares versions part by part", () => {
    expect(isNewerVersion("1.1.0", "1.0.9")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(true);
    expect(isNewerVersion("1.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false);
  });
});

describe("the published entries", () => {
  it("each have a stable id that starts with their date", () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of CHANGELOG) {
      expect(e.id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      expect(e.id.slice(0, 10)).toBe(e.date);
    }
  });

  it("run newest first, and none is dated in the future", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(dates[0]! <= todayIsoLocal()).toBe(true);
    expect(dates[dates.length - 1]).toBe(CHANGELOG_STATS.since);
  });

  it("are written in both languages, and say where they are", () => {
    for (const e of CHANGELOG) {
      for (const text of [e.fr, e.en]) {
        expect(text.title.trim()).not.toBe("");
        expect(text.body.trim()).not.toBe("");
        expect(Boolean(e.fr.detail)).toBe(Boolean(e.en.detail));
      }
      expect(e.platforms.length).toBeGreaterThan(0);
    }
  });

  it("only feature an entry whose screen can be drawn", () => {
    for (const e of CHANGELOG.filter((e) => e.featured)) {
      expect(e.feature).toBeTruthy();
    }
  });
});

describe("the roadmap", () => {
  it("has unique ids and both languages", () => {
    const ids = ROADMAP.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ROADMAP) {
      expect(
        item.fr.title && item.fr.body && item.en.title && item.en.body,
      ).toBeTruthy();
    }
  });
});
