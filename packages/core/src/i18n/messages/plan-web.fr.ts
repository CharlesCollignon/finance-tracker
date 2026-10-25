import type { planWebEn } from "./plan-web.en";

/** The French half of `plan-web.en.ts`, mounted by `fr.ts` as `planWeb`. */
export const planWebFr: typeof planWebEn = {
  yearEmpty:
    "Ajoutez ce qui entre et sort chaque mois dans Récurrents, et votre année à venir s'affichera ici.",
  yearEmptyCta: "Ouvrir Récurrents",
  asItStands: "Comme aujourd'hui",

  runMonthWon: "{month} : réussi",
  runMonthMissed: "{month} : manqué",
  monthsChartLabel: "Ce que chaque bilan a économisé",
};
