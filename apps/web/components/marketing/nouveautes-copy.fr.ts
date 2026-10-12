import type { NouveautesCopy } from "./nouveautes-copy";

/**
 * « Nouveautés », en français — la langue où tout le monde arrive. Les
 * règles du fichier anglais, et des espaces insécables avant « : », « ? »
 * et « ! », comme sur le reste du site.
 */
export const nouveautesCopyFr: NouveautesCopy = {
  meta: {
    title: "Nouveautés",
    description:
      "Ce qui change dans Pluclair, semaine après semaine, sur le web et sur le téléphone.",
  },
  hero: {
    titleLines: ["Nouveautés"],
    intro:
      "Ce qui change dans Pluclair, semaine après semaine — sur le web et sur le téléphone. Tout ce qui est ici est déjà en ligne.",
    updatedToday: "Mis à jour aujourd’hui",
    updatedYesterday: "Mis à jour hier",
    updatedDaysAgo: "Mis à jour il y a {days} jours",
    entries: "nouveautés listées",
    commits: "modifications du code",
    since: "depuis le {date}",
  },
  pulse: {
    caption: "Une barre par semaine, depuis la première ligne de code",
    week: "Semaine du {date}",
    none: "Rien de nouveau",
  },
  filters: {
    label: "Afficher",
    all: "Tout",
    kinds: { new: "Nouveau", better: "Amélioré", fixed: "Corrigé" },
    platformsLabel: "Sur",
    platformsAll: "Partout",
    platforms: { web: "Web", phone: "Téléphone" },
  },
  fresh: {
    one: "1 nouveauté depuis votre dernière visite",
    many: "{count} nouveautés depuis votre dernière visite",
    badge: "Nouveau pour vous",
  },
  river: {
    label: "Les nouveautés, des plus récentes aux plus anciennes",
    monthCount: { one: "1 nouveauté", many: "{count} nouveautés" },
    fixes: { one: "1 correction", many: "{count} corrections" },
    empty: "Rien dans ce filtre pour l’instant.",
    reset: "Tout afficher",
  },
  entry: {
    more: "Plus",
    less: "Moins",
    featurePage: "Voir la page",
    copyLink: "Copier le lien de cette nouveauté",
    copied: "Lien copié",
  },
  soon: {
    heading: "Bientôt",
    intro: "En préparation, pas encore ouvert.",
  },
  follow: {
    heading: "Suivre",
    rss: "Flux RSS",
    rssDetail: "Chaque nouveauté, dans votre lecteur de flux",
    source: "Le code, sur GitHub",
    sourceDetail: "Chaque modification, lisible ligne à ligne",
  },
  landing: { label: "Nouveau" },
};
