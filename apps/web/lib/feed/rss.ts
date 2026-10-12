/**
 * An RSS 2.0 feed, written out by hand: a handful of fields, escaped, is
 * all a feed reader needs, and no package is worth carrying for it.
 */

export interface FeedItem {
  title: string;
  /** Absolute. Also the item's id: one address, one change. */
  link: string;
  description: string;
  /** ISO date; published at noon UTC that day. */
  date: string;
}

export interface Feed {
  title: string;
  /** Absolute: the page the feed follows. */
  link: string;
  /** Absolute: the feed's own address. */
  self: string;
  description: string;
  /** `fr-FR`, `en-GB`. */
  language: string;
  items: FeedItem[];
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

function rfc822(date: string): string {
  return new Date(`${date}T12:00:00Z`).toUTCString();
}

export function rssFeed(feed: Feed): string {
  const items = feed.items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${rfc822(item.date)}</pubDate>
    </item>`,
    )
    .join("\n");
  const updated = feed.items[0]?.date;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <atom:link href="${escapeXml(feed.self)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(feed.description)}</description>
    <language>${feed.language}</language>${
      updated ? `\n    <lastBuildDate>${rfc822(updated)}</lastBuildDate>` : ""
    }
${items}
  </channel>
</rss>
`;
}
