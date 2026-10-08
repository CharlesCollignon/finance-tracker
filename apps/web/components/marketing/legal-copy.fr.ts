import type { LegalCopy } from "./legal-copy";

/**
 * La politique de confidentialité et les conditions d'utilisation, en
 * français.
 *
 * Mêmes sections, mêmes identifiants et mêmes blancs `[[…]]` que la version
 * anglaise, dont l'en-tête vaut ici : ce texte décrit ce que l'application
 * fait réellement, et change avec elle.
 */
export const legalCopyFr: LegalCopy = {
  nav: {
    privacy: "Politique de confidentialité",
    terms: "Conditions d'utilisation",
    notice: "Mentions légales",
  },
  updatedLabel: "Dernière mise à jour\u00A0:",
  updated: "2026-10-04",
  contents: "Sur cette page",
  draftNotice:
    "Brouillon à relire. Les blancs surlignés sont à compléter par l'éditeur, et le texte n'a pas encore été vérifié par un juriste.",

  privacy: {
    title: "Politique de confidentialité",
    summary:
      "Ce que Pluclair conserve à votre sujet, pourquoi, qui l'aide à fonctionner, combien de temps, et comment le reprendre.",
    sections: [
      {
        id: "who",
        heading: "Qui sommes-nous",
        body: [
          "Pluclair est édité par [[le nom légal de l'éditeur — et, pour une société, sa forme juridique, son siège et son numéro d'immatriculation]] (« nous »). Nous sommes responsables du traitement des données décrites ici, sauf quand une section désigne quelqu'un d'autre.",
          "Pour toute question sur vos données, écrivez à [[une adresse de contact confidentialité]]. Nous répondons sous un mois.",
        ],
      },
      {
        id: "short",
        heading: "En bref",
        body: [],
        points: [
          "Pluclair conserve ce que vous y mettez, et ce que votre banque envoie si vous choisissez de la connecter. Rien d'autre.",
          "Aucune publicité, aucun pistage d'un site à l'autre, et rien n'est vendu ni partagé à des fins commerciales. Une mesure d'audience, faite par nous seuls, compte les jours où l'application est ouverte sans vous nommer\u00A0; vous pouvez la couper dans Profil.",
          "Connecter une banque est facultatif et en lecture seule : rien dans Pluclair ne peut déplacer d'argent.",
          "Vous pouvez corriger ou supprimer n'importe quelle écriture, déconnecter votre banque ou supprimer votre compte depuis l'application, et supprimer le compte emporte tout avec lui.",
        ],
      },
      {
        id: "what",
        heading: "Ce que nous conservons",
        body: [],
        points: [
          "Votre compte : votre adresse e-mail et, si vous vous connectez avec Google, le nom et l'identifiant de compte que Google nous transmet. Si vous ajoutez une clé d'accès (passkey), nous gardons sa clé publique ; la partie privée ne quitte jamais votre appareil.",
          "Ce que vous saisissez ou importez : opérations, catégories, charges, plafonds, objectifs, portefeuilles et leurs positions, clôtures de mois et soldes relevés, étiquettes et notes. Quand vous importez un relevé, le fichier est lu pour proposer des écritures et seules celles que vous gardez sont enregistrées ; le fichier lui-même ne l'est pas.",
          "Vos préférences : la langue, et les invitations que vous avez écartées.",
          "La mesure d'audience, sauf si vous la coupez\u00A0: les jours où l'application est ouverte, et combien de fois ce jour-là vous avez ajouté une opération, clôturé un mois ou demandé «\u00A0Puis-je me permettre\u00A0?\u00A0». Sous un identifiant calculé à partir de votre compte avec une clé secrète, qui ne vous nomme pas. Aucun montant, aucun commerce, aucun texte.",
          "Les notifications, si vous les activez : l'adresse de distribution que votre navigateur ou votre téléphone nous donne (un abonnement push, ou un jeton push pour l'application mobile), l'identifiant du navigateur (user agent), et la liste des rappels déjà envoyés, pour qu'aucun ne parte deux fois.",
          "Vos biens immobiliers, si vous en ajoutez : ce que chacun a coûté et son usage, sa surface et sa classe énergie, votre part, les prêts qui l'ont financé et leurs conditions, et ce qu'il vaut à vos yeux. De son adresse nous gardons la commune et le point où il se trouve, pour le comparer aux ventes alentour ; l'adresse complète seulement si vous le demandez.",
          "Votre banque, si vous la connectez : voir la section suivante.",
        ],
      },
      {
        id: "bank",
        heading: "Connecter une banque",
        body: [
          "Connecter une banque est facultatif. Cela passe par votre propre compte open-banking.io\u00A0: vous vous y inscrivez et le payez directement (à ce jour, environ 3\u00A0€ par mois pour le premier compte et 1\u00A0€ par compte supplémentaire), et c'est votre banque qui recueille votre consentement, sur ses propres pages, par l'intermédiaire d'Enable Banking Oy, prestataire de services d'information sur les comptes agréé. Pluclair ne voit jamais vos identifiants bancaires, n'encaisse ni ne manipule jamais ce paiement, et n'est pas lui-même un prestataire de services de paiement agréé ou enregistré.",
          "open-banking.io, Enable Banking et votre banque traitent vos données selon leurs propres politiques de confidentialité, en tant que [[responsables de traitement distincts — à confirmer avec open-banking.io]].",
          "Pour que Pluclair puisse lire ce compte, vous lui confiez le fichier d'identifiants qu'open-banking.io vous permet de télécharger (credentials.json)\u00A0: une clé API qui lit votre compte open-banking.io, et la clé privée qui déchiffre ce qu'il renvoie. Ce que Pluclair reçoit alors\u00A0:",
        ],
        points: [
          "Pour chaque compte : son nom, sa devise et le solde que la banque indique.",
          "Pour chaque mouvement : sa date, son montant, sa devise et son sens, le libellé de la banque, le commerçant ou le payeur quand la banque le nomme, et le code de catégorie du commerçant quand il existe.",
          "L'état de la connexion, et la date de fin du consentement donné à votre banque.",
        ],
        after: [
          "De ce fichier, nous ne conservons que les deux clés, scellées en AES-256-GCM sous une clé que seul notre serveur détient. Aucune application ne peut lire cette table — pas même pour votre propre compte — et ces clés ne sont jamais renvoyées à un navigateur ou à un téléphone, ni écrites dans un journal. Votre navigateur ou votre téléphone transmet le fichier une seule fois, à notre serveur, et ne le conserve pas.",
          "Pluclair ne demande de nouvelles données à votre banque que lorsque vous demandez une actualisation\u00A0; le reste du temps, il lit ce que votre compte open-banking.io contient déjà. Le consentement donné à votre banque dure environ 180 jours\u00A0; vous le renouvelez sur open-banking.io, et nous vous prévenons avant qu'il se termine.",
          "Vous pouvez déconnecter votre banque à tout moment depuis Profil → Banque. Nous supprimons aussitôt le fichier. Sa clé API continue d'exister chez open-banking.io jusqu'à ce que vous la supprimiez là-bas, ce que la page Banque vous rappelle de faire. Vous choisissez si les écritures apportées par votre banque restent dans vos comptes ou sont retirées\u00A0; elles restent, sauf si vous en décidez autrement. La fermeture de votre compte open-banking.io se fait auprès d'eux.",
        ],
      },
      {
        id: "why",
        heading: "Pourquoi nous l'utilisons, et sur quelle base",
        body: [],
        points: [
          "Pour fournir le service auquel vous vous êtes inscrit : conserver vos écritures, calculer vos chiffres, vous les montrer, et synchroniser votre banque si vous l'avez connectée. La base légale est le contrat qui nous lie (RGPD, article 6.1.b).",
          "Pour la connexion bancaire, sur le consentement que vous donnez à l'écran en déposant votre fichier d'identifiants, et auprès de votre banque. Il couvre les informations sensibles que vos opérations peuvent révéler — santé, convictions, appartenance syndicale —, qui ne sont traitées que sur ce consentement explicite (articles 6.1.a et 9.2.a). Nous conservons la date et la version du texte accepté, et vous le retirez en déconnectant votre banque.",
          "Pour envoyer des notifications, seulement si vous les activez. Les désactiver sur votre appareil ou dans votre navigateur les arrête.",
          "Pour savoir si Pluclair sert\u00A0: la mesure d'audience ne sert qu'à calculer trois chiffres d'ensemble — combien reviennent après un mois, combien l'ouvrent plusieurs jours par semaine, combien clôturent leur mois —, jamais à changer ce que vous voyez, et n'est ni partagée ni croisée avec autre chose. La base est notre intérêt légitime (article 6.1.f), et vous vous y opposez à tout moment en coupant «\u00A0Mesure d'audience\u00A0» dans Profil.",
          "Pour garder le service sûr et en état de marche : notre hébergeur conserve brièvement des journaux techniques des requêtes, que nous ne consultons que pour corriger une panne ou arrêter un abus. La base est notre intérêt légitime à faire fonctionner un service sûr (article 6.1.f).",
        ],
        after: [
          "Nous n'utilisons jamais vos données pour de la publicité, du profilage commercial, une évaluation de solvabilité, ni pour prendre à votre sujet des décisions automatisées produisant des effets juridiques ou significatifs.",
        ],
      },
      {
        id: "processors",
        heading: "Qui nous aide à le faire fonctionner",
        body: [
          "Ces sociétés traitent des données pour notre compte, uniquement pour faire fonctionner Pluclair, dans le cadre d'un accord de sous-traitance :",
        ],
        points: [
          "Supabase\u00A0: la base de données et la connexion, dans l'Union européenne ([[la région exacte du projet Supabase dans l'UE]]).",
          "Vercel\u00A0: l'hébergement du site et du serveur, les fonctions serveur s'exécutant à Paris, en France.",
          "Mistral AI (France) : rédige les courtes lectures de votre mois et de vos portefeuilles. Elle ne reçoit que les chiffres à partir desquels une lecture est écrite — noms de catégories et totaux du mois, ou fonds d'un portefeuille et leurs valeurs — et jamais votre nom, votre e-mail ni vos écritures une à une. Pour une question posée dans «\u00A0Questions\u00A0», elle reçoit aussi la question telle que vous l'avez tapée — ce que vous y écrivez lui parvient tel quel —, avec les seuls totaux nécessaires pour y répondre.",
          "OpenRouter (États-Unis), si vous connectez votre propre compte IA\u00A0: vos lectures sont alors rédigées par le modèle que vous avez choisi, sur votre compte et à vos frais, et non plus par Mistral AI pour notre compte. OpenRouter reçoit les mêmes chiffres — noms de catégories et totaux du mois, fonds d'un portefeuille et leurs valeurs, nom et identifiant d'un fonds à lire, la question posée dans «\u00A0Questions\u00A0» telle que vous l'avez tapée — et les transmet au fournisseur du modèle (Mistral, OpenAI ou Anthropic). Jamais votre nom, votre e-mail, vos écritures une à une ni vos identifiants bancaires. La clé de ce compte est conservée chiffrée sur notre serveur, et vous pouvez le déconnecter à tout moment.",
          "Google : seulement si vous vous connectez avec Google.",
          "La distribution des notifications : les notifications web sont chiffrées, si bien que le service push de votre navigateur (Apple, Google, Microsoft ou Mozilla selon le navigateur) ne peut pas les lire. Les notifications sur téléphone passent par le service push d'Expo, puis par Apple ou Google.",
          "Les cours de marché : pour valoriser vos fonds, nous consultons leurs cours sur Yahoo Finance et sur les pages des émetteurs (justETF, iShares). Nous n'envoyons que l'identifiant du fonds, jamais rien vous concernant.",
          "La recherche d'adresse : quand vous saisissez l'adresse d'un bien, notre serveur demande au service de géocodage de l'État (Géoplateforme de l'IGN) de la retrouver. L'IGN reçoit l'adresse saisie, jamais votre adresse IP ni rien d'autre vous concernant. Pour estimer ce que vaut un bien, nous consultons les ventes immobilières publiques (DVF) et l'indice des prix Notaires-INSEE, en n'envoyant qu'un code de commune ou l'identifiant de l'indice. Pour un bien loué, nous téléchargeons la carte des loyers de l'ANIL en entier, sans rien envoyer vous concernant.",
        ],
        after: [
          "Vercel Inc. est une société américaine certifiée au titre du cadre de protection des données UE–États-Unis, sur lequel repose tout transfert vers elle. Supabase et Mistral AI conservent les données dans l'Union européenne, et Supabase s'appuie sur les clauses contractuelles types de la Commission européenne pour tout accès depuis l'extérieur. [[Vérifier l'accord de sous-traitance en vigueur de chaque prestataire.]]",
          "Si vous connectez un compte IA, OpenRouter et le fournisseur du modèle choisi peuvent traiter ces chiffres hors de l'Union européenne, le plus souvent aux États-Unis\u00A0: ce transfert a lieu sur votre compte, à votre demande, et vous en êtes informé avant de le connecter.",
        ],
      },
      {
        id: "retention",
        heading: "Combien de temps nous le gardons",
        body: [],
        points: [
          "Votre compte et tout ce qu'il contient : tant que vous gardez le compte.",
          "Une écriture supprimée : [[conservée 30 jours pour pouvoir annuler la suppression, puis effacée — la tâche qui les efface n'est pas encore programmée]].",
          "Quand vous supprimez votre compte (Profil → Supprimer le compte), votre fichier d'identifiants est d'abord supprimé, puis tout est retiré de la base en service d'un coup. Les sauvegardes sont écrasées sous [[la durée de conservation des sauvegardes de l'offre Supabase]].",
          "Votre fichier d'identifiants\u00A0: jusqu'à ce que vous déconnectiez la banque, remplaciez le fichier ou supprimiez votre compte.",
          "La mesure d'audience\u00A0: 13 mois, puis effacée\u00A0; supprimer votre compte l'efface aussitôt.",
          "Vos questions et leurs réponses («\u00A0Questions\u00A0»)\u00A0: 30 jours, puis effacées\u00A0; chacune peut être supprimée avant, et supprimer votre compte les efface aussitôt.",
          "La liste des rappels envoyés : tant que le compte existe, pour qu'aucun ne se répète.",
        ],
      },
      {
        id: "security",
        heading: "Comment c'est protégé",
        body: [
          "Chaque ligne est rattachée à son compte, et la base elle-même refuse de la montrer à quiconque d'autre (sécurité au niveau des lignes). Tous les échanges sont chiffrés en transit. Les clés bancaires sont chiffrées au repos sous une clé conservée à part de la base. L'accès aux systèmes de production est limité à [[qui dispose d'un accès d'administration]].",
          "Si une violation met vos données en danger, nous le signalerons à la CNIL sous 72 heures et vous en informerons dans les meilleurs délais, comme la loi l'exige.",
        ],
      },
      {
        id: "rights",
        heading: "Vos droits",
        body: [
          "Vous pouvez demander à consulter les données que nous détenons sur vous, les faire rectifier ou effacer, limiter leur usage ou vous y opposer, les recevoir dans un format portable, et retirer tout consentement donné. L'essentiel se fait dans l'application : modifier ou supprimer une écriture, exporter un mois du Journal en CSV, déconnecter votre banque, ou supprimer votre compte. Pour le reste, écrivez à [[l'adresse de contact confidentialité]].",
          "Si vous estimez que nous n'avons pas traité vos données correctement, vous pouvez adresser une réclamation à la CNIL (cnil.fr) ou à l'autorité de protection des données de votre pays.",
        ],
      },
      {
        id: "children",
        heading: "Mineurs",
        body: [
          "Pluclair ne s'adresse pas aux moins de 15 ans, l'âge de la majorité numérique en France, et nous ne conservons pas sciemment de données les concernant.",
        ],
      },
      {
        id: "changes",
        heading: "Modifications de cette politique",
        body: [
          "Quand cette politique change, la date en haut de page change avec elle. Si un changement touche ce que nous conservons à votre sujet ou qui y a accès, nous vous prévenons dans l'application avant qu'il ne s'applique.",
        ],
      },
    ],
  },

  terms: {
    title: "Conditions d'utilisation",
    summary:
      "L'accord entre vous et Pluclair : ce qu'est le service, ce qu'il n'est pas, et ce que chacun peut attendre de l'autre.",
    sections: [
      {
        id: "about",
        heading: "À propos de ces conditions",
        body: [
          "Ces conditions forment un accord entre vous et [[le nom légal de l'éditeur]], qui édite Pluclair. En créant un compte, vous les acceptez. La politique de confidentialité explique comment vos données sont traitées, et fait partie de cet accord.",
        ],
      },
      {
        id: "service",
        heading: "Le service",
        body: [
          "Pluclair tient le registre de vos finances personnelles : ce qui entre et ce qui sort, ce qui revient, ce que vous mettez de côté et investissez, et comment chaque mois se clôt. Il calcule ses chiffres à partir de ce que vous saisissez, importez, ou laissez votre banque envoyer.",
          "Pluclair est gratuit. Si cela devait changer, rien de ce que vous utilisez aujourd'hui ne deviendra payant sans votre accord explicite. Les fonctionnalités peuvent évoluer ; nous essayons de vous prévenir avant qu'une fonctionnalité sur laquelle vous comptez ne disparaisse.",
        ],
      },
      {
        id: "account",
        heading: "Votre compte",
        body: [
          "Vous devez avoir au moins 15 ans et utiliser une vraie adresse e-mail à laquelle vous recevez du courrier. Un compte est destiné à une seule personne. Gardez vos moyens de connexion pour vous ; ce qui est fait avec votre compte relève de votre responsabilité, alors prévenez-nous tout de suite à [[une adresse de contact assistance]] si vous pensez que quelqu'un d'autre l'a utilisé.",
        ],
      },
      {
        id: "data",
        heading: "Vos données",
        body: [
          "Ce que vous mettez dans Pluclair reste à vous. Vous nous autorisez à le conserver et à le traiter dans la seule mesure où le service l'exige. Vous pouvez exporter un mois du Journal à tout moment, et supprimer votre compte quand vous le souhaitez.",
        ],
      },
      {
        id: "bank",
        heading: "Connecter une banque",
        body: [
          "Connecter une banque est facultatif et passe par votre propre compte open-banking.io, un service distinct. Vous vous y inscrivez, acceptez ses conditions et le payez directement\u00A0; Pluclair n'est pas partie à ce contrat, n'encaisse ni ne manipule jamais ce paiement, et n'est pas un prestataire de services de paiement agréé ou enregistré — le service d'information sur les comptes est fourni par Enable Banking Oy. Vous le connectez en confiant à Pluclair le fichier d'identifiants de ce compte et en donnant votre consentement à l'écran\u00A0: gardez ce fichier pour vous, et supprimez sa clé API chez open-banking.io si vous pensez qu'il a été exposé.",
          "La connexion est en lecture seule : rien dans Pluclair ne peut déplacer d'argent. La synchronisation dépend d'open-banking.io, d'Enable Banking et de votre banque, et elle peut être en retard, incomplète, ou s'arrêter — quand le consentement donné à votre banque prend fin, quand votre portefeuille open-banking.io est vide, ou quand une banque est indisponible. Nous vous prévenons quand la synchronisation s'arrête, et vos écritures restent les vôtres quoi qu'il arrive à la connexion.",
        ],
      },
      {
        id: "advice",
        heading: "Pas un conseil financier",
        body: [
          "Les chiffres de Pluclair sont des calculs sur les données que vous et votre banque fournissez, et ne sont justes que si ces données le sont. Pluclair ne donne aucun conseil en investissement, fiscal, juridique ou de crédit, et les courtes lectures qu'il rédige avec l'aide d'un modèle d'IA peuvent contenir des erreurs : elles s'affichent toujours à côté des chiffres dont elles viennent, vérifiez-les là. Les décisions concernant votre argent restent les vôtres.",
        ],
      },
      {
        id: "use",
        heading: "Usage loyal",
        body: ["Merci de ne pas :"],
        points: [
          "tenter d'accéder aux données d'une autre personne, ou de contourner les limites d'accès du service ;",
          "surcharger le service, ou le lire avec des outils automatisés autres que les applications que nous fournissons ;",
          "l'utiliser à des fins illicites.",
        ],
        after: [
          "Si un compte enfreint ces règles, nous pouvons le suspendre. Sauf urgence ou obligation légale contraire, nous vous prévenons d'abord et vous laissons l'occasion de vous expliquer.",
        ],
      },
      {
        id: "availability",
        heading: "Disponibilité",
        body: [
          "Nous faisons en sorte que Pluclair reste disponible et vos données en sécurité, mais nous ne pouvons pas promettre qu'il ne sera jamais interrompu : maintenance, pannes et incidents chez les services dont il dépend peuvent le rendre indisponible un temps.",
        ],
      },
      {
        id: "liability",
        heading: "Responsabilité",
        body: [
          "Dans les limites permises par la loi, nous ne sommes pas responsables des pertes indirectes, ni des décisions que vous prenez sur la base des chiffres affichés par Pluclair. Rien dans ces conditions ne limite les droits que vous tenez du droit de la consommation, ni notre responsabilité en cas de faute lourde, de fraude, ou dans tout autre cas où la loi interdit de l'exclure.",
        ],
      },
      {
        id: "ending",
        heading: "Fin de l'accord",
        body: [
          "Vous pouvez arrêter à tout moment en supprimant votre compte depuis Profil. Si nous devions fermer Pluclair, nous vous préviendrons au moins [[30 jours]] à l'avance, en vous laissant le moyen d'exporter vos écritures d'abord.",
        ],
      },
      {
        id: "changes",
        heading: "Modifications de ces conditions",
        body: [
          "Si ces conditions changent de façon importante, nous vous prévenons dans l'application au moins [[30 jours]] avant l'entrée en vigueur. Si vous ne les acceptez pas, vous pouvez supprimer votre compte d'ici là ; continuer à utiliser Pluclair ensuite vaut acceptation des nouvelles conditions.",
        ],
      },
      {
        id: "law",
        heading: "Droit applicable et litiges",
        body: [
          "Ces conditions sont régies par le droit français. En cas de problème, écrivez-nous d'abord à [[l'adresse de contact assistance]] et nous chercherons à y remédier. [[Si l'éditeur est un professionnel s'adressant à des consommateurs : indiquer ici le médiateur de la consommation, que vous pouvez saisir gratuitement.]] Vous pouvez aussi saisir les tribunaux français compétents, ou ceux de votre lieu de résidence quand la loi vous en donne le droit.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        body: [
          "[[Le nom légal et l'adresse postale de l'éditeur]]. E-mail : [[l'adresse de contact assistance]].",
        ],
      },
    ],
  },

  notice: {
    title: "Mentions légales",
    summary:
      "Qui édite Pluclair, qui l'héberge, et qui fournit la partie réglementée de la connexion bancaire.",
    sections: [
      {
        id: "publisher",
        heading: "Éditeur",
        body: [
          "Le site pluclair.com et les applications Pluclair sont édités par [[les nom et prénoms de l'éditeur — ou, pour une société, sa dénomination, sa forme juridique et son capital social]], [[adresse du domicile ou du siège social]], téléphone [[un numéro de téléphone]], e-mail [[une adresse e-mail de contact]]. [[Numéro d'immatriculation (SIREN / RCS) si l'éditeur est immatriculé\u00A0; sinon, supprimer cette phrase]].",
        ],
      },
      {
        id: "director",
        heading: "Directeur de la publication",
        body: [
          "[[Nom du directeur de la publication — en général l'éditeur lui-même]].",
        ],
      },
      {
        id: "hosting",
        heading: "Hébergement",
        body: [
          "Le site et ses serveurs sont hébergés par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis, téléphone [[numéro de téléphone de Vercel]]. Les fonctions serveur de Pluclair s'exécutent à Paris, en France.",
          "Les données de l'application sont stockées par [[dénomination et adresse de Supabase]], dans l'Union européenne ([[région exacte du projet Supabase dans l'UE]]).",
        ],
      },
      {
        id: "payments",
        heading: "Services de paiement",
        body: [
          "Pluclair n'est pas un prestataire de services de paiement agréé ou enregistré. La connexion bancaire, facultative, passe par le compte open-banking.io de l'utilisateur (Tatic ApS, Danemark), et le service d'information sur les comptes est fourni par Enable Banking Oy, enregistrée auprès de l'autorité finlandaise de surveillance financière (FIN-FSA).",
        ],
      },
      {
        id: "data",
        heading: "Données personnelles",
        body: [
          "La manière dont Pluclair traite les données personnelles, et dont exercer vos droits, est décrite dans la politique de confidentialité.",
        ],
      },
    ],
  },
};
