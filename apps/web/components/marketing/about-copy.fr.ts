import type { AboutCopy } from "./about-copy";

/**
 * La page « À propos », en français — la langue où tout le monde arrive.
 *
 * Écrite à la première personne, par le propriétaire, avec les règles du
 * fichier anglais : seulement ce qui est vrai et vérifiable (les dates sont
 * celles du dépôt), et « gratuit » dit exactement, le prix des deux options
 * à côté du mot. Espaces insécables avant « : », « ? », « ! » et « € »,
 * comme sur le reste du site.
 */
export const aboutCopyFr: AboutCopy = {
  meta: {
    title: "À propos",
    description:
      "Charles Collignon, engineering manager à Paris, a construit Pluclair pour suivre son propre argent. Gratuit, en bêta ouverte.",
  },

  hero: {
    status: "Bêta ouverte · Android et web",
    titleLines: ["Bonjour,", "je suis Charles."],
    intro:
      "Engineering manager — produit et design — dans une start-up de macroéconomie à Paris. Et, à côté, celui qui fait Pluclair.",
    portraitAlt: "Charles Collignon",
    place: "Paris, 2026",
  },

  why: "Je n’ai pas construit Pluclair pour gagner de l’argent. Je l’ai construit pour savoir où va le mien.",

  letter: {
    heading: "Pourquoi Pluclair",
    paragraphs: [
      "Je voulais voir au même endroit ce qui rentre, ce qui sort, ce que je mets de côté et ce que je place — et vérifier chaque mois que les chiffres collent avec ma banque. Alors je l’ai construit.",
      "Je m’en sers tous les jours, pour mes propres comptes. C’est la meilleure façon que je connaisse de savoir si quelque chose marche.",
      "Pluclair n’a rien à vous vendre : pas de pub, pas de produit glissé sous vos yeux, et vos données ne sont revendues à personne. S’il vous aide à y voir plus clair, il a fait son travail.",
    ],
    signature: "Charles",
  },

  hats: {
    heading: "Trois métiers dans une seule app",
    intro:
      "Le jour, je fais travailler ensemble des ingénieurs, du produit et du design. Sur Pluclair, je tiens les trois.",
    items: [
      {
        title: "Ingénierie",
        body: "Un site, une app mobile et une seule base de code partagée entre les deux, pour que les chiffres soient les mêmes partout.",
      },
      {
        title: "Produit",
        body: "Surtout, décider ce qui n’y entre pas : pas de score, pas de pub, rien à acheter. Ce qui reste doit mériter sa place chaque semaine.",
      },
      {
        title: "Design",
        body: "Un fond sombre et une seule couleur vive : celle du chiffre qui compte. Tout le reste se tait.",
      },
    ],
  },

  run: {
    heading: "Quatre mois, de la première ligne à la bêta",
    note: "Près de 900 modifications du code depuis juin, toutes lisibles sur GitHub.",
    items: [
      {
        date: "15 juin 2026",
        title: "La première ligne de code",
        body: "Un tableau de bord, des catégories, et les opérations qui reviennent chaque mois.",
      },
      {
        date: "23 juillet 2026",
        title: "L’app mobile",
        body: "Le même compte dans la poche, avec les mêmes chiffres.",
      },
      {
        date: "11 août 2026",
        title: "Il s’appelle Pluclair",
        body: "Votre argent, plus clair chaque mois.",
      },
      {
        date: "2 septembre 2026",
        title: "La banque, en lecture seule",
        body: "Un mois se clôt contre le solde de la banque, et ce qui a filé apparaît.",
      },
      {
        date: "2 octobre 2026",
        title: "L’immobilier",
        body: "Une maison, ses prêts, et la part qui est déjà à vous.",
      },
      {
        date: "9 octobre 2026",
        title: "À deux",
        body: "Un espace commun pour le compte joint, et chacun garde le sien.",
      },
      {
        date: "10 octobre 2026",
        title: "Questions, une vraie conversation",
        body: "Demandez « où part mon argent ? » et creusez à la suite.",
      },
      {
        date: "Aujourd’hui",
        title: "Bêta ouverte",
        body: "Ouverte à tous, gratuite, et toujours en chantier.",
      },
    ],
  },

  bill: {
    heading: "L’addition",
    intro:
      "Pluclair est gratuit. Deux options se paient à part, directement à leur service — jamais à moi.",
    optional: "Facultatif",
    rows: [
      {
        label: "Pluclair",
        detail: "Le site, l’app, toutes les fonctions",
        amount: "0 €",
        optional: false,
      },
      {
        label: "Connexion bancaire",
        detail: "Votre compte open-banking.io · 1 € par compte en plus",
        amount: "environ 3 € / mois",
        optional: true,
      },
      {
        label: "L’IA de votre choix",
        detail: "Votre compte OpenRouter · Mistral, ChatGPT ou Claude",
        amount: "quelques centimes la question",
        optional: true,
      },
    ],
    totalLabel: "Ce que Pluclair encaisse",
    footnote:
      "Aucune commission sur ces deux services : Pluclair ne voit ni ne manipule jamais ces paiements.",
  },

  beta: {
    heading: "Essayez la bêta",
    body: "Une bêta ouverte : tout marche et je m’en sers chaque jour, mais des choses bougent encore. Si quelque chose cloche, écrivez-moi — c’est moi qui lis.",
    download: "Télécharger pour Android",
    downloadMeta: "Fichier APK · gratuit · sans store",
    web: "Commencer sur le web",
    openApp: "Ouvrir Pluclair",
    notYet:
      "L’app Android arrive ici très bientôt. En attendant, Pluclair s’utilise dans le navigateur de votre téléphone.",
    stepsHeading: "Installer sur Android",
    steps: [
      "Ouvrez cette page sur votre téléphone et téléchargez le fichier.",
      "Android vous demande d’autoriser votre navigateur à installer des applications : acceptez, une fois.",
      "Si un avertissement parle d’une application inconnue, choisissez « Installer quand même ». Les mises à jour s’installent par-dessus, et vos données restent.",
    ],
    iphone:
      "Sur iPhone, pas encore d’app : Pluclair s’utilise dans Safari, avec le même compte.",
  },

  elsewhere: {
    heading: "Me trouver",
    source: { title: "Le code", detail: "Lisible par tous, sur GitHub" },
    write: { title: "M’écrire" },
  },
};
