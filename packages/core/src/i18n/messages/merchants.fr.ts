import type { merchantsEn } from "./merchants.en";

/** The French half of `merchants.en.ts`, mounted by `fr.ts` as `merchants`. */
export const merchantsFr: typeof merchantsEn = {
  intro:
    "Chaque endroit où votre argent est allé ces douze derniers mois, par ce que vous y avez dépensé.",
  searchLabel: "Trouver un commerce",
  searchPlaceholder: "Un commerce, une catégorie",
  empty: "Rien à montrer pour l'instant",
  emptyBody:
    "Les commerces apparaissent à mesure que vous notez vos dépenses, ou que vous apportez votre relevé.",
  noMatch: "Aucun commerce avec ces mots",
  noMatchBody: "Essayez moins de lettres, ou un autre mot.",
  visits: { one: "{count} fois", other: "{count} fois" },
  lastOn: "Dernière fois le {date}",
  normal: "{amount} un mois normal",
  perVisit: "{amount} à chaque fois",
  total: "{amount} sur 12 mois",
  mixed: "Rangé dans plusieurs catégories",
  open: "Ouvrir {name}",
  moreRows: { one: "+{count} autre", other: "+{count} autres" },
  chartLabel: "Mois par mois, les douze derniers",
  count: { one: "{count} commerce", other: "{count} commerces" },
};
