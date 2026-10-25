import type { futurePlanEn } from "./future-plan.en";

/** The French half of `future-plan.en.ts`, mounted by `fr.ts` as `futurePlan`. */
export const futurePlanFr: typeof futurePlanEn = {
  intro: "Là où va votre argent, si les choses continuent comme aujourd'hui.",

  yearTitle: "Dans un an",
  scrubPoint: "{month} : {amount}",

  inMonthsTitle: "Dans {count} mois",
  inYearsTitle: { one: "Dans un an", other: "Dans {count} ans" },
  horizonMonths: "{count} mois",
  yearAllGrounded: "sur tous vos comptes, d'ici {month}",
  accountCurrent: "Compte courant",
  accountElsewhere: "Autre épargne",

  whyLeadIncome: "Chaque mois, sur {amount} de revenus",
  rangeLine: "8 chances sur 10\u00a0: entre {low} et {high}",
  afterTaxLine: "soit {amount} après impôts si vous vendiez tout",
  realTerms: "En euros d'aujourd'hui",
  whyTitle: "Pourquoi",
  flowCommitted: "Charges fixes",
  flowEveryday: "Dépenses courantes",
  flowCurrentStays: "Reste sur le compte courant",

  whatIfTo: "Sur",
  whatIfToLabel: "Où va le supplément",
  whatIfResultBy: "{amount} de plus d'ici {month}",

  whatIfTitle: "Et si…",
  whatIfLabel: "Mettre de côté en plus chaque mois",
  whatIfPerMonth: "+{amount} par mois",
  whatIfNone: "Faites glisser pour voir ce qu'un petit effort change.",
  whatIfSooner: {
    one: "{milestone} atteint {count} mois plus tôt",
    other: "{milestone} atteint {count} mois plus tôt",
  },
  whatIfNowReached: "{milestone} atteint en {month}",

  milestonesTitle: "Vos paliers",
  milestonesBasis: "Votre épargne et vos placements, avec leur rendement",
  milestoneReached: "Atteint",
  milestoneIn: { one: "dans {count} mois", other: "dans {count} mois" },
  milestoneBeyond: "au-delà de {count} ans",
  milestoneNew: "Nouveau palier !",

  cushionTitle: "Votre matelas de sécurité",
  cushionBody: "{months} de dépenses fixes couverts par votre épargne",
  cushionMonths: { one: "{count} mois", other: "{count} mois" },
  cushionNext: "Prochaine étape : {months}",
  cushionFull: "Six mois couverts : votre matelas est complet.",
  cushionNoFixed:
    "Ajoutez vos dépenses fixes dans Récurrents et votre matelas sera mesuré ici.",
  horizon: "Horizon",
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
