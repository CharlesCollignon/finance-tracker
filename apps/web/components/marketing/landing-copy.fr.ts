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
    body: "Un compte, un journal, trois clients qui s'accordent. Ajoutez une ligne sur le téléphone en rentrant et le Cap l'a avant que vous ne soyez assis.",
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
        body: "Tout le reste, vous le saisissez. Ce qu'il reste, le calendrier jour par jour et chaque carte du Cap lisent tous ce même journal.",
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
    bearing: {
      title: "Cap",
      body: "Où en est l'ensemble un jour donné, et vers quoi cela va.",
      utility:
        "Deux chiffres en haut, et cinq cartes en dessous qui décomposent le reste. Aucun chiffre n'est inventé ici : chacun est déjà montré par une autre surface, ce qui rend l'écran vérifiable au lieu d'en faire une seconde comptabilité.",
      steps: [
        {
          title: "Lisez les deux chiffres",
          body: "Ce qu'il y a actuellement sur votre compte courant, et à combien le mois finit une fois que tout ce qu'il sait déjà sera arrivé. Le second est une arithmétique sur des charges déjà saisies, pas une supposition sur ce que vous pourriez dépenser.",
        },
        {
          title: "Ouvrez une carte là où vous voulez le détail",
          body: "Ce mois-ci, Les comptes, Votre régularité, L'année à venir, Portefeuilles. Une carte n'est que son nom et un chiffre tant qu'elle est fermée ; ouvrez-la et elle liste les chiffres derrière celui-là et dessine ce qui les compose, sur place, sans quitter l'écran.",
        },
        {
          title: "Suivez-la jusqu'à la surface qui la porte",
          body: "Chaque carte se termine par les surfaces qui l'expliquent. Un chiffre qui mène quelque part est un lien ; un chiffre qui n'a nulle part d'honnête où mener n'est pas déguisé en lien.",
        },
      ],
    },
    ledger: {
      title: "Journal",
      body: "Chaque mouvement — en liste, posé sur les jours, ou mois par mois et par catégorie.",
      utility:
        "L'enregistrement dont tout le reste découle. Des lignes que vous avez saisies, des lignes qu'un modèle de charge a appliquées, et des lignes venues du relevé qu'une de vos propres habitudes a classées — un seul corps de données, regardé de trois façons.",
      steps: [
        {
          title: "La liste, le calendrier, ou par catégorie",
          body: "Les mêmes lignes partout. La liste sert à en retrouver une et à la modifier ; le calendrier les pose sur les jours, ce qui répond à quand le mois se tend plutôt qu'à ce que vous avez dépensé ; par catégorie donne à chacune ses douze mois, ce qu'elle coûte normalement, et ce qui s'en est écarté.",
        },
        {
          title: "Ce que la banque envoie vous attend",
          body: "Une ligne de relevé se classe toute seule seulement là où vous avez mis ce commerçant au même endroit deux fois — le moment où c'est une habitude et non une coïncidence. Tout le reste attend dans la liste à vérifier, l'argent qui entre y compris. Y répondre apprend au classement, et c'est pourquoi la liste rétrécit au lieu de devenir une corvée permanente.",
        },
        {
          title: "Ou apportez un CSV",
          body: "Un export de votre banque, dont les colonnes se règlent une fois. Le même historique qui classe le flux propose une catégorie pour celles-ci, et rien n'est écrit avant que vous ayez lu la liste proposée.",
        },
      ],
    },
    charges: {
      title: "Charges",
      body: "Salaire, loyer, abonnements, un achat mensuel. Appliqués quand vous le dites.",
      utility:
        "Des instructions permanentes pour ce qui se répète, chaque mois, chaque semaine ou chaque année, éventuellement bornées par un début et une fin. Elles ne s'exécutent pas toutes seules — et c'est le but, parce qu'une instruction qui part sans surveillance est la façon dont un journal s'éloigne de la vérité.",
      steps: [
        {
          title: "Définissez ce qui se répète",
          body: "Un montant et un rythme. Un modèle au cours prend son montant d'un nombre de parts multiplié par le cours actuel plutôt que d'un chiffre fixe, pour qu'un achat mensuel vaille ce qu'il a coûté et non ce que vous aviez estimé.",
        },
        {
          title: "Appliquez, sautez, ou dites que c'est déjà arrivé",
          body: "Rien n'existe tant que vous n'appliquez pas, et appliquer écrit des lignes ordinaires que vous pouvez encore modifier. Sautez un mois sans désactiver le modèle. Et là où le relevé a rapporté le mouvement lui-même, dites que c'est bien celui que le modèle appelait, au lieu de laisser une seconde ligne à côté.",
        },
        {
          title: "Tenu à jour avec le marché",
          body: "Une échéance appliquée mais encore datée dans le futur est revalorisée quand son cours bouge, discrètement et sans rien demander — que le marché bouge n'est la décision de personne. Une fois sa date passée, son montant est ce qui a réellement bougé et ne change plus.",
        },
      ],
    },
    plan: {
      title: "Plan",
      body: "Des plafonds, des objectifs, les mois à venir, et le solde qui les vérifie.",
      utility:
        "Ce que vous avez décidé au sujet de l'argent, et ce que ces décisions donnent mises bout à bout. Un plafond sur une catégorie, une somme à accumuler, les mois vers lesquels mènent vos charges, et le solde unique contre lequel un mois est clôturé. Rien ici n'impose quoi que ce soit ni ne déplace quoi que ce soit.",
      steps: [
        {
          title: "Fixez un plafond, fixez un objectif",
          body: "Une limite mensuelle sur une catégorie, et une somme à accumuler avec le rythme qu'il faudrait pour y arriver à la date que vous avez nommée. Les deux se remplissent à mesure que le journal court dessus, et les deux changent de teinte avant que vous les atteigniez, pas après.",
        },
        {
          title: "Voyez vers quoi mènent les mois, et décomposez-le",
          body: "Deux courbes, pas une : ce que contiennent les comptes de dépense, et cela plus tout ce qui a été mis de côté en chemin. Il y en a deux parce qu'une seule était un mensonge — une courbe unique qui comptait l'argent viré en épargne comme de l'argent parti faisait voir à un épargnant appliqué sa position s'enfoncer. Les deux se décomposent : les revenus des charges, ce qui est engagé, ce qui est mis de côté, et ce qu'un mois normal coûte sans qu'on le voie, chacun avec les charges qui le portent et un moyen d'aller le changer.",
        },
        {
          title: "Clôturez le mois contre la banque",
          body: "Le jour de votre relevé, le seul solde que l'application ne peut pas déduire elle-même. Il mesure ce qu'aucune arithmétique sur les lignes ne pourrait trouver, et ce qu'il trouve a sa propre page.",
        },
      ],
    },
    wallets: {
      title: "Portefeuilles",
      body: "PEA, CTO, AV, PER et crypto — ce que vous détenez, et de quoi c'est vraiment fait.",
      utility:
        "Là où se trouve la valeur investie, enregistrée par vous. Les cours mettent la valorisation à jour ; il n'y a aucune connexion courtier, et aucun ordre ne sort jamais de cette application.",
      steps: [
        {
          title: "Enregistrez ce que vous détenez",
          body: "Un portefeuille par enveloppe, et une position par instrument dedans, avec ce qui y est entré et ce que cela vaut maintenant. Les prix arrivent en euros quelle que soit la devise de cotation d'origine, et « pas de prix pour le moment » est une réponse ordinaire que le dernier cours connu couvre.",
        },
        {
          title: "Voyez à travers, jusqu'à ce que vous détenez vraiment",
          body: "Deux fonds peuvent détenir la même entreprise, et aucun des deux ne le dit. La transparence résout vos positions à travers ce que chaque instrument a été lu comme contenant — pays, secteurs, plus grandes lignes en dessous — sur la valeur qu'elle a pu résoudre, et signale le reste comme non lu plutôt que de le laisser discrètement de côté.",
        },
        {
          title: "Demandez une lecture de l'ensemble",
          body: "Un état daté de ce qui est investi : ce qu'il observe, ce qu'il suggère, et l'allocation cible que ces suggestions impliquent. Il ne nomme des instruments que dans un catalogue fermé et n'écrit aucun chiffre de lui-même — il choisit un rôle et une taille, et l'application en fait des pourcentages.",
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
          body: "Ce que contenait, ce jour-là, le compte d'où partent vraiment vos dépenses. Avec une banque connectée, l'application le lit sur le relevé à votre place. La première clôture est une référence : elle fixe le point à partir duquel tout le reste est mesuré.",
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
        "Toutes les autres surfaces vous tendent un chiffre ou une liste. Celle-ci les lit ensemble et dit ce qui ressort — sans avoir le droit d'inventer un nombre pour le dire. Utile les mois où les totaux ont l'air ordinaires et où quelque chose en dessous ne l'est pas.",
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
    goToDashboard: "Voir où vous en êtes",
  },
  exampleLabel: "Données d'exemple",
};
