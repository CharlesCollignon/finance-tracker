import type { ChangelogEntry, RoadmapItem } from "./changelog";

/**
 * Every entry of « Nouveautés », newest first.
 *
 * Written from the repository: each is a merge into `main`, or a run of
 * commits on it, dated the day it landed — `git log --merges --first-parent
 * main` shows them, and `scripts/changelog-draft.mjs` lists what has landed
 * since the newest entry here. A branch that changes what someone using the
 * app sees adds its entry before it is merged, and the date is set on the
 * day of the merge.
 *
 * What changes behind the screen — a refactor, a test, a migration nobody
 * sees — is not an entry. What was built and then taken back out (the tax
 * page, October 2026) is not either: it never stayed long enough for anyone
 * to use.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-10-12-journal-weeks",
    date: "2026-10-12",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "ledger",
    featured: true,
    fr: {
      title: "Le Journal, une semaine à la fois",
      body: "Une bande en haut du Journal montre les semaines du mois : choisissez-en une, et les jours glissent à leur place.",
      detail:
        "Les entrées et les sorties de la semaine se mettent à jour d’un coup, et un bouton retourne l’ordre de la liste, du plus ancien au plus récent ou l’inverse.",
    },
    en: {
      title: "The Journal, a week at a time",
      body: "A strip at the top of the Journal shows the month’s weeks: pick one and the days slide into place.",
      detail:
        "The week’s money in and out update at once, and one button turns the list over, oldest first or newest first.",
    },
  },
  {
    id: "2026-10-12-recurring-lighter",
    date: "2026-10-12",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "charges",
    fr: {
      title: "Récurrents s’allège",
      body: "Le bloc « Abonnements » quitte Récurrents. Le récap du lundi continue de signaler un abonnement qui commence, augmente ou s’arrête.",
    },
    en: {
      title: "A lighter Recurring",
      body: "The “Subscriptions” block leaves Recurring. The Monday recap still says when a subscription starts, goes up or stops.",
    },
  },
  {
    id: "2026-10-12-about",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "« À propos » : qui fait Pluclair",
      body: "Qui construit Pluclair, pourquoi, et comment essayer la bêta, raconté au fil de la page.",
    },
    en: {
      title: "“About”: who makes Pluclair",
      body: "Who builds Pluclair, why, and how to try the beta, told as the page scrolls.",
    },
  },
  {
    id: "2026-10-12-android-apk",
    date: "2026-10-12",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "L’application Android, depuis le site",
      body: "L’application se télécharge directement sur pluclair.com, en bêta ouverte, sans passer par un store.",
    },
    en: {
      title: "The Android app, from the site",
      body: "The app downloads straight from pluclair.com, as an open beta, without going through a store.",
    },
  },
  {
    id: "2026-10-12-bank-for-everyone",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "month-close",
    fr: {
      title: "La connexion bancaire, ouverte à tous",
      body: "Chacun peut relier sa banque, en lecture seule, avec son propre compte open-banking.io, payé directement à ce service.",
    },
    en: {
      title: "Bank connection, open to everyone",
      body: "Anyone can connect their bank, read-only, with their own open-banking.io account, paid to that service directly.",
    },
  },
  {
    id: "2026-10-10-ask-chat",
    date: "2026-10-10",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "questions",
    featured: true,
    fr: {
      title: "Questions devient une conversation",
      body: "Demandez « où part mon argent ? », puis creusez à la suite. La réponse s’écrit en direct, à partir de vos propres chiffres.",
      detail:
        "Pluclair cherche lui-même dans vos écritures, compare deux mois, fait un calcul ; chaque montant cité est vérifié contre ce que l’app sait, et la conversation reste là quand vous revenez.",
    },
    en: {
      title: "Questions becomes a conversation",
      body: "Ask “where does my money go?”, then dig further. The answer is written live, from your own figures.",
      detail:
        "Pluclair looks through your entries itself, compares two months, runs a sum; every amount it quotes is checked against what the app knows, and the conversation is still there when you come back.",
    },
  },
  {
    id: "2026-10-10-plan-fees",
    date: "2026-10-10",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "plan",
    fr: {
      title: "Les frais, comptés dans chaque projection",
      body: "Les frais de vos placements sont retirés des paliers, de la vue longue et de « Dans un an ».",
    },
    en: {
      title: "Fees, counted in every projection",
      body: "Your investments’ fees come off the milestones, the long view and “A year from now”.",
    },
  },
  {
    id: "2026-10-09-year-ahead",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "plan",
    featured: true,
    fr: {
      title: "« Dans un an », compte par compte",
      body: "Le Plan montre où chacun de vos comptes en sera dans un an, pourquoi, et ce qui changerait si vous versiez plus ou moins.",
      detail:
        "Les livrets pleins, les versements prévus et les événements de l’année sont dessinés sur la même bande ; un interrupteur passe de « Pourquoi » à « Et si ».",
    },
    en: {
      title: "“A year from now”, account by account",
      body: "Plan shows where each of your accounts will be in a year, why, and what would change if you put in more or less.",
      detail:
        "Full savings accounts, planned transfers and the year’s events are drawn on the same band; a switch goes from “Why” to “What if”.",
    },
  },
  {
    id: "2026-10-09-together",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "together",
    featured: true,
    fr: {
      title: "À deux : l’espace commun",
      body: "« Moi · Commun » : un espace pour le compte joint, partagé avec votre conjoint. Chacun garde son propre espace, que l’autre ne voit jamais.",
      detail:
        "Invitez par un lien, passez d’un espace à l’autre d’une touche, et choisissez comment se répartissent les dépenses communes : Le point peut alors compter votre part.",
    },
    en: {
      title: "Together: the shared space",
      body: "“Me · Shared”: a space for the joint account, shared with your partner. Each keeps their own space, which the other never sees.",
      detail:
        "Invite with a link, switch spaces in one tap, and choose how shared spending is split: Le point can then count your part of it.",
    },
  },
  {
    id: "2026-10-09-shared-home",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "property",
    fr: {
      title: "Un logement à deux, et l’Immobilier pour tous",
      body: "Un bien peut appartenir à l’espace commun, avec la part de chacun. L’onglet Immobilier est désormais ouvert à tout le monde.",
    },
    en: {
      title: "A home owned together, and Property for all",
      body: "A property can belong to the shared space, with each partner’s part. The Property tab is now open to everyone.",
    },
  },
  {
    id: "2026-10-09-own-ai",
    date: "2026-10-09",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "questions",
    fr: {
      title: "L’IA de votre choix, sur votre compte",
      body: "Les questions et les lectures passent par votre propre compte OpenRouter, avec le modèle que vous choisissez : Mistral, ChatGPT ou Claude.",
    },
    en: {
      title: "The AI of your choice, on your account",
      body: "Questions and reads go through your own OpenRouter account, with the model you choose: Mistral, ChatGPT or Claude.",
    },
  },
  {
    id: "2026-10-09-android-widget",
    date: "2026-10-09",
    kind: "new",
    platforms: ["phone"],
    feature: "bearing",
    fr: {
      title: "« Il vous reste » sur l’écran d’accueil",
      body: "Un widget Android affiche ce qu’il vous reste, avec un « + » pour noter une dépense sans ouvrir l’app.",
    },
    en: {
      title: "“You have” on the home screen",
      body: "An Android widget shows what you have left, with a “+” to note a spend without opening the app.",
    },
  },
  {
    id: "2026-10-09-feedback",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Envoyer un retour »",
      body: "Une remarque, un bug ? Écrivez directement depuis votre Profil.",
    },
    en: {
      title: "“Send feedback”",
      body: "A remark, a bug? Write straight from your Profile.",
    },
  },
  {
    id: "2026-10-09-feature-pages",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Une page par fonction, avec sa démo",
      body: "Sur le site, chaque écran de Pluclair a sa page, et une démo à manipuler avec un mois d’exemple.",
    },
    en: {
      title: "A page for each feature, with its demo",
      body: "On the site, each of Pluclair’s screens has its own page, and a demo to play with on a sample month.",
    },
  },
  {
    id: "2026-10-09-google-account",
    date: "2026-10-09",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Google demande quel compte utiliser",
      body: "La connexion avec Google propose de choisir le compte à chaque fois, au lieu de reprendre le dernier.",
    },
    en: {
      title: "Google asks which account to use",
      body: "Signing in with Google offers a choice of account every time, instead of taking the last one.",
    },
  },
  {
    id: "2026-10-09-offline-retry",
    date: "2026-10-09",
    kind: "fixed",
    platforms: ["phone"],
    fr: {
      title: "« Réessayer » quand le réseau manque",
      body: "Trois écrans du téléphone restaient vides hors connexion ; ils proposent désormais de réessayer.",
    },
    en: {
      title: "“Try again” when the network drops",
      body: "Three phone screens stayed empty offline; they now offer to try again.",
    },
  },
  {
    id: "2026-10-08-left-to-spend",
    date: "2026-10-08",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    featured: true,
    fr: {
      title: "« Il vous reste », en tête du point",
      body: "Le point s’ouvre sur ce qu’il vous reste jusqu’à votre prochain revenu, recalculé à chaque dépense notée.",
      detail:
        "Ce que vos comptes contiennent, moins les charges qui tombent d’ici là, moins une marge pour ce que vous ne notez jamais. Et « Puis-je me permettre ? » : tapez un montant, Pluclair dit ce qu’il vous resterait, sans rien enregistrer.",
    },
    en: {
      title: "“You have”, at the top of Le point",
      body: "Le point opens on what you have left until your next income, worked out again with every spend you note.",
      detail:
        "What your accounts hold, less the charges due before then, less a margin for what you never note. And “Can I afford it?”: type an amount, and Pluclair says what you would have left, saving nothing.",
    },
  },
  {
    id: "2026-10-08-search",
    date: "2026-10-08",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "ledger",
    fr: {
      title: "Chercher dans tous les mois",
      body: "Depuis le Journal, retrouvez une écriture par commerçant, catégorie ou montant, quel que soit le mois.",
    },
    en: {
      title: "Search every month",
      body: "From the Journal, find an entry by shop, category or amount, whatever the month.",
    },
  },
  {
    id: "2026-10-08-statements",
    date: "2026-10-08",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Plus de relevés bancaires lus",
      body: "L’import lit les fichiers OFX, les CSV en Windows-1252 et ceux qui ont des lignes avant l’en-tête, comme en exportent beaucoup de banques françaises.",
    },
    en: {
      title: "More bank statements read",
      body: "Import reads OFX files, Windows-1252 CSVs and those with lines above the header, as many French banks export them.",
    },
  },
  {
    id: "2026-10-08-bank-steps",
    date: "2026-10-08",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "month-close",
    fr: {
      title: "Relier sa banque, une étape à la fois",
      body: "La connexion bancaire se fait pas à pas, et Pluclair se souvient où vous en êtes, sur le web comme sur le téléphone.",
    },
    en: {
      title: "Connecting a bank, one step at a time",
      body: "The bank connection goes step by step, and Pluclair remembers where you are, on the web and on the phone.",
    },
  },
  {
    id: "2026-10-08-your-year",
    date: "2026-10-08",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Votre année », racontée",
      body: "Début janvier, l’année passée en quelques cartes, avec une image à partager où ne figure aucun montant.",
    },
    en: {
      title: "“Your year”, told",
      body: "In early January, the year gone by in a few cards, with an image to share that shows no amount.",
    },
  },
  {
    id: "2026-10-08-quick-actions",
    date: "2026-10-08",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Un appui long sur l’icône",
      body: "Sur l’icône de l’app : « Ajouter une dépense » ou « Le point », directement.",
    },
    en: {
      title: "A long press on the icon",
      body: "On the app’s icon: “Add a spend” or “Le point”, straight away.",
    },
  },
  {
    id: "2026-10-08-broker-transfer-timing",
    date: "2026-10-08",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Le virement au courtier, au bon moment",
      body: "Deux jours avant le 1er, puis quand le salaire arrive : combien envoyer à votre courtier pour les DCA du mois.",
    },
    en: {
      title: "The broker transfer, at the right time",
      body: "Two days before the 1st, then when the salary arrives: how much to send your broker for the month’s DCAs.",
    },
  },
  {
    id: "2026-10-07-several-accounts",
    date: "2026-10-07",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Plusieurs comptes bancaires",
      body: "Chaque compte reçoit son rôle d’une touche, Le point détaille le solde compte par compte, et chaque ligne du Journal dit d’où elle vient.",
    },
    en: {
      title: "Several bank accounts",
      body: "Each account gets its role in one tap, Le point breaks the balance down by account, and each Journal row says where it came from.",
    },
  },
  {
    id: "2026-10-07-dca-tick",
    date: "2026-10-07",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "wallets",
    fr: {
      title: "Une coche par DCA",
      body: "Chaque DCA dit s’il est payé par le virement au courtier, et Le point résume ce virement en une ligne sous la courbe.",
    },
    en: {
      title: "A tick for each DCA",
      body: "Each DCA says whether the broker transfer pays for it, and Le point sums that transfer up in one line under the curve.",
    },
  },
  {
    id: "2026-10-07-dca-bank-row",
    date: "2026-10-07",
    kind: "fixed",
    platforms: ["web", "phone"],
    fr: {
      title: "Une ligne de la banque n’est plus prise pour un DCA",
      body: "Un achat fait chez le courtier ne passe jamais par la banque ; Pluclair ne lui associe plus une ligne du relevé, et propose de rouvrir celles qui l’avaient été.",
    },
    en: {
      title: "A bank row is no longer taken for a DCA",
      body: "A buy made at the broker never goes through the bank; Pluclair no longer matches a statement row to it, and offers to reopen those it had.",
    },
  },
  {
    id: "2026-10-07-passkey",
    date: "2026-10-07",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Après une passkey, Le point s’ouvre en entier",
      body: "La connexion par passkey menait à un point incomplet ; il se charge désormais entièrement.",
    },
    en: {
      title: "After a passkey, Le point opens in full",
      body: "Signing in with a passkey led to a half-loaded Le point; it now loads in full.",
    },
  },
  {
    id: "2026-10-06-dca-confirm",
    date: "2026-10-06",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "wallets",
    fr: {
      title: "Votre DCA est-il passé ?",
      body: "Pluclair ne voit pas les achats faits dans votre PEA : le lendemain d’un DCA, une notification le demande, et vous confirmez d’une touche.",
    },
    en: {
      title: "Did your DCA go through?",
      body: "Pluclair cannot see buys made inside your PEA: the morning after a DCA, a notification asks, and you confirm in one tap.",
    },
  },
  {
    id: "2026-10-06-broker-transfer",
    date: "2026-10-06",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "wallets",
    fr: {
      title: "Un virement au courtier qui suit vos DCA",
      body: "« Selon vos DCA » : le virement vers votre courtier prend le montant de vos DCA du mois, et le suit quand ils changent.",
    },
    en: {
      title: "A broker transfer that follows your DCAs",
      body: "“Following your DCAs”: the transfer to your broker takes the amount of the month’s DCAs, and follows them when they change.",
    },
  },
  {
    id: "2026-10-06-left-each-month",
    date: "2026-10-06",
    kind: "fixed",
    platforms: ["web", "phone"],
    feature: "charges",
    fr: {
      title: "« Reste chaque mois » ne compte plus les DCA deux fois",
      body: "Les DCA achetés chez le courtier étaient retirés deux fois, et le calendrier les comptait comme des sorties d’argent.",
    },
    en: {
      title: "“Left each month” no longer counts DCAs twice",
      body: "DCAs bought at the broker were taken off twice, and the calendar counted them as money going out.",
    },
  },
  {
    id: "2026-10-05-awaited",
    date: "2026-10-05",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Une charge attendue reste comptée",
      body: "Passé son jour, une charge que la banque n’a pas encore apportée reste dans Le point, marquée « attendue », jusqu’à ce qu’elle arrive.",
    },
    en: {
      title: "An awaited charge stays counted",
      body: "Once its day has passed, a charge the bank has not brought yet stays in Le point, marked “awaited”, until it arrives.",
    },
  },
  {
    id: "2026-10-05-new-site",
    date: "2026-10-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Un nouveau site",
      body: "pluclair.com, redessiné pour tout le monde : la Terre au lever du jour, et l’app racontée au fil du défilement.",
    },
    en: {
      title: "A new site",
      body: "pluclair.com, redesigned for everyone: the Earth at sunrise, and the app told as the page scrolls.",
    },
  },
  {
    id: "2026-10-04-bearing-markers",
    date: "2026-10-04",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Les jours où l’argent part, sur la courbe",
      body: "Chaque jour où de l’argent sort est marqué sur la courbe du point, et la lecture dit ce qui est parti.",
    },
    en: {
      title: "The days money leaves, on the curve",
      body: "Each day money goes out is marked on Le point’s curve, and the reading says what left.",
    },
  },
  {
    id: "2026-10-04-ai-account",
    date: "2026-10-04",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "month-read",
    fr: {
      title: "Votre propre compte d’IA",
      body: "Reliez votre compte OpenRouter : les lectures écrites par l’IA passent par votre clé, avec le modèle que vous choisissez.",
    },
    en: {
      title: "Your own AI account",
      body: "Connect your OpenRouter account: the reads the AI writes go through your key, with the model you choose.",
    },
  },
  {
    id: "2026-10-04-phone-catches-up",
    date: "2026-10-04",
    kind: "better",
    platforms: ["phone"],
    fr: {
      title: "Le téléphone rattrape le web",
      body: "La vue « Par catégorie » du Journal, la bande au-dessus du calendrier et les charges proposées depuis le relevé arrivent sur le téléphone.",
    },
    en: {
      title: "The phone catches up with the web",
      body: "The Journal’s “By category” view, the strip above the calendar and the charges suggested from the statement come to the phone.",
    },
  },
  {
    id: "2026-10-04-placements-phone",
    date: "2026-10-04",
    kind: "better",
    platforms: ["phone"],
    feature: "wallets",
    fr: {
      title: "Placements, repensé sur le téléphone",
      body: "Un résumé en tête, les logos de vos placements, et des lignes plus calmes.",
    },
    en: {
      title: "Investments, rethought on the phone",
      body: "A summary at the top, your holdings’ logos, and quieter rows.",
    },
  },
  {
    id: "2026-10-03-loan-insurance",
    date: "2026-10-03",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "property",
    fr: {
      title: "L’assurance d’un prêt, prélevée à part",
      body: "Si l’assurance de votre prêt est prélevée séparément, Pluclair garde les deux prélèvements distincts et ne les compte qu’une fois.",
    },
    en: {
      title: "A loan’s insurance, debited apart",
      body: "If your loan’s insurance is debited separately, Pluclair keeps the two debits apart and counts them once.",
    },
  },
  {
    id: "2026-10-03-property-progress",
    date: "2026-10-03",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "property",
    fr: {
      title: "Ce qui est déjà à vous",
      body: "Chaque bien montre la part qui vous appartient déjà, et où en est chacun de ses prêts.",
    },
    en: {
      title: "What is already yours",
      body: "Each property shows the share that is already yours, and how far each of its loans has come.",
    },
  },
  {
    id: "2026-10-02-property",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "property",
    featured: true,
    fr: {
      title: "L’immobilier",
      body: "Un onglet pour votre logement : sa valeur estimée d’après les ventes autour, ses prêts et leur tableau d’amortissement, et la part déjà à vous.",
      detail:
        "Les ventes viennent des données publiques (DVF), portées à aujourd’hui par l’indice des prix. Un bien loué montre aussi son mois, son rendement et les loyers demandés autour.",
    },
    en: {
      title: "Property",
      body: "A tab for your home: its value estimated from sales around it, its loans and their schedule, and the share already yours.",
      detail:
        "The sales come from public records (DVF), brought to today by the price index. A let property also shows its month, its yield and the rents asked around it.",
    },
  },
  {
    id: "2026-10-02-recap-warnings",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Le récap du lundi, et des alertes utiles",
      body: "Chaque lundi, votre semaine en quelques chiffres ; et un mot avant un découvert, avant une grosse charge, ou le jour où lire votre solde.",
      detail:
        "Chaque type de notification se coupe à part, dans le Profil, et rien n’arrive entre 21 h et 8 h.",
    },
    en: {
      title: "The Monday recap, and useful warnings",
      body: "Every Monday, your week in a few figures; and a word before an overdraft, before a large charge, or on the day to read your balance.",
      detail:
        "Each kind of notification can be turned off on its own, in Profile, and nothing arrives between 9 pm and 8 am.",
    },
  },
  {
    id: "2026-10-02-undo",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Annuler », partout",
      body: "Une suppression se reprend d’un « Annuler ». Un mois clos et une boîte de revue vidée deviennent de petits moments.",
    },
    en: {
      title: "“Undo”, everywhere",
      body: "A delete can be taken back with “Undo”. A closed month and an emptied review inbox become small moments.",
    },
  },
  {
    id: "2026-10-02-how-computed",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "« Comment c’est calculé ? »",
      body: "Sous le solde du point, une ligne ouvre le détail du calcul, en mots simples.",
    },
    en: {
      title: "“How is it worked out?”",
      body: "Under Le point’s balance, one line opens how the figure is worked out, in plain words.",
    },
  },
  {
    id: "2026-10-02-journal-export",
    date: "2026-10-02",
    kind: "fixed",
    platforms: ["web"],
    feature: "ledger",
    fr: {
      title: "L’export du Journal s’ouvre bien dans un tableur",
      body: "Le fichier exporté s’ouvre proprement dans un tableur, en français.",
    },
    en: {
      title: "The Journal export opens cleanly in a spreadsheet",
      body: "The exported file opens properly in a spreadsheet, in French.",
    },
  },
  {
    id: "2026-10-01-french-first",
    date: "2026-10-01",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Pluclair parle français d’abord",
      body: "Tout est écrit en français, en mots simples ; l’anglais reste disponible dans le Profil.",
    },
    en: {
      title: "Pluclair speaks French first",
      body: "Everything is written in French, in plain words; English stays available in Profile.",
    },
  },
  {
    id: "2026-10-01-charges-fill",
    date: "2026-10-01",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "charges",
    fr: {
      title: "Les charges se remplissent toutes seules",
      body: "Plus de bouton « Appliquer » : ce qui revient chaque mois s’ajoute de lui-même, compté dans le mois prévu même s’il passe un peu avant ou après.",
    },
    en: {
      title: "Charges fill in on their own",
      body: "No more “Apply” button: what comes back every month adds itself, counted in the month it was planned for even when it clears a little early or late.",
    },
  },
  {
    id: "2026-10-01-plan",
    date: "2026-10-01",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "plan",
    fr: {
      title: "Le Plan, autour d’où va votre argent",
      body: "Le Plan est reconstruit : votre matelas, les paliers à venir, et une place pour chacun de vos comptes.",
    },
    en: {
      title: "Plan, built around where your money is heading",
      body: "Plan is rebuilt: your cushion, the milestones ahead, and a place for each of your accounts.",
    },
  },
  {
    id: "2026-09-21-site-french",
    date: "2026-09-21",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Le site, en français",
      body: "pluclair.com se lit en français comme en anglais.",
    },
    en: {
      title: "The site, in French",
      body: "pluclair.com reads in French as well as in English.",
    },
  },
  {
    id: "2026-09-19-category-read",
    date: "2026-09-19",
    kind: "new",
    platforms: ["web"],
    feature: "month-read",
    fr: {
      title: "Une catégorie, lue en quelques phrases",
      body: "Ouvrez une catégorie : douze mois en grille, ce qui se distingue, et une lecture écrite à la demande.",
    },
    en: {
      title: "A category, read in a few sentences",
      body: "Open a category: twelve months in a grid, what stands out, and a read written on request.",
    },
  },
  {
    id: "2026-09-09-bearing",
    date: "2026-09-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Le point",
      body: "Un écran pour savoir où vous en êtes aujourd’hui, et comment le mois va finir.",
    },
    en: {
      title: "Le point",
      body: "One screen to see where you stand today, and how the month will end.",
    },
  },
  {
    id: "2026-09-09-two-languages",
    date: "2026-09-09",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "L’app en français et en anglais",
      body: "Pluclair se lit dans les deux langues, et se souvient de celle que vous avez choisie.",
    },
    en: {
      title: "The app in French and English",
      body: "Pluclair reads in both languages, and remembers the one you chose.",
    },
  },
  {
    id: "2026-09-07-android-push",
    date: "2026-09-07",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Les notifications sur Android",
      body: "Les rappels et les alertes arrivent aussi sur le téléphone.",
    },
    en: {
      title: "Notifications on Android",
      body: "Reminders and warnings reach the phone too.",
    },
  },
  {
    id: "2026-09-02-bank",
    date: "2026-09-02",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "month-close",
    featured: true,
    fr: {
      title: "La banque, en lecture seule",
      body: "Un mois se clôt contre le solde de votre banque, et ce qui a filé sans être noté apparaît.",
      detail:
        "Pluclair lit vos mouvements, reconnaît un commerçant comme la banque l’écrit, et ne range une ligne que là où vous l’avez déjà rangée vous-même. Il ne peut rien virer ni payer.",
    },
    en: {
      title: "The bank, read-only",
      body: "A month closes against your bank’s balance, and what slipped by unrecorded shows up.",
      detail:
        "Pluclair reads your movements, recognises a shop the way the bank spells it, and files a row only where you have filed one yourself. It cannot transfer or pay anything.",
    },
  },
  {
    id: "2026-09-01-import",
    date: "2026-09-01",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Importer un relevé",
      body: "Déposez le CSV de votre banque : les opérations du mois entrent d’un coup.",
    },
    en: {
      title: "Import a statement",
      body: "Drop your bank’s CSV: the month’s transactions come in at once.",
    },
  },
  {
    id: "2026-09-01-web-push",
    date: "2026-09-01",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Des notifications dans le navigateur",
      body: "Installée depuis le navigateur, l’app peut vous prévenir comme une application.",
    },
    en: {
      title: "Notifications in the browser",
      body: "Installed from the browser, the app can notify you like any other.",
    },
  },
  {
    id: "2026-08-13-passkeys",
    date: "2026-08-13",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Passkeys et déverrouillage biométrique",
      body: "Connectez-vous sans mot de passe, et rouvrez l’app avec votre visage ou votre empreinte.",
    },
    en: {
      title: "Passkeys and biometric unlock",
      body: "Sign in without a password, and reopen the app with your face or your fingerprint.",
    },
  },
  {
    id: "2026-08-11-pluclair",
    date: "2026-08-11",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Il s’appelle Pluclair",
      body: "Votre argent, plus clair chaque mois.",
    },
    en: {
      title: "It is called Pluclair",
      body: "Your money, clearer every month.",
    },
  },
  {
    id: "2026-07-23-mobile-app",
    date: "2026-07-23",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "L’app mobile",
      body: "Le même compte dans la poche, avec les mêmes chiffres.",
    },
    en: {
      title: "The mobile app",
      body: "The same account in your pocket, with the same figures.",
    },
  },
  {
    id: "2026-06-15-first-line",
    date: "2026-06-15",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "La première ligne de code",
      body: "Un tableau de bord, des catégories, et les opérations qui reviennent chaque mois.",
    },
    en: {
      title: "The first line of code",
      body: "A dashboard, categories, and the transactions that come back every month.",
    },
  },
];

/**
 * The figures the page states about the list, counted from the repository
 * by `scripts/changelog-draft.mjs` when an entry is added — not at build,
 * where Vercel's shallow clone would count a handful.
 */
export const CHANGELOG_STATS = {
  /** `git rev-list --count main` on `asOf`. */
  commits: 917,
  /** The repository's first commit. */
  since: "2026-06-15",
  asOf: "2026-10-12",
} as const;

/**
 * « Bientôt »: what is being built and not open yet, in the future tense
 * and nowhere else. An item leaves this list the day its entry is written.
 */
export const ROADMAP: readonly RoadmapItem[] = [
  {
    id: "blog-guides",
    fr: {
      title: "Le blog : des guides pratiques",
      body: "Le jour de lecture, la clôture du mois, le PEA, le CTO, l’assurance-vie et le PER, expliqués simplement.",
    },
    en: {
      title: "The blog: practical guides",
      body: "The reading day, closing the month, and the PEA, CTO, assurance-vie and PER, explained simply.",
    },
  },
  {
    id: "entraide",
    fr: {
      title: "Entraide",
      body: "Posez vos questions aux autres personnes qui utilisent Pluclair, et répondez aux leurs.",
    },
    en: {
      title: "Entraide",
      body: "Ask your questions to other people who use Pluclair, and answer theirs.",
    },
  },
  {
    id: "stores",
    fr: {
      title: "Dans les stores",
      body: "Pluclair sur Google Play et l’App Store. En attendant, l’application Android se télécharge sur ce site.",
    },
    en: {
      title: "In the stores",
      body: "Pluclair on Google Play and the App Store. Until then, the Android app downloads from this site.",
    },
  },
];
