import type { Locale } from "@finance/core/i18n/locale";
import type { GuideRubrique } from "@/lib/guide-list";
import { blogCopyFr } from "@/components/marketing/blog-copy.fr";

/**
 * The words around « Le blog »: its index, a guide's frame, and the door to
 * Entraide while it is still coming. The guides themselves are in
 * `content/guides/`, in French. `{minutes}` and `{date}` are filled in where
 * the words are used.
 */
export interface BlogCopy {
  meta: { title: string; description: string };
  hero: { titleLines: string[]; intro: string };
  featured: string;
  rubriques: Record<GuideRubrique, string>;
  minutes: string;
  updated: string;
  frenchOnly: string;
  toc: string;
  allGuides: string;
  next: string;
  disclaimer: string;
  /** Under a guide's cover: « Photo : <name> sur <Unsplash> ». */
  photo: { by: string; on: string };
  question: { heading: string; body: string; write: string };
  entraide: { title: string; body: string; soon: string };
}

export const blogCopy: BlogCopy = {
  meta: {
    title: "The blog",
    description:
      "Practical guides to understand your money in France: the reading day, the month's close, the PEA, CTO, assurance-vie and PER.",
  },
  hero: {
    titleLines: ["The blog"],
    intro:
      "Practical guides to understand your money, without advice — and soon, a place to help one another.",
  },
  featured: "Featured",
  rubriques: { mois: "Your month", placements: "Your investments" },
  minutes: "{minutes} min read",
  updated: "Updated {date}",
  frenchOnly: "This guide is written in French only.",
  toc: "In this guide",
  allGuides: "All guides",
  next: "Next guide",
  disclaimer:
    "This guide explains how things work; it does not tell you what to do.",
  photo: { by: "Photo:", on: "on" },
  question: {
    heading: "A question?",
    body: "If something here is unclear, or wrong, write to us: guides get better that way.",
    write: "Write to us",
  },
  entraide: {
    title: "Entraide",
    body: "Ask your questions to other people who use Pluclair, and answer theirs.",
    soon: "Coming soon",
  },
};

export function blogCopyFor(locale: Locale): BlogCopy {
  return locale === "en" ? blogCopy : blogCopyFr;
}
