import type { LandingCopySections, LandingPageCopy } from "./landing-copy";
import type { LandingPageId } from "./landing-copy";

/**
 * Every word on the marketing site, in French.
 *
 * A file of its own rather than entries in the message catalogue, for the
 * reason the English file gives about itself: the voice only holds if it can
 * be read in one sitting, and a paragraph reviewed next to a button label is
 * a paragraph nobody reviews. The two rules the English header states apply
 * here unchanged, and are worth restating because a translation is where they
 * are easiest to lose:
 *
 *   Say the mechanism, not the benefit. "Un solde, une fois par mois" is
 *   checkable; "une clarté sans effort" is not, and it is exactly the
 *   register a translation drifts into when the English is doing something
 *   more specific.
 *
 *   Never promise what the app does not do. Read-only access, a row filed
 *   only by a rule the user wrote, and no advice — all three are as true in
 *   French and just as easy to write around.
 *
 * The nouns come from the app, not from the dictionary: "Journal", "Gardé",
 * "Dépenses non enregistrées", "Clôture du mois". They are the words printed
 * on the screens this page is describing, and a landing page that names a
 * feature differently from the app is a landing page that mis-sold it.
 */
export const landingCopyFr: LandingCopySections & {
  pages: Record<LandingPageId, LandingPageCopy>;
} = {
  hero: {
    titleLines: ["Tout votre mois,", "sur un seul écran calme"],
    tagline:
      "Revenus, factures, épargne et investissements — saisis par vous ou lus depuis votre banque, gardés en privé, et rapprochés de votre vrai solde à la fin de chaque mois.",
    cards: {
      remaining: {
        label: "Reste en mars",
        caption: "sur 3 200 € gagnés",
      },
      unrecorded: {
        label: "Non enregistré · févr.",
        caption: "trouvé par un seul solde",
      },
    },
  },

  pillars: {
    heading: "Trois choses qu'il ne fera pas",
    items: [
      {
        title: "Déplacer votre argent",
        body: "La connexion bancaire lit, et rien d'autre. Elle voit ce qui est sorti du compte ; elle ne peut pas déclencher un paiement, et il n'existe aucune version d'elle qui le pourrait.",
      },
      {
        title: "Agir sur une règle que vous n'avez pas écrite",
        body: "Une ligne de relevé ne se classe toute seule que là où vous avez déjà mis ce commerçant deux fois. Tout le reste attend dans une liste, et un récurrent n'est qu'un modèle tant que vous ne l'appliquez pas.",
      },
      {
        title: "Vous dire quoi faire",
        body: "Pas de conseil, pas de score, aucune incitation à changer de produit. L'application mesure ; les décisions restent où elles doivent être.",
      },
    ],
  },

  devices: {
    heading: "Le même mois, quel que soit l'écran le plus proche",
    body: "Un compte, un journal, trois clients qui s'accordent. Ajoutez une ligne sur le téléphone en rentrant et elle est sur Mois avant que vous ne soyez assis.",
  },

  features: {
    heading: "Chaque écran est le même journal",
    body: "Rien ici ne tient un second jeu de chiffres. Vos saisies et votre relevé arrivent au même endroit, et chaque écran en est une lecture différente.",
  },

  monthClose: {
    heading: "Le chiffre qui vérifie tous les autres",
    body: [
      "Chaque total de chaque autre écran est une somme de mouvements — certains que vous avez saisis, d'autres apportés par le relevé. C'est honnête, et c'est incomplet : des espèces retirées au distributeur, une carte que le flux ne couvre pas, un mois que la synchronisation a manqué. Aucun calcul sur les lignes ne peut trouver ce qui n'y est pas.",
      "Le solde, si. Si le compte contenait un chiffre à la fin du mois dernier et un autre à la fin de celui-ci, et que les lignes n'expliquent qu'une partie de l'écart, le reste est une dépense que rien n'explique. Avec une banque connectée, l'application lit les deux chiffres sur le relevé lui-même, la vérification ne vous coûte donc rien ; sans banque, elle coûte un seul nombre par mois.",
    ],
    outcomes: [
      {
        label: "Non enregistré",
        body: "Ce que le solde prouve être sorti du compte et que rien n'explique. Mesuré, pas retenu de mémoire.",
      },
      {
        label: "Gardé",
        body: "Ce que le mois a réellement ajouté à votre patrimoine : ce qu'il a laissé sur le compte plus tout ce qui a été mis de côté exprès.",
      },
      {
        label: "La série",
        body: "Les mois d'affilée sous votre propre enveloppe, fixée d'après votre historique plutôt que d'après un chiffre rond.",
      },
    ],
    footnote:
      "Un solde plus élevé que les lignes ne le permettent n'est pas une bonne nouvelle — cela veut dire qu'il manque quelque chose, et la clôture le dit au lieu de le compter en silence.",
  },

  monthRead: {
    heading: "Les mots sont écrits pour vous. Pas les chiffres.",
    body: [
      "Demandez une lecture et un modèle de langage écrit quelques phrases sur le mois que vous regardez. Il ne saisit jamais un nombre. Il désigne un chiffre par son nom — dépenses non enregistrées, ce que vous avez gardé, le plafond que vous avez fixé — et l'application y substitue sa propre valeur avant que la phrase ne vous parvienne. Une phrase qui repose sur un chiffre que l'application n'a pas calculé est écartée ; si c'est le titre qui a cassé, toute la lecture est jetée et rien n'est enregistré.",
      "Cela corrige l'arithmétique, pas l'opinion. « Vous dépensez nettement plus en courses » ne contient aucun chiffre, donc rien au-dessus ne peut le vérifier — c'est un jugement, et il est du modèle. C'est un deuxième regard sur le mois, pas un verdict, et c'est le seul endroit de l'application où quoi que ce soit est écrit pour vous.",
    ],
    outcomes: [
      {
        label: "Sur demande",
        body: "Rien n'est écrit tant que vous ne le demandez pas. Chaque lecture est enregistrée avec les chiffres dont elle est partie, pour que ce qu'elle regardait reste visible à côté de ce qu'elle a dit.",
      },
      {
        label: "Vos mots",
        body: "Le modèle est tenu aux termes de l'application. Une lecture qui appellerait une clôture de mois une « réconciliation » contredirait chaque libellé imprimé autour d'elle, et vous n'auriez aucun moyen de savoir lequel des deux a tort.",
      },
      {
        label: "Elle vieillit",
        body: "Les chiffres à l'écran sont toujours à jour. Le jugement, non : « confortablement dans votre enveloppe » cesse d'être vrai quand cela cesse d'être vrai, alors une lecture est signalée dès que les chiffres qui la portent ont bougé.",
      },
    ],
    footnote:
      "Les suggestions sont sous un titre à elles, jamais mêlées aux observations — pour que rien de ce qu'elle propose ne puisse être pris pour quelque chose qu'elle a mesuré.",
  },

  how: {
    heading: "Ouvrez-le, remplissez-le, clôturez-le",
    beats: [
      {
        title: "Définissez ce qui revient, une fois",
        body: "Salaire, loyer, abonnements, un achat mensuel dans le PEA. Chacun est un modèle avec un montant et un rythme — un modèle en parts prend plutôt son montant du cours du moment.",
      },
      {
        title: "Appliquez-le au mois",
        body: "Appliquer transforme ce que le mois appelle en vraies lignes que vous pouvez encore modifier. Passez-en une, appliquez en retard, appliquez deux fois : le mois est à vous pour le décrire fidèlement, pas pour le tenir bien rangé.",
      },
      {
        title: "Ajoutez le reste au fil de l'eau",
        body: "Tout le reste, vous le saisissez. Ce qu'il reste, le calendrier jour par jour et les anneaux de Mois lisent tous ce même journal.",
      },
      {
        title: "Clôturez-le face à la banque",
        body: "Le jour de votre relevé, saisissez le seul solde que l'application ne peut pas connaître. Elle en déduit ce qu'elle n'a jamais vu, et ce que vous avez vraiment gardé.",
      },
    ],
  },

  privacy: {
    heading: "En lecture seule, côté serveur, et vous pouvez couper",
    body: "Vos chiffres vivent dans des lignes derrière votre connexion, et chaque requête est limitée à votre compte — aucun autre compte ne peut les lire, parce qu'aucune requête ne le permettrait. Connecter une banque est facultatif ; là où vous le faites, l'accès est du genre qui ne peut que lire, les identifiants n'atteignent jamais un navigateur, et il n'y a rien à vendre parce qu'il n'y a personne à qui le vendre.",
    points: [
      "Un accès en lecture seule, qui voit ce qui a bougé et ne bouge jamais rien.",
      "Révoquez la banque quand vous voulez ; les lignes déjà classées restent les vôtres.",
      "Effacez toutes les lignes en gardant le compte, ou supprimez les deux.",
      "Floutez chaque chiffre à l'écran d'un geste, pour le train.",
    ],
  },

  finalCta: {
    heading: "Commencez par ce mois-ci",
    body: "Un salaire, un loyer, et ce dont vous vous souvenez. Environ quatre minutes, et sans carte bancaire.",
  },

  pages: {
    home: {
      title: "Mois",
      body: "Ce qu'il reste ce mois-ci, où les revenus sont partis, et si le plafond et l'objectif tiennent encore.",
      utility:
        "Un écran pour le mois : ce qu'il reste, où les revenus sont partis, et si le plafond et l'objectif d'épargne tiennent encore. Il répond à la question pour laquelle vous avez ouvert l'application avant que vous ayez fini de la poser.",
      steps: [
        {
          title: "Ouvrez le mois",
          body: "Mois est le mois où vous êtes. Revenus, dépenses et chaque charge arrivée apparaissent ici, sous la vue du budget que vous préférez — comptée jusqu'à aujourd'hui, ou comptée pour tout ce que le mois contiendra.",
        },
        {
          title: "Lisez ce qu'il reste",
          body: "Le chiffre en tête est ce qui reste. Dessous, ce qui est entré contre ce qui est sorti, pour que l'écart soit une forme plutôt qu'une soustraction à faire.",
        },
        {
          title: "Regardez les anneaux",
          body: "L'anneau du plafond et celui de l'objectif suivent ce que vous avez défini dans Plan. Rien ici n'est une projection : les deux lisent des lignes qui existent.",
        },
      ],
    },
    transactions: {
      title: "Journal",
      body: "Un journal manuel qui vous appartient. Appliquez ce qui revient, puis changez tout.",
      utility:
        "Le journal est la source de vérité de tous les autres écrans. Rien n'est importé, donc rien n'arrive mal classé, en double, ou avec trois jours de retard — vous saisissez les lignes, et ce qu'il reste en découle.",
      steps: [
        {
          title: "Appliquez ce qui revient",
          body: "Salaire, factures et un achat mensuel peuvent remplir le mois en une passe, quand vous choisissez de les appliquer. Chacun devient ensuite une ligne ordinaire.",
        },
        {
          title: "Ajoutez et modifiez librement",
          body: "Changez une date, un montant ou une catégorie. Ajoutez un ponctuel. Supprimez une erreur. Étiquetez des lignes et filtrez par étiquette quand vous voulez une vue plus étroite qu'une catégorie.",
        },
        {
          title: "Tout le reste suit",
          body: "Ce qu'il reste, la répartition des dépenses, le calendrier et la clôture lisent tous ici. Il n'existe pas de second endroit où un chiffre pourrait se contredire.",
        },
      ],
    },
    recurring: {
      title: "Charges",
      body: "Salaire, loyer, abonnements, un achat mensuel. Appliqués quand vous le dites.",
      utility:
        "Des modèles pour ce qui revient, chaque mois, chaque semaine ou chaque année, éventuellement bornés par un début et une fin. Ils ne se déclenchent pas tout seuls — et c'est le principe, parce qu'une instruction permanente qui part sans surveillance est la façon dont un journal s'éloigne de la vérité.",
      steps: [
        {
          title: "Définissez un modèle",
          body: "Un montant et un rythme. Un modèle en parts prend son montant du cours du moment plutôt que d'un chiffre fixe, pour qu'un achat mensuel vaille ce qu'il a coûté et non ce que vous aviez estimé.",
        },
        {
          title: "Appliquez, passez, ou laissez",
          body: "Rien n'existe tant que vous n'appliquez pas. Passez un seul mois sans désactiver le modèle, ou désactivez-le et arrêtez-les tous.",
        },
        {
          title: "Tenu à jour du marché",
          body: "Une occurrence appliquée dont la date est encore à venir est revalorisée quand son cours bouge, discrètement et sans rien demander — le marché qui bouge n'est la décision de personne. Une fois sa date passée, son montant est ce qui a réellement bougé et ne change plus.",
        },
      ],
    },
    calendar: {
      title: "Calendrier",
      body: "Les mêmes lignes posées sur des jours, pour que le mois ait une forme.",
      utility:
        "Le journal, rangé par jour. Utile pour la question à laquelle une liste répond mal : non pas ce que j'ai dépensé, mais quand ce mois devient tendu.",
      steps: [
        {
          title: "Lisez le mois d'un coup",
          body: "Chaque jour porte son net, entré et sorti. Les jours lourds ressortent sans que vous ouvriez quoi que ce soit.",
        },
        {
          title: "Ouvrez un jour",
          body: "Ce qui entre et ce qui sort ce jour-là sont côte à côte, pour que la trésorerie du jour se lise au lieu de se reconstituer en faisant défiler.",
        },
        {
          title: "Modifiez à un seul endroit",
          body: "Le calendrier renvoie au journal pour modifier une ligne. Il ne garde aucun chiffre à lui, il ne peut donc jamais être l'écran qui n'est plus à jour.",
        },
      ],
    },
    wallets: {
      title: "Portefeuilles",
      body: "PEA, CTO et crypto. Les cours rafraîchissent la valeur ; les positions restent les vôtres.",
      utility:
        "Là où se trouve la valeur investie, enregistrée par vous. Les cours mettent la valorisation à jour ; il n'y a aucune connexion au courtier et aucun ordre ne quitte jamais cette application.",
      steps: [
        {
          title: "Enregistrez ce que vous détenez",
          body: "Un portefeuille par enveloppe — PEA, CTO, crypto — et une position par instrument à l'intérieur, avec ce qui est entré et ce que cela vaut aujourd'hui.",
        },
        {
          title: "Les cours font la revalorisation",
          body: "Les prix viennent d'une source de cotation en euro, quelle que soit la devise d'origine de l'instrument. « Pas de prix pour le moment » est une réponse ordinaire, et le dernier cours connu prend le relais.",
        },
        {
          title: "Voyez la répartition",
          body: "La répartition entre portefeuilles, et la plus-value face à ce que vous avez versé. Une lecture pour vous, pas un flux venu de quelqu'un.",
        },
      ],
    },
    planning: {
      title: "Plan",
      body: "Un plafond par catégorie, un objectif d'épargne par mois.",
      utility:
        "Des plafonds et des objectifs, et rien qui les impose. Un budget est un plafond sur ce qu'une catégorie peut dépenser dans un mois ; un objectif d'épargne est une somme que vous comptez accumuler. Les deux deviennent des anneaux sur Mois et aucun ne déplace d'argent.",
      steps: [
        {
          title: "Fixez un plafond",
          body: "Une limite mensuelle sur une catégorie. L'anneau se remplit à mesure que le journal dépense dessus et change de teinte avant que vous l'atteigniez, pas après.",
        },
        {
          title: "Fixez un objectif",
          body: "Une somme à accumuler, suivie sur vos lignes d'épargne, avec le rythme mensuel qu'il faudrait pour y arriver à la date que vous avez nommée.",
        },
        {
          title: "Suivez-le sur Mois",
          body: "Mois lit ces chiffres directement. Changez un plafond ou un objectif et les anneaux bougent avec.",
        },
      ],
    },
    "month-close": {
      title: "Clôture du mois",
      body: "Un solde, une fois par mois, et l'application vous dit ce qu'elle n'a jamais vu.",
      utility:
        "Le seul endroit où l'application demande quelque chose qu'elle ne peut pas déduire elle-même. Partout ailleurs elle raisonne sur des mouvements dont on lui a parlé ; ici, un vrai solde mesure les dépenses que personne ne saisit.",
      steps: [
        {
          title: "Choisissez un jour de relevé",
          body: "Le même jour du mois suivant, chaque mois — délibérément pas le dernier du mois, parce qu'avec une carte à débit différé les dépenses par carte du mois ne sont pas encore passées.",
        },
        {
          title: "Saisissez un solde",
          body: "Ce que contenait, ce jour-là, le compte d'où partent vraiment vos dépenses. La première clôture est une référence : elle fixe le point à partir duquel tout le reste est mesuré.",
        },
        {
          title: "Lisez ce qu'elle a trouvé",
          body: "Les dépenses non enregistrées, ce que vous avez gardé, et si le mois est resté dans votre propre enveloppe — fixée d'après votre historique, pas d'après un chiffre rond avec lequel vous ne feriez que discuter.",
        },
      ],
    },
    "month-read": {
      title: "Lecture du mois",
      body: "Quelques phrases sur le mois, où la prose est celle d'un modèle et chaque chiffre est celui de l'application.",
      utility:
        "Tous les autres écrans vous tendent un chiffre ou une liste. Celui-ci les lit ensemble et dit ce qui ressort — sans avoir le droit d'inventer un nombre pour le dire. Utile les mois où les totaux ont l'air ordinaires et où quelque chose en dessous ne l'est pas.",
      steps: [
        {
          title: "Demandez-la",
          body: "Une lecture est écrite quand vous appuyez, jamais à l'ouverture. Cinq par mois, ce qui est largement assez pour un mois qui bouge et un plafond pour tout ce qui appuierait en boucle.",
        },
        {
          title: "Lisez ce qu'elle a trouvé",
          body: "Les observations d'abord, et les éventuelles suggestions sous un titre à elles. Chaque chiffre de la prose est celui de l'application, glissé dans la phrase après que le modèle a dit lequel il voulait.",
        },
        {
          title: "Redemandez quand elle vieillit",
          body: "Les chiffres ne périment jamais, le jugement si. Quand ce qui est dessous a assez bougé pour changer la lecture, elle le dit et vous pouvez en demander une autre.",
        },
      ],
    },
  },

  cta: {
    getStarted: "Commencer",
    signIn: "Se connecter",
    openApp: "Ouvrir l'application",
    goToDashboard: "Ouvrir le mois",
  },
  exampleLabel: "Données d'exemple",
};
