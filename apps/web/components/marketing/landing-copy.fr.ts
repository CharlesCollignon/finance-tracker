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
 *   tous — la banque, l'application mobile — est dit une fois, sous
 *   « Bientôt », au futur.
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

  figure: {
    heading: "Un chiffre, chaque matin",
    body: "Ce que vos comptes contiennent, moins les charges qui tombent avant votre prochain revenu, moins une marge pour ce que vous ne notez jamais. Recalculé à chaque dépense notée.",
    title: "Il vous reste",
    until: "jusqu’au {date}",
    perDay: "soit {amount} par jour",
    balance: "Sur vos comptes",
    charges: "Charges d’ici le {date}",
    marge: "Marge pour le non-noté",
    note: "De l’arithmétique sur ce que vous avez prévu. Jamais un conseil.",
  },

  story: {
    heading: "Comment ça marche",
    body: "Sur votre téléphone, Pluclair s’ouvre dans le navigateur et se range sur l’écran d’accueil comme une application.",
    chapters: [
      {
        id: "bearing",
        title: "Où vous en êtes, d’un coup d’œil",
        body: "Le point s’ouvre sur ce qu’il vous reste jusqu’à votre prochain revenu, et sur la fin du mois une fois passé tout ce qui est prévu.",
      },
      {
        id: "ledger",
        title: "Une dépense, en quelques touches",
        body: "Le montant et le commerce : Pluclair retrouve la catégorie de la dernière fois. Ou importez le fichier CSV ou OFX de votre banque.",
      },
      {
        id: "charges",
        title: "Ce qui revient, écrit pour vous",
        body: "Loyer, salaire, abonnements : notés une fois, ils remplissent chaque mois — et un abonnement qui augmente vous est signalé.",
      },
      {
        id: "month-close",
        title: "Le mois, vérifié face à votre banque",
        body: "Une fois par mois, recopiez le solde affiché par votre banque. Ce qui est parti sans laisser de trace — du liquide, une carte oubliée — apparaît, en euros.",
      },
      {
        id: "questions",
        title: "Demandez, avec vos mots",
        body: "« Combien en courses ce mois-ci ? » La réponse vient avec les chiffres de Pluclair, écrite par l’IA de votre choix — jamais un conseil.",
      },
    ],
  },

  gallery: {
    heading: "Sur grand écran",
    body: "Le même compte sur votre ordinateur, avec de la place pour voir loin.",
    items: [
      { id: "wallets", caption: "Ce que contiennent vraiment vos fonds" },
      { id: "plan", caption: "Votre matelas, et les caps à venir" },
      { id: "property", caption: "Votre logement, et la part qui est à vous" },
      { id: "month-read", caption: "Votre mois, mis en mots" },
    ],
  },

  more: {
    heading: "Et tout ce qu’il y a autour",
    items: [
      {
        id: "together",
        title: "À deux",
        body: "Un espace commun pour le compte joint. Chacun voit ce que vous partagez — jamais l’argent de l’autre.",
        link: "Voir l’espace commun",
      },
      {
        id: "questions",
        title: "Questions",
        body: "Interrogez votre argent avec des mots. L’IA de votre choix répond avec les chiffres de Pluclair, sur votre propre compte.",
        link: "Voir Questions",
      },
      {
        id: "tax",
        title: "Votre déclaration, préparée",
        body: "Dons, emploi à domicile, garde d’enfant, PER, loyers : les montants de vos cases, tirés de vos propres opérations.",
        link: "Voir la page impôts",
      },
      {
        id: "year",
        title: "Votre année",
        body: "Chaque janvier, votre année en chiffres — à garder, ou à partager en image.",
        link: "",
      },
      {
        id: "search",
        title: "Tous vos mois d’un coup",
        body: "Retrouvez un commerce, un montant ou une catégorie dans tous vos mois. Les abonnements se repèrent tout seuls.",
        link: "",
      },
      {
        id: "alerts",
        title: "Le récap du lundi",
        body: "Votre semaine en une notification, et une alerte avant un découvert.",
        link: "",
      },
      {
        id: "privacy",
        title: "Flouté d’un geste",
        body: "Tous les montants masqués d’un coup — dans le train, au bureau.",
        link: "",
      },
    ],
  },

  soon: {
    heading: "Bientôt dans Pluclair",
    items: [
      {
        id: "bank",
        title: "Votre banque, connectée",
        body: "En lecture seule : vos opérations arriveront toutes seules, et Pluclair ne pourra jamais faire de paiement.",
      },
      {
        id: "app",
        title: "L’application mobile",
        body: "Pluclair dans votre poche, avec les mêmes chiffres que sur l’ordinateur.",
      },
    ],
  },

  phone: {
    heading: "Sur votre téléphone",
    body: "Le même compte et les mêmes chiffres, où que vous soyez. Sur Android, « Il vous reste » s’affiche sur l’écran d’accueil, avec un + pour noter une dépense.",
    appStore: "App Store",
    googlePlay: "Google Play",
  },

  faq: {
    heading: "Vos questions",
    items: [
      {
        question: "Peut-on l’utiliser à deux ?",
        answer:
          "Oui. Invitez votre conjoint dans un espace commun pour le compte joint : vous voyez tous les deux ce que vous partagez, chacun garde un espace personnel que l’autre ne voit jamais, et vous choisissez comment se répartissent les dépenses communes.",
      },
      {
        question: "C’est payant ?",
        answer:
          "Pluclair est gratuit, sans carte bancaire. Les lectures et les questions, écrites par une IA, demandent votre propre compte OpenRouter : vous y choisissez le modèle — Mistral, ChatGPT ou Claude — et vous payez ce service directement, quelques centimes chacune. La connexion bancaire, quand elle arrivera, se paiera chez son service.",
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
        "Les autres écrans vous donnent des chiffres et des listes. Une lecture les rassemble et dit ce qui ressort — sans avoir le droit d’inventer un nombre. Utile les mois où les totaux ont l’air normaux et où quelque chose en dessous ne l’est pas. Les lectures sont écrites sur votre propre compte OpenRouter, avec le modèle de votre choix — Mistral, ChatGPT ou Claude — et à vos frais : quelques centimes chacune.",
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
    questions: {
      title: "Questions",
      body: "Interrogez votre argent avec vos propres mots.",
      utility:
        "Tapez une question comme elle vous vient. Pluclair choisit les chiffres utiles, l’IA de votre choix écrit quelques phrases, et chaque nombre y est celui de Pluclair. Sur votre propre compte IA, et jamais un conseil.",
      steps: [
        {
          title: "Posez-la à votre façon",
          body: "« Combien en courses ce mois-ci ? », « Quel est mon plus gros abonnement ? » — la question telle qu’elle vient. Un commerce reçoit ses opérations et leur total.",
        },
        {
          title: "Les chiffres de Pluclair, les mots de l’IA",
          body: "L’IA n’écrit jamais un nombre : elle nomme un chiffre et Pluclair y met le sien. Une phrase qui en inventerait un, ou qui dirait quoi faire, est retirée.",
        },
        {
          title: "Sur votre propre compte",
          body: "Connectez une fois un compte OpenRouter et choisissez Mistral, ChatGPT ou Claude : chaque question coûte quelques centimes, payés à OpenRouter. Les conversations sont gardées 30 jours.",
        },
      ],
    },
    together: {
      title: "Espace commun",
      body: "Un compte joint, partagé — et votre argent à vous, gardé pour vous.",
      utility:
        "Invitez votre conjoint dans un espace commun : le compte joint, ses charges, ses mois et un logement que vous possédez ensemble. Chacun garde un espace personnel que l’autre ne voit jamais.",
      steps: [
        {
          title: "Invitez par un lien",
          body: "Envoyez un lien ; votre conjoint rejoint l’espace, et les opérations du compte joint y arrivent plutôt que dans vos mois à chacun.",
        },
        {
          title: "Moi, ou Commun",
          body: "Passez de votre argent à l’espace commun d’une touche. Chaque opération dit qui l’a ajoutée, et chacun de vous peut clôturer le mois commun.",
        },
        {
          title: "Votre part",
          body: "Fixez la répartition des dépenses communes — moitié chacun, ou autrement — et voyez vos dépenses avec votre part du commun.",
        },
      ],
    },
    tax: {
      title: "Déclaration de revenus",
      body: "Les montants de vos cases d’impôt, tirés de vos propres opérations.",
      utility:
        "Chaque printemps, les cases que votre année remplit : dons (7UF, 7UD), emploi à domicile (7DB), garde d’enfant (7GA–7GC), versements PER (6NS), loyers (4BE, 5NI). Pluclair additionne ; vous vérifiez et déclarez sur impots.gouv.fr.",
      steps: [
        {
          title: "Rangez une catégorie dans sa case",
          body: "Dons, ménage, crèche : rangez la catégorie dans sa case une fois, et chacune de ses opérations y compte.",
        },
        {
          title: "Ouvrez une case pour voir ses lignes",
          body: "Chaque montant s’ouvre sur les opérations qu’il additionne, pour le vérifier ligne à ligne avant de le recopier.",
        },
        {
          title: "Vérifiez, puis déclarez",
          body: "Pluclair n’estime aucun impôt et ne déclare rien : vous recopiez vous-même les montants sur impots.gouv.fr.",
        },
      ],
    },
  },

  demos: {
    bearing: {
      heading: "Puis-je me permettre ?",
      hint: "Faites glisser un montant : le chiffre répond aussitôt. Rien n’est enregistré.",
    },
    ledger: {
      heading: "Ça se range tout seul",
      hint: "Touchez un commerce : Pluclair retrouve sa catégorie, comme la dernière fois.",
      shops: [
        { shop: "Carrefour", category: "Courses" },
        { shop: "SNCF", category: "Transports" },
        { shop: "Boulangerie", category: "Restaurants" },
        { shop: "Netflix", category: "Abonnements" },
      ],
      added: "Ajouté aujourd’hui",
    },
    charges: {
      heading: "Le mois se remplit tout seul",
      hint: "Faites défiler : chaque opération récurrente se pose sur son jour.",
      left: "Reste chaque mois",
    },
    "month-close": {
      heading: "Ce qui a filé",
      hint: "Faites glisser le solde affiché par votre banque : l’écart, c’est ce qui est parti sans laisser de trace.",
      expected: "Ce que disent vos opérations",
      bank: "Ce qu’affiche votre banque",
      gap: "Parti sans laisser de trace",
      none: "Rien n’a filé",
    },
    "month-read": {
      heading: "Chaque chiffre est celui de Pluclair",
      hint: "Pointez un chiffre : il vient de vos propres opérations, jamais de l’IA.",
      sentence:
        "Les courses en sont à {groceries} à douze jours de la fin, dans votre marge de {marge}, et le logement reste à {housing}.",
      sources: {
        groceries: "Courses, mars",
        marge: "Votre marge pour le non-noté",
        housing: "Loyer, chaque mois",
      },
      from: "D’où",
    },
    plan: {
      heading: "Votre matelas, en accéléré",
      hint: "Faites glisser ce que vous mettez de côté chaque mois : les caps bougent avec.",
      monthly: "Mis de côté chaque mois",
      inMonths: "dans {count} mois",
      reached: "Atteint",
    },
    wallets: {
      heading: "Ce que contient vraiment un fonds",
      hint: "Un ETF MSCI World, ouvert.",
      fund: "ETF MSCI World",
      countriesTab: "Pays",
      sectorsTab: "Secteurs",
      countries: [
        "États-Unis",
        "Japon",
        "Royaume-Uni",
        "Canada",
        "France",
        "Ailleurs",
      ],
      sectors: [
        "Technologie",
        "Finance",
        "Santé",
        "Industrie",
        "Consommation",
        "Tout le reste",
      ],
    },
    property: {
      heading: "La part qui est à vous",
      hint: "Faites défiler les années du prêt.",
      yours: "À vous",
      owed: "Reste dû",
      year: "En {year}",
    },
    questions: {
      heading: "Demandez à votre façon",
      hint: "Choisissez une question.",
      third: "Combien me reste-t-il ?",
      thirdAnswer:
        "Il vous reste {left} jusqu’au {date}, soit {perDay} par jour.",
    },
    together: {
      heading: "Votre part",
      hint: "Faites glisser la répartition : chaque part des dépenses communes suit.",
      spent: "Dépenses communes ce mois-ci",
    },
    tax: {
      heading: "Rangez une fois, c’est compté",
      hint: "Touchez une catégorie pour la ranger dans sa case.",
      chips: ["Restos du Cœur", "Croix-Rouge", "Ménage", "Loyers du studio"],
    },
  },

  nav: {
    howItWorks: "Comment ça marche",
    privacy: "Vos questions",
    previous: "Précédent",
    next: "Suivant",
    groupMonth: "Votre mois",
    groupWealth: "Votre patrimoine",
    groupMore: "Et aussi",
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
