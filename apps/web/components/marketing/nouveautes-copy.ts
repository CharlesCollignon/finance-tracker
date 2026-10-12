import type { ChangeKind, ChangePlatform } from "@finance/core/changelog";
import type { Locale } from "@finance/core/i18n/locale";
import { nouveautesCopyFr } from "@/components/marketing/nouveautes-copy.fr";

/**
 * The words around « Nouveautés »: its title, its filters, what an entry's
 * buttons say. The entries themselves are in `@finance/core/changelog-entries`,
 * written in both languages there.
 *
 * Held to the site's rules (`landing-copy.ts`). `{count}`, `{days}` and
 * `{date}` are filled in where the words are used.
 */

export const NOUVEAUTES_HREF = "/nouveautes";

/** The feed, beside the page (`app/(marketing)/nouveautes/rss.xml`). */
export const NOUVEAUTES_RSS_HREF = `${NOUVEAUTES_HREF}/rss.xml`;

export function nouveautesEntryHref(id: string): string {
  return `${NOUVEAUTES_HREF}/${id}`;
}

export interface NouveautesCopy {
  meta: { title: string; description: string };
  hero: {
    titleLines: string[];
    intro: string;
    updatedToday: string;
    updatedYesterday: string;
    updatedDaysAgo: string;
    entries: string;
    commits: string;
    since: string;
  };
  /** The strip beside the title: one bar per week since the first commit. */
  pulse: { caption: string; week: string; none: string };
  filters: {
    label: string;
    all: string;
    kinds: Record<ChangeKind, string>;
    platformsLabel: string;
    platformsAll: string;
    platforms: Record<ChangePlatform, string>;
  };
  fresh: {
    one: string;
    many: string;
    badge: string;
  };
  river: {
    label: string;
    monthCount: { one: string; many: string };
    fixes: { one: string; many: string };
    empty: string;
    reset: string;
  };
  entry: {
    more: string;
    less: string;
    featurePage: string;
    copyLink: string;
    copied: string;
  };
  soon: { heading: string; intro: string };
  follow: {
    heading: string;
    rss: string;
    rssDetail: string;
    source: string;
    sourceDetail: string;
  };
  /** The pill under the landing's hero, pointing at the latest entry. */
  landing: { label: string };
}

export const nouveautesCopy: NouveautesCopy = {
  meta: {
    title: "What's new",
    description:
      "What changes in Pluclair, week after week, on the web and on the phone.",
  },
  hero: {
    titleLines: ["What's new"],
    intro:
      "What changes in Pluclair, week after week — on the web and on the phone. Everything here is live today.",
    updatedToday: "Updated today",
    updatedYesterday: "Updated yesterday",
    updatedDaysAgo: "Updated {days} days ago",
    entries: "changes listed",
    commits: "changes to the code",
    since: "since {date}",
  },
  pulse: {
    caption: "One bar a week, since the first line of code",
    week: "Week of {date}",
    none: "Nothing new",
  },
  filters: {
    label: "Show",
    all: "All",
    kinds: { new: "New", better: "Improved", fixed: "Fixed" },
    platformsLabel: "On",
    platformsAll: "Everywhere",
    platforms: { web: "Web", phone: "Phone" },
  },
  fresh: {
    one: "1 new since your last visit",
    many: "{count} new since your last visit",
    badge: "New for you",
  },
  river: {
    label: "Changes, newest first",
    monthCount: { one: "1 change", many: "{count} changes" },
    fixes: { one: "1 fix", many: "{count} fixes" },
    empty: "Nothing under this filter yet.",
    reset: "Show everything",
  },
  entry: {
    more: "More",
    less: "Less",
    featurePage: "See the page",
    copyLink: "Copy the link to this change",
    copied: "Link copied",
  },
  soon: {
    heading: "Coming soon",
    intro: "Being built now, and not open yet.",
  },
  follow: {
    heading: "Follow along",
    rss: "RSS feed",
    rssDetail: "Each change, in your feed reader",
    source: "The code, on GitHub",
    sourceDetail: "Every change, readable line by line",
  },
  landing: { label: "New" },
};

export function nouveautesCopyFor(locale: Locale): NouveautesCopy {
  return locale === "en" ? nouveautesCopy : nouveautesCopyFr;
}

/** « 1 change » or « 4 changes ». */
export function countLabel(
  words: { one: string; many: string },
  count: number,
): string {
  return count === 1 ? words.one : words.many.replace("{count}", String(count));
}
