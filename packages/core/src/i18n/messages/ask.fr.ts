import type { askEn } from "./ask.en";

/** The French half of `ask.en.ts`, mounted by `fr.ts` as `ask`. */
export const askFr: typeof askEn = {
  title: "Questions",
  intro:
    "Posez toutes vos questions sur votre argent : où il part, comment se compare un mois, ce que changerait un remboursement anticipé. La réponse est calculée à partir de vos propres chiffres.",
  placeholder: "Posez votre question…",
  send: "Demander",
  stop: "Arrêter",
  thinking: "Réflexion…",
  new: "Nouvelle question",
  delete: "Supprimer cette conversation",
  deleted: "Conversation supprimée",
  kept: "Gardées {days} jours, puis supprimées.",
  none: "Plus de questions ce mois-ci : elles reviennent le 1er.",
  onAccount: "Payées sur votre compte IA.",
  disclaimer:
    "L'IA peut se tromper et ne donne aucun conseil en investissement : vérifiez les chiffres qui comptent.",
  noAdvice:
    "Pluclair donne les chiffres, pas de conseil : ce que vous en faites vous appartient.",
  outside:
    "Pluclair ne sait pas répondre à ça : il ne connaît que les chiffres de votre argent.",
  empty: "Pluclair ne contient pas de quoi répondre à ça.",
  searchHeading: {
    one: "Une opération « {query} »",
    other: "{count} opérations « {query} »",
  },
  searchSpent: "{amount} au total, sorties moins entrées",
  searchMore:
    "Les plus récentes sont montrées : cherchez le reste dans le Journal.",
  searchNone: "Aucune opération « {query} ».",
  noAnswer: "Pas de réponse pour l'instant. Réessayez dans un moment.",
  unusable: "La réponse est revenue vide. Essayez de la poser autrement.",
  busy: "Trop de demandes au service d'IA pour l'instant : réessayez dans une minute.",
  accountRefused:
    "Votre compte IA a refusé la demande : vérifiez-le dans Profil.",
  noCredit: "Votre compte IA n'a plus de crédit : rechargez-le sur OpenRouter.",
  tooLong: "Plus court, s'il vous plaît : {max} caractères au plus.",
  stopped: "Arrêtée. La réponse n'a pas été gardée.",
  suggest1: "Où est passé mon argent ces 3 derniers mois ?",
  suggest2: "Comment se compare ce mois-ci au précédent ?",
  suggest3: "Quels abonnements pourrais-je supprimer ?",
  suggest4: "Et si je remboursais 10 000 € de mon prêt par anticipation ?",
  openFromRead: "Poser une question",
  history: "Vos conversations",
  historyEmpty: "Aucune conversation pour l'instant.",
  looked: {
    one: "1 élément consulté",
    other: "{count} éléments consultés",
  },
  untraced:
    "Chiffre de l'IA : Pluclair ne l'a pas trouvé dans vos données. Vérifiez-le.",
  untracedNote: {
    one: "1 chiffre, en pointillé, vient de l'IA : vérifiez-le.",
    other: "{count} chiffres, en pointillé, viennent de l'IA : vérifiez-les.",
  },
  copy: "Copier",
  copied: "Copié",
  step: {
    month: "Le mois",
    cashflow: "Entrées et sorties",
    categories: "Dépenses par catégorie",
    transactions: "Vos opérations",
    merchants: "Commerces et bénéficiaires",
    recurring: "Opérations récurrentes",
    savings: "Épargne",
    investments: "Placements",
    loans: "Prêts",
    loan_prepayment: "Remboursement anticipé",
    calculate: "Un calcul",
  },
};
