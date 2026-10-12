import { describe, expect, it } from "vitest";
import { rssFeed } from "./rss";

describe("rssFeed", () => {
  const xml = rssFeed({
    title: "Nouveautés — Pluclair",
    link: "https://pluclair.com/nouveautes",
    self: "https://pluclair.com/nouveautes/rss.xml",
    description: "Ce qui change",
    language: "fr-FR",
    items: [
      {
        title: "« Il vous reste » & <le point>",
        link: "https://pluclair.com/nouveautes/2026-10-08-left-to-spend",
        description: "Ce qu’il vous reste",
        date: "2026-10-08",
      },
    ],
  });

  it("escapes what XML would read as markup", () => {
    expect(xml).toContain("« Il vous reste » &amp; &lt;le point&gt;");
    expect(xml).not.toContain("<le point>");
  });

  it("dates an item at noon UTC on its day, and the channel by its newest", () => {
    expect(xml).toContain("<pubDate>Thu, 08 Oct 2026 12:00:00 GMT</pubDate>");
    expect(xml).toContain(
      "<lastBuildDate>Thu, 08 Oct 2026 12:00:00 GMT</lastBuildDate>",
    );
  });

  it("gives each item its address as a permanent id, and the feed its own", () => {
    expect(xml).toContain(
      '<guid isPermaLink="true">https://pluclair.com/nouveautes/2026-10-08-left-to-spend</guid>',
    );
    expect(xml).toContain(
      '<atom:link href="https://pluclair.com/nouveautes/rss.xml" rel="self"',
    );
  });
});
