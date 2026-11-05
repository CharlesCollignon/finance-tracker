import { describe, expect, it } from "vitest";

import {
  easterSunday,
  frenchHolidays,
  isBusinessDay,
  moneyDay,
} from "./business-days";

describe("business days", () => {
  it("knows Easter and the holidays that follow it", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    const holidays = frenchHolidays(2026);
    expect(holidays.has("2026-04-06")).toBe(true); // Lundi de Pâques
    expect(holidays.has("2026-05-14")).toBe(true); // Ascension
    expect(holidays.has("2026-05-25")).toBe(true); // Lundi de Pentecôte
    expect(holidays.has("2026-07-14")).toBe(true);
  });

  it("is a weekday that is not a holiday", () => {
    expect(isBusinessDay("2026-11-06")).toBe(true); // Friday
    expect(isBusinessDay("2026-11-07")).toBe(false); // Saturday
    expect(isBusinessDay("2026-11-11")).toBe(false); // Armistice
  });

  it("pays the working day before and debits the working day after", () => {
    // Saturday 31 October 2026.
    expect(moneyDay("2026-10-31", "in")).toBe("2026-10-30");
    expect(moneyDay("2026-10-31", "out")).toBe("2026-11-02");
    // Sunday 1 November, All Saints', then Monday is a working day.
    expect(moneyDay("2026-11-01", "out")).toBe("2026-11-02");
    // Friday 1 May 2026: a debit waits for Monday the 4th.
    expect(moneyDay("2026-05-01", "out")).toBe("2026-05-04");
    // A working day stays itself.
    expect(moneyDay("2026-11-05", "in")).toBe("2026-11-05");
  });
});
