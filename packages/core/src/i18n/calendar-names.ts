import { DEFAULT_LOCALE, type Locale } from "./locale";

/**
 * Day and month names, in every language, still written out.
 *
 * The English tables moved here from `../constants`, and the comment that
 * justified them there justifies them twice as hard now. `Intl.DateTimeFormat`
 * does not agree with itself across runtimes — Node 20's ICU says "Sep" where
 * current Chrome says "Sept" — and every one of these labels is rendered
 * inside a client component, so a disagreement is a hydration mismatch and
 * React redraws the page. French makes it worse rather than better: its
 * abbreviations are exactly the ones ICU has changed most ("sept." against
 * "sep."), and its long forms are lowercase in a way some ICU versions
 * capitalise at the start of a formatted date. Fixed tables cost nothing and
 * cannot drift with an upgrade.
 *
 * Note the French conventions, which are not stylistic choices: months and
 * weekdays are lowercase, and the abbreviations carry a full stop because
 * they are contractions rather than initialisms — "sept." is short for
 * "septembre", and dropping the point makes it a different word.
 *
 * Three indexings coexist because three callers need three different ones,
 * and converting between them at each call site is how the app ended up with
 * three separate weekday tables in the first place:
 *
 *   - `monthLong` / `monthShort` are 0-indexed, to be subscripted by
 *     `month - 1` the way the formatters in `../constants` already do.
 *   - `weekdayLong` / `weekdayShort` start on Sunday, so `Date.getDay()`
 *     indexes them directly.
 *   - `weekdayShortMondayFirst` starts on Monday, for a calendar grid, and
 *     `dayOfWeekLong` is ISO 1-7, for a weekly recurrence.
 */
export interface CalendarNames {
  /** January … December, indexed from 0. */
  monthLong: readonly string[];
  /** Jan … Dec, indexed from 0. */
  monthShort: readonly string[];
  /** Sunday … Saturday, indexed by `Date.getDay()`. */
  weekdayLong: readonly string[];
  /** Sun … Sat, indexed by `Date.getDay()`. */
  weekdayShort: readonly string[];
}

const EN: CalendarNames = {
  monthLong: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  monthShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  weekdayLong: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  weekdayShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const FR: CalendarNames = {
  monthLong: [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ],
  // "mars", "mai", "juin" and "août" are already short enough not to be
  // abbreviated, so they carry no full stop. That asymmetry is correct
  // French, not an oversight.
  monthShort: [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ],
  weekdayLong: [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ],
  weekdayShort: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
};

export const CALENDAR_NAMES: Record<Locale, CalendarNames> = { en: EN, fr: FR };

export function calendarNames(locale: Locale = DEFAULT_LOCALE): CalendarNames {
  return CALENDAR_NAMES[locale] ?? CALENDAR_NAMES[DEFAULT_LOCALE];
}

/** "September" from a 1-indexed month, the way every caller holds it. */
export function monthLong(month: number, locale: Locale = DEFAULT_LOCALE): string {
  return calendarNames(locale).monthLong[month - 1] ?? "";
}

/** "Sep" from a 1-indexed month. */
export function monthShort(month: number, locale: Locale = DEFAULT_LOCALE): string {
  return calendarNames(locale).monthShort[month - 1] ?? "";
}

/**
 * The seven short weekday names a calendar grid heads its columns with,
 * Monday first — which is the week Europe starts on, and the order the
 * existing grid already assumes.
 */
export function weekdayShortMondayFirst(
  locale: Locale = DEFAULT_LOCALE,
): readonly string[] {
  const { weekdayShort } = calendarNames(locale);
  return [...weekdayShort.slice(1), weekdayShort[0]!];
}

/**
 * A weekday named from an ISO day number, 1 being Monday.
 *
 * That is the numbering a weekly recurring template stores, and it is one off
 * from `Date.getDay()` in a way that has to be converted somewhere; here is
 * the somewhere.
 */
export function dayOfWeekLong(
  isoDayOfWeek: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return calendarNames(locale).weekdayLong[isoDayOfWeek % 7] ?? "";
}
