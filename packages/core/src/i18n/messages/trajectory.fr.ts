import type { trajectoryEn } from "./trajectory.en";

/** The French half of `trajectory.en.ts`, mounted by `fr.ts` as `trajectory`. */
export const trajectoryFr: typeof trajectoryEn = {
  intro:
    "Là où vos comptes peuvent aller, rejoués sur ce que les marchés ont vraiment fait depuis 1970.",

  title: "Votre trajectoire",
  horizonLabel: "Horizon",
  medianCaption: "en euros d'aujourd'hui, au départ médian depuis 1970",
  rangeLine: "8 départs sur 10 depuis 1970 : entre {low} et {high}",
  worstLine: "Pire départ : {month}, {amount}",
  afterTax: "soit environ {amount} après impôts si vous vendiez tout",
  scrubPoint: "{when} : {median}, entre {low} et {high}",
  scrubYears: { one: "Dans {count} an", other: "Dans {count} ans" },
  scrubMonths: { one: "Dans {count} mois", other: "Dans {count} mois" },
  withProperty: "Avec vos biens",
  withPropertyHint:
    "Leur valeur nette estimée, en ligne simple : aucune histoire boursière ne parle pour un logement.",
  whatIfResult: "{amount} de plus en {year}",
  chartLabel:
    "Vos comptes, départ par départ depuis 1970 : la ligne médiane, et la bande où finissent 8 départs sur 10",
  follows: "Suit {series}",
  followsMix: "Suit {first}, et {rest}",
  lossLine:
    "Sur {years} ans, a fini sous l'inflation {count} fois sur 100 depuis {since}",
  lossNever: "Sur {years} ans, n'a jamais fini sous l'inflation depuis {since}",
  standIn:
    "{share} de ce compte suit une série voisine : les émergents et le Nasdaq n'ont pas d'histoire ouverte à eux.",
  unknown: "{share} que l'app ne reconnaît pas, suivi comme {series}.",
  cryptoFlat:
    "Le bitcoin n'a que onze ans d'histoire : la trajectoire le garde à sa valeur d'aujourd'hui, en euros constants.",
  currentLine:
    "Ce qui reste sur le compte courant ne rapporte rien : en euros d'aujourd'hui, il perd ce que les prix prennent.",
  elsewhereLine:
    "Mis de côté sans compte pour le recevoir, comme la marge chez un courtier : compté comme de l'argent qui dort.",
  incomeLine:
    "De quoi retirer environ {amount} par mois : un rythme ({rate} par an) qui a tenu {years} ans à chaque départ depuis 1970.",
  pastNotPromise:
    "Le passé ne dit pas l'avenir : ce sont les marchés tels qu'ils ont été, pas une promesse.",

  series: {
    world: "les actions des pays développés",
    us: "les actions américaines",
    europe: "les actions européennes",
    "bonds-fr": "les emprunts d'État français à 10 ans",
    "fonds-euros": "le fonds euros moyen",
    bitcoin: "le bitcoin",
    "livret-a": "le Livret A",
    lep: "le LEP",
    cash: "rien : de l'argent qui dort",
  },

  progressionTitle: "Progression",
  nextMilestone: "Prochain palier : {amount}",
  milestoneWhen: "{month}, au départ médian",
  milestonesReached: "Atteints",
  cushionLabel: "Matelas de sécurité",
  runLink: "Faire le bilan sur Le point",

  accountsTitle: "Vos comptes",
  accountsLead:
    "La courbe rejoue ces comptes sur chaque départ depuis 1970 : ce qu'ils ont aujourd'hui, ce que vous y mettez chaque mois et ce que leur histoire a rapporté. Changez un chiffre, la courbe suit ; ce que vous mettez en plus sur un compte est pris sur votre compte courant.",
  accountColumn: "Compte",
  totalLine: "Au départ de la courbe",
  monthlyFromLedger: "d'après vos récurrents",
  sourcesFold: "Sources et méthode",
  returnFromHistory: "Historique {from}–{to} : {rate}",
  returnContract: "Le taux de votre contrat",
  returnNone: "Pas d'histoire assez longue pour un rendement.",
  realTermsNote:
    "Tout est en euros d'aujourd'hui, avec l'inflation française mesurée par l'INSEE.",
  reconstructedNote:
    "Avant 1986, les actions sont reconstituées à partir des cours de l'OCDE ; avant 2000, le fonds euros suit l'emprunt d'État français à 10 ans.",
};
