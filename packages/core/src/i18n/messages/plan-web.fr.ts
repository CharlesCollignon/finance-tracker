import type { planWebEn } from "./plan-web.en";

/** The French half of `plan-web.en.ts`, mounted by `fr.ts` as `planWeb`. */
export const planWebFr: typeof planWebEn = {
  yearEmpty:
    "Ajoutez ce qui entre et sort chaque mois dans Récurrents, et votre année à venir s'affichera ici.",
  yearEmptyCta: "Ouvrir Récurrents",
  yearChartLabel: "Votre argent, compte par compte, mois par mois",
  scrubTotal: "En tout",
  asItStands: "Comme aujourd'hui",

  horizonLess: "Un an de moins",
  horizonMore: "Un an de plus",
  growthChartLabel:
    "Votre patrimoine année par année\u00A0: ce qui est déjà placé, vos versements et les gains après impôts",
  accountPick: "Choisir un compte à ajouter",

  runMonthWon: "{month} : réussi",
  runMonthMissed: "{month} : manqué",
  monthsChartLabel: "Ce que chaque bilan a économisé",
  closeDetails: "Détail et réglages du bilan",
  closeDetailsHide: "Masquer le détail",

  tableMonth: "Mois",
  tableYear: "Année",
  breakdownOthers: "Autres",
};
