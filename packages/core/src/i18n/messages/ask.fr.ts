import type { askEn } from "./ask.en";

/** The French half of `ask.en.ts`, mounted by `fr.ts` as `ask`. */
export const askFr: typeof askEn = {
  title: "Questions",
  intro:
    "Posez une question sur votre argent. Les réponses s'appuient sur les chiffres de Pluclair, et Pluclair ne conseille jamais.",
  placeholder: "Posez votre question…",
  send: "Demander",
  thinking: "Pluclair regarde vos chiffres…",
  new: "Nouvelle question",
  delete: "Supprimer cette conversation",
  deleted: "Conversation supprimée",
  kept: "Gardées {days} jours, puis supprimées.",
  left: {
    one: "Une question restante ce mois-ci",
    other: "{count} questions restantes ce mois-ci",
  },
  none: "Plus de questions ce mois-ci : elles reviennent le 1er.",
  onAccount: "Sur votre compte IA : sans limite.",
  noAdvice:
    "Pluclair donne les chiffres, pas de conseil : ce que vous en faites vous appartient.",
  outside:
    "Pluclair ne sait pas répondre à ça : il ne connaît que les chiffres de votre argent.",
  empty: "Pluclair ne contient pas de quoi répondre à ça.",
  searchHeading: {
    one: "Une opération « {query} »",
    other: "{count} opérations « {query} »",
  },
  searchSpent: "{amount} au total, sorties moins entrées",
  searchMore:
    "Les plus récentes sont montrées : cherchez le reste dans le Journal.",
  searchNone: "Aucune opération « {query} ».",
  noAnswer: "Pas de réponse pour l'instant. Réessayez dans un moment.",
  unusable:
    "La réponse n'a pas pu être montrée : rien n'y tenait. Essayez de la poser autrement.",
  noWriter: "Les questions ne sont pas disponibles ici.",
  tooLong: "Plus court, s'il vous plaît : {max} caractères au plus.",
  suggest1: "Combien ai-je dépensé en courses ce mois-ci ?",
  suggest2: "Quelle est ma plus grosse dépense récurrente ?",
  suggest3: "Combien de mois mon épargne couvre-t-elle ?",
  suggest4: "Dois-je rembourser mon prêt par anticipation ?",
  openFromRead: "Poser une question",
  history: "Vos conversations",
  historyEmpty: "Aucune conversation pour l'instant.",
  facts: {
    spentTotal: "Dépenses, {month}",
    spentCategory: "{name}, {month}",
    income: "Revenus, {month}",
    balanceToday: "Sur le compte aujourd'hui",
    charge: "{name} (par mois)",
    chargesOut: "Dépenses récurrentes, par mois",
    chargesIn: "Revenus récurrents, par mois",
    savings: "Mis de côté",
    cushionMonths: "Mois de dépenses fixes couverts",
    walletValue: "{name}, valeur",
    walletInvested: "{name}, versé",
    walletsTotal: "Placements, valeur totale",
    loanOwed: "{name}, restant dû",
    loanRate: "{name}, taux",
    loanMonthly: "{name}, mensualité",
    loanInterestLeft: "{name}, intérêts restant à payer",
    loanMonthsLeft: "{name}, mensualités restantes",
  },
};
