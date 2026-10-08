import type { LandingCopySections, LandingPageCopy } from "./landing-copy";
import type { LandingPageId } from "./landing-copy";

/**
 * Every word on the marketing site, in French — the language everyone
 * starts in.
 *
 * A file of its own rather than entries in the message catalogue, for the
 * reason the English file gives about itself: the voice only holds if it can
 * be read in one sitting. Its three rules apply here unchanged, and are worth
 * restating because a translation is where they are easiest to lose:
 *
 *   Écrire pour quelqu'un qui n'est pas du métier. Des phrases courtes, des
 *   mots de tous les jours, un exemple concret par idée — « les courses, le
 *   resto » — et les noms des écrans tels que l'application les affiche.
 *
 *   Say the mechanism, not the benefit. « Recopiez le solde affiché par
 *   votre banque » se vérifie ; « une clarté sans effort », non.
 *
 *   Never promise what the app does not do. Ce qui n'est pas encore ouvert à
 *   tous — la banque, l'IA de votre choix, l'application mobile — est dit
 *   une fois, sous « Bientôt », au futur.
 *
 * The nouns come from the app, not from the dictionary: « Le point »,
 * « Journal », « Récurrents », « Placements », « Clôture du mois ». A landing
 * page that names a feature differently from the app is one that mis-sold it.
 */
export const landingCopyFr: LandingCopySections & {
  pages: Record<LandingPageId, LandingPageCopy>;
} = {
  hero: {
    titleLines: ["Votre argent,", "plus clair chaque mois"],
    tagline:
      "Vos revenus, vos dépenses, votre épargne et vos placements au même endroit. Ce qui revient chaque mois s’ajoute tout seul, et une fois par mois, Pluclair compare avec votre banque pour retrouver ce qui a filé.",
  },

  promise: {
    text: "Trois choses que Pluclair ne fera jamais : toucher à votre argent, décider à votre place, vous vendre quoi que ce soit.",
  },

  how: {
    heading: "Comment ça marche",
    rows: {
      bearing: {
        question: "Où j’en suis ce mois-ci ?",
        body: "Le point affiche ce qu’il y a sur votre compte aujourd’hui, et ce qu’il restera à la fin du mois une fois passé tout ce qui est prévu. Touchez une carte pour voir ce qu’il y a derrière un chiffre.",
        link: "Voir Le point",
      },
      charges: {
        question: "Ce qui revient, noté une seule fois",
        body: "Loyer, salaire, abonnements, épargne du mois : vous notez chacun une seule fois, et il s’ajoute tout seul chaque mois. Il ne vous reste qu’à noter le reste — les courses, le resto, le cadeau d’anniversaire. Ou importez le relevé CSV de votre banque : Pluclair propose une catégorie pour chaque ligne, et vous validez.",
        link: "Voir les Récurrents",
      },
      "month-close": {
        question: "Où est passé le reste ?",
        body: "Une fois par mois, recopiez le solde affiché par votre banque. Pluclair le compare à ce que vous avez noté, et l’écart, c’est l’argent parti sans laisser de trace : un retrait au distributeur, un paiement oublié. Vous le voyez enfin, en euros.",
        link: "Voir la clôture du mois",
      },
      plan: {
        question: "Combien de temps je tiens si ça coince ?",
        body: "Le Plan compte votre matelas de sécurité en mois de dépenses fixes, montre les paliers que votre épargne va franchir et quand, et ce que chaque compte pourrait valoir dans dix ou vingt ans, après impôts.",
        link: "Voir le Plan",
      },
      wallets: {
        question: "Que valent vraiment mes placements ?",
        body: "PEA, assurance vie, compte-titres, PER, crypto : ce que vous avez versé, ce que ça vaut aujourd’hui, et de quoi vos fonds sont faits — actions, obligations, or, crypto, pays, frais. Les cours se mettent à jour tout seuls, et aucun ordre ne part jamais de l’application.",
        link: "Voir les Placements",
      },
      property: {
        question: "Et votre logement ?",
        body: "Le bien que vous possédez ou louez : sa valeur estimée d’après les ventes enregistrées autour, ce qu’il reste sur le crédit, et la part qui est vraiment à vous. La mensualité du crédit rejoint vos Récurrents toute seule.",
        link: "Voir l’immobilier",
      },
      "month-read": {
        question: "Et si on vous expliquait votre mois ?",
        body: "Demandez une lecture : une IA écrit quelques phrases sur votre mois — ce qui a changé, ce qui mérite un œil. Ou posez votre propre question dans Questions. Les chiffres, eux, viennent toujours de Pluclair : l’IA n’a pas le droit d’en inventer un seul, ni de vous dire quoi faire.",
        link: "Voir les lectures écrites",
      },
    },
  },

  soon: {
    heading: "Bientôt dans Pluclair",
    items: [
      {
        title: "Votre banque, connectée",
        body: "En lecture seule : vos opérations arriveront toutes seules, et Pluclair ne pourra jamais faire de paiement.",
      },
      {
        title: "L’IA de votre choix",
        body: "Mistral, ChatGPT ou Claude, sur votre propre compte OpenRouter : vous choisissez le modèle et vous payez vos lectures, quelques centimes chacune.",
      },
      {
        title: "L’application mobile",
        body: "Pluclair dans votre poche, avec les mêmes chiffres que sur l’ordinateur.",
      },
    ],
  },

  faq: {
    heading: "Vos questions",
    items: [
      {
        question: "C’est payant ?",
        answer:
          "Non. Créer un compte et tout ce qui est décrit plus haut est gratuit, sans carte bancaire. Seules les nouveautés qui passent par un service extérieur — la connexion bancaire, l’IA de votre choix — se paieront chez ce service.",
      },
      {
        question: "Pluclair peut-il toucher à mon argent ?",
        answer:
          "Non, jamais. Il ne fait ni virement ni paiement, et la connexion bancaire qui arrive ne pourra que lire.",
      },
      {
        question: "Où vont mes données ?",
        answer:
          "Elles restent sur des serveurs en Europe, derrière votre connexion. Personne d’autre ne peut les lire — sauf, dans un espace commun, la personne que vous y invitez —, rien n’est revendu, et vous pouvez tout effacer quand vous voulez.",
      },
      {
        question: "Faut-il connecter sa banque ?",
        answer:
          "Non. Vous notez vos opérations vous-même, ou vous importez un relevé CSV de votre banque. Une connexion en lecture seule arrive bientôt, pour ceux qui la veulent.",
      },
      {
        question: "Que voit l’IA ?",
        answer:
          "Seulement les chiffres de la page que vous lui demandez de lire, ou ceux qu’une question demande : des totaux, des noms de catégories, les lignes de vos placements — et une question telle que vous l’avez tapée. Jamais votre nom, votre e-mail ni vos identifiants bancaires — et rien n’est écrit tant que vous ne le demandez pas.",
      },
      {
        question: "Je peux masquer mes chiffres en public ?",
        answer:
          "Oui : un geste floute tous les montants à l’écran. Pratique dans le train.",
      },
    ],
  },

  finalCta: {
    heading: "Commencez par ce mois-ci",
    body: "Un salaire, un loyer, et ce dont vous vous souvenez. Quelques minutes, sans carte bancaire.",
  },

  pages: {
    bearing: {
      title: "Le point",
      body: "Où vous en êtes aujourd’hui, et comment le mois va finir.",
      utility:
        "Deux chiffres en haut : ce qu’il y a sur votre compte maintenant, et ce qu’il restera à la fin du mois. En dessous, quelques cartes qui s’ouvrent pour montrer le détail — chaque chiffre vient d’un autre écran, vous pouvez toujours le vérifier.",
      steps: [
        {
          title: "Lisez les deux chiffres",
          body: "Le solde d’aujourd’hui, et la fin du mois une fois passé tout ce qui est prévu. Le second est un simple calcul sur ce que vous avez prévu, pas une supposition sur ce que vous pourriez dépenser.",
        },
        {
          title: "Ouvrez une carte pour le détail",
          body: "Ce mois-ci, vos comptes, votre épargne, vos placements. Chaque carte s’ouvre sur place et montre ce qui compose son chiffre.",
        },
        {
          title: "Remontez jusqu’à la source",
          body: "Chaque carte se termine par un lien vers l’écran qui porte ses chiffres : rien n’est compté deux fois.",
        },
      ],
    },
    ledger: {
      title: "Journal",
      body: "Toutes vos opérations — en liste, sur un calendrier, ou par catégorie.",
      utility:
        "Tout ce qui entre et tout ce qui sort, au même endroit : ce que vous avez saisi, ce que vos opérations récurrentes ont ajouté, et ce que vous avez importé de votre banque.",
      steps: [
        {
          title: "En liste, en calendrier ou par catégorie",
          body: "Les mêmes lignes, de trois façons. La liste pour en retrouver une et la corriger ; le calendrier pour voir quels jours le mois se tend ; par catégorie pour voir ce que chacune coûte d’habitude.",
        },
        {
          title: "Il propose, vous décidez",
          body: "Rangez deux fois un commerçant dans la même catégorie, et Pluclair vous la propose la fois suivante. Vous validez, les propositions s’affinent — le classement reste le vôtre.",
        },
        {
          title: "Ou apportez un CSV",
          body: "Exportez un relevé depuis votre banque et réglez ses colonnes une fois. Rien n’est écrit avant que vous ayez relu la liste.",
        },
      ],
    },
    charges: {
      title: "Récurrents",
      body: "Salaire, loyer, abonnements, épargne du mois — ajoutés à chaque mois pour vous.",
      utility:
        "Notez une fois ce qui revient chaque mois, chaque semaine ou chaque année. Chaque échéance s’ajoute le jour venu, et seulement si elle manque : une ligne que vous avez corrigée à la main n’est jamais réécrite.",
      steps: [
        {
          title: "Notez ce qui revient",
          body: "Un montant et un rythme. Pour un achat mensuel d’actions, le montant suit le cours du jour.",
        },
        {
          title: "Ajouté le jour venu",
          body: "Chaque échéance arrive comme une ligne ordinaire, que vous pouvez encore modifier. Sautez-en une, et seul ce mois-là s’en passe ; les suivantes continuent.",
        },
        {
          title: "Modifiez une fois pour tous les mois à venir",
          body: "Changez une opération récurrente et tous les mois à venir suivent. Les lignes de ce mois-ci ne changent que si vous le dites.",
        },
      ],
    },
    plan: {
      title: "Plan",
      body: "Votre matelas de sécurité, vos paliers, et la vue longue.",
      utility:
        "Ce que vos propres chiffres donnent si les choses continuent ainsi : l’année à venir, les paliers que votre épargne franchira et quand, un matelas de sécurité compté en mois de dépenses fixes, et ce que chaque compte pourrait valoir plus tard, après impôts. Rien ici ne déplace d’argent.",
      steps: [
        {
          title: "Voyez l’année à venir",
          body: "Vos comptes mois par mois sur les douze prochains, d’après ce que vous avez déjà prévu. Faites glisser pour mettre un peu plus de côté, et l’année finit plus haut.",
        },
        {
          title: "Votre matelas de sécurité",
          body: "Combien de mois de dépenses fixes votre épargne couvrirait si vos revenus s’arrêtaient.",
        },
        {
          title: "La vue longue",
          body: "Ce qu’un Livret A, un PEA, une assurance vie, un compte-titres, un PER ou de la crypto pourrait valoir dans dix ou vingt ans, après l’impôt que chacun paie en France. Une estimation, présentée comme telle.",
        },
      ],
    },
    wallets: {
      title: "Placements",
      body: "PEA, assurance vie, compte-titres, PER, crypto — ce que vous détenez, et de quoi c’est fait.",
      utility:
        "Vos placements, notés par vous. Les cours mettent leur valeur à jour tout seuls ; il n’y a aucun lien avec un courtier, et aucun ordre ne part jamais de l’application.",
      steps: [
        {
          title: "Notez ce que vous détenez",
          body: "Un compte par enveloppe, et chaque placement dedans avec ce que vous y avez versé. Les cours arrivent en euros, quelle que soit leur devise.",
        },
        {
          title: "Voyez ce qu’il y a dedans",
          body: "Deux fonds peuvent détenir les mêmes entreprises sans le dire. La Composition montre où est vraiment votre argent — actions, obligations, or, crypto — et, pour les fonds, les pays, les secteurs et les frais.",
        },
        {
          title: "Demandez une revue",
          body: "Une IA lit la Composition et dit ce qu’elle remarque. Elle ne cite que des fonds d’une liste fermée, et n’écrit aucun chiffre d’elle-même.",
        },
      ],
    },
    property: {
      title: "Immobilier",
      body: "Votre logement ou un bien que vous louez — ce qu’il vaut aujourd’hui, ce qu’il reste à rembourser, et la part qui est vraiment à vous.",
      utility:
        "Un bien, c’est souvent votre plus gros chiffre, et celui que vous voyez le moins. Pluclair estime sa valeur à partir des ventes enregistrées autour et suit le crédit mois après mois : la part qui est à vous devient un chiffre, plus une impression. À deux, chacun voit sa part de l’acte.",
      steps: [
        {
          title: "Ajoutez-le une fois",
          body: "L’adresse, le prix payé et sa date, le crédit. Sa mensualité rejoint vos Récurrents : le mois la compte déjà.",
        },
        {
          title: "Voyez ce qu’il vaut",
          body: "Une estimation à partir des ventes enregistrées autour, ajustée de l’évolution des prix depuis, avec la fourchette où elle se situe. Vous pouvez mettre votre propre chiffre.",
        },
        {
          title: "Regardez votre part grandir",
          body: "Ce qu’il reste dû baisse à chaque mensualité ; la barre montre quelle part du bien est à vous, et votre patrimoine net, dans le Plan, la compte.",
        },
      ],
    },
    "month-close": {
      title: "Clôture du mois",
      body: "Un solde par mois, et Pluclair vous montre ce qu’il n’a jamais vu.",
      utility:
        "Le seul moment où Pluclair vous demande ce qu’il ne peut pas deviner : votre vrai solde. Comparé à ce que vous avez noté, il fait apparaître les dépenses que personne n’a écrites.",
      steps: [
        {
          title: "Choisissez un jour",
          body: "Le même jour chaque mois — pas forcément le dernier : avec une carte à débit différé, les paiements par carte du mois ne sont pas encore passés.",
        },
        {
          title: "Recopiez un solde",
          body: "Ce que contenait ce jour-là votre compte courant, lu dans l’application de votre banque. La première clôture sert de point de départ ; tout le reste se mesure à partir d’elle.",
        },
        {
          title: "Voyez ce qu’elle a trouvé",
          body: "L’argent dépensé sans être noté, ce que vous avez vraiment mis de côté, et si le mois est resté dans votre marge habituelle.",
        },
      ],
    },
    "month-read": {
      title: "Lectures écrites",
      body: "Quelques phrases sur votre mois ou vos placements. Les mots sont ceux de l’IA ; chaque chiffre est celui de Pluclair.",
      utility:
        "Les autres écrans vous donnent des chiffres et des listes. Une lecture les rassemble et dit ce qui ressort — sans avoir le droit d’inventer un nombre. Utile les mois où les totaux ont l’air normaux et où quelque chose en dessous ne l’est pas.",
      steps: [
        {
          title: "Demandez-en une",
          body: "Une lecture s’écrit quand vous appuyez, jamais toute seule : sur votre mois, sur une catégorie, ou sur vos placements.",
        },
        {
          title: "Lisez ce qu’elle a remarqué",
          body: "Les observations d’abord, les suggestions à part, sous leur propre titre. Chaque chiffre du texte est celui de Pluclair, glissé après que l’IA a dit lequel elle voulait.",
        },
        {
          title: "Redemandez quand elle vieillit",
          body: "Les chiffres ne périment jamais, les jugements si. Quand ce qu’il y a dessous a assez bougé, la lecture le dit, et vous pouvez en demander une nouvelle.",
        },
      ],
    },
  },

  nav: {
    howItWorks: "Comment ça marche",
    privacy: "Vos questions",
    previous: "Précédent",
    next: "Suivant",
  },

  footer: {
    tagline:
      "Vos revenus, vos dépenses, votre épargne et vos placements au même endroit — vérifiés chaque mois avec votre banque.",
    copyright: "© 2026 Pluclair",
    imageCredit:
      "Image de la Terre : NASA, Blue Marble Next Generation (Reto Stöckli).",
    disclaimer:
      "Aucun conseil. Aucune pub. Pluclair ne touche jamais à votre argent.",
  },

  cta: {
    getStarted: "Commencer",
    signIn: "Se connecter",
    openApp: "Ouvrir l’application",
    goToDashboard: "Voir où vous en êtes",
  },
};
