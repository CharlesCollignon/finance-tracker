import type { Locale } from "./i18n/locale";

/**
 * « Nouveautés »: what changed in Pluclair, told to the people who use it.
 *
 * The entries themselves are in `./changelog-entries`; this module is their
 * shape and the arithmetic both apps do with them. Every entry carries its
 * French and its English side by side rather than in two catalogues, because
 * the list only ever grows and a pair is hard to leave half-written — the
 * test fails on an empty side.
 *
 * Held to the site's copy rules (`apps/web/components/marketing/landing-copy.ts`):
 * only what is true and checkable — each entry is a merge or a commit on
 * `main`, dated the day it landed — said in plain words, never advice.
 */

/** What an entry is: something new, something better, something mended. */
export type ChangeKind = "new" | "better" | "fixed";

export type ChangePlatform = "web" | "phone";

export interface ChangeText {
  /** Short, a line on a phone: what changed, not how. */
  title: string;
  /** One or two sentences: what it means for the person using the app. */
  body: string;
  /** A little more, shown when the entry is opened. */
  detail?: string;
}

export interface ChangelogEntry {
  /**
   * `YYYY-MM-DD-slug`, never changed once published: the « seen » marker,
   * an entry's own address and, later, its reactions all key on it.
   */
  id: string;
  /** The day it reached `main`, ISO. */
  date: string;
  kind: ChangeKind;
  platforms: readonly ChangePlatform[];
  /**
   * The marketing feature page that shows it, by id (`/features/<id>`).
   * The web checks every id against its own list of pages.
   */
  feature?: string;
  /** « À la une »: drawn wide, with the feature's screen. Needs `feature`. */
  featured?: boolean;
  fr: ChangeText;
  en: ChangeText;
}

/** A thing being built, said in the future tense under « Bientôt ». */
export interface RoadmapItem {
  id: string;
  fr: { title: string; body: string };
  en: { title: string; body: string };
}

export function changeText(entry: ChangelogEntry, locale: Locale): ChangeText {
  return entry[locale];
}

/**
 * The entries newer than the one a reader last saw, newest first.
 *
 * Nothing when they have never seen the list (there is no « since » for a
 * first visit), and nothing when the marker names an entry no longer in it,
 * rather than calling the whole list new.
 */
export function entriesSince<T extends { id: string }>(
  entries: readonly T[],
  seenId: string | null,
): T[] {
  if (!seenId) {
    return [];
  }
  const index = entries.findIndex((entry) => entry.id === seenId);
  return index < 0 ? [] : entries.slice(0, index);
}

/** Whole days from `from` to `to`, both ISO dates, on the calendar. */
export function daysBetween(from: string, to: string): number {
  const day = (iso: string) => {
    const [year, month, date] = iso.split("-").map(Number);
    return Date.UTC(year!, month! - 1, date!) / 86_400_000;
  };
  return Math.round(day(to) - day(from));
}

export interface ChangelogWeek<T = ChangelogEntry> {
  /** The first day of the week this group covers, within its month. */
  start: string;
  /** Its last day, within its month. */
  end: string;
  entries: T[];
}

export interface ChangelogMonth<T = ChangelogEntry> {
  /** `YYYY-MM`. */
  key: string;
  year: number;
  month: number;
  weeks: ChangelogWeek<T>[];
}

/**
 * The entries as months, and each month as its weeks, newest first — the
 * order the list is read in. A week is Monday to Sunday, cut at the month's
 * edges so that no group sits under the wrong month's name.
 *
 * Generic over the entry, so a screen can group entries it has already put
 * into one language.
 */
export function changelogMonths<T extends { date: string }>(
  entries: readonly T[],
): ChangelogMonth<T>[] {
  const months: ChangelogMonth<T>[] = [];
  for (const entry of entries) {
    const [year, month] = entry.date.split("-").map(Number);
    const key = entry.date.slice(0, 7);
    let current = months[months.length - 1];
    if (!current || current.key !== key) {
      current = { key, year: year!, month: month!, weeks: [] };
      months.push(current);
    }
    const { start, end } = weekWithinMonth(entry.date);
    let week = current.weeks[current.weeks.length - 1];
    if (!week || week.start !== start) {
      week = { start, end, entries: [] };
      current.weeks.push(week);
    }
    week.entries.push(entry);
  }
  return months;
}

function weekWithinMonth(iso: string): { start: string; end: string } {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  // Monday is 0.
  const offset = (date.getUTCDay() + 6) % 7;
  const lastOfMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const start = Math.max(1, day! - offset);
  const end = Math.min(lastOfMonth, day! - offset + 6);
  const at = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start: at(start), end: at(end) };
}

/** The Monday of the week an ISO date falls in. */
export function weekMonday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * One count per week, from the week of `from` to the week of `to`, oldest
 * first: how many entries landed in each, quiet weeks included as 0. The
 * rhythm of the work, drawn as it was.
 */
export function changelogPulse<T extends { date: string }>(
  entries: readonly T[],
  from: string,
  to: string,
): { week: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const week = weekMonday(entry.date);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const weeks: { week: string; count: number }[] = [];
  const last = weekMonday(to);
  const cursor = new Date(`${weekMonday(from)}T00:00:00Z`);
  for (;;) {
    const week = cursor.toISOString().slice(0, 10);
    weeks.push({ week, count: counts.get(week) ?? 0 });
    if (week >= last) {
      return weeks;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
}

/**
 * How far back a first look reaches: someone who has never opened the list
 * is told about the last two weeks, not about everything since June.
 */
const FIRST_LOOK_DAYS = 14;

/**
 * What is new for an account, newest first: the entries above the one it
 * last saw (`user_preferences.changelog_seen`) or, before it has seen any,
 * those of the last two weeks. Drives the dot in both apps' account menus.
 */
export function unseenEntries<T extends { id: string; date: string }>(
  entries: readonly T[],
  seenId: string | null,
  today: string,
): T[] {
  if (seenId && entries.some((entry) => entry.id === seenId)) {
    return entriesSince(entries, seenId);
  }
  return entries.filter(
    (entry) => daysBetween(entry.date, today) <= FIRST_LOOK_DAYS,
  );
}

/**
 * Whether `candidate` is a newer entry than `current`, by the day in their
 * ids — so a device a step behind never moves the marker back.
 */
export function isLaterEntry(
  candidate: string,
  current: string | null,
): boolean {
  return current === null || candidate.slice(0, 10) >= current.slice(0, 10);
}

/** Whether version `a` (« 1.2.0 ») is newer than `b`, part by part. */
export function isNewerVersion(a: string, b: string): boolean {
  const parts = (version: string) =>
    version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

/**
 * `/nouveautes/feed.json`: what the phone reads, so an APK already
 * installed still hears of what shipped after it was built, and of a newer
 * APK to download.
 */
export interface NouveautesFeed {
  entries: ChangelogEntry[];
  roadmap: RoadmapItem[];
  /** The APK the site hands out, where its version is known. */
  apk: { version: string; url: string } | null;
}
