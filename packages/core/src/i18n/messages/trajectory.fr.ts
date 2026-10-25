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

  whyTitle: "D'où vient ce chiffre",
  accountLine: "{today} aujourd'hui → {then}",
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

  historyTitle: "Face à l'histoire",
  episodeLabel: "Quelle chute",
  fact2000:
    "La bulle internet : les actions des pays développés ont perdu la moitié de leur valeur en euros entre l'été 2000 et mars 2003 — et 2008 est arrivé avant la remontée.",
  fact2008:
    "La crise financière : près de la moitié de leur valeur perdue en euros entre mai 2007 et février 2009.",
  fact2020:
    "Le Covid : un cinquième perdu en trois mois, retrouvé avant la fin de l'année.",
  fact2022:
    "L'inflation et la hausse des taux : actions et obligations ont baissé ensemble, et le Livret A a rapporté moins que la hausse des prix.",
  replayedFrom:
    "Vos comptes d'aujourd'hui, rejoués depuis le sommet de {month}",
  lowLine: "Au pire {loss} ({share}), en {month}",
  recovered: {
    one: "Votre mise retrouvée en {count} mois en continuant vos versements",
    other: "Votre mise retrouvée en {count} mois en continuant vos versements",
  },
  recoveredAlone: {
    one: "({count} sans eux)",
    other: "({count} sans eux)",
  },
  notRecovered: "Pas encore retrouvée fin {month}",
  neverBelow:
    "Vos comptes n'auraient jamais fini sous ce que vous y aviez mis.",
  absent: "Sans {names}, dont l'histoire ne remonte pas jusque-là.",
  noShares:
    "Sans placement en Bourse, l'histoire touche vos livrets par les prix : sur un an, le Livret A a fini sous l'inflation {count} fois sur 100 depuis 1970.",
  noSharesLink: "Ajouter un placement",
  chartValue: "Ce qu'ils valaient",
  chartInvested: "Ce que vous y aviez mis",

  progressionTitle: "Progression",
  nextMilestone: "Prochain palier : {amount}",
  milestoneWhen: "{month}, au départ médian",
  milestonesReached: "Atteints",
  cushionLabel: "Matelas de sécurité",
  runLink: "Faire le bilan sur Le point",

  hypothesesTitle: "Hypothèses",
  hypothesesHide: "Masquer les hypothèses",
  hypothesesLead:
    "Préremplies avec vos comptes et l'histoire de ce qu'ils suivent. Un rendement modifié décale toute l'histoire du compte : ses chutes gardent leur forme.",
  returnFromHistory: "Historique {from}–{to} : {rate}",
  returnContract: "Le taux de votre contrat",
  returnNone: "Pas d'histoire assez longue pour un rendement.",
  realTermsNote:
    "Tout est en euros d'aujourd'hui, avec l'inflation française mesurée par l'INSEE.",
  reconstructedNote:
    "Avant 1986, les actions sont reconstituées à partir des cours de l'OCDE ; avant 2000, le fonds euros suit l'emprunt d'État français à 10 ans.",
  sourcesTitle: "Sources",
};
