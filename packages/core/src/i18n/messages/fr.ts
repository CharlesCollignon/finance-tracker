import type { Messages } from "./en";
import { removalFr } from "./removal.fr";
import { planPhoneFr } from "./plan-phone.fr";
import { planWebFr } from "./plan-web.fr";
import { futurePlanFr } from "./future-plan.fr";
import { accountsFr } from "./accounts.fr";
import { placementsWebFr } from "./placements-web.fr";
import { placementsPhoneFr } from "./placements-phone.fr";
import { moreScreensFr } from "./more-screens.fr";
import { formPickersFr } from "./form-pickers.fr";
import { reviewScreensFr } from "./review-screens.fr";
import { planScreenFr } from "./plan-screen.fr";
import { homeScreenFr } from "./home-screen.fr";
import { actionsFr } from "./actions.fr";
import { propertyFr } from "./property.fr";

/**
 * What the app says, in French.
 *
 * Annotated `Messages` rather than inferred, which is what makes a missing
 * key a compile error. Keep the groups in the same order as `./en` so the two
 * can be read side by side; that is the only way a reviewer can tell whether
 * a sentence still means what it meant.
 *
 * French typography is observed: a no-break space before `?` and `:`,
 * written as `\u00A0` rather than pasted in as the character itself so it
 * survives an editor that trims whitespace or normalises Unicode — and no
 * capital letter on a language name: "en français", not "en Français". The
 * endonyms in `LOCALE_LABELS` are the exception, because a picker names a
 * language the way that language names itself.
 *
 * The domain vocabulary in `CONTEXT.md` was chosen word by word in English —
 * "review inbox" over "queue", "kept" over "saved". The French terms below
 * deserve the same care, and where a screen's noun is still unsettled it is
 * better to leave the group untranslated and fall back to English than to
 * ship a word the glossary would refuse.
 */
export const fr: Messages = {
  nav: {
    bearing: "Le point",
    ledger: "Journal",
    charges: "Récurrents",
    plan: "Plan",
    wallets: "Placements",
    property: "Immobilier",
    profile: "Profil",
    ledgerList: "Liste",
    ledgerCalendar: "Calendrier",
    ledgerByCategory: "Par catégorie",
    walletsPositions: "Comptes",
    walletsAnalysis: "Analyse",
    walletsLookThrough: "Composition",

    waiting: "{count} en attente",
  },

  pages: {
    categories: "Catégories",
    import: "Importer",
    bank: "Banque",
  },

  profile: {
    noName: "Pas encore de nom",
    notSet: "Non renseigné",
    accountSection: "Compte",
    name: "Nom",
    displayName: "Nom affiché",
    namePlaceholder: "Votre nom",
    saving: "Enregistrement…",
    save: "Enregistrer",
    email: "E-mail",
    signedInWith: "Connecté avec",
    moneySection: "Argent",
    moneyFooter: "La devise change le symbole, pas les montants.",
    categories: "Catégories",
    currency: "Devise",
    securitySection: "Sécurité",
    securityFooterWeb:
      "Connexion sans mot de passe, liée à ce site et stockée sur votre appareil.",
    appUnlock: "Déverrouillage",
    unlockWithBiometrics: "Déverrouiller par biométrie",
    passkeys: "Clés d'accès",
    notificationsSection: "Notifications",
    notificationsFooterWeb:
      "Le premier interrupteur ne concerne que ce navigateur. Les autres valent pour tous vos appareils.",
    notificationsFooterMobile:
      "Le premier interrupteur ne concerne que ce téléphone. Les autres valent pour tous vos appareils.",
    onThisPhone: "Sur ce téléphone",
    dataSection: "Données",
    deleteAllData: "Supprimer toutes les données",
    deleteConfirmLabel: "Tapez DELETE pour confirmer",
    deleteConfirmPlaceholder: "Tapez DELETE",
    deleting: "Suppression…",
    deleteAllMyData: "Supprimer toutes mes données",
    deleteAccount: "Supprimer le compte",
    deleteMyAccount: "Supprimer mon compte",
    saved: "Enregistré",
    notificationsOff: "Notifications désactivées",
    onThisBrowser: "Sur ce navigateur",
    pushChecking: "Vérification…",
    pushNotConfigured: "Pas encore disponible ici",
    pushUnavailable: "Indisponible ici",
    pushUnsupported: "Ce navigateur ne peut pas recevoir de notifications.",
    pushInstallFirst:
      "Sur iPhone et iPad, ajoutez d'abord Pluclair à l'écran d'accueil\u00A0: Safari n'autorise les notifications que pour les apps installées.",
    pushBlocked:
      "Les notifications sont bloquées pour ce site dans les réglages du navigateur.",
    pushNotAllowed: "Les notifications n'ont pas été autorisées.",
    pushRefused: "Ce navigateur a refusé l'abonnement aux notifications.",
    notificationsOn: "Notifications activées",
    remindersOnly:
      "Rappels activés. Cette version ne peut pas recevoir les alertes de votre banque.",
    dataDeleted: "Données supprimées",
    deleteAccountUnavailable:
      "La suppression du compte n'est pas encore possible depuis le téléphone. Supprimez vos données ci-dessus, puis écrivez-nous.",
    biometricsUnavailable: "Pas sur cet appareil",
    biometricsNeedsSetup: "À configurer dans les réglages du téléphone",
    wipeBlurb:
      "Vos opérations, ponctuelles et récurrentes, vos placements et vos catégories. Votre compte reste.",
    closeBlurb: "Définitif. Tout ce qui précède part avec.",
    deleteNeedsServiceKey:
      "La suppression du compte exige SUPABASE_SERVICE_ROLE_KEY sur le serveur (en local\u00A0: .env.local, en production\u00A0: les variables d'environnement Vercel).",
  },

  biometric: {
    unlockTitle: "Déverrouiller",
    unlockBody: "Utilisez Face ID ou votre empreinte pour ouvrir Pluclair.",
    unlockPrompt: "Déverrouiller Pluclair",
    enablePrompt: "Activer le déverrouillage biométrique",
    waiting: "Un instant…",
    cancelLabel: "Annuler",
    cancelled: "Annulé.",
    failed: "Le déverrouillage biométrique a échoué.",
    couldNotUnlock: "Impossible de déverrouiller.",
    needsSetup:
      "Configurez d'abord Face ID ou une empreinte dans les réglages du téléphone.",
    couldNotEnable: "Impossible d'activer le déverrouillage biométrique.",
  },
  reminders: {
    channelName: "Rappels",
    dueTomorrowTitle: "{name} demain",
    dueTodayTitle: "{name} aujourd'hui",
    dueBody: "{amount} à prévoir.",
    monthOpenTitle: "Un nouveau mois commence",
    monthOpenBody:
      "Vos opérations récurrentes y sont déjà. Voyez ce qu'il vous restera.",
  },
  passkeys: {
    none: "Aucune clé d'accès pour l'instant.",
    unnamed: "Clé d'accès",
    added: "Ajoutée le {date}",
    working: "Un instant…",
    add: "Ajouter une clé d'accès",
    removeBody:
      "Retirer {name}\u00A0? Vous pourrez l'ajouter à nouveau plus tard.",
    failed: "La demande de clé d'accès a échoué.",
    unsupported: "Les clés d'accès ne sont pas disponibles sur cet appareil.",
    cancelled: "Demande de clé d'accès annulée.",
  },

  ledger: {
    csv: {
      date: "Date",
      category: "Catégorie",
      type: "Type",
      amount: "Montant (€)",
      note: "Note",
    },
    emptyTitle: "Aucune opération ce mois-ci",
    emptyBody:
      "Ajoutez ce qui s'est passé. Vos opérations récurrentes remplissent chaque mois d'elles-mêmes.",
    searchPlaceholder: "Chercher une catégorie ou une note…",
    searchLabel: "Chercher dans les opérations",
    filterByCategory: "Filtrer par catégorie",
    filterTransactions: "Filtrer les opérations",
    allCategories: "Toutes les catégories",
    selectDone: "Terminé",
    select: "Sélectionner",
    clearAll: "Tout désélectionner",
    selectAll: "Tout sélectionner",
    exportCsv: "Exporter ces opérations en CSV",
    importCsv: "Importer un relevé CSV",
    optionsToggle: "Filtres et actions",
    filtersOn: {
      one: "{count} filtre actif",
      other: "{count} filtres actifs",
    },
    exportShort: "Exporter",
    importShort: "Importer",
    exportNothing: "Rien à exporter pour cette vue",
    noMatchTitle: "Aucune opération correspondante",
    noMatchBody: "Essayez une autre recherche ou un autre filtre.",
    entryCount: {
      one: "{count} opération",
      other: "{count} opérations",
    },
    shownOfTotal: {
      one: "{count} opération sur {total}",
      other: "{count} opérations sur {total}",
    },
    exported: {
      one: "{count} opération exportée",
      other: "{count} opérations exportées",
    },
    in: "Entrées",
    out: "Sorties",
    clearFilters: "Effacer les filtres",
    selectRow: "Sélectionner {name}",
    editRow: "Modifier {name}",
    theNewCategory: "la nouvelle catégorie",
    deleted: {
      one: "{count} opération supprimée",
      other: "{count} opérations supprimées",
    },
    moved: {
      one: "{count} opération déplacée vers {name}",
      other: "{count} opérations déplacées vers {name}",
    },
    add: "Ajouter",
    addTransaction: "Ajouter une opération",
    importCsvShort: "Importer un CSV",
    clearSearch: "Effacer la recherche",
    allTypes: "Tous les types",
    restore: "Remettre",
    restored: "Remis dans le mois\u00A0: {name}",
    addedForToday: "Ajouté pour aujourd'hui\u00A0: {name}",
    skippedCount: {
      one: "{count} opération prévue retirée de ce mois-ci",
      other: "{count} opérations prévues retirées de ce mois-ci",
    },
    skippedBody:
      "Retirées de ce mois. Remettez-en une pour qu'elle compte à nouveau.",
    review: "Vérifier",
    fillThisMonth: "Remplir ce mois-ci",
    selectHint: "Touchez pour sélectionner · Terminé pour quitter",
    editHint: "Touchez pour modifier · appui long pour sélectionner",
    needsCategory: {
      one: "{count} opération attend une catégorie",
      other: "{count} opérations attendent une catégorie",
    },
    needsCategoryAction: {
      one: "{count} opération attend une catégorie. Vérifier",
      other: "{count} opérations attendent une catégorie. Vérifier",
    },
    repeatTitle: "Répéter aujourd'hui\u00A0?",
    repeatBody: "Ajoute un autre {category} de {amount} daté d'aujourd'hui.",
    repeatConfirm: "Ajouter pour aujourd'hui",
    planned: "À venir",
    awaited: "Pas encore passé",
    toConfirm: {
      one: "{count} mouvement à confirmer sur Le point",
      other: "{count} mouvements à confirmer sur Le point",
    },
    receivedOn: "Reçu le {date}",
    paidOn: "Payé le {date}",
    recurringEntry: "Opération récurrente",
  },

  importer: {
    statusReady: "Prêt",
    statusSkipped: "Ignoré",
    statusProblem: "Problème",
    heading: "Importer un relevé bancaire",
    checkColumns: "Vérifiez les colonnes",
    columnDate: "Date",
    columnDescription: "Libellé",
    columnAmount: "Montant",
    columnCategory: "Catégorie",
    columnStatus: "État",
    debitColumn: "Argent sorti (débit)",
    creditColumn: "Argent entré (crédit)",
    notInThisFile: "Absent de ce fichier",
    reading: "Lecture…",
    continue: "Continuer",
    back: "Retour",
    importing: "Import…",
    importCount: "Importer {count}",
    rowsReady: "{ready} lignes prêtes sur {total}",
    alreadyInLedger: {
      one: "{count} déjà dans votre journal. ",
      other: "{count} déjà dans votre journal. ",
    },
    couldNotRead: {
      one: "{count} illisible. ",
      other: "{count} illisibles. ",
    },
    needCategory: {
      one: "{count} attend encore une catégorie.",
      other: "{count} attendent encore une catégorie.",
    },
    everyRowCategorised: "Toutes les lignes ont une catégorie.",
    chooseFile: "Choisir un fichier",
    chooseCategory: "Choisir une catégorie",
    firstRowIsHeader: "La première ligne contient les noms de colonnes",
    setRemainingSpending: "Mettre toutes les dépenses restantes dans",
    setRemainingIncome: "Mettre tous les revenus restants dans",
    imported: {
      one: "{count} opération importée",
      other: "{count} opérations importées",
    },
    intro:
      "Exportez un CSV depuis votre banque et déposez-le ici. Le fichier est lu dans votre navigateur — rien n'est envoyé, et rien n'est enregistré tant que vous n'avez pas relu chaque ligne.",
    dropFile: "Déposez un fichier .csv ici",
    fileTooLarge: "Ce fichier dépasse 5\u00A0Mo — est-ce le bon export\u00A0?",
    fileNoRows: "Ce fichier ne contient aucune ligne.",
    fileUnreadable: "Ce fichier n'a pas pu être ouvert.",
    introPhone:
      "Exportez un CSV depuis votre banque et choisissez-le ici. Le fichier est lu sur votre téléphone — rien n'est envoyé, et rien n'est enregistré tant que vous n'avez pas relu chaque ligne.",
    firstRows: "Les premières lignes, telles que lues",
    categoryForRow: "Catégorie pour {description}",
    noRowsRead: "Aucune ligne n'a pu être lue dans ce fichier.",
    columnNumber: "Colonne {number}",
    rowCount: { one: "{count} ligne", other: "{count} lignes" },
    guesses: "Voici ce que l'application a deviné. Corrigez ce qui ne va pas.",
    spendingIs: "Dans ce fichier, les dépenses sont",
    signNegative: "Négatives (−12,50)",
    signPositive: "Positives (12,50)",
    categoryForLine: "Catégorie pour la ligne {line}",
    choose: "Choisir…",
  },

  plan: {
    capRemoved: "Budget supprimé",
  },

  recurring: {
    on: "Actif",
    off: "Inactif",
    addTitle: "Nouvelle opération récurrente",
    editTitle: "Modifier l'opération récurrente",
    addTitleMobile: "Nouvelle opération récurrente",
    editTitleMobile: "Modifier l'opération récurrente",
    close: "Fermer",
    category: "Catégorie",
    description: "Libellé",
    descriptionPlaceholder: "ex. Netflix, salle de sport, achat d'ETF mensuel",
    schedule: "Échéance",
    monthly: "Mensuel",
    weekly: "Hebdomadaire",
    yearly: "Annuel",
    dayOfMonth: "Jour du mois",
    dayOfWeek: "Jour de la semaine",
    startsOn: "Commence le",
    endsOn: "Se termine le",
    noStartDate: "Pas de date de début",
    noEndDate: "Pas de date de fin",
    amount: "Montant",
    annualAmount: "Montant annuel",
    amountType: "Type de montant",
    fixedAmount: "Montant fixe en EUR",
    sharesTimesPrice: "Parts × cours",
    followsPurchases: "Selon vos DCA",
    followsPurchasesNote:
      "Ce que vos DCA du mois suivant vont coûter, 5\u00A0% de plus sur ceux achetés en parts, arrondi aux 50\u00A0€ supérieurs. Recalculé chaque jour, et dès qu'un DCA change.",
    followsPurchasesNow: "Aujourd'hui\u00A0: {amount}",
    followsPurchasesNew: "Calculé à l'enregistrement.",
    followsPurchasesRow: "Selon vos DCA du mois suivant",
    shareCount: "Nombre de parts",
    wholeSharesOnly: "Saisissez un nombre entier de parts",
    estimatedAmount: "Montant estimé",
    fetchingPrice: "Récupération du cours…",
    perSharePrice: "@ {price} / part",
    convertedFrom: "({amount} converti)",
    descriptionOptional: "Libellé (facultatif)",
    monthOfYear: "Mois",
    activePeriod: "Période d'activité (facultative)",
    activePeriodNote:
      "Laissez les deux vides pour que ça tourne jusqu'à ce que vous l'arrêtiez. Renseignez les deux pour un échéancier fixe\u00A0: une taxe foncière étalée sur plusieurs mois, par exemple.",
    saving: "Enregistrement…",
    save: "Enregistrer",
    delete: "Supprimer",
    deleteItem: "Supprimer l'opération récurrente",
    deleteExplanation:
      "Supprimer cette opération récurrente\u00A0? Ce qu'elle a écrit pour les jours passés reste dans votre journal\u00A0; ce qu'elle avait écrit à l'avance disparaît avec elle.",
    deleting: "Suppression…",
    confirmDelete: "Confirmer la suppression",
    savedHint: "Opération récurrente enregistrée",
    updatedHint: "Opération récurrente mise à jour",
    deletedHint: "Opération récurrente supprimée",
    applyTo: "Appliquer ce changement à",
    scopeUpcoming: "À venir seulement",
    scopeUpcomingHint: "Ce qui est déjà enregistré ({dates}) reste tel quel.",
    scopeThisMonth: "Ce mois-ci aussi",
    scopeThisMonthHint: "Met aussi à jour {dates}.",
    pastMonthsNote: "Les mois passés ne changent jamais.",
    startFrom: "Début",
    startNow: "À partir de maintenant",
    startNowHint: "Sa première ligne est la prochaine date à venir.",
    startThisMonth: "Inclure ce mois-ci",
    startThisMonthHint: {
      one: "Enregistre aussi {dates}, déjà passé.",
      other: "Enregistre aussi {dates}, déjà passés.",
    },
    brokerDcaNote:
      "Les achats chez le courtier sont suivis pour information mais ne réduisent pas votre budget restant.",
    bitstackNote:
      "Achat hebdomadaire à montant fixe en EUR sur Bitstack. La valeur de marché dans Placements utilise votre total BTC × le cours BTC/EUR en direct.",
    sharesNote:
      "Choisissez votre ETF et le nombre de parts. Cherchez par nom ou par ISIN (ex. LU1681043599). L'application récupère le cours en direct et calcule le montant en euros à l'enregistrement, puis à chaque fois que l'opération récurrente est écrite dans un mois.",
    yearlyNote:
      "Compté comme une part mensuelle dans votre budget (annuel ÷ 12). Le paiement complet est enregistré une fois, le mois dû.",
    trackedFund: "ETF ou fonds suivi",
    trackedFundNote:
      "Un versement fixe en euros\u00A0: indiquez l'ETF qu'il achète. Dans Placements, saisissez le nombre total de parts que vous détenez pour une valeur de marché en direct.",
    bitcoinTitle: "Achat récurrent de bitcoin",
    bitcoinNote:
      "Chaque achat convertit votre montant en euros en BTC. Saisissez votre solde BTC total dans Placements pour une valeur en direct.",
  },

  instrument: {
    label: "ETF ou fonds",
    resultsLabel: "Instruments correspondants",
    searching: "Recherche…",
    isinKeepTyping: "Un ISIN fait 12 caractères — continuez…",
    noResults:
      "Aucun instrument trouvé. Essayez un nom ou un ISIN de 12 caractères.",
  },

  recurringProposals: {
    lead: {
      one: "{count} opération de votre relevé a l'air de se répéter.",
      other: "{count} opérations de votre relevé ont l'air de se répéter.",
    },
    everyWeek: "chaque semaine",
    everyMonth: "chaque mois",
    everyYear: "chaque année",
    seenTimes: { one: "vue {count} fois", other: "vue {count} fois" },
    accept: "Ajouter",
    refuse: "Pas celle-ci",
    added: "Ajoutée",
  },

  transaction: {
    editTitle: "Modifier l'opération",
    close: "Fermer",
    category: "Catégorie",
    amount: "Montant",
    date: "Date",
    note: "Note (facultatif)",
    notePlaceholder: "Libellé",
    selectCategory: "Choisir une catégorie",
    saving: "Enregistrement…",
    saveTransaction: "Enregistrer l'opération",
    saved: "Opération enregistrée",
    duplicating: "Duplication…",
    duplicateToToday: "Dupliquer à aujourd'hui",
    duplicated: "Dupliquée à aujourd'hui",
    deleteTransaction: "Supprimer l'opération",
    deleting: "Suppression…",
    confirmDelete: "Oui, supprimer",
    deleted: "Opération supprimée",
    moveBack: "Le remettre au {date}",
    countsForReceived: "Compte pour {month} — reçu le {date}.",
    countsForPaid: "Compte pour {month} — payé le {date}.",
    deleteExplanation: "Supprimer définitivement cette opération\u00A0?",
    deleteChargeExplanation:
      "Supprimer cette ligne\u00A0? Elle vient d'une opération récurrente et ne sera pas rajoutée ce mois-ci. L'opération récurrente continue les mois suivants.",
    cancel: "Annuler",
  },

  charges: {
    blurb: "Ce que vous savez déjà devoir payer, chaque mois.",
    tileLeft: "Reste",
    leftEachMonth: "Reste chaque mois",
    keptShare: "Vous gardez {percent} de vos revenus",
    ofIncomeBefore: "sur",
    ofIncomeAfter: "de revenus",
    perMonth: "Par mois",
    perMonthSuffix: " / mois",
    noIncomeYet: "Aucun revenu récurrent — ajoutez-en un et ceci se remplira.",
    ofWhichMovedBefore: "dont",
    ofWhichMovedAfter: "versés sur vos placements — suivis, mais pas dépensés.",
    nothingHereYet:
      "Rien ici pour l'instant\u00A0: « Ajouter une opération récurrente » en crée une.",
    editNamed: "Modifier {name}",
    addTo: "Ajouter dans {group}",
    addCharge: "Ajouter une opération récurrente",
    kindOfCharge: "Type d'opération récurrente",
    activate: "Activer",
    deactivate: "Désactiver",
    toggleFor: "{action} {name}",
    fixedToBitcoin: "Montant fixe en EUR → Bitcoin",
    emptyTitle: "Aucune opération récurrente pour l'instant",
    emptyBody:
      "Loyer, abonnements, un virement mensuel vers l'épargne — tout ce que vous savez déjà à venir.",
    emptyTitleMobile: "Qu'est-ce qui revient chaque mois\u00A0?",
    emptyBodyMobile: "Loyer, salaire, abonnements, un achat d'ETF mensuel.",
    remindTitle: "Être prévenu avant les grosses dépenses\u00A0?",
    remindBody:
      "La veille d'une grosse opération ou d'une annuelle, le jour du bilan, et un récap le lundi. Rien la nuit, et chaque type se coupe dans le profil.",
    remindYes: "Me rappeler",
    remindNo: "Non merci",
    remindNeedsPermission: "Les rappels demandent l'autorisation de notifier",
    remindOn: "Notifications activées",
  },

  add: {
    title: "Ajouter",
    open: "Ajouter une opération",
    kind: "Ce que vous ajoutez",
    transaction: "Une fois",
    charge: "Récurrente",
    transactionHint: "Quelque chose qui s'est passé une fois.",
    chargeHint: "Quelque chose qui revient — loyer, salaire, abonnement.",
  },

  planned: {
    body: "Prévu le {date}. Il sera enregistré le jour même.",
    awaitedBody: "Prévu le {date}, pas encore passé à la banque.",
    recordNow: "L'enregistrer maintenant",
    recordNowHint: "C'est déjà arrivé — l'ajoute à la date d'aujourd'hui.",
    skip: "Passer cette date",
    editCharge: "Modifier l'opération récurrente",
    recorded: "Enregistré à la date d'aujourd'hui",
    skipped: "Passé pour le {date}",
    undo: "Annuler",
  },

  monthFill: {
    added: {
      one: "{count} opération récurrente ajoutée à ce mois",
      other: "{count} opérations récurrentes ajoutées à ce mois",
    },
  },

  quickAdd: {
    close: "Fermer",
    deleteLastDigit: "Effacer le dernier chiffre",
    date: "Date",
    category: "Catégorie",
    searchCategories: "Chercher une catégorie",
    searchCategoriesPlaceholder: "Chercher une catégorie…",
    changeCategory: "{name} — changer",
    notePlaceholder: "C'était pour quoi\u00A0?",
    saving: "Enregistrement…",
    save: "Enregistrer",
    saveAndAnother: "Enregistrer et en ajouter une autre",
    saved: "Opération enregistrée",
    savedOffline:
      "Enregistrée sur cet appareil — elle sera synchronisée dès le retour en ligne",
    amount: "Montant",
    note: "Note",
    anotherDay: "Un autre jour",
    allCategories: "Toutes les catégories",
    noCategoryMatch: "Aucune catégorie ne correspond à «\u00A0{query}\u00A0».",
    savedKeepGoing: {
      one: "{count} enregistrée — continuez.",
      other: "{count} enregistrées — continuez.",
    },
  },

  onboarding: {
    progress: "Progression de la configuration",
    welcomeTitle: "Bienvenue sur Pluclair",
    welcomeBody:
      "Deux minutes maintenant, et Le point affichera de vrais chiffres au lieu de zéros.",
    currencyTitle: "Dans quelle devise pensez-vous\u00A0?",
    currencyBody:
      "Tous les montants de l'application sont affichés ainsi. Vous pourrez changer plus tard dans Profil.",
    incomeTitle: "Qu'est-ce qui entre\u00A0?",
    incomeBody:
      "Vos revenus mensuels sont la référence de tout le reste. Ajoutez-les une fois et ils reviennent chaque mois.",
    expensesTitle: "Qu'est-ce qui sort\u00A0?",
    expensesBody:
      "Loyer, abonnements, factures — ce que vous savez déjà devoir payer. C'est ce qui rend la projection utile.",
    monthlyAmount: "Montant mensuel",
    dayOfMonth: "Jour du mois",
    category: "Catégorie",
    continue: "Continuer",
    back: "Retour",
    skipForNow: "Passer pour l'instant",
    saving: "Enregistrement…",
    addIncome: "Ajouter le revenu",
    incomeAdded: "Revenu ajouté",
    adding: "Ajout…",
    addThisOne: "Ajouter celle-ci",
    addedCount: {
      one: "{count} ajoutée — ajoutez-en une autre ou terminez ci-dessous.",
      other: "{count} ajoutées — ajoutez-en une autre ou terminez ci-dessous.",
    },
    reopen: "Prise en main",
    templateAdded: "Ajouté\u00A0: {name}",
  },

  categories: {
    blurb:
      "Les catégories rangent toutes vos opérations, ponctuelles ou récurrentes. Une catégorie archivée garde son historique mais n'apparaît plus à la saisie.",
    addCategory: "Ajouter une catégorie",
    newCategory: "Nouvelle catégorie",
    editCategory: "Modifier la catégorie",
    close: "Fermer",
    back: "Retour",
    name: "Nom",
    namePlaceholder: "Courses",
    type: "Type",
    icon: "Icône",
    iconPicker: "Icône de la catégorie",
    saving: "Enregistrement…",
    saveCategory: "Enregistrer la catégorie",
    saved: "Catégorie enregistrée",
    added: "Catégorie ajoutée",
    updated: "Catégorie mise à jour",
    archived: "Archivée",
    archivedToast: "Catégorie archivée",
    restoredToast: "Catégorie restaurée",
    archiveNamed: "Archiver {name}",
    restoreNamed: "Restaurer {name}",
    editNamed: "Modifier {name}",
    deleteNamed: "Supprimer {name}",
    confirmDelete: "Supprimer",
    deleted: "Catégorie supprimée",
    deleteWarning:
      "Si des opérations l'utilisent, ponctuelles ou récurrentes, archivez-la plutôt.",
    emptyTitle: "Ajoutez votre première catégorie",
    emptyBody: "Revenus, dépenses, épargne, investissements.",
    countsTowardBudget: "Compte dans le budget mensuel",
    countsHintIncome:
      "Décochez pour de l'argent qui revient plutôt qui entre — un ami qui règle sa part, un remboursement. Il est retiré des dépenses du mois au lieu d'être compté comme un revenu.",
    countsHintSavings:
      "Décochez pour de l'argent qui ressort de l'épargne — un virement vers votre compte courant. Il est retiré de ce que vous avez mis de côté, et sort de la réserve derrière l'autonomie.",
    countsHintInvestment:
      "Décochez pour un achat de placement suivi hors budget (par exemple des achats financés par un virement chez le courtier).",
    countsHintExpense:
      "Décochez pour un virement que vous ne voulez pas voir dans le bilan du mois.",
    excludedFromTotals: "Hors des totaux",
    notCountingInvestment: "Suivi",
    notCountingSavings: "Retrait",
    notCountingIncome: "Remboursement",
  },

  categoryFindings: {
    driftUp: {
      one: "monte depuis {months} mois",
      other: "monte depuis {months} mois d'affilée",
    },
    driftDown: {
      one: "baisse depuis {months} mois",
      other: "baisse depuis {months} mois d'affilée",
    },
    oddMonthHigh: "{month} sort nettement au-dessus d'un mois normal ici",
    oddMonthLow: "{month} sort nettement en dessous d'un mois normal ici",
    goneQuiet: {
      one: "rien enregistré depuis {months} mois, après une série régulière",
      other: "rien enregistré depuis {months} mois, après une série régulière",
    },
    appeared: "nouveau depuis {month}, et régulier depuis",
    // Ni "cher" ni "toutes les années" : la première disait d'un salaire ou
    // d'une épargne qu'ils coûtaient, la seconde n'est pas ce qu'on dit.
    everyYear: "{month} sort au-dessus d'un mois normal ici chaque année",
    everyYearLow: "{month} sort en dessous d'un mois normal ici chaque année",
    weightPerMonth: "{amount} par mois",
    weightOnce: "{amount}",
    bandTitle: "Ce qui a bougé",
    bandEmpty: "Rien n'a assez bougé pour mériter une phrase.",
    rerank: "Faire classer par l'IA",
    reranked: "Classé par l'IA",
    rerankStale: "Les chiffres ont bougé depuis ce classement.",
  },

  categoryScreen: {
    empty: "Rien à revoir pour l'instant",
    emptyBody:
      "Dès que quelques mois auront des opérations, la série de chaque catégorie apparaîtra ici.",
    normal: "{amount} dans un mois normal",
    normalShifted: "{amount} par période de paie",
    periodShifted:
      "Ces mouvements tombent de part et d'autre d'une fin de mois\u00A0: chacun est compté dans la période à laquelle il appartient. Un mois ici peut différer du même mois dans le Journal.",
    groupExpense: "Ce qui sort",
    groupIncome: "Ce qui entre",
    groupSavings: "Épargne et placements",
    groupInvestment: "Investi",
    open: "Ouvrir {name}",
    close: "Fermer",
    behindThisMonth: "Derrière {month}",
    seeInLedger: "Tout voir dans le Journal",
    months: "{count} derniers mois",
  },

  spendStrip: {
    more: {
      one: "{count} autre",
      other: "{count} autres",
    },
    label: {
      one: "Dépenses réparties sur {count} catégorie",
      other: "Dépenses réparties sur {count} catégories",
    },
  },

  wallets: {
    refreshQuotes: "Actualiser les cours",
    refreshingQuotes: "Actualisation…",
    quotesRefreshed: "Cours actualisés",
    marketValue: "Valeur aujourd'hui",
    value: "Valeur",
    invested: "Versé",
    market: "Aujourd'hui",
    profitLoss: "Gain ou perte",
    namePea: "Plan d'épargne en actions",
    nameCto: "Compte-titres ordinaire",
    nameAv: "Assurance vie",
    namePer: "Plan d'épargne retraite",
    nameCrypto: "Cryptomonnaies",
    rangeAll: "Tout",
    positions: "Positions",
    orderBy: "Trier",
    orderByName: "Nom",
    orderByInvested: "Versé",
    noItems:
      "Rien dans ce compte pour l'instant. Ajoutez ce que vous y détenez pour suivre ce que vous avez versé et ce que ça vaut.",
    editPosition: "Modifier {name}",
    investedSuffix: "versés",
    fundingLabel: "Versements mensuels",
    perMonth: "par mois",
    emptyTitle: "Aucun placement suivi pour l'instant",
    emptyBody:
      "Ajoutez ce que vous détenez sur chaque compte pour suivre ce que vous avez versé et ce que ça vaut aujourd'hui.",
    emptyTitleMobile: "Suivez vos placements",
    emptyBodyMobile:
      "Votre PEA, votre compte-titres et vos cryptos, au même endroit.",
    trackBody:
      "Un versement récurrent vers un placement apparaît ici tout seul.",
    addBtcForValue:
      "Indiquez combien de bitcoins vous détenez pour voir leur valeur du jour",
    addSharesForValue:
      "Indiquez combien de parts vous détenez pour voir leur valeur du jour",
    returnTitle: "Rendement par an",
    returnBody:
      "Calculé sur chacun de vos versements, à sa date\u00A0: verser un peu chaque mois est comparé équitablement à un gros versement unique.",
    summaryTitle: "Vos placements",
    summarySavings: "+ {amount} sur vos livrets · {total} en tout",
    contributionStreak: {
      one: "{count} mois de versement",
      other: "{count} mois de versements d'affilée",
    },
    nextContributionOn: "Prochain versement\u00A0: {date} · {amount}",
    priceOverYear: "{change} sur un an",
    inWallet: "Dans votre {wallet}",
  },

  fundCost: {
    title: "Frais des fonds",
    weightedSuffix: "par an, en moyenne",
    emptyBody:
      "Indiquez les frais annuels de chaque fonds — le pourcentage « frais courants » de sa fiche d'information, le DIC — et ceci devient un montant en euros. Ce sont souvent les frais les plus lourds d'un portefeuille, et ils n'apparaissent sur aucun relevé.",
    aYearOn: "par an sur",
    overYears: "sur {years} ans à ce montant",
    cheapestPrefix: "Votre ligne la moins chère est",
    cheapestAt: "à {charge}. À ce taux, les mêmes",
    wouldCost: "coûteraient",
    differenceOf: "— soit",
    aYear: "de différence par an.",
    missingCharge: {
      one: "{count} ligne sans frais renseignés",
      other: "{count} lignes sans frais renseignés",
    },
    partialSuffix: ", ce total est donc partiel.",
  },

  monthClose: {
    keptIn: "Économisé en {month}",
    runExtended: {
      one: "Série prolongée\u00A0: {count} mois d'affilée",
      other: "Série prolongée\u00A0: {count} mois d'affilée",
    },
    runRecord: {
      one: "Nouveau record\u00A0: {count} mois d'affilée",
      other: "Nouveau record\u00A0: {count} mois d'affilée",
    },
    closeMonth: "Faire le bilan de {month}",
    balance: "Solde",
    balancePrompt:
      "Combien votre compte contenait-il le {date}\u00A0? Additionnez les comptes d'où partent vos dépenses courantes — un seul chiffre suffit.",
    baselineNote:
      "Ce premier bilan ne fixe que le point de départ. Il n'y a encore rien à comparer\u00A0; le mois prochain, si.",
    sameDayNote:
      "Relevez-le le même jour chaque mois. Ainsi les paiements par carte encore en route faussent la lecture de la même façon à chaque fois, et les mois restent comparables.",
    working: "Calcul…",
    seeWhatThatMeans: "Voir ce que cela donne",
    couldNotWorkOut: "Impossible de calculer cela.",
    couldNotClose: "Impossible de faire le bilan du mois.",
    startingPointSet: "Point de départ fixé",
    somethingMissing: "Le compte contient plus que prévu",
    youKept: "Vous avez économisé {amount}",
    costMoreThanItBrought: "{month} a coûté plus qu'il n'a rapporté",
    keptRate:
      "{rate} de ce qui est entré, en comptant ce que vous avez mis de côté.",
    keptRateUnknown: "En comptant ce que vous avez mis de côté.",
    cameIn: "Entré",
    recordedSpending: "Dépenses enregistrées",
    setAside: "Épargne et placements",
    neverRecorded: "Jamais enregistré",
    overAllowance: "C'est {over} au-delà de votre marge de {cap}.",
    insideAllowance: "Dans votre marge de {cap}, il vous reste {spare}.",
    normalMonth: "Un mois normal chez vous tourne autour de {amount}.",
    unrecordedBlurb:
      "Des dépenses dont l'application n'a jamais entendu parler — les restaurants, les tournées, ce qu'on achète en rentrant. Rien à corriger, juste bon à savoir.",
    closing: "Bilan en cours…",
    changeTheBalance: "Modifier le solde",
    done: "Terminé",
    reopen: "Ce solde était faux — réouvrir le mois",
    reopenShort: "Ce solde était faux — réouvrir",
    close: "Fermer",
    balanceOn: "Solde au {date}",
    unexplainedCredit:
      "Le compte contient {amount} de plus que vos opérations ne l'expliquent. Souvent, un revenu pas encore noté — ou une dépense, ou un versement sur vos placements, noté deux fois.",
    runwayBought: {
      one: "De quoi couvrir {count} jour de vos dépenses fixes.",
      other: "De quoi couvrir {count} jours de vos dépenses fixes.",
    },
    setStartingBalance: "Fixez votre solde de départ",
    inviteBaseline:
      "Saisissez ce que votre compte contient réellement aujourd'hui. Dès le mois prochain, l'application pourra le comparer à ce qu'elle a enregistré et vous dire ce qu'elle n'a jamais vu — des espèces, un paiement oublié, une carte que vous ne suivez pas.",
    inviteAllowance:
      "Restez sous {cap} de dépenses non notées pour garder la série en vie.",
    inviteNormal:
      "Un mois normal chez vous tourne autour de {amount} que l'application ne voit jamais.",
    inviteBare:
      "Un seul solde, et l'application peut calculer ce qu'elle n'a jamais vu.",
    closeTheMonth: "Faire le bilan du mois",
    filledFromBank:
      "Rempli depuis votre banque. Modifiez-le si le jour de lecture n'est pas aujourd'hui.",
    balanceUnreadable:
      "Cela ne ressemble pas à un montant. Essayez plutôt {example}.",
    balancePlaceholder: "2400,50",
    reopened: "{month} réouvert",
    baselineSet:
      "{amount} au {date}. Faites le bilan du mois prochain et l'application pourra commencer à vous dire ce qu'elle n'a jamais vu.",
  },

  inbox: {
    fromYourBank: "De votre banque",
    review: "À vérifier",
    needsCategory: "Attend une catégorie",
    nothingWaiting: "Rien en attente",
    fetching: "Récupération…",
    fetchEverything: "Tout récupérer",
    pickCategoryFirst: "Choisissez d'abord une catégorie",
    add: "Ajouter",
    done: "Terminé",
    close: "Fermer",
    filterCategories: "Filtrer les catégories",
    filterCategoriesPlaceholder: "Filtrer les catégories…",
    taughtIt:
      "Tout ce que l'application reconnaissait déjà est passé directement. Répondre à celles-ci le lui apprend pour la prochaine fois.",
    leaveOut: "Laisser de côté",
    recentlyDecided: "Décidé récemment",
    putOneBack:
      "Remettez-en une en attente si elle est partie au mauvais endroit.",
    leftOut: "laissée de côté",
    inYourLedger: "dans votre journal",
    move: "Déplacer",
    changeCategory: "Changer de catégorie",
    undo: "Annuler",
  },

  inboxGroups: {
    groups: { one: "{count} groupe", other: "{count} groupes" },
    entries: { one: "{count} ligne", other: "{count} lignes" },
    fileAll: "Tout classer",
    leaveOutAll: "Tout laisser de côté",
    showRows: "Afficher les lignes",
    hideRows: "Masquer les lignes",
    mixed:
      "Vous avez classé ce commerçant de plusieurs façons, donc chaque ligne est demandée à part.",
    groupLabel: "{name}, {entries}, {amount}",
    filed: {
      one: "{count} ligne classée dans {category}",
      other: "{count} lignes classées dans {category}",
    },
    alreadyRecorded: {
      one: "{count} était déjà dans votre journal",
      other: "{count} étaient déjà dans votre journal",
    },
    leftOut: {
      one: "{count} ligne laissée de côté",
      other: "{count} lignes laissées de côté",
    },
    putBack: {
      one: "{count} ligne est de nouveau à vérifier",
      other: "{count} lignes sont de nouveau à vérifier",
    },
    taught: {
      one: "{count} commerce appris pour la prochaine fois.",
      other: "{count} commerces appris pour la prochaine fois.",
    },
    allFiled: "Tout est classé.",
    /* The phone's review, one group at a time. */
    whichCategory: "Quelle catégorie\u00A0?",
    recentCategories: "Récentes",
    keyboardHint:
      "↑ ↓ pour naviguer · Entrée pour classer · L pour laisser de côté",
  },

  selectionBar: {
    region: "Opérations sélectionnées",
    regionMobile: {
      one: "{count} opération sélectionnée",
      other: "{count} opérations sélectionnées",
    },
    countSelected: "{count} sélectionnées",
    move: "Déplacer",
    moveTo: {
      one: "Déplacer {count} opération vers",
      other: "Déplacer {count} opérations vers",
    },
    moving: "Déplacement…",
    confirmMove: "Oui, les déplacer",
    pickCategory: "Choisir une catégorie",
    delete: "Supprimer",
    deleting: "Suppression…",
    confirmDelete: "Oui, supprimer",
    cancel: "Annuler",
    clear: "Vider la sélection",
    fromRecurring: {
      one: "{count} vient d'une opération récurrente",
      other: "{count} viennent d'opérations récurrentes",
    },
  },

  calendarView: {
    monthlyCalendar: "Calendrier du mois",
    dayLabel: "{day} — {entries}",
    pulseStillToCome: "{amount} encore à venir",
    pulseOut: "{amount} sortis",
    pulseIn: "{amount} entrés",
    pulsePlannedOut: "{amount} prévus en sortie",
    pulsePlannedIn: "{amount} prévus en entrée",
    pulseNothing: "rien ce jour-là",
    inAndOut: "{income} en entrée · {outflow} en sortie",
    selectedDay: "Détail du jour sélectionné",
    noTransactions: "Aucune opération",
    emptyTitle: "Rien ce jour-là",
    emptyBody: "Ajoutez une opération ou choisissez une autre date.",
    emptyBodyMobile: "Ajoutez ce qui s'est passé.",
    recurring: "Récurrent",
    all: "Tout",
  },

  auth: {
    signIn: "Se connecter",
    signInHeading: "Connectez-vous pour suivre vos finances",
    signingIn: "Connexion…",
    signUp: "S'inscrire",
    createAccount: "Créer un compte",
    creating: "Création…",
    email: "E-mail",
    emailAddress: "Adresse e-mail",
    password: "Mot de passe",
    passwordPlaceholder: "Votre mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    pleaseWait: "Un instant…",
    withGoogleSignIn: "Se connecter avec Google",
    withGoogleSignUp: "S'inscrire avec Google",
    withGoogleContinue: "Continuer avec Google",
    withPasskey: "Se connecter avec une clé d'accès",
    invalidCredentials: "Identifiants incorrects",
    haveAccount: "Vous avez déjà un compte\u00A0?",
    legalConsent:
      "En créant un compte, vous acceptez les {terms} et la {privacy}.",
    termsLink: "conditions d'utilisation",
    privacyLink: "politique de confidentialité",
    noAccount: "Pas de compte\u00A0?",
    noAccountYet: "Pas encore de compte\u00A0?",
    createOne: "En créer un",
    or: "ou",
    welcomeBack: "Content de vous revoir",
    signUpHeading: "Commencez à suivre vos revenus et vos dépenses",
    linkExpired: "Lien de connexion expiré ou invalide. Veuillez réessayer.",
    redirecting: "Redirection…",
    finishingSignIn: "Connexion en cours…",
    confirmEmail:
      "Ouvrez l'e-mail que nous venons d'envoyer pour confirmer votre compte, puis connectez-vous.",
    googleStartFailed: "Impossible de lancer la connexion avec Google.",
    googleCancelled: "Connexion avec Google annulée.",
    googleFailed: "Impossible de terminer la connexion avec Google.",
    waitingForPasskey: "En attente de la clé d'accès…",
    forgotPassword: "Mot de passe oublié\u00A0?",
    resetHeading: "Réinitialiser votre mot de passe",
    resetBody:
      "Saisissez votre adresse e-mail et nous vous enverrons un lien pour choisir un nouveau mot de passe.",
    sendResetLink: "Envoyer le lien",
    sendingResetLink: "Envoi…",
    resetSent:
      "S'il existe un compte pour {email}, un lien vient de partir. Regardez votre boîte de réception, et vos indésirables.",
    backToSignIn: "Retour à la connexion",
    newPasswordHeading: "Choisir un nouveau mot de passe",
    newPasswordBody:
      "Il remplace l'ancien partout où vous vous connectez avec votre e-mail.",
    newPassword: "Nouveau mot de passe",
    confirmNewPassword: "Confirmez le nouveau mot de passe",
    saveNewPassword: "Enregistrer le nouveau mot de passe",
    savingNewPassword: "Enregistrement…",
    passwordChanged: "Votre mot de passe a été modifié.",
    openApp: "Ouvrir Pluclair",
    askForNewLink: "Demander un nouveau lien",
    resetLinkExpired:
      "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous.",
    resetNeedsLink:
      "Cette page s'ouvre depuis le lien d'un e-mail de réinitialisation. Demandez-en un nouveau si le vôtre a expiré.",
    resetFinishOnWeb:
      "Ouvrez le lien sur n'importe quel appareil pour choisir un nouveau mot de passe, puis connectez-vous ici avec celui-ci.",
  },

  marketingMock: {
    openingBalance: "Solde d'ouverture",
    recordedIn: "Entrées enregistrées",
    recordedOut: "Sorties enregistrées",
    closingBalance: "Solde en fin de mois",
    howItAddsUp: "Comment on y arrive",
    monthRead: "Lecture du mois",
    whereItWent: "Où c'est parti",
    whatsLeft: "Ce qu'il reste",
    expectedImpact: "Impact prévu",
    expectedImpactPerMonth: "Impact prévu par mois",
    portfolioValue: "Valeur des placements",
    oneShare: "1 part",
    oneShareAtQuote: "1 part au cours actuel",
    sharePriced: "Au cours",
    templatesAllApplied: {
      one: "{count} récurrent, appliqué",
      other: "{count} récurrents, tous appliqués",
    },
  },

  marketingStat: {
    unrecordedIn: "Non noté en {month}",
    underAllowance: "sous votre marge de {amount}",
    ofWhatCameIn: "{percent} de ce qui est entré",
    monthsInARow: {
      one: "{count} mois d'affilée",
      other: "{count} mois d'affilée",
    },
    inARow: "{count} d'affilée",
    readyToClose: "{month} est prêt pour son bilan",
    keepTheRun:
      "Restez sous {amount} de dépenses non notées pour continuer la série.",
    keptIn: "Économisé en {month}",
    leftIn: "Reste en {month}",
    ofEarned: "sur {amount} gagnés",
  },

  position: {
    fromRecurring: "Depuis une opération récurrente",
    customHolding: "Ligne personnalisée",
    noRecurringAvailable:
      "Aucune opération récurrente disponible pour ce compte. Créez-en une dans Récurrents, ou utilisez une ligne personnalisée.",
    nameLabel: "Nom",
    namePlaceholder: "ex. ETF MSCI World",
    costBasis: "Total versé (ce que ça vous a coûté)",
    costBasisHint:
      "Le total versé que votre courtier indique pour cette ligne. Sert à calculer le gain ou la perte\u00A0; il n'est pas mis à jour par les opérations récurrentes.",
    changeFundPrefix: "Changez le fonds sur la page",
    changeFundLink: "Récurrents",
    changeFundSuffix: ".",
    linkEtfPrefix: "Liez d'abord votre ETF depuis",
    linkEtfLink: "Récurrents → {name}",
    linkEtfSuffix: ", puis saisissez le nombre total de parts ci-dessous.",
    chargePlaceholder: "ex. 0,20",
    isinLabel: "ISIN (facultatif)",
    isinHint:
      "Douze caractères, sur le DIC (document d'informations clés) ou la fiche du fonds. Pluclair en a besoin pour lire ce que contient le fonds\u00A0; les actions et le bitcoin peuvent rester vides.",
    moneyWeightedReturn: "Rendement par an",
    amountIn: "versés",
    amountNow: "aujourd'hui",
    returnExplainer:
      "Calculé sur chacun de vos versements, à sa date\u00A0: verser un peu chaque mois est comparé équitablement à un gros versement unique. Le gain en euros seul avantagerait l'argent resté placé le plus longtemps.",
    returnByAccount: "Par compte",
    allocationIntroTargets:
      "Chaque barre est la part d'un compte aujourd'hui\u00A0; le trait marque la part visée.",
    shareNowTarget: "{share} aujourd'hui · cible {target}",
    onTarget: "Dans la cible",
    aboveTarget: "au-dessus de la cible",
    belowTarget: "en dessous de la cible",
    pointsAbove: {
      one: "{count} point au-dessus de la cible",
      other: "{count} points au-dessus de la cible",
    },
    pointsBelow: {
      one: "{count} point en dessous de la cible",
      other: "{count} points en dessous de la cible",
    },
    allOnTarget: "Chaque compte est dans sa cible.",
    nextContributionBefore: "Répartissez vos prochains",
    nextContributionAfter:
      "ainsi pour revenir vers vos cibles, sans rien vendre\u00A0:",
    splitItemTo: "vers {wallet}",
    noTargetHint:
      "Choisissez la répartition voulue\u00A0: vous verrez l'écart de chaque compte et où placer votre prochain versement.",
    editTargets: "Modifier les cibles",
    targetNow: "aujourd'hui {share}",
    targetTotalComplete: "Total 100\u00A0%",
    targetTotalShort: "{left}\u00A0% restant à répartir",
    targetTotalOver: "{over}\u00A0% de trop",
    useCurrentSplit: "Partir de la répartition actuelle",
    removeTargets: "Supprimer les cibles",
    targetsRemoved: "Cibles supprimées",
    allocationView: "Vue de la répartition",
    viewTotal: "Total",
    viewMonthly: "Mensuel",
    monthlyIntroBefore: "Comment vos",
    monthlyIntroAfter: "par mois se répartissent entre vos comptes.",
    shareOfEachMonth: "{share} de chaque mois",
    shareOfEachMonthTarget: "{share} de chaque mois · cible {target}",
    monthlyNoneTarget: "Aucun versement mensuel · cible {target}",
    monthlyOnTarget: "Vos versements mensuels suivent votre cible.",
    monthlyNothing:
      "Aucun investissement récurrent pour l'instant. Ajoutez-en un dans Récurrents et sa répartition s'affichera ici.",
    peaPaidIn: "Versé",
    peaOfCeiling: "sur {ceiling}",
    peaRoomLeft: "de marge restante",
    peaCashOnly:
      "Seuls les versements comptent dans le plafond\u00A0; la performance, non.",
    addItem: "Ajouter une ligne",
    addCryptoItem: "Ajouter une ligne crypto",
    itemAdded: "Ligne ajoutée",
    itemUpdated: "{name} mis à jour",
    itemRemoved: "{name} retiré",
    pickRecurring: "Choisissez-en un…",
    liveEstimate: "Estimation au cours du marché\u00A0:",
    itemType: "Type de ligne",
    recurringItem: "Opération récurrente associée",
    dcaBitcoin: "Montant fixe chaque mois · Bitcoin sur Bitstack",
    dcaEtf: "Montant fixe chaque mois · ETF défini dans Plan",
    trackedAsset: "Actif suivi",
    trackedEtf: "ETF suivi",
    bitcoin: "Bitcoin",
    totalBtc: "Total BTC",
    totalShares: "Total des parts",
    totalBtcHeld: "Total BTC détenu",
    totalSharesHeld: "Total des parts détenues",
    sharesHeldOptional: "Parts détenues (facultatif)",
    btcHint:
      "Depuis Bitstack — les fractions de BTC sont acceptées (virgule ou point).",
    sharesHint:
      "Depuis votre courtier — les fractions de parts sont acceptées (virgule ou point, ex. 1,1465).",
    manualValuePlaceholder: "Valeur totale de ce compte chez votre courtier",
    marketValuePlaceholder: "Laisser vide pour utiliser le marché",
    brokerValue: "Le total de votre courtier (optionnel)",
    brokerValueHint:
      "Laissez vide — ou tapez 0 — et la valeur est calculée en direct depuis vos parts et le cours du marché. Ne le remplissez que si votre courtier affiche un total différent, puis épinglez-le ci-dessous pour qu'il soit retenu.",
    pinValue: "Utiliser ce chiffre plutôt que le cours du marché",
    pinValueHint:
      "Non épinglé, votre chiffre ne sert que de repli quand aucun cours ne peut être récupéré.",
    manualValueHint:
      "S'il est rempli, ce chiffre remplace la valeur calculée au cours du jour.",
    removeConfirmBody:
      "Retirer cette ligne\u00A0? Vos opérations restent\u00A0; seule la ligne suivie est supprimée.",
    targetPercentFor: "Part visée pour {wallet}, en pourcentage",
    valuedLive: "Valeur au cours du jour",
    valuedPinned: "Valeur\u00A0: votre chiffre",
    valuedManual: "Valeur\u00A0: votre chiffre — aucun cours disponible",
    valuedCost:
      "Valeur\u00A0: ce que vous avez versé — ajoutez les parts pour suivre le cours",
    ongoingChargeLabel: "Frais courants du fonds (optionnel)",
    ongoingChargeHint:
      "Les frais annuels du fonds lui-même, en pourcentage — 0,20 pour 0,20\u00A0%. Ils figurent sur le DIC (document d'informations clés) et n'apparaissent jamais sur un relevé, car ils sont prélevés sur la valeur du fonds. Ce ne sont pas les frais de votre courtier, que Pluclair ne suit pas.",
    perYear: "% par an",
    lookUpCharge: "Chercher les frais sur justETF",
    saving: "Enregistrement…",
    saveItem: "Enregistrer la ligne",
    savePosition: "Enregistrer la position",
    removing: "Retrait…",
    removeFromPortfolio: "Retirer de ce compte",
    removePosition: "Retirer la position",
    confirmRemove: "Oui, retirer",
    cancel: "Annuler",
    close: "Fermer",
    allocation: "Répartition",
    setTargets: "Définir les cibles",
    saveTargets: "Enregistrer les cibles",
    targetsSaved: "Cibles enregistrées",
    saved: "Enregistré",
    save: "Enregistrer",
    openedOn: "Ouvert le",
    peaOpenedLabel: "Indiquer la date d'ouverture du PEA",
    peaOpenedHint:
      "Ajoutez la date d'ouverture pour suivre le cap des cinq ans.",
  },

  month: {
    setUpTitle: "Configurez votre mois",
    setUpBody:
      "Ajoutez une fois ce qui revient. Chaque mois est projeté à partir de là.",
    setUpCharges: "Configurer vos opérations récurrentes",
    capsAndGoals: "Budgets et objectifs",
    moreThisMonth: "Plus sur ce mois",
    startingBalanceHint:
      "Indiquez un solde de départ pour commencer à faire le bilan de vos mois",
    actionReopen: "Réouvrir",
    actionReview: "Vérifier",
    actionClose: "Faire le bilan",
    actionStart: "Commencer",
    attentionSwallowed: {
      one: "{count} opération bancaire a été fusionnée par une synchronisation précédente",
      other:
        "{count} opérations bancaires ont été fusionnées par une synchronisation précédente",
    },
    attentionInbox: {
      one: "{count} opération attend une catégorie",
      other: "{count} opérations attendent une catégorie",
    },
    attentionBaseline:
      "Saisissez une fois le solde de votre compte, pour commencer à capter les dépenses que l'application ne voit jamais",
    attentionReadyToClose: "{month} est prêt pour son bilan",
    attentionProposals: {
      one: "{count} opération a l'air de revenir",
      other: "{count} opérations ont l'air de revenir",
    },
    streakInARow: "{count} d'affilée",
    bestStreak: "record {count}",
  },

  common: {
    undo: "Annuler",
    putBack: "Remis en place",
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    pickAMonth: "Choisir un mois",
    showYear: "Afficher {year}",
    thisMonth: "Ce mois-ci",
    backToThisMonth: "Revenir à ce mois-ci",
    previousYear: "Année précédente",
    nextYear: "Année suivante",
    monthClosed: "bilan fait",
    monthRecords: "opérations",
    close: "Fermer",
    closeSheet: "Fermer le panneau",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    accountMenu: "Menu du compte",
    closeAccountMenu: "Fermer le menu du compte",
    view: "Vue",
    save: "Enregistrer",
    loading: "Chargement",
    add: "Ajouter",
    change: "Modifier",
    remove: "Retirer",
    cancel: "Annuler",
    delete: "Supprimer",
    working: "En cours…",
    signOut: "Se déconnecter",
    chartMode: "Mode du graphique",
    chartRange: "Période du graphique",
    unrealisedProfitLoss: "Gain ou perte à ce jour",
    unrecordedAllowance: "Marge pour les dépenses non notées",
    removePasskey: "Retirer la clé d'accès",
    remindersOff: "Rappels désactivés",
    remindersNeedPermission: "Les rappels demandent l'autorisation de notifier",
    typeDeleteToConfirm: "Tapez DELETE pour confirmer.",
    product: "Le produit",
    account: "Compte",
    marketing: "Présentation",
    nearbyPages: "Pages voisines",
    needsYou: "À votre attention",
    arrivedCharges: "Opérations récurrentes qui semblent arrivées",
    clearInstrument: "Retirer l'instrument sélectionné",
    searchInstrument: "Chercher par nom ou ISIN…",
    clearDate: "Effacer la date",
    date: "Date",
    pickADate: "Choisir une date",
    setUp: "Configuration",
    usePassword: "Utiliser le mot de passe",
    browserNotifications: "Notifications du navigateur",
    kept: "Économisé",
    showAmounts: "Afficher les montants",
    hideAmounts: "Masquer les montants",
  },

  locale: {
    settingLabel: "Langue",
    settingHint:
      "Change chaque mot de l'application. Les chiffres suivent aussi.",

    suggest: {
      title: "Lire Pluclair en français\u00A0?",
      body: "Vous pouvez changer à tout moment depuis votre profil.",
      accept: "Passer au français",
      dismiss: "Rester en français",
    },
  },

  units: {
    thousands: "{value}\u00A0k",
    perYear: "{rate} par an",
    percent: "{value}\u00A0%",
    months: "{value} mois",
  },

  recurrence: {
    weekly: "Hebdomadaire · {day}",
    yearly: "Annuel · {day} {month}",
    monthly: "Mensuel · le {day}",
  },

  pullAge: {
    never: "jamais",
    justNow: "à l'instant",
    minutes: "il y a {count} min",
    hours: { one: "il y a {count} heure", other: "il y a {count} heures" },
    yesterday: "hier",
    days: { one: "il y a {count} jour", other: "il y a {count} jours" },
  },

  calendar: {
    today: "Aujourd'hui",
    yesterday: "Hier",
  },

  list: {
    conjunction: "{first} et {last}",
    more: "{names} et {count} de plus",
  },

  selection: {
    deleteConfirm: {
      one: "Supprimer {count} opération\u00A0?",
      other: "Supprimer {count} opérations\u00A0?",
    },
    deletePermanent: "C'est irréversible.",
    deleteAllRecurring: {
      one: "Elle vient d'une opération récurrente\u00A0: elle ne sera pas rajoutée ce mois-ci.",
      other:
        "Elles viennent d'opérations récurrentes\u00A0: elles ne seront pas rajoutées ce mois-ci.",
    },
    deleteSomeRecurring:
      "{count} d'entre elles viennent d'opérations récurrentes\u00A0: celles-là ne seront pas rajoutées ce mois-ci.",
    typeChangeAll: {
      one: "Elle change de type de catégorie, donc les totaux des mois passés et les dépenses non notées vont bouger.",
      other:
        "Toutes changent de type de catégorie, donc les totaux des mois passés et les dépenses non notées vont bouger.",
    },
    typeChangeSome:
      "{count} d'entre elles changent de type de catégorie, donc les totaux des mois passés et les dépenses non notées vont bouger.",
    rulesLeftBehind: {
      one: "{names} restera classé à l'ancienne, car une opération plus récente n'est pas sélectionnée.",
      other:
        "{names} resteront classés à l'ancienne, car des opérations plus récentes ne sont pas sélectionnées.",
    },
    rulesRewritten: "Désormais {names} sera classé en {target}.",
    recurringKeepCategory:
      "{count} proviennent d'opérations récurrentes, qui garderont leur propre catégorie.",
  },

  bankReview: {
    moneyIn: "De l'argent arrive — dites ce que c'était",
    possibleRefund:
      "On dirait un remboursement d'un endroit où vous dépensez d'habitude",
    needsALook: "Espèces ou virement — pas encore une dépense",
    noSuchCategory: "Aucune catégorie pour ce genre de dépense pour l'instant",
    possibleDuplicate: "Vous l'avez peut-être déjà saisi",
    unknownMerchant: "Première fois ici",
    waiting: "En attente",
  },

  swallowed: {
    title: {
      one: "{count} ligne bancaire a été fusionnée sans vous demander",
      other: "{count} lignes bancaires ont été fusionnées sans vous demander",
    },
    body: "Une synchronisation plus ancienne a décidé que c'étaient des opérations récurrentes déjà écrites, sur la seule foi d'un montant identique à cinq jours près. Sur un relevé plein de petites sommes rondes, ça ne suffit pas\u00A0: la plupart sont probablement de vraies dépenses qui ne sont jamais arrivées dans votre journal. Les rouvrir les remet dans la boîte de revue, à vous de juger.",
    reopenAll: "Toutes les rouvrir",
    reopening: "Réouverture…",
    reopened: "Rouvertes",
  },

  investmentReturn: {
    noContributions: "Aucun versement pour l'instant",
    tooShort: "Trop récent pour être annualisé",
    notSolvable: "Pas assez d'historique",
  },

  categoryType: {
    income: "Revenu",
    expense: "Dépense",
    savings: "Épargne",
    investment: "Investissement",
  },

  facts: {
    income: "Argent entré",
    expenses: "Argent sorti",
    savings: "Épargne et placements",
    remaining: "Reste",
    investments: "Investi",
    savingsRate: "Taux d'épargne",
    expensesPrevious: "Argent sorti sur les mêmes jours de {month}",
    expensesVsPrevious: "Écart avec {month}",
    expensesVsPreviousMissing: "Écart avec le mois dernier",
    expensesVsPreviousNote:
      "la même période dans les deux mois, pas un mois entier contre une partie",
    kept: "Économisé",
    keptRate: "Économisé, en part de ce qui est entré",
    unrecorded: "Dépenses non notées",
    unrecordedNote: "mesuré sur le solde du compte, pas estimé",
    cashChange: "De combien le compte a varié",
    unrecordedSoFar: "Dépenses non notées à ce jour",
    unrecordedSoFarNote: "mesuré, et pas définitif avant le bilan du mois",
    onHand: "Ce que les comptes contiennent",
    committed: "Doit encore partir",
    arriving: "Doit encore arriver",
    free: "À vous de dépenser",
    unrecordedAllowance: "Marge pour les dépenses non notées",
    unrecordedAllowanceNote: "une marge fixée d'après son propre historique",
    unrecordedOver: "Dépenses non notées au-delà de la marge",
    unrecordedBaseline: "Dépenses non notées habituelles",
    unrecordedBaselineNote:
      "la médiane de vos bilans passés, pour qu'un seul voyage ne la déplace pas",
    streak: "Mois d'affilée dans la marge",
    bestStreak: "Meilleure série à ce jour",
    investedValue: "Valeur investie",
    inboxPending: "Opérations encore sans catégorie",
    chargesUnconfirmed: "Opérations récurrentes pas encore confirmées",
  },

  bearingFacts: {
    netPosition: "Tout ce que vous avez, additionné",
    committed: "Reste à partir ce mois-ci",
    arriving: "Reste à arriver ce mois-ci",
    savingsRate: "Taux d'épargne ce mois-ci",
    unrecordedBaseline: "Dépenses non notées habituelles",
    projectedBalanceBare: "Solde prévu",
    walletCost: "Versé sur vos placements",
  },

  categoryFacts: {
    normal: "Un mois normal",
    latest: "En {month}",
    drift: "L'écart avec ses mois d'avant, sur un mois",
    oddMonth: "De combien ce mois s'écarte d'un mois normal",
    monthsActive: "Mois où quelque chose est enregistré",
    shareOfMonth: "Part de tout ce qui est sorti ce mois-là",
  },

  pulse: {
    headlineLeft: "Reste ce mois-ci",
    headlineShort: "Il manque",
    headlineFree: "À vous de dépenser",
    noBalance:
      "Faites le bilan d'un mois pour voir ce qu'il y a vraiment sur le compte.",
    nothingDue: "Plus rien n'est prévu ce mois-ci.",
    afterLeaving: "Après tout ce qui doit encore partir.",
    includingArriving: "Y compris ce qui doit encore arriver.",
    afterBoth:
      "Après ce qui doit encore partir, et ce qui doit encore arriver.",
  },

  cashAccounts: {
    tickHint: "Cochez celles que vous utilisez pour dépenser.",
    lastRead: "Dernière lecture {when}",
    noneTicked:
      "Rien n'est coché\u00A0: le bilan des mois se fait donc encore à la main.",
    autoCloses:
      "Le bilan de chaque mois se fait de lui-même une fois que le relevé couvre le jour où il est lu. Un mois dont les comptes cochés ne peuvent pas tous être lus attend, plutôt que de deviner.",
  },

  monthCloseHistory: {
    title: "Bilans des mois",
    normalMonthCost:
      "Un mois normal vous coûte environ {amount} que l'application ne voit jamais.",
    oneMoreForBaseline:
      "Encore un bilan, et il y aura un mois normal auquel vous comparer.",
    closeFromSurface:
      "Faites le bilan d'un mois depuis {surface} et il apparaîtra ici.",
    allowanceHint:
      "Ce que vous acceptez de dépenser sans l'enregistrer. Rester en dessous, c'est ce qui garde une série vivante.",
    useSuggested: "Utiliser {amount}",
    needMoreForSuggestion:
      "Faites le bilan d'un mois de plus, et l'application pourra suggérer un montant à partir de vos propres dépenses.",
    readingDayHeading: "Jour de lecture",
    readingDayHint:
      "Le jour du mois suivant où vous relevez le solde. Plus tard est plus sûr avec une carte à débit différé, car les dépenses par carte du mois doivent avoir été prélevées. Le plus important est que ce soit toujours le même jour.",
    startingPoint: "Point de départ",
    needsLook:
      "À vérifier — plus sur le compte que ce que les opérations permettent",
    neverRecordedAmount: "{amount} jamais enregistré",
    keptPercent: "{rate}\u00A0% économisé",
    saved: "Enregistré",
  },

  projection: {
    noIncomeCharge:
      "Aucune opération récurrente n'apporte de revenu\u00A0: votre salaire n'entre dans aucun de ces chiffres. Ajoutez-le dans Récurrents et tout change ici.",
    noIncomeCta: "Ajouter un revenu récurrent",
  },

  runway: {
    underAMonth: "Moins d'un mois de dépenses fixes.",
    months: "{count} mois de dépenses fixes.",
  },

  allocation: {
    income: "Revenus",
    expenses: "Dépenses",
    savings: "Épargne",
    investments: "Investissements",
    remaining: "Reste",
    available: "Disponible",
    other: "Autre",
  },

  pea: {
    matured: "Plus de cinq ans — les retraits conservent la fiscalité du plan.",
    thisMonth: "Les cinq ans sont atteints ce mois-ci.",
    inMonths: {
      one: "Un mois avant les cinq ans.",
      other: "{count} mois avant les cinq ans.",
    },
    inYears: "{years} avant les cinq ans.",
    inYearsAndMonths: "{years} et {months} avant les cinq ans.",
    yearCount: { one: "{count} an", other: "{count} ans" },
    // "mois" does not change in the plural.
    monthCount: { one: "{count} mois", other: "{count} mois" },
  },

  comparison: {
    flat: "À peu près identique, comparé à {when}.",
    up: "{amount} de plus, comparé à {when}.",
    down: "{amount} de moins, comparé à {when}.",
    thisPointIn: "la même période en {month}",
  },

  budgetView: {
    currentOption: "Actuel · {date}",
    monthEndOption: "Fin de mois · {date}",
    currentHint:
      "Jusqu'à aujourd'hui seulement — dépenses et achats de placements à venir non comptés.",
    monthEndHint:
      "Inclut toutes les échéances dues ce mois-ci, achats de placements compris.",
  },

  notificationKinds: {
    recap: {
      label: "Le récap du lundi",
      hint: "Votre semaine en quelques chiffres, le lundi matin.",
    },
    overdraft: {
      label: "Risque de découvert",
      hint: "Quand le solde prévu passe sous zéro avant la fin du mois.",
    },
    close: {
      label: "Bilan du mois",
      hint: "Le jour où noter votre solde, et quand votre banque l'a fait pour vous.",
    },
    bigCharge: {
      label: "Grosse dépense demain",
      hint: "La veille d'une opération plus forte que d'habitude, ou annuelle.",
    },
    arrived: {
      label: "Opération arrivée",
      hint: "Quand un salaire ou une opération prévue semble être passé.",
    },
    dca: {
      label: "Vos DCA",
      hint: "Avant la paie, ce qu'il faut envoyer au courtier\u00A0; le lendemain d'un achat dans vos placements, pour dire s'il est passé.",
    },
    review: {
      label: "Opérations à classer",
      hint: "Quand votre banque a apporté des opérations sans catégorie.",
    },
    milestone: {
      label: "Nouveau palier",
      hint: "Quand ce que vous avez mis de côté et placé passe un palier.",
    },
    property: {
      label: "Immobilier",
      hint: "La moitié d'un prêt remboursée, sa dernière échéance, une nouvelle estimation d'après les ventes.",
    },
    monthOpen: {
      label: "Nouveau mois",
      hint: "Le 1er, quand le mois commence.",
    },
    bank: {
      label: "Connexion bancaire",
      hint: "Quand il faut la renouveler, ou si elle s'est arrêtée.",
    },
  },
  dcaInvite: {
    title: "Faire suivre vos DCA",
    follow:
      "« {name} » peut prendre le montant de vos DCA\u00A0: chaque mois, ce qu'ils vont coûter, 5\u00A0% de plus sur ceux achetés en parts, arrondi aux 50\u00A0€ supérieurs.",
    create:
      "Un virement mensuel vers le courtier, le {day} comme votre salaire, peut prendre le montant de vos DCA\u00A0: chaque mois, ce qu'ils vont coûter, 5\u00A0% de plus sur ceux achetés en parts, arrondi aux 50\u00A0€ supérieurs.",
    next: "En {month}, ce serait {amount}, et trois jours avant la paie, vous recevrez le montant à envoyer.",
    followAction: "Le faire suivre",
    createAction: "Créer ce virement",
    dismiss: "Non merci",
    done: "Votre virement suit maintenant vos DCA",
  },
  dcaTransfer: {
    title: "À envoyer au courtier",
    for: "Pour les DCA prévus en {month}\u00A0: {wallets}.",
    margin: "Arrondi, avec 5\u00A0% de marge sur ceux achetés en parts.",
    rounded: "Arrondi aux 50\u00A0€ supérieurs.",
    due: "Virement prévu le {date}",
    open: "Voir le virement",
    otherWallet: "Autres",
  },
  recap: {
    title: "Votre semaine",
    lastWeek: "{amount} dépensés la semaine dernière.",
    noSpending: "Aucune dépense notée la semaine dernière.",
    monthSame:
      "Depuis le 1er\u00A0: {amount}, comme à la même date en {month}.",
    monthLess:
      "Depuis le 1er\u00A0: {amount}, {delta} de moins qu'à la même date en {month}.",
    monthMore:
      "Depuis le 1er\u00A0: {amount}, {delta} de plus qu'à la même date en {month}.",
    stillToCome: {
      one: "Encore à venir ce mois-ci\u00A0: {amount}, en {count} opération.",
      other:
        "Encore à venir ce mois-ci\u00A0: {amount}, en {count} opérations.",
    },
    aboveNormal: "{name} dépasse déjà un mois normal (autour de {normal}).",
    waiting: {
      one: "{count} opération de votre banque attend sa catégorie.",
      other: "{count} opérations de votre banque attendent leur catégorie.",
    },
    optIn: "Me l'envoyer chaque lundi",
    dismiss: "Vu",
  },
  push: {
    dcaTransfer: {
      title: "{name}\u00A0: {amount}",
    },
    dca: {
      title: "{name}\u00A0: c'est passé\u00A0?",
      body: "L'achat de {amount} prévu le {date} attend votre réponse sur Le point.",
      titleSeveral: {
        one: "{count} achat à confirmer",
        other: "{count} achats à confirmer",
      },
      bodySeveral: "{names}\u00A0: dites sur Le point s'ils sont passés.",
    },
    bigCharge: {
      title: "Demain\u00A0: {name}",
      body: "{amount} à prévoir, plus que vos opérations récurrentes habituelles.",
      yearly: "{amount} à prévoir — elle ne revient qu'une fois par an.",
      titleSeveral: {
        one: "Demain\u00A0: {count} grosse opération",
        other: "Demain\u00A0: {count} grosses opérations",
      },
    },
    property: {
      halfTitle: "{loan}\u00A0: la moitié est remboursée",
      halfBody: "Il reste {owed} à rembourser sur {property}, jusqu'en {end}.",
      halfBodyOpen: "Il reste {owed} à rembourser sur {property}.",
      lastTitle: "Dernière échéance\u00A0: {loan}",
      lastBody:
        "{loan} est remboursé depuis le {date}\u00A0: {amount} de moins à payer chaque mois.",
      equityTitle: "{property}\u00A0: la moitié est à vous",
      equityBody:
        "Avec vos remboursements, ce qui reste dû est passé sous la moitié de sa valeur estimée ({value}).",
      marketTitle: "Nouvelle estimation\u00A0: {property}",
      marketBody:
        "D'après les dernières ventes publiées, il vaut environ {after}, contre {before} à la lecture précédente.",
      marketBodySame:
        "D'après les dernières ventes publiées, il vaut toujours environ {after}.",
    },
    milestone: {
      title: "Nouveau palier\u00A0: {amount}",
      body: "Ce que vous avez mis de côté et placé vient de passer {amount}. Le Plan dit quand viendra le suivant.",
    },
    overdraft: {
      title: "Découvert possible le {date}",
      body: "Avec ce qui est prévu, le compte descendrait à {amount} le {date}, puis remonterait à {end} en fin de mois.",
      bodyStays:
        "Avec ce qui est prévu, le compte descendrait à {amount} le {date} et finirait le mois à {end}.",
    },
    close: {
      title: "Faites le bilan de {month}",
      body: "C'est le jour de lecture\u00A0: notez le solde de votre compte pour voir ce que {month} vous a laissé.",
      bodyRun: {
        one: "C'est le jour de lecture\u00A0: notez le solde de votre compte. Votre série en est à {count} mois.",
        other:
          "C'est le jour de lecture\u00A0: notez le solde de votre compte. Votre série en est à {count} mois.",
      },
    },
    closed: {
      title: "Le bilan de {month} est fait",
      baseline:
        "Votre banque a donné le solde\u00A0: c'est le point de départ des prochains bilans.",
      overRecorded:
        "Votre banque a donné le solde. Il y a plus sur le compte que ce qui est noté pour {month}\u00A0: ouvrez le bilan pour voir l'écart.",
      kept: "Votre banque a donné le solde\u00A0: {month} vous a laissé {amount}.",
      spentMore:
        "Votre banque a donné le solde\u00A0: {month} a coûté {amount} de plus qu'il n'a rapporté.",
      unrecorded: "Dépenses non notées\u00A0: {amount}.",
    },
    monthOpen: {
      title: "Un nouveau mois",
      idle: "Prévoyez ce qui revient, et voyez ce que le mois vous laisse.",
      pending: {
        one: "Il commence avec {count} opération récurrente. Voyez ce qu'il reste.",
        other:
          "Il commence avec {count} opérations récurrentes. Voyez ce qu'il reste.",
      },
    },
    arrived: {
      title: {
        one: "Est-ce bien arrivé\u00A0?",
        other: "Sont-ils bien arrivés\u00A0?",
      },
      body: {
        one: "Une opération récurrente semble déjà passée sur votre compte.",
        other:
          "{count} opérations récurrentes semblent déjà passées sur votre compte.",
      },
    },
    bankRenew: {
      title: "Gardez votre banque synchronisée",
      body: {
        one: "Le consentement de votre banque se termine demain, le {date}. Renouvelez-le sur open-banking.io — cela prend une minute.",
        other:
          "Le consentement de votre banque se termine dans {count} jours, le {date}. Renouvelez-le sur open-banking.io — cela prend une minute.",
      },
      today:
        "Le consentement de votre banque se termine aujourd'hui. Renouvelez-le sur open-banking.io — cela prend une minute.",
      ended:
        "Le consentement de votre banque a pris fin. Renouvelez-le sur open-banking.io pour reprendre la synchronisation.",
    },
    bankExpired: {
      title: "Votre banque ne se synchronise plus",
      body: "Pluclair ne peut plus lire votre compte open-banking.io. Déposez un nouveau fichier d'identifiants pour remettre vos chiffres à jour.",
    },
    review: {
      title: "À vérifier",
      body: {
        one: "Une opération de votre banque attend sa catégorie.",
        other: "{count} opérations de votre banque attendent leur catégorie.",
      },
    },
    bankPaused: {
      title: "Synchronisation en pause",
      body: "open-banking.io a mis la synchronisation en pause, souvent faute de crédit. Rechargez le portefeuille pour reprendre.",
    },
  },

  fulfilment: {
    onTheDay: "le jour prévu",
    late: { one: "{count} jour de retard", other: "{count} jours de retard" },
    early: { one: "{count} jour d'avance", other: "{count} jours d'avance" },
    exact: "Au centime près, {when}",
    more: "{amount} de plus que prévu, {when}",
    less: "{amount} de moins que prévu, {when}",
    askTitle: {
      one: "Est-ce bien arrivé\u00A0?",
      other: "Sont-ils bien arrivés\u00A0?",
    },
    thatsIt: "C'est ça",
    notIt: "Ce n'est pas ça",
    countsFor: "à compter pour {month}",
    countFor: "Compter pour {month}",
    confirmAll: "Tout confirmer",
    allConfirmed: {
      one: "{count} opération confirmée",
      other: "{count} opérations confirmées",
    },
    notThis: "Non, ce n'est pas {name}",
    done: "Terminé",
    purchaseTitle: {
      one: "Cet achat est-il passé\u00A0?",
      other: "Ces achats sont-ils passés\u00A0?",
    },
    purchaseWhy:
      "Votre banque ne voit pas les achats faits dans vos placements.",
    purchaseDue: "Prévu le {date}",
    purchaseYes: "C'est passé",
    purchaseNo: "Pas cette fois",
    purchaseLater: "Un autre jour",
    purchaseLaterWhich: "Passé quel jour\u00A0?",
    purchaseLaterOn: "Passé le {date}",
    state: {
      confirmed: "Confirmé",
      toConfirm: "À confirmer",
    },
    misses: {
      nothingAlike: "rien dans sa catégorie à rapprocher",
      refused:
        "vous avez dit que le mouvement le plus proche n'était pas le bon",
      notArrived: "le mouvement le plus proche n'a pas encore eu lieu",
      amountNear: "le plus proche était {amount}, trop loin de {expected}",
      amountNone: "aucun mouvement du bon montant",
      dateNear: {
        one: "le plus proche était à {count} jour de la date prévue, plus loin que les {window} jours où l'on cherche",
        other:
          "le plus proche était à {count} jours de la date prévue, plus loin que les {window} jours où l'on cherche",
      },
      dateNone: "aucun mouvement assez proche dans le temps",
    },
  },

  csvImport: {
    noDate: "Date illisible",
    noAmount: "Montant illisible",
    duplicate: "Déjà dans votre journal",
  },

  fallback: {
    trackingSuffix: "{name} · suivi",
    chartStart: "Départ",
    bankTransaction: "Opération bancaire",
    noValue: "—",
  },

  monthRead: {
    allowanceSpent: "Vous avez utilisé les {allowance} lectures de {month}.",
    coolingDown: "Une vient d'être écrite — réessayez dans {seconds} s.",
    inFlight: "Une lecture est déjà en cours d'écriture.",
    nothingToSay: "Il n'y a pas encore assez dans {month} pour en écrire.",
    untracked: "Les lectures mensuelles ne sont pas encore disponibles ici.",
    noWriter: "Aucun rédacteur n'est configuré.",
    noAnswer: "Le rédacteur n'a pas répondu à l'instant.",
    unusable: "La réponse du rédacteur n'était pas utilisable.",
    writeFailed: "Impossible d'écrire la lecture pour le moment.",
    threwAway:
      "Le rédacteur a utilisé un chiffre que l'application ne lui avait pas donné, la lecture a donc été écartée. ({detail})",
    writtenInOtherLanguage: "Écrit en {language}.",
    refusal: {
      wrongShape: "Pas la forme demandée",
      unknownDatum: 'Il a cité "{id}", qui ne lui a jamais été envoyé',
      headlineHadFigure: "Le titre contenait un chiffre de son invention",
      headlineTooLong: "Le titre dépassait une ligne",
      everythingDropped: "Toutes les observations ont dû être écartées",
    },

    title: "La lecture",
    subtitleWeb:
      "Écrit par {model}, à partir des chiffres de cette page. Il ne voit pas vos comptes.",
    subtitleMobile:
      "Écrit par {model}, à partir des chiffres de cet écran. Il ne voit pas vos comptes.",
    empty: "Rien n'a encore été écrit sur {month}.",
    suggestionsHeading: "À regarder de plus près",
    writing: "Écriture…",
    noReadsLeft: "Plus de lecture pour {month}",
    noReadsLeftGeneric: "Plus de lecture ce mois-ci",
    writeAgain: "Réécrire avec {model} ({left} restantes)",
    writeOne: "Écrire avec {model} ({left} restantes)",
    writtenToast: "Écrit pour {month}",
    writeAgainLabel: "Réécrire la lecture avec {model}",
    writeLabel: "Écrire la lecture avec {model}",
    writtenBy: "Écrit par {model}.",
    writtenByUnknown: "Rédigé par un modèle d'IA que Pluclair ne propose plus.",
    standingMoved: {
      one: "Un chiffre sur lequel elle s'appuie a bougé depuis qu'elle a été écrite, {age}.",
      other:
        "{count} chiffres sur lesquels elle s'appuie ont bougé depuis qu'elle a été écrite, {age}.",
    },
    standingProvisional:
      "Écrit {age}, à partir des chiffres tels qu'ils étaient alors.",
    standingWritten: "Écrit {age}.",
  },

  categoryRead: {
    refusal: {
      claimHadFigure: "Elle a écrit un chiffre de son invention",
    },

    noWriter: "Aucun rédacteur n'est configuré.",
    gone: "Cette catégorie n'est plus disponible.",

    writtenInOtherLanguage: "Écrit en {language}.",

    title: "La lecture",
    subtitle:
      "Écrit par {model}, à partir des chiffres de ce panneau. Il ne voit pas vos comptes.",
    empty: "Rien n'a encore été écrit sur cette catégorie.",
    writing: "Écriture…",
    noReadsLeft: "Plus de lecture ce mois-ci",
    writeAgain: "Réécrire avec {model} ({left} restantes)",
    writeOne: "Écrire avec {model} ({left} restantes)",
    writtenToast: "Écrit pour {category}",
    writtenBy: "Écrit par {model}.",
    writtenByUnknown: "Rédigé par un modèle d'IA que Pluclair ne propose plus.",
  },

  /** La transparence : de quoi les portefeuilles sont faits. */
  lookThrough: {
    title: "Composition",
    subtitle: "De quoi vos placements sont réellement faits",

    geography: "Où est l'argent",
    sectors: "Dans quoi il est",
    charges: "Ce que cela coûte",
    doublingUp: "Où vous faites doublon",
    wrappers: "Où les choses sont placées",
    target: "Une cible à viser",

    sectorLabels: {
      energy: "Énergie",
      materials: "Matériaux",
      industrials: "Industrie",
      "consumer-discretionary": "Consommation non essentielle",
      "consumer-staples": "Consommation de base",
      "health-care": "Santé",
      financials: "Finance",
      "information-technology": "Technologies de l'information",
      "communication-services": "Services de communication",
      utilities: "Services aux collectivités",
      "real-estate": "Immobilier",
    },

    restCountries: {
      one: "1 autre pays",
      other: "{count} autres pays",
    },
    restSectors: {
      one: "1 autre secteur",
      other: "{count} autres secteurs",
    },
    showRest: "Les afficher",
    hideRest: "Les masquer",

    holdings: "Par classe d'actifs",
    holdingsNote:
      "Sur tout ce qui est investi, crypto et or compris. Les pays et les secteurs portent sur les fonds lus.",
    holdingKind: {
      equity: "Actions",
      bonds: "Obligations",
      commodity: "Or et matières premières",
      crypto: "Crypto",
      mixed: "Fonds mixtes",
      unknown: "Pas encore identifié",
    },

    costPerYear: "{amount} de frais par an",
    costAllIn: "({rate} tout compris)",

    countryShare: "{country}",
    franceShare: "France",
    europeShare: "Europe",
    usShare: "États-Unis",
    marketWeight: "Sa part dans le marché\u00A0: {weight}",
    timesMarket: "{factor}× sa part dans le marché",
    inLineWithMarket: "Conforme au marché",

    fundCharges: "Les frais propres aux fonds",
    envelopeFeeHint:
      "Sur le relevé annuel de votre contrat, en pourcentage — généralement 0,5 à 0,8. Ils s'ajoutent aux frais courants de chaque support.",
    envelopeFee: "Les frais du compte",
    chargesNote:
      "Ce sont les frais des fonds et du compte. Les commissions de votre courtier et les frais de transaction ne sont pas suivis.",
    allIn: "Tout compris",
    perYear: "{amount} par an",
    overYears: "{amount} sur {years} ans",
    noChargeRecorded: "Aucuns frais renseignés",

    sameIndex: "Les deux reproduisent le même indice, {index}",
    nestedIndex: "{outer} contient {inner}",
    sharedCompanies: "Partage {count} de ses plus grosses lignes avec {other}",
    overlapAtLeast: "Au moins {share} des mêmes sociétés",

    cannotSitHere: "{name} ne peut pas être détenu dans un {wallet}",
    couldSitIn: "Il pourrait aller dans un {wallets}",

    targetWeight: "{weight}",
    currentWeight: "actuellement {weight}",
    buy: "Acheter {amount}",
    sell: "Vendre {amount}",
    noMoveNeeded: "Déjà à sa place",
    rebalanceNote:
      "Ce sont des mouvements entre lignes, pas de l'argent frais. Réorienter un virement mensuel mène au même endroit sans rien vendre.",

    readCoverage: "{share} de ce que vous détenez a été lu",
    notRead: "Pas encore lu",
    notReadBody:
      "{count} lignes n'ont pas été lues\u00A0: leur composition est donc inconnue, et non vide. Les parts ci-dessus sont calculées sur le reste.",
    readOne: "Lire celle-ci",
    readingOne: "Lecture…",
    readAll: "Lire le reste",
    lastRead: "Lu {when}",

    halt: {
      cooling: "La précédente se termine — réessayez dans un instant.",
      allowance: "Le quota de lectures de ce mois est épuisé.",
      notYours: "Cet instrument ne fait plus partie de vos positions.",
      noReader: "Aucun lecteur n'est configuré.",
      notSetUp:
        "Les lectures d'instruments ne sont pas encore en place (migration 032).",
      noSearch:
        "{model} ne peut pas chercher sur le web avec cette formule\u00A0: rien ne peut être consulté.",
      providerDown: "{model} n'a pas répondu à l'instant.",
      nothingFound: "Rien de publié n'a été trouvé pour {name}.",
      wrongInstrument: "Ce qui est revenu pour {name} concernait autre chose.",
      signedOut: "Vous avez été déconnecté.",
    },

    /** Comment s'est terminé un parcours de la file, une fois arrivé au bout. */
    readRest: {
      allRead: {
        one: "Un instrument lu.",
        other: "{count} instruments lus.",
      },
      someSkipped: {
        one: "{read} lu. Un n'a pas pu être lu et reste en l'état.",
        other:
          "{read} lus. {count} n'ont pas pu être lus et restent en l'état.",
      },
      noneRead: {
        one: "Un instrument n'a pas pu être lu.",
        other: "Aucun des {count} instruments n'a pu être lu.",
      },
    },

    caveats: {
      notCovered: "Ce que ces parts ne couvrent pas",
      unresolvableHeading: "Rien à consulter",
      noIsin: "Pas encore identifié",
      noIsinBody:
        "{count} de vos lignes n'ont pas d'ISIN\u00A0: il n'y a donc rien à rechercher. Ouvrez chacune depuis Positions et choisissez son instrument dans la recherche — c'est ce qui enregistre l'ISIN.",
      goToPositions: "Ouvrir Positions",
      neverRead: "Pas encore lu",
      neverReadBody:
        "{count} instruments ont un ISIN mais n'ont pas été lus. Lire un instrument va chercher ce qu'il contient — ses frais, ses pays, ses secteurs.",
      readNothingUseful: "Lu, mais incomplet",
      readNothingUsefulBody:
        "{count} lectures ont trouvé des frais mais aucun pays ni secteur, sans que le document d'information en dise la raison. Relancer la lecture peut en trouver davantage.",
      needsAReading:
        "Lisez d'abord au moins un instrument — il n'y a encore rien à passer en revue.",
      unclassified:
        "{share} de votre encours investi n'est pas couvert par les parts de cette page. Toutes les parts ici sont calculées sur la partie qui l'est.",
      overlapIsAFloor:
        "Le chevauchement est un plancher, pas une mesure. Seules les plus grosses lignes publiées de chaque fonds ont été comparées\u00A0: deux fonds présentés comme partageant peu peuvent en réalité être largement les mêmes sociétés — l'indice suivi est le signal le plus fiable.",
      staleReadings:
        "{count} lectures ont plus de six mois. Elles servent quand même\u00A0: la composition de l'an dernier vaut mieux que rien.",
      noMarketValue:
        "Rien n'est détenu pour l'instant, il n'y a donc rien à examiner.",
      partialAxis:
        "Ces chiffres couvrent {coverage} de ce qui a été lu — une fiche ne publie pas toujours la répartition complète. Les parts sont celles publiées, pas une part de ce qui a été trouvé\u00A0: elles ne totalisent donc pas l'ensemble.",
      unresolvable: {
        one: "L'or et les cryptos n'ont ni pays ni secteur — non pas non publiés\u00A0: aucun. C'est détenu, et compté dans le total ci-dessus, mais les parts de cette page ne peuvent pas le décrire.",
        other:
          "L'or et les cryptos n'ont ni pays ni secteur — non pas non publiés\u00A0: aucun. C'est détenu, et compté dans le total ci-dessus, mais les parts de cette page ne peuvent pas le décrire.",
      },
      geographyIsNotCurrency:
        "La géographie désigne ici où sont les sociétés, pas la devise dans laquelle vous êtes payé. Un fonds peut détenir des sociétés américaines et être libellé en euro.",
    },
  },

  /** Le compte IA de l'utilisateur, connecté par OpenRouter. */
  aiAccount: {
    writeOne: "Écrire avec {model}",
    writeAgain: "Réécrire avec {model}",
    connectFirst: "Connectez un compte IA pour des lectures écrites.",
    unavailable:
      "La connexion d'un compte IA n'est pas disponible pour le moment.",
    notEnabled: "La connexion d'un compte IA n'est pas encore ouverte.",
    /** Le Profil : la section « Compte IA ». */
    section: "Compte IA",
    footer:
      "Les lectures écrites — votre mois, une catégorie, vos placements — sont rédigées sur votre propre compte IA, avec le modèle de votre choix.",
    footerConnected:
      "Pluclair garde la clé chiffrée et ne s'en sert que pour vos lectures. Le solde de votre compte se consulte sur openrouter.ai.",
    connect: "Connecter un compte IA",
    connectHint: "Avec OpenRouter, en une fois",
    consentWhat:
      "Les lectures écrites — votre mois, une catégorie, vos placements, un fonds — seront rédigées par le modèle que vous choisissez, sur votre compte OpenRouter, et facturées sur vos crédits.",
    consentSent:
      "Pour chaque lecture, Pluclair envoie les chiffres de la page concernée : totaux, noms de catégories, lignes de vos placements. Jamais votre nom, votre e-mail, vos opérations une à une ni vos identifiants bancaires.",
    consentWhere:
      "OpenRouter les transmet au fournisseur du modèle (Mistral, OpenAI ou Anthropic), le plus souvent aux États-Unis. Vous pouvez déconnecter ce compte à tout moment, ici ou depuis OpenRouter.",
    continue: "Continuer vers OpenRouter",
    continuing: "Ouverture d'OpenRouter…",
    model: "Modèle",
    modelChosen: "Les prochaines lectures seront écrites avec {model}.",
    credit: "Dépensé ce mois-ci",
    creditLeft: "Reste {left} sur la limite de {limit} de cette clé",
    creditNoLimit: "Aucune limite sur cette clé",
    creditUnknown: "OpenRouter ne répond pas pour le moment",
    keyRefused: "Clé refusée",
    keyRefusedHint:
      "OpenRouter ne reconnaît plus cette clé : reconnectez le compte.",
    disconnect: "Déconnecter",
    disconnectBlurb:
      "Pluclair oubliera la clé, et vos lectures ne seront plus écrites. La clé « Pluclair » reste dans votre compte OpenRouter jusqu'à ce que vous l'y supprimiez.",
    disconnected: "Compte IA déconnecté.",
    connected: "Compte IA connecté.",
    refused: "OpenRouter n'a pas accordé l'accès. Rien n'a été enregistré.",
    expired: "La connexion a pris trop de temps. Recommencez.",
    /** L'étape de l'onboarding qui présente le compte IA. */
    welcomeTitle: "Des lectures écrites par l'IA de votre choix",
    welcomeBody:
      "Pluclair peut commenter votre mois, vos catégories et vos placements en quelques phrases. Ces lectures sont écrites par un modèle d'IA, sur votre propre compte.",
    welcomeHow:
      "Un compte OpenRouter vous donne accès à Mistral, ChatGPT et Claude, en une seule connexion.",
    welcomeCost:
      "Chaque lecture est facturée sur vos crédits OpenRouter, quelques centimes au plus.",
    welcomeConnect: "Connecter avec OpenRouter",
    welcomeLater: "Vous pourrez aussi le faire plus tard, depuis le Profil.",
  },

  /** La revue des portefeuilles : ce qu'un modèle tire de la transparence. */
  walletRead: {
    review: "Passer en revue avec {model}",
    reviewing: "Lecture…",
    reviewHint:
      "Lit les chiffres de cette page et dit ce qu'il en pense. {remaining} restantes ce mois-ci.",
    writtenBy: "Écrit par {model}.",
    writtenByUnknown: "Rédigé par un modèle d'IA que Pluclair ne propose plus.",
    readAt: "Lu {when}",
    stale: "Vos positions ont bougé depuis cette lecture",
    writtenInOtherLanguage: "Rédigé en {language}.",
    empty: "Rien n'a encore été lu.",
    emptyBody:
      "Les chiffres ci-dessus se suffisent à eux-mêmes. Une revue ajoute ce qu'on peut en tirer.",

    allowanceSpent: "Vous avez utilisé vos {allowance} revues du mois.",
    coolingDown: "Une vient d'être écrite — réessayez dans {seconds} s.",
    inFlight: "Une revue est déjà en cours d'écriture.",
    nothingToSay:
      "Trop peu a été lu pour dire quoi que ce soit de l'ensemble de vos placements.",
    unchanged: "Rien n'a bougé depuis la dernière revue.",
    untracked: "Les revues de placements ne sont pas encore disponibles ici.",
    noWriter: "Aucun rédacteur n'est configuré.",
    noAnswer: "Le rédacteur n'a pas répondu à l'instant.",
    threwAway: "La réponse du rédacteur a été écartée. ({detail})",

    refusal: {
      wrongShape: "Pas la forme demandée",
      unknownDatum:
        "Elle citait «\u00A0{id}\u00A0», qui n'a jamais été transmis",
      unknownInstrument:
        "Elle proposait «\u00A0{isin}\u00A0», qui n'est pas un instrument connu de Pluclair",
      headlineHadFigure: "Le titre contenait un chiffre de son cru",
      everythingDropped: "Toutes les observations ont dû être écartées",
    },

    footing: {
      notAdvice:
        "Ce sont des informations sur vos propres avoirs, pas un conseil en investissement. Chaque chiffre est le calcul de Pluclair.",
      partiallyRead:
        "Certaines lignes n'ont pas été lues\u00A0: ceci porte donc sur la partie de vos placements que Pluclair peut voir.",
    },
  },

  bankConnect: {
    sheetTitle: "Connecter votre banque",
    sheetLead:
      "Vos opérations et votre vrai solde viennent directement de votre banque à chaque actualisation. Vous le mettez en place une fois, avec votre propre compte open-banking.io.",
    step1Title: "Créez votre compte open-banking.io",
    step1Body:
      "Inscrivez-vous et approvisionnez son portefeuille. Environ 3\u00A0€ par mois pour un compte bancaire et 1\u00A0€ par compte supplémentaire — payés à eux, pas à Pluclair.",
    step2Title: "Connectez-y votre banque",
    step2Body:
      "Avec l'identification de votre banque. Pluclair ne voit jamais votre mot de passe bancaire.",
    step3Title: "Téléchargez votre fichier d'identifiants",
    step3Body:
      "Sur la page Développeurs, créez une clé API et choisissez «\u00A0Télécharger credentials.json\u00A0» dans la fenêtre qui l'affiche. L'export de la carte «\u00A0Clé de chiffrement\u00A0» porte le même nom, mais sans clé API.",
    step4Title: "Déposez-le ici",
    step4Body:
      "Pluclair le vérifie, puis importe votre historique. Ce qu'il ne sait pas classer seul vous attend dans une courte revue.",
    factReadOnly: "Lecture seule\u00A0: rien ici ne peut déplacer d'argent.",
    factKey:
      "Pluclair conserve votre fichier d'identifiants chiffré, hors de portée de toute application, et le supprime dès que vous vous déconnectez.",
    factConsent:
      "Le consentement de votre banque dure environ 180 jours. Vous le renouvelez sur open-banking.io, et vous êtes prévenu avant la fin.",
    factHistory:
      "Les mois passés sont complétés depuis votre banque, leurs totaux peuvent donc changer.",
    notRegulated:
      "Pluclair n'est pas un prestataire de services de paiement\u00A0: le service réglementé d'information sur les comptes est fourni par Enable Banking Oy, via votre compte open-banking.io.",
    privacyLink: "Comment vos données bancaires sont traitées",
    consentLabel:
      "J'autorise Pluclair à utiliser mon fichier d'identifiants pour lire les comptes et les opérations de mon compte open-banking.io — des données que ma banque fournit via Enable Banking Oy, prestataire agréé de services d'information sur les comptes — afin de tenir mon budget. Ces opérations peuvent révéler des informations sensibles (santé, convictions, appartenance syndicale…), et j'accepte expressément qu'elles soient traitées dans ce seul but. Pluclair ne sollicite ma banque que lorsque je demande une actualisation. Je peux retirer ce consentement à tout moment en déconnectant ma banque.",
    consentRequired: "Cochez d'abord la case de consentement.",
    consentMissingTitle: "Confirmez votre consentement",
    consentMissingBody:
      "Pluclair enregistre désormais ce consentement avant de lire des données bancaires. Merci de le confirmer pour votre connexion.",
    consentConfirm: "J'accepte",
    openSite: "Ouvrir open-banking.io",
    dropTitle: "Déposez credentials.json ici",
    dropHint:
      "Peu importe son nom — le fichier téléchargé peut comporter une date.",
    chooseFile: "Choisir le fichier",
    checking: "Vérification de votre fichier…",
    fileTooLarge:
      "Ce fichier est trop gros pour être un fichier d'identifiants.",
    fileNotCredentials:
      "Ce n'est pas un fichier d'identifiants open-banking.io. Téléchargez à nouveau credentials.json et déposez celui-là.",
    fileMissingApiKey:
      "Ce fichier contient votre clé de chiffrement, mais pas de clé API\u00A0: c'est l'export de la carte «\u00A0Clé de chiffrement\u00A0». Sur la page Développeurs, créez une clé API et choisissez «\u00A0Télécharger credentials.json\u00A0» dans la fenêtre qui l'affiche.",
    fileWrongService:
      "Ce fichier d'identifiants est destiné à un autre service qu'open-banking.io.",
    fileRejected:
      "open-banking.io n'a pas accepté la clé de ce fichier — elle a peut-être été supprimée. Créez une nouvelle clé API et téléchargez à nouveau le fichier.",
    fileKeyMismatch:
      "La clé privée de ce fichier n'ouvre pas vos données. Téléchargez à nouveau credentials.json.",
    openBankingUnreachable:
      "open-banking.io n'a pas pu être joint, votre fichier n'a donc pas été enregistré. Réessayez dans un instant.",
    saveFailed: "Votre fichier n'a pas pu être enregistré. Réessayez.",
    connectedPaused:
      "Votre fichier fonctionne, mais open-banking.io a mis la synchronisation en pause jusqu'à ce que son portefeuille soit approvisionné.",
    noAccountsYet:
      "Votre fichier fonctionne, mais aucune banque n'est encore connectée sur open-banking.io. Connectez-en une là-bas, puis revenez ici.",
    checkAgain: "Vérifier à nouveau",
    unavailable: "La connexion bancaire n'est pas encore disponible ici.",
    unreachable:
      "Impossible de joindre Pluclair pour l'instant. Réessayez dans un moment.",
    notConnected: "Aucune banque n'est connectée.",
    priceNote: "Environ 3\u00A0€ par mois, payés à open-banking.io.",
    connected: "Votre banque est connectée.",
    importTitle: "Import de votre historique",
    importBody:
      "Gardez cette page ouverte. Si vous la quittez, l'import reprend là où il s'est arrêté la prochaine fois.",
    importAccountDone: { one: "{count} ligne", other: "{count} lignes" },
    importDone: "Votre historique est là.",
    reviewCta: { one: "Revoir {count} ligne", other: "Revoir {count} lignes" },
    toBearing: "Voir votre solde",
    statusConnected: "Synchronisation active",
    lastSynced: "Dernière synchronisation {when}",
    neverSynced: "Pas encore synchronisé",
    sourceOwner: "Connectée avec les identifiants propres à ce déploiement.",
    ownerUpload:
      "Déposez votre fichier d'identifiants pour rattacher cette connexion à votre compte plutôt qu'aux réglages de ce déploiement.",
    ownerUploadCta: "Déposer le fichier",
    consentUntil: "Le consentement de votre banque court jusqu'au {date}.",
    consentSoon:
      "Le consentement de votre banque se termine le {date}. Renouvelez-le sur open-banking.io pour continuer la synchronisation.",
    consentEnded:
      "Le consentement de votre banque a pris fin. Renouvelez-le sur open-banking.io pour reprendre la synchronisation.",
    details: "Détails",
    renew: "Renouveler",
    expiredTitle: "Pluclair ne peut plus lire votre compte",
    expiredBody:
      "open-banking.io n'accepte plus votre fichier d'identifiants — en général parce que sa clé API a été supprimée. Créez une nouvelle clé, téléchargez à nouveau le fichier et déposez-le ici. Tout ce qui a déjà été importé reste.",
    reconnect: "Déposer un nouveau fichier",
    replaceFile: "Remplacer le fichier d'identifiants",
    pausedTitle: "La synchronisation est en pause",
    pausedBody:
      "open-banking.io l'a mise en pause jusqu'à ce que son portefeuille soit approvisionné.",
    errorTitle: "Votre banque n'a pas pu être jointe",
    errorBody: "Nouvel essai à la prochaine synchronisation.",
    accounts: "Comptes",
    accountsBody:
      "Choisissez les comptes qui contiennent votre argent courant. Leur solde est celui affiché dans Le point.",
    disconnect: "Déconnecter",
    disconnectTitle: "Déconnecter votre banque\u00A0?",
    disconnectBody:
      "La synchronisation s'arrête et votre fichier d'identifiants est supprimé de Pluclair.",
    disconnectApiKey:
      "Supprimez ensuite sa clé API sur open-banking.io, et fermez votre compte là-bas si vous n'en avez plus besoin.",
    keepImported: "Garder les opérations importées",
    keepImportedHint: "Votre journal reste tel quel.",
    deleteImported: "Les supprimer aussi",
    deleteImportedHint:
      "Seulement ce que la banque a ajouté. Ce que vous avez saisi reste.",
    confirmDisconnect: "Déconnecter",
    disconnected: "Votre banque est déconnectée.",
    notConnectedBody:
      "Voyez votre vrai solde, laissez les lignes arriver toutes seules et le bilan de vos mois se faire de lui-même.",
    unlockBalance:
      "Votre vrai solde, lu depuis votre banque à chaque actualisation",
    unlockEntries:
      "Des lignes qui arrivent et se classent d'après votre propre historique",
    unlockArrived: "Des opérations récurrentes confirmées à leur arrivée",
    unlockClose: "Des bilans de mois qui se font d'eux-mêmes le jour du relevé",
    profileLink: "Connexion bancaire",
    inviteBearing:
      "Voyez votre vrai solde, lu depuis votre banque à chaque actualisation.",
    inviteWelcome: "Laissez votre banque remplir tout cela pour vous.",
    inviteLedger:
      "Arrêtez de tout saisir\u00A0: connectez votre banque et les lignes arrivent toutes seules.",
    invitePlan:
      "Votre solde est lu pour vous, et le bilan des mois se fait de lui-même.",
    dismissInvite: "Ne plus afficher",
    orEnterBalance: "Ou saisissez votre solde à la main",
  },

  bearingMonth: {
    onAccount: "Sur votre compte",
    expectedEnd: "Prévu en fin de mois",
    startedWith: "Au début du mois",
    endedWith: "À la fin du mois",
    expectedStart: "Prévu au début du mois",
    netSoFar: "Ce mois-ci à ce jour",
    netByEnd: "D'ici la fin du mois",
    netMonth: "Ce mois-ci",
    how: {
      title: "Comment c'est calculé\u00A0?",
      net: "Sans solde de départ, le mois est compté à partir de zéro\u00A0: ce qui est entré moins ce qui est sorti. Faites le bilan d'un mois pour voir un vrai solde.",
      planned:
        "Un mois à venir ne compte que vos opérations récurrentes, à partir du solde prévu au début du mois. Les dépenses du quotidien n'y sont pas.",
      bank: "Le solde vient de votre banque. Pour le reste du mois, l'application y ajoute ce que vos opérations récurrentes doivent encore faire entrer ou sortir. Les dépenses du quotidien pas encore faites n'y sont pas.",
      close:
        "Le départ est le solde que vous avez noté au dernier bilan de mois. L'application y ajoute les opérations enregistrées depuis, puis ce que vos opérations récurrentes doivent encore faire entrer ou sortir.",
    },
    netCaption: "Ce qui est entré, moins ce qui est sorti.",
    fromBank: "Aujourd'hui, d'après votre banque",
    fromClose: "D'après votre dernier bilan, plus ce que vous avez noté depuis",
    plannedOnly:
      "Vos opérations récurrentes seulement — les dépenses du quotidien n'y sont pas",
    fromToday: "{amount} par rapport à aujourd'hui",
    lowestAhead: "Point le plus bas à venir\u00A0: {amount} le {date}",
    lowest: "Point le plus bas\u00A0: {amount} le {date}",
    toComeIn: "{amount} encore à recevoir",
    toGoOut: "{amount} encore à sortir",
    chartLabel: "Solde au fil de {month}",
    netChartLabel: "Net au fil de {month}",
    moreOutflows: {
      one: "+{count} autre",
      other: "+{count} autres",
    },
    recorded: "Enregistré",
    setBalance: "Saisir votre solde",
    setBalanceBody:
      "Saisissez une fois ce que contient votre compte, et ceci devient votre vrai solde.",
    spent: "Dépensé",
    spentLessSoFar: "{amount} de moins qu'en {month} à ce stade",
    spentMoreSoFar: "{amount} de plus qu'en {month} à ce stade",
    spentLess: "{amount} de moins qu'en {month}",
    spentMore: "{amount} de plus qu'en {month}",
    spentSame: "Comme en {month}",
    stillToCome: "Encore à venir",
    plannedThisMonth: "Prévu ce mois-ci",
    nothingToCome: "Plus rien de prévu ce mois-ci.",
    moreToCome: { one: "+{count} autre", other: "+{count} autres" },
    seeInLedger: "Voir dans le Journal",
    whereItWent: "Où c'est parti",
    everythingElse: "Tout le reste",
    run: { one: "{count} mois d'affilée", other: "{count} mois d'affilée" },
    runBody: "Bilans d'affilée sous votre marge.",
    bestRun: "Record\u00A0: {count}",
    noRunYet:
      "Faites le bilan d'un mois sous votre marge pour lancer une série.",
    invested: "Valeur de vos placements",
  },

  bearing: {
    headline: {
      onHand: "actuellement sur votre compte courant",
      free: "vous finirez le mois à",
    },
    cards: {
      month: "Ce mois-ci",
      now: "Les comptes",
      run: "Votre série",
      ahead: "L'année à venir",
      wallet: "Placements",
    },
    panel: {
      cashAccountsHeading: "Quels comptes détiennent vos liquidités",
      cashAccountsBody:
        "Faire le bilan d'un mois compare ce que ces comptes détenaient au début et à la fin avec ce que le journal indique.",
      cashAccountsLapsed: "Le consentement a expiré — rien ne peut en être lu",
    },
    spine: {
      moreWaiting: {
        one: "+{count} en attente",
        other: "+{count} en attente",
      },
    },
  },

  errorPage: {
    title: "Quelque chose s'est mal passé",
    appFailed: "L'application n'a pas pu démarrer",
    body: "Cette page n'a pas pu être chargée. Vos données sont intactes — réessayez, et si le problème persiste, déconnectez-vous puis reconnectez-vous.",
    tryAgain: "Réessayer",
    notFoundTitle: "Page introuvable",
    notFoundBody: "La page que vous cherchez n'existe pas ou a été déplacée.",
    goHome: "Retour à l'accueil",
  },

  refresh: {
    reloadEverything: "Tout recharger",
    askingBank: "Interrogation de votre banque…",
    lastChecked: "Actualiser — dernière vérification {age}",
    askBank: "Demander à votre banque s'il y a du nouveau",
    unreachable: "Impossible de joindre votre banque pour le moment.",
    coolingDown:
      "Votre banque vient d'être interrogée — réessayez dans {seconds}\u00A0s.",
    allowanceSpent:
      "Les {allowance} vérifications automatiques du jour sont épuisées. Actualiser vous-même fonctionne toujours.",
    nothingToPull: "Aucun compte connecté ne peut être lu pour le moment.",
    onlyWhenAsked:
      "Pluclair n'interroge votre banque que lorsque vous actualisez.",
    noBank: "Aucune banque n'est connectée à ce compte.",
    bankDidNotAnswer: "Votre banque n'a pas répondu pour le moment.",
    reloadedNoBank: "Rechargé — aucune banque n'est connectée.",
    reloadedRejected:
      "Rechargé — open-banking.io n'accepte plus votre fichier d'identifiants. Déposez-en un nouveau pour synchroniser à nouveau.",
    reloadedPaused:
      "Rechargé — open-banking.io a mis la synchronisation en pause jusqu'à ce que son portefeuille soit approvisionné.",
    reloadedUnreachable:
      "Rechargé — votre banque n'a pas pu être jointe. Un nouvel essai aura lieu plus tard.",
  },

  outbox: {
    waiting: {
      one: "{count} opération pas encore envoyée",
      other: "{count} opérations pas encore envoyées",
    },
    retry: "Réessayer",
  },

  picker: {
    choose: "Choisir",
    search: "Rechercher",
    searchCategories: "Rechercher une catégorie",
    chooseCategory: "Choisir une catégorie",
    kindOfCategory: "Type de catégorie",
    noMatch: "Rien ne correspond à «\u00A0{query}\u00A0».",
  },

  errors: {
    emailNotConfirmed:
      "Confirmez d'abord votre adresse\u00A0: ouvrez le lien reçu par e-mail.",
    tooManyAttempts: "Trop d'essais. Attendez quelques minutes et réessayez.",
    signInFailed: "La connexion n'a pas fonctionné. Réessayez.",
    accountExists: "Un compte existe déjà avec cette adresse. Connectez-vous.",
    signUpClosed: "Les inscriptions sont fermées pour l'instant.",
    signUpFailed: "L'inscription n'a pas fonctionné. Réessayez.",
    alreadyThere: "C'est déjà enregistré.",
    stillInUse: "C'est encore utilisé ailleurs, donc rien n'a été supprimé.",
    notAllowed: "Vous n'avez pas accès à cet élément.",
    notFound: "Introuvable — il a peut-être déjà été supprimé.",
    offline: "Pas de connexion pour l'instant. Réessayez dans un moment.",
    couldNotSave: "L'enregistrement n'a pas fonctionné. Réessayez.",
    amountPositive: "Le montant doit être positif",
    invalidDate: "Date invalide",
    nothingSelected: "Rien de sélectionné",
    tooManySelected: "Sélectionnez au plus 200 opérations à la fois",
    pickCategory: "Choisissez une catégorie",
    pickDay: "Choisissez un jour entre 1 et 28",
    pickRecurring: "Choisissez une opération récurrente",
    selectEtf: "Choisissez un ETF dans les résultats de recherche",
    endBeforeStart:
      "La date de fin doit être égale ou postérieure à la date de début",
    passwordTooShort: "Le mot de passe doit faire au moins 6 caractères",
    passwordsDiffer: "Les deux mots de passe ne sont pas identiques",
    invalidEmail: "Ce n'est pas une adresse e-mail",
    samePassword: "Le nouveau mot de passe doit être différent de l'ancien",
    passwordTooWeak:
      "Ce mot de passe est trop faible — choisissez-en un plus long ou moins courant",
    passwordNotSaved:
      "Le mot de passe n'a pas pu être enregistré. Demandez un nouveau lien et réessayez.",
    resetTooMany:
      "Trop de liens demandés. Attendez quelques minutes et réessayez.",
    resetNotSent: "Le lien n'a pas pu être envoyé. Réessayez dans un instant.",
    descriptionTooLong: "Le libellé doit faire 500 caractères ou moins",
    nameTooLong100: "Le nom doit faire 100 caractères ou moins",
    nameRequiredCustom: "Le nom est obligatoire pour une ligne personnalisée",
    shareCountRequired: "Le nombre de parts est obligatoire",
    followsPurchasesMonthly: "Un virement qui suit vos DCA est mensuel",
    followsPurchasesCategory:
      "Seul un virement vers le courtier peut suivre vos DCA",
    noDcaToFollow:
      "Aucun DCA le mois suivant\u00A0: indiquez un montant pour ce virement",
    capNotNegative: "Un budget ne peut pas être négatif",
    zeroOrMore: "Doit être 0 ou plus",
    positiveNumber:
      "Saisissez un nombre positif (virgule ou point pour les décimales)",
    chargeAsPercent: "Saisissez les frais en pourcentage, par exemple 0,20",
    chargeTooHigh:
      "Cela semble trop élevé — saisissez 0,20 pour 0,20\u00A0%, pas 20",
    notAnIsin: "Cela ne ressemble pas à un ISIN, par exemple IE00B4L5Y983",
    notABalance: "Cela ne ressemble pas à un solde",
    notACap: "Cela ne ressemble pas à un budget",
    nothingToImport: "Rien à importer",
    tooManyRows: "Importez au plus 2000 lignes à la fois",
    undoGone: "Cette suppression ne peut plus être annulée.",
    invalidInput: "Saisie invalide",
    notAuthenticated: "Non authentifié",
    nameRequired: "Le nom est obligatoire",
    nameTooLong: "Le nom est trop long",
    areaRequired: "Indiquez la surface en m²",
    shareRange: "La part doit être comprise entre 0 et 100\u00A0%",
    roomsRange: "Le nombre de pièces va de 1 à 100",
    growthRange: "La hausse doit être comprise entre −20 et 20\u00A0% par an",
    rateRange: "Le taux doit être compris entre 0 et 20\u00A0%",
    insuranceRateRange:
      "Le taux d'assurance doit être compris entre 0 et 5\u00A0%",
    monthsRange: "La durée doit être comprise entre 1 et 600 mois",
    insuranceOneWay:
      "L'assurance est un montant par mois ou un taux, pas les deux",
    inFineNoDeferral: "Un prêt in fine n'a pas de différé",
    deferralMonthsRequired: "Indiquez combien de mois dure le différé",
    deferralTooLong: "Le différé doit laisser au moins une échéance à payer",
    // DELETE stays in English: it is a word the user has to type back
    // exactly, checked by `z.literal("DELETE")` in `../../validations/profile`,
    // so translating the prompt without translating the literal would lock
    // French readers out of their own account deletion.
    deleteConfirmation: "Tapez DELETE pour confirmer",
    targetsMustTotal100: "Les cibles doivent totaliser 100\u00A0%.",
  },
  actions: actionsFr,
  removal: removalFr,
  planPhone: planPhoneFr,
  planWeb: planWebFr,
  futurePlan: futurePlanFr,
  accounts: accountsFr,
  placementsWeb: placementsWebFr,
  placementsPhone: placementsPhoneFr,
  moreScreens: moreScreensFr,
  formPickers: formPickersFr,
  reviewScreens: reviewScreensFr,
  planScreen: planScreenFr,
  homeScreen: homeScreenFr,
  property: propertyFr,
};
