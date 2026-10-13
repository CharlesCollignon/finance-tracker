import type { EntraideCopy } from "@/components/marketing/entraide-copy";

/** Entraide, en français : la langue de ceux qui y écrivent. */
export const entraideCopyFr: EntraideCopy = {
  meta: {
    title: "Entraide",
    description:
      "Des questions sur l'argent au quotidien en France, posées et répondues par les personnes qui utilisent Pluclair.",
  },
  hero: {
    title: "Entraide",
    intro:
      "Posez vos questions sur l'argent au quotidien, et répondez à celles des autres. Chaque réponse est l'avis de son auteur, jamais un conseil de Pluclair.",
    rules: "Les règles d'Entraide",
  },
  filters: {
    label: "Afficher",
    all: "Toutes",
    unanswered: "Sans réponse",
    solved: "Résolues",
    shares: "Partages",
  },
  sorts: { label: "Ordre", recent: "Récentes", useful: "Les plus utiles" },
  kinds: { question: "Question", share: "Partage" },
  composer: {
    pill: "Posez votre question…",
    kindLabel: "C'est",
    titleQuestion: "Votre question",
    titleShare: "Ce que vous voulez partager",
    titlePlaceholder: "Ex. : comment choisir mon jour de lecture ?",
    bodyLabel: "Les détails (facultatif)",
    bodyPlaceholder:
      "Votre situation, ce que vous avez déjà essayé — jamais une coordonnée bancaire.",
    formatHint: "**gras**, *italique*, listes et liens",
    handleLabel: "Votre pseudonyme",
    handleHint:
      "C'est tout ce que les autres verront de vous. Choisi une fois : prenez-en un qui ne vous identifie pas.",
    handleProblems: {
      short: "Au moins 3 caractères.",
      long: "Au plus 24 caractères.",
      characters:
        "Des lettres, des chiffres, et . _ - entre eux ; pas d'espace.",
      reserved: "Celui-ci est à Pluclair.",
    },
    preview: "Aperçu",
    masked: "Avant publication, Pluclair masquera : {kinds}.",
    maskKinds: {
      iban: "un IBAN",
      card: "un numéro de carte",
      account: "un long numéro",
      email: "une adresse e-mail",
      phone: "un numéro de téléphone",
    },
    already: "Déjà demandé ?",
    guide: "Guide",
    publish: "Publier",
    publishing: "Publication…",
    cancel: "Annuler",
    agree: "En publiant, vous acceptez les règles d'Entraide.",
    signIn: "Connectez-vous pour poser une question ou y répondre.",
    signInCta: "Se connecter",
  },
  list: {
    empty: "Pas encore de question. Posez la première.",
    emptyFiltered: "Rien ici pour l'instant.",
    more: "Voir plus",
    replies: { one: "1 réponse", many: "{count} réponses" },
    noReply: "Pas encore de réponse",
    solved: "Résolu",
    gone: "Message supprimé",
    pluclair: "Pluclair",
    edited: "modifié",
  },
  thread: {
    back: "Entraide",
    answers: { one: "1 réponse", many: "{count} réponses" },
    noAnswers: "Pas encore de réponse. La vôtre peut être la première.",
    views:
      "Chaque réponse est l'avis de son auteur, pas un conseil de Pluclair. Les réponses marquées « Pluclair » viennent de Pluclair lui-même.",
    replyLabel: "Votre réponse",
    replyPlaceholder: "Ce que vous savez, et d'où vous le savez.",
    reply: "Répondre",
    replying: "Envoi…",
    signIn: "Connectez-vous pour répondre.",
    markSolved: "Marquer « Résolu »",
    unmarkSolved: "Retirer « Résolu »",
    solvedAnswer: "La réponse qui a résolu la question",
    edit: "Modifier",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    confirmDelete:
      "Supprimer ce message ? Il sera remplacé par « Message supprimé ».",
    hidden:
      "Ce message est masqué par la modération : il n'est visible que par vous. La raison vous a été envoyée par e-mail.",
    aboutGuide: "À propos du guide",
  },
  when: {
    now: "à l'instant",
    minutes: "il y a {count} min",
    hours: "il y a {count} h",
    yesterday: "hier",
  },
  reactions: {
    label: "Réagir",
    useful: "Utile",
    thanks: "Merci",
    signIn: "Connectez-vous pour réagir.",
    signInCta: "Se connecter",
    failed: "Cela n'est pas passé. Réessayez dans un instant.",
  },
  errors: {
    "entraide.noHandle": "Choisissez d'abord un pseudonyme.",
    "entraide.handleTaken": "Ce pseudonyme est déjà pris. Essayez-en un autre.",
    "entraide.handleReserved": "Ce pseudonyme est à Pluclair.",
    "entraide.handleInvalid":
      "Des lettres, des chiffres, et . _ - entre eux ; de 3 à 24 caractères.",
    "entraide.banned":
      "Ce pseudonyme ne peut plus publier dans Entraide. La raison vous a été envoyée par e-mail.",
    "entraide.linksTooSoon":
      "Les liens sont possibles une fois votre compte vieux d'un jour. Retirez le lien, ou revenez demain.",
    generic: "Cela n'a pas pu être publié. Réessayez dans un instant.",
    tooManyAttempts: "C'est la limite du jour pour ce compte. Revenez demain.",
    notAllowed: "Cela ne se fait pas sur ce message.",
    offline: "Pas de connexion. Votre texte est toujours là : réessayez.",
  },
};
