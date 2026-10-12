import type {
  ChangeKind,
  ChangePlatform,
  ChangelogEntry,
} from "@finance/core/changelog";
import { changeText } from "@finance/core/changelog";
import { formatDayMonth } from "@finance/core/constants";
import { monthLong } from "@finance/core/i18n/calendar-names";
import type { Locale } from "@finance/core/i18n/locale";
import {
  getLandingPage,
  isLandingPageId,
  type LandingPageId,
} from "@/components/marketing/landing-copy";

/**
 * An entry as the page draws it: in the reader's language, its date already
 * worded, and its feature page checked against the site's own list — an id
 * the site has no page for draws no link and no screen.
 */
export interface RiverEntry {
  id: string;
  date: string;
  dateLabel: string;
  kind: ChangeKind;
  platforms: readonly ChangePlatform[];
  feature: { id: LandingPageId; title: string } | null;
  featured: boolean;
  title: string;
  body: string;
  detail: string | null;
}

export function riverEntry(entry: ChangelogEntry, locale: Locale): RiverEntry {
  const text = changeText(entry, locale);
  const feature =
    entry.feature && isLandingPageId(entry.feature)
      ? {
          id: entry.feature,
          title: getLandingPage(entry.feature, locale).title,
        }
      : null;
  return {
    id: entry.id,
    date: entry.date,
    dateLabel: formatDayMonth(entry.date, locale),
    kind: entry.kind,
    platforms: entry.platforms,
    feature,
    featured: Boolean(entry.featured && feature),
    title: text.title,
    body: text.body,
    detail: text.detail ?? null,
  };
}

/** « 5 octobre », « 1er octobre », "5 October": a day said with its month. */
export function dayAndMonth(iso: string, locale: Locale): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${locale === "fr" && day === 1 ? "1er" : day} ${monthLong(month!, locale)}`;
}
