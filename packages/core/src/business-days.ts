/**
 * The day money actually moves when its day is not a working one.
 *
 * A salary due on Saturday the 31st is paid on Friday the 30th; a direct
 * debit due on Sunday leaves on Monday; nothing moves on the 1st of May. A
 * recurring entry keeps its own day — that is what its occurrences are known
 * by — but what is still to come, the balance's line and « Il vous reste »
 * look for the money on the working day it lands.
 *
 * French public holidays, the ones banks do not book on: the fixed ones and
 * the three that follow Easter.
 */

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = utc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

/** Easter Sunday, by the anonymous Gregorian algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const holidayCache = new Map<number, ReadonlySet<string>>();

/** France's public holidays in a year. */
export function frenchHolidays(year: number): ReadonlySet<string> {
  const cached = holidayCache.get(year);
  if (cached) {
    return cached;
  }
  const easter = easterSunday(year);
  const days = new Set([
    `${year}-01-01`,
    addDays(easter, 1), // Lundi de Pâques
    `${year}-05-01`,
    `${year}-05-08`,
    addDays(easter, 39), // Ascension
    addDays(easter, 50), // Lundi de Pentecôte
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
  holidayCache.set(year, days);
  return days;
}

/** Whether banks book on that day: a weekday that is not a public holiday. */
export function isBusinessDay(day: string): boolean {
  const weekday = utc(day).getUTCDay();
  return (
    weekday !== 0 &&
    weekday !== 6 &&
    !frenchHolidays(Number(day.slice(0, 4))).has(day)
  );
}

/**
 * The working day money due on `day` moves on: pay comes the working day
 * before, a charge leaves the working day after. The day itself when it is
 * a working one.
 */
export function moneyDay(day: string, way: "in" | "out"): string {
  let at = day;
  const step = way === "in" ? -1 : 1;
  for (let guard = 0; guard < 10 && !isBusinessDay(at); guard += 1) {
    at = addDays(at, step);
  }
  return at;
}
