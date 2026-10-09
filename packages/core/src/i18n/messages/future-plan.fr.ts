import type { futurePlanEn } from "./future-plan.en";

/** The French half of `future-plan.en.ts`, mounted by `fr.ts` as `futurePlan`. */
export const futurePlanFr: typeof futurePlanEn = {
  intro: "Là où va votre argent, si les choses continuent comme aujourd'hui.",
  estimate: "Une estimation à partir de vos propres chiffres, pas un conseil.",

  yearTitle: "Dans un an",
  yearGrounded: "sur vos comptes et de côté, d'ici {month}",
  yearAdded: "mis de côté d'ici {month}, en plus de ce que vous avez",
  scrubHint: "Faites glisser sur la courbe pour voir chaque mois",
  scrubPoint: "{month} : {amount}",
  scrubWithExtra: "{amount} avec le supplément",

  inMonthsTitle: "Dans {count} mois",
  inYearsTitle: { one: "Dans un an", other: "Dans {count} ans" },
  horizonMonths: "{count} mois",
  yearAllGrounded: "sur tous vos comptes, d'ici {month}",
  yearAllAdded:
    "sur votre épargne et vos placements d'ici {month}, plus ce que les mois laissent sur le compte courant",
  yearShownOnly: "sur les comptes affichés, d'ici {month}",
  accountCurrent: "Compte courant",
  accountElsewhere: "Autre épargne",
  accountsPending: "Placements…",
  accountToggle: "Afficher ou masquer {name}",
  currentNoBank:
    "Sans banque connectée, le compte courant part de zéro\u00A0: il montre ce que les mois y ajoutent.",
  elsewhereHint:
    "Mis de côté depuis le compte courant sans qu'un de vos comptes le reçoive, comme la marge laissée chez un courtier au-delà des achats qu'elle paie.",

  whyLeadIncome: "Chaque mois, sur {amount} de revenus",
  flowGrowthLine:
    "S'y ajoutent {amount} d'intérêts et de rendement estimés d'ici {month}.",
  eventAdd: "Un événement",
  detailsLabel: "Le détail",
  whyTitle: "Pourquoi",
  flowCommitted: "Charges fixes",
  flowEveryday: "Dépenses courantes",
  flowEverydayUnmeasured:
    "Les dépenses courantes ne sont pas encore mesurées. Faites le bilan de quelques mois et elles seront déduites ici.",
  flowCurrentStays: "Reste sur le compte courant",
  flowCurrentFalls: "Sort du compte courant",

  whatIfTo: "Sur",
  whatIfToLabel: "Où va le supplément",
  whatIfResultBy: "{amount} de plus d'ici {month}",
  whatIfClear: "Tout effacer",

  eventsHint: "Faites glisser un repère sur la courbe pour changer son mois.",
  eventRaise: "Une augmentation",
  eventBonus: "Une prime",
  eventExpense: "Une grosse dépense",
  eventRaiseLine: "+{amount} par mois dès {month}",
  eventBonusLine: "+{amount} en {month}",
  eventExpenseLine: "−{amount} en {month}",
  eventRaiseAmount: "En plus chaque mois",
  eventAmount: "Montant",
  eventMonth: "Mois",
  eventRemove: "Retirer {name}",
  eventBeyond: "après l'horizon",
  eventMarker: "{name}, {line}. Les flèches gauche et droite changent le mois.",

  whatIfTitle: "Et si…",
  whatIfLabel: "Mettre de côté en plus chaque mois",
  whatIfPerMonth: "+{amount} par mois",
  whatIfNone: "Faites glisser pour voir ce qu'un petit effort change.",
  whatIfResult: "{amount} de plus en un an",
  whatIfSooner: {
    one: "{milestone} atteint {count} mois plus tôt",
    other: "{milestone} atteint {count} mois plus tôt",
  },
  whatIfNowReached: "{milestone} atteint en {month}",

  milestonesTitle: "Vos paliers",
  milestonesBasis: "Votre épargne et vos placements, avec leur rendement",
  milestoneReached: "Atteint",
  milestoneIn: { one: "dans {count} mois", other: "dans {count} mois" },
  milestoneOn: "en {month}",
  milestoneBeyond: "au-delà de {count} ans",
  milestoneNew: "Nouveau palier !",

  cushionTitle: "Votre matelas de sécurité",
  cushionBody: "{months} de dépenses fixes couverts par votre épargne",
  cushionMonths: { one: "{count} mois", other: "{count} mois" },
  cushionNext: "Prochaine étape : {months}",
  cushionFull: "Six mois couverts : votre matelas est complet.",
  cushionNoFixed:
    "Ajoutez vos dépenses fixes dans Récurrents et votre matelas sera mesuré ici.",
  cushionWhy:
    "Trois à six mois de dépenses fixes de côté, c'est le filet de sécurité habituel en cas de perte d'emploi ou de grosse réparation.",

  longTitle: {
    one: "Votre patrimoine dans {count} an",
    other: "Votre patrimoine dans {count} ans",
  },
  longNet: "après impôts",
  longReal: "soit {amount} en euros d'aujourd'hui",
  longIncome: "un revenu d'environ {amount} par mois",
  longIncomeHint:
    "Ce que vous pourriez retirer chaque mois au taux de retrait, en euros d'aujourd'hui.",
  legendInitial: "Déjà placé",
  legendContributions: "Vos versements",
  legendGains: "Gains après impôts",
  statFuture: "Valeur future",
  statGains: "Dont gains",
  statTaxes: "Impôts estimés",
  statNet: "Valeur nette",
  horizon: "Horizon",
  years: { one: "{count} an", other: "{count} ans" },
  today: "Aujourd'hui",
  inYears: { one: "dans {count} an", other: "dans {count} ans" },
  inflation: "Inflation",
  inflationHint:
    "La vitesse à laquelle les prix montent chaque année. 2 % est l'objectif européen.",
  withdrawalRate: "Taux de retrait",
  withdrawalHint:
    "La part de votre patrimoine que vous retireriez chaque année pour en vivre. Le repère le plus répandu est 4\u00A0%.",
  accountsTitle: "Vos comptes",
  accountsFromData:
    "Pré-rempli avec vos placements et vos versements récurrents.",
  accountsReset: "Revenir à mes chiffres",
  accountAdd: "Ajouter un compte",
  accountRemove: "Retirer {name}",
  fieldInitial: "Dessus aujourd'hui",
  fieldMonthly: "Chaque mois",
  fieldReturn: "Rendement par an",
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
  taxSource: "Taux 2026, simplifiés à un taux par compte.",

  runTitle: "Votre série",
  runCount: {
    one: "{count} mois d'affilée",
    other: "{count} mois d'affilée",
  },
  runRecord: { one: "Record : {count} mois", other: "Record : {count} mois" },
  runKeep: "Faites le bilan de {month} pour la garder en vie",
  runStart: "Faites le bilan d'un mois dans votre marge pour lancer une série.",
  monthsTitle: "Vos mois",
  monthsBest: "Meilleur mois : {month}, {amount} économisés",
  monthsEmpty: "Faites votre premier bilan pour voir vos mois ici.",
};
