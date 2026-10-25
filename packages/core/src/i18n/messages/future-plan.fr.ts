import type { futurePlanEn } from "./future-plan.en";

/** The French half of `future-plan.en.ts`, mounted by `fr.ts` as `futurePlan`. */
export const futurePlanFr: typeof futurePlanEn = {
  scrubPoint: "{month} : {amount}",
  inYearsTitle: { one: "Dans un an", other: "Dans {count} ans" },
  accountCurrent: "Compte courant",
  accountElsewhere: "Autre épargne",

  whatIfTo: "Sur",
  whatIfToLabel: "Où va le supplément",

  whatIfTitle: "Et si…",
  whatIfLabel: "Mettre de côté en plus chaque mois",
  whatIfPerMonth: "+{amount} par mois",
  whatIfNone: "Faites glisser pour voir ce qu'un petit effort change.",
  whatIfSooner: {
    one: "{milestone} atteint {count} mois plus tôt",
    other: "{milestone} atteint {count} mois plus tôt",
  },
  whatIfNowReached: "{milestone} atteint en {month}",
  milestoneBeyond: "au-delà de {count} ans",
  milestoneNew: "Nouveau palier !",
  cushionMonths: { one: "{count} mois", other: "{count} mois" },
  cushionNext: "Prochaine étape : {months}",
  cushionFull: "Six mois couverts : votre matelas est complet.",
  cushionNoFixed:
    "Ajoutez vos dépenses fixes dans Récurrents et votre matelas sera mesuré ici.",
  years: { one: "{count} an", other: "{count} ans" },
  today: "Aujourd'hui",
  accountsReset: "Revenir à mes chiffres",
  fieldInitial: "Dessus aujourd'hui",
  fieldMonthly: "Chaque mois",
  fieldReturn: "Rendement par an",
  fieldFees: "Frais par an",
  fieldTax: "Impôt sur les gains",
  envelopeLivret: "Livrets d'épargne (Livret A, LDDS, LEP)",
  taxPea:
    "18,6 % de prélèvements sociaux sur les gains après 5 ans (31,4 % avant).",
  taxCto:
    "Impôt forfaitaire (« flat tax ») de 31,4\u00A0%\u00A0: 12,8\u00A0% d'impôt sur le revenu et 18,6\u00A0% de prélèvements sociaux.",
  taxAv:
    "24,7 % après 8 ans, sur les gains au-delà de 4 600 € par an (9 200 € en couple).",
  taxPer:
    "31,4 % sur les gains ; les versements déduits sont imposés comme un revenu à la sortie.",
  taxCrypto:
    "Impôt forfaitaire de 31,4\u00A0%, sur les ventes au-delà de 305\u00A0€ par an.",
  taxLivret: "Aucun : le Livret A, le LDDS et le LEP sont défiscalisés.",

  runTitle: "Votre série",
  runCount: {
    one: "{count} mois d'affilée",
    other: "{count} mois d'affilée",
  },
  runRecord: { one: "Record : {count} mois", other: "Record : {count} mois" },
  runKeep: "Faites le bilan de {month} pour la garder en vie",
  monthsTitle: "Vos mois",
  monthsBest: "Meilleur mois : {month}, {amount} économisés",
  monthsEmpty: "Faites votre premier bilan pour voir vos mois ici.",
};
