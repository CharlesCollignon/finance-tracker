import type { BlogCopy } from "./blog-copy";

/** « Le blog », en français — et les guides n'existent que dans cette langue. */
export const blogCopyFr: BlogCopy = {
  meta: {
    title: "Le blog",
    description:
      "Des guides pratiques pour comprendre votre argent en France : le jour de lecture, le bilan du mois, le PEA, le CTO, l’assurance-vie et le PER.",
  },
  hero: {
    titleLines: ["Le blog"],
    intro:
      "Des guides pratiques pour comprendre votre argent, sans conseil — et bientôt, un espace pour s’entraider.",
  },
  featured: "À la une",
  rubriques: { mois: "Votre mois", placements: "Vos placements" },
  minutes: "{minutes} min de lecture",
  updated: "Mis à jour le {date}",
  frenchOnly: "Ce guide n’existe qu’en français.",
  toc: "Dans ce guide",
  allGuides: "Tous les guides",
  next: "Guide suivant",
  disclaimer:
    "Ce guide explique comment les choses fonctionnent ; il ne dit pas quoi faire.",
  photo: { by: "Photo :", on: "sur" },
  question: {
    heading: "Une question ?",
    body: "Si quelque chose n’est pas clair, ou pas juste, écrivez-nous : c’est comme ça que les guides s’améliorent.",
    write: "Nous écrire",
  },
  entraide: {
    title: "Entraide",
    body: "Posez vos questions aux autres personnes qui utilisent Pluclair, et répondez aux leurs.",
    soon: "Bientôt",
  },
};
