import type { Messages } from "./en";

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
    bearing: "Cap",
    ledger: "Journal",
    charges: "Charges",
    plan: "Plan",
    wallets: "Portefeuilles",
    profile: "Profil",
    ledgerList: "Liste",
    ledgerCalendar: "Calendrier",
    ledgerByCategory: "Par catégorie",
    walletsPositions: "Positions",
    walletsLookThrough: "Transparence",

    waiting: "{count} en attente",
  },

  pages: {
    categories: "Catégories",
    import: "Importer",
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
    budgetsAndGoals: "Plafonds et objectifs",
    currency: "Devise",
    securitySection: "Sécurité",
    securityFooterWeb:
      "Connexion sans mot de passe, liée à ce site et stockée sur votre appareil.",
    appUnlock: "Déverrouillage",
    unlockWithBiometrics: "Déverrouiller par biométrie",
    passkeys: "Clés d'accès",
    notificationsSection: "Notifications",
    notificationsFooterWeb:
      "Ce navigateur uniquement — votre téléphone a ses propres rappels.",
    notificationsFooterMobile:
      "Des rappels pour ce qui revient, et une alerte quand la banque laisse quelque chose sans catégorie.",
    remindersAndNudges: "Rappels et alertes",
    dataSection: "Données",
    deleteAllData: "Supprimer toutes les données",
    deleteConfirmLabel: "Tapez DELETE pour confirmer",
    deleteConfirmPlaceholder: "Tapez DELETE",
    deleting: "Suppression…",
    deleteAllMyData: "Supprimer toutes mes données",
    deleteAccount: "Supprimer le compte",
    deleteMyAccount: "Supprimer mon compte",
    saved: "Enregistré",
    wipeBlurb:
      "Transactions, modèles récurrents, positions et catégories. Votre compte reste.",
    closeBlurb: "Définitif. Tout ce qui précède part avec.",
    deleteNeedsServiceKey:
      "La suppression du compte exige SUPABASE_SERVICE_ROLE_KEY sur le serveur (en local\u00A0: .env.local, en production\u00A0: les variables d'environnement Vercel).",
  },

  passkeys: {
    none: "Aucune clé d'accès pour l'instant.",
    unnamed: "Clé d'accès",
    added: "Ajoutée le {date}",
    working: "Un instant…",
    add: "Ajouter une clé d'accès",
  },

  ledger: {
    applyPending: "Application…",
    applyRecurring: "Appliquer les récurrents",
    applyWaiting: "Des récurrents attendent d'être appliqués",
    applyAllDone: "Toutes les échéances récurrentes sont déjà appliquées",
    applyNothing: "Rien à appliquer",
    applyResult: "Récurrents appliqués\u00A0: {parts}",
    applyAdded: "{count} ajoutés",
    applyUpdated: "{count} mis à jour",
    emptyTitle: "Rien d'enregistré ce mois-ci",
    emptyBody:
      "Ajoutez une transaction, ou appliquez les charges que vous savez déjà récurrentes.",
    searchPlaceholder: "Chercher une catégorie ou une note…",
    searchLabel: "Chercher dans les transactions",
    filterByCategory: "Filtrer par catégorie",
    filterByTag: "Filtrer par étiquette",
    filterTransactions: "Filtrer les transactions",
    allCategories: "Toutes les catégories",
    allTags: "Toutes les étiquettes",
    selectDone: "Terminé",
    select: "Sélectionner",
    clearAll: "Tout désélectionner",
    selectAll: "Tout sélectionner",
    exportCsv: "Exporter ces transactions en CSV",
    importCsv: "Importer un relevé CSV",
    exportNothing: "Rien à exporter pour cette vue",
    noMatchTitle: "Aucune transaction correspondante",
    noMatchBody: "Essayez une autre recherche ou un autre filtre.",
    entryCount: {
      one: "{count} transaction",
      other: "{count} transactions",
    },
    shownOfTotal: {
      one: "{count} transaction sur {total}",
      other: "{count} transactions sur {total}",
    },
    exported: {
      one: "{count} transaction exportée",
      other: "{count} transactions exportées",
    },
    in: "Entré",
    out: "Sorti",
    leftAtMonthEnd: "Restant en fin de mois",
    clearFilters: "Effacer les filtres",
    selectRow: "Sélectionner {name}",
    editRow: "Modifier {name}",
    theNewCategory: "la nouvelle catégorie",
    deleted: {
      one: "{count} transaction supprimée",
      other: "{count} transactions supprimées",
    },
    moved: {
      one: "{count} transaction déplacée vers {name}",
      other: "{count} transactions déplacées vers {name}",
    },
    add: "Ajouter",
    addTransaction: "Ajouter une transaction",
    importCsvShort: "Importer un CSV",
    clearSearch: "Effacer la recherche",
    allTypes: "Tous les types",
    restore: "Restaurer",
    review: "Vérifier",
    fillThisMonth: "Remplir ce mois-ci",
    selectHint: "Touchez pour sélectionner · Terminé pour quitter",
    editHint: "Touchez pour modifier · appui long pour sélectionner",
    needsCategory: {
      one: "{count} transaction attend une catégorie",
      other: "{count} transactions attendent une catégorie",
    },
    needsCategoryAction: {
      one: "{count} transaction attend une catégorie. Vérifier",
      other: "{count} transactions attendent une catégorie. Vérifier",
    },
    repeatTitle: "Répéter aujourd'hui ?",
    repeatBody: "Ajoute un autre {category} de {amount} daté d'aujourd'hui.",
    repeatConfirm: "Ajouter pour aujourd'hui",
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
      one: "{count} transaction importée",
      other: "{count} transactions importées",
    },
    intro:
      "Exportez un CSV depuis votre banque et déposez-le ici. Le fichier est lu dans votre navigateur — rien n'est envoyé, et rien n'est enregistré tant que vous n'avez pas relu chaque ligne.",
    dropFile: "Déposez un fichier .csv ici",
    fileTooLarge: "Ce fichier dépasse 5\u00A0Mo — est-ce le bon export\u00A0?",
    fileNoRows: "Ce fichier ne contient aucune ligne.",
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
    runwayLead: "Tout ce que vous avez enregistré comme épargne couvre",
    runwayRate: "à {amount} par mois.",
    capsHeading: "Plafonds de dépense",
    addCap: "Ajouter un plafond",
    addCapSubmit: "Ajouter le plafond",
    update: "Mettre à jour",
    cancel: "Annuler",
    monthlyLimit: "Plafond mensuel",
    capSaved: "Plafond enregistré",
    capRemoved: "Plafond supprimé",
    goalsHeading: "Objectifs d'épargne",
    addGoal: "Ajouter un objectif",
    addGoalSubmit: "Ajouter l'objectif",
    updateGoal: "Mettre à jour l'objectif",
    goalTarget: "Objectif",
    goalTargetDate: "Date cible",
    goalSaved: "Objectif enregistré",
    goalRemoved: "Objectif supprimé",
    allSavings: "Toute l'épargne",
    tagsHeading: "Étiquettes",
    tagsBlurb:
      "Une deuxième façon de regrouper une transaction, en travers des catégories — des vacances, un colocataire, un projet à côté.",
    newTag: "Nouvelle étiquette",
    addTag: "Ajouter l'étiquette",
    tagAdded: "Étiquette ajoutée",
    goalName: "Nom de l'objectif",
    deleteGoalTitle: "Supprimer cet objectif\u00A0?",
    deleteCapTitle: "Supprimer ce plafond\u00A0?",
    deleteWarning: "C'est irréversible. Vos transactions ne sont pas touchées.",
    goalReached: "Objectif atteint\u00A0!",
    goalOverdue: "Date cible dépassée — {amount} encore à épargner.",
    goalOnSchedule: "Épargnez {amount}/mois pour y arriver avant {month}.",
    globalMonthlyLimit: "Plafond mensuel global",
    goalTargetDateOptional: "Date cible (facultative)",
    goalStartsOn: "Compter à partir du",
    goalStartsOnHint: "L'épargne à partir de ce jour compte pour l'objectif.",
    linkCategoriesTitle: "Catégories",
    linkCategoriesHint: "Là où l'argent a le droit d'aller",
    linkImportTitle: "Importer un relevé",
    linkImportHint: "Un CSV, quand il n'y a pas de connexion bancaire",
    capsBlurb:
      "Un plafond est un maximum mensuel — sur une catégorie, ou sur tout. Ajoutez-en un et vous verrez où vous en êtes.",
    goalsBlurb:
      "Un objectif est un montant à atteindre — un apport, un voyage, une réserve. Mettez de l'argent de côté dans une catégorie d'épargne et il se remplit.",
    capOn: "Plafond sur {label}",
    capRemoveHint: "Appui long pour supprimer ce plafond",
    goalNamed: "Objectif {name}",
    goalRemoveHint: "Appui long pour supprimer cet objectif",
    amountOfTotal: "{amount} sur {total}",
    editCapOn: "Modifier le plafond sur {label}",
    editGoalNamed: "Modifier l'objectif {name}",
    capScope: "Portée",
    trackCategoryOptional: "Catégorie suivie (facultative)",
  },

  recurring: {
    on: "Actif",
    off: "Inactif",
    addTitle: "Ajouter un récurrent",
    editTitle: "Modifier le récurrent",
    addTitleMobile: "Ajouter un récurrent",
    editTitleMobile: "Modifier le récurrent",
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
    dayOfWeekNumeric: "Jour de la semaine (1 = lundi, 7 = dimanche)",
    startsOn: "Commence le",
    endsOn: "Se termine le",
    noStartDate: "Pas de date de début",
    noEndDate: "Pas de date de fin",
    amount: "Montant",
    annualAmount: "Montant annuel",
    amountType: "Type de montant",
    fixedAmount: "Montant fixe en EUR",
    sharesTimesPrice: "Parts × cours",
    shareCount: "Nombre de parts",
    wholeSharesOnly: "Saisissez un nombre entier de parts",
    estimatedAmount: "Montant estimé",
    fetchingPrice: "Récupération du cours…",
    perSharePrice: "@ {price} / part",
    convertedFrom: "({amount} converti)",
    descriptionOptional: "Libellé (facultatif)",
    monthOfYear: "Mois",
    monthOfYearNumeric: "Mois (de 1 à 12)",
    activePeriod: "Période d'activité (facultative)",
    activePeriodNote:
      "Laissez les deux vides pour que ça tourne jusqu'à ce que vous l'arrêtiez. Renseignez les deux pour un échéancier fixe\u00A0: une taxe foncière étalée sur plusieurs mois, par exemple.",
    saving: "Enregistrement…",
    save: "Enregistrer",
    delete: "Supprimer",
    deleteItem: "Supprimer le récurrent",
    deleteExplanation:
      "Supprimer ce modèle récurrent\u00A0? Les transactions passées restent dans votre journal.",
    deleting: "Suppression…",
    confirmDelete: "Confirmer la suppression",
    savedHint:
      "Enregistré. Appliquez les récurrents dans le Journal pour voir le changement.",
    updatedHint:
      "Mis à jour. Appliquez les récurrents dans le Journal pour voir le changement.",
    deletedHint:
      "Supprimé — appliquez les récurrents dans le Journal pour voir le changement.",
    brokerDcaNote:
      "Les achats chez le courtier sont suivis pour information mais ne réduisent pas votre budget restant.",
    bitstackNote:
      "Achat hebdomadaire à montant fixe en EUR sur Bitstack. La valeur de marché dans Portefeuilles utilise votre total BTC × le cours BTC/EUR en direct.",
    sharesNote:
      "Choisissez votre ETF et le nombre de parts. Cherchez par nom ou par ISIN (ex. LU1681043599). L'application récupère le cours en direct et calcule le montant en euros à l'enregistrement ou à l'application.",
    yearlyNote:
      "Compté comme une part mensuelle dans votre budget (annuel ÷ 12). Le paiement complet est enregistré une fois, le mois dû.",
    trackedFund: "ETF ou fonds suivi",
    trackedFundNote:
      "Une charge à montant fixe en euros\u00A0: indiquez l'ETF qu'elle achète. Dans Portefeuilles, saisissez le nombre total de parts que vous détenez pour une valeur de marché en direct.",
    bitcoinTitle: "Charge en bitcoin",
    bitcoinNote:
      "Chaque achat convertit votre montant en euros en BTC. Saisissez votre solde BTC total dans Portefeuilles pour une valeur en direct.",
  },

  instrument: {
    label: "ETF ou fonds",
    resultsLabel: "Instruments correspondants",
    searching: "Recherche…",
    isinKeepTyping: "Un ISIN fait 12 caractères — continuez…",
    noResults:
      "Aucun instrument trouvé. Essayez un nom ou un ISIN de 12 caractères.",
  },

  applyRecurring: {
    blurb:
      "Écrit les transactions que les charges de ce mois réclament. Ce que vous avez déjà enregistré n'est pas touché, sauf si vous confirmez les mises à jour ci-dessous.",
    repriceNote: {
      one: "{count} échéance est valorisée au marché et encore datée à venir. Elle suit son instrument toute seule — rien à confirmer.",
      other:
        "{count} échéances sont valorisées au marché et encore datées à venir. Elles suivent leurs instruments toutes seules — rien à confirmer.",
    },
    updateExisting: "Mettre à jour l'existant ({count})",
    updateExistingNote:
      "Elles ont déjà été appliquées, mais le modèle récurrent a changé depuis\u00A0: son montant, son libellé ou sa catégorie.",
    addNew: "Ajouter les nouvelles ({count})",
    noteUpdated: "Libellé aligné sur le modèle récurrent",
    movedToCategory: "Déplacée vers la catégorie du modèle récurrent",
    applying: "Application…",
    nothingSelected: "Rien de sélectionné",
    applySelected: {
      one: "Appliquer la sélection ({count})",
      other: "Appliquer la sélection ({count})",
    },
    applyNew: {
      one: "Appliquer {count} nouvelle",
      other: "Appliquer {count} nouvelles",
    },
  },

  recurringProposals: {
    lead: {
      one: "{count} charge de votre relevé a l'air de se répéter.",
      other: "{count} charges de votre relevé ont l'air de se répéter.",
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
    addTitle: "Ajouter une transaction",
    editTitle: "Modifier la transaction",
    close: "Fermer",
    category: "Catégorie",
    filterCategories: "Filtrer les catégories",
    filterCategoriesPlaceholder: "Filtrer les catégories…",
    amount: "Montant",
    date: "Date",
    note: "Note (facultatif)",
    notePlaceholder: "Libellé",
    selectCategory: "Choisir une catégorie",
    tags: "Étiquettes",
    saving: "Enregistrement…",
    saveTransaction: "Enregistrer la transaction",
    saved: "Transaction enregistrée",
    duplicating: "Duplication…",
    duplicateToToday: "Dupliquer à aujourd'hui",
    duplicated: "Dupliquée à aujourd'hui",
    deleteTransaction: "Supprimer la transaction",
    deleting: "Suppression…",
    confirmDelete: "Oui, supprimer",
    deleted: "Transaction supprimée",
    skipThisDate: "Passer ce mois / cette date",
    skipping: "Exclusion…",
    confirmSkip: "Oui, passer cette date",
    skipped: "Cette date est passée — elle ne sera pas réappliquée",
    skipExplanation:
      "Passer cette date seulement\u00A0? La transaction sera retirée et Appliquer ne la recréera pas. Le modèle récurrent reste actif pour les mois suivants.",
    deleteExplanation:
      "Supprimer définitivement cette transaction\u00A0? Appliquer pourra la réécrire si le modèle récurrent la réclame toujours.",
    cancel: "Annuler",
  },

  charges: {
    blurb: "Ce que vous savez déjà devoir payer, chaque mois.",
    tileIncome: "Revenus",
    tileCommitted: "Engagé",
    tileSetAside: "Mis de côté",
    tileLeft: "Reste",
    perMonth: "Par mois",
    perMonthSuffix: " / mois",
    noIncomeYet: "Aucun revenu récurrent — ajoutez-en un et ceci se remplira.",
    ofWhichMovedBefore: "dont",
    ofWhichMovedAfter: "déplacés chez le courtier — suivis, mais pas dépensés.",
    nothingHereYet: "Rien ici pour l'instant.",
    editNamed: "Modifier {name}",
    addCharge: "Ajouter une charge",
    kindOfCharge: "Type de charge",
    activate: "Activer",
    deactivate: "Désactiver",
    toggleFor: "{action} {name}",
    fixedToBitcoin: "Montant fixe en EUR → Bitcoin",
    emptyTitle: "Aucune charge pour l'instant",
    emptyBody:
      "Loyer, abonnements, un virement mensuel vers l'épargne — tout ce que vous savez déjà à venir.",
    emptyTitleMobile: "Qu'est-ce qui revient chaque mois\u00A0?",
    emptyBodyMobile: "Loyer, salaire, abonnements, un achat d'ETF mensuel.",
    openLedgerToApply: "Ouvrir le Journal pour appliquer ces charges",
    applyPendingBefore: "Ces charges ont changé depuis l'écriture de ce mois.",
    applyPendingLink: "Ouvrez le Journal",
    applyPendingAfter: "et appliquez-les.",
    remindTitle: "Un rappel avant qu'elles ne passent\u00A0?",
    remindBody:
      "Un rappel la veille de chaque échéance, pour que rien ne passe inaperçu. Entièrement sur votre appareil.",
    remindYes: "Me rappeler",
    remindNo: "Non merci",
    remindNeedsPermission: "Les rappels demandent l'autorisation de notifier",
    remindOn: "Rappels activés — vous serez prévenu la veille",
  },

  quickAdd: {
    title: "Ajouter une transaction",
    close: "Fermer",
    deleteLastDigit: "Effacer le dernier chiffre",
    date: "Date",
    category: "Catégorie",
    searchCategories: "Chercher une catégorie",
    searchCategoriesPlaceholder: "Chercher une catégorie…",
    filterCategories: "Filtrer les catégories",
    filterCategoriesPlaceholder: "Filtrer les catégories…",
    changeCategory: "{name} — changer",
    notePlaceholder: "C'était pour quoi\u00A0?",
    saving: "Enregistrement…",
    save: "Enregistrer",
    saveAndAnother: "Enregistrer et en ajouter une autre",
    saved: "Transaction enregistrée",
    savedOffline:
      "Enregistrée sur cet appareil — elle sera synchronisée dès le retour en ligne",
    amount: "Montant",
    note: "Note",
    tags: "Étiquettes",
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
      "Deux minutes maintenant, et Cap affichera de vrais chiffres au lieu de zéros.",
    currencyTitle: "Dans quelle devise pensez-vous\u00A0?",
    currencyBody:
      "Tous les montants de l'application sont affichés ainsi. Vous pourrez changer plus tard dans Profil.",
    incomeTitle: "Qu'est-ce qui entre\u00A0?",
    incomeBody:
      "Vos revenus mensuels sont la référence de tout le reste. Ajoutez-les une fois et ils reviennent chaque mois.",
    expensesTitle: "Qu'est-ce qui sort\u00A0?",
    expensesBody:
      "Loyer, abonnements, factures — les charges que vous savez déjà à venir. C'est ce qui rend la projection utile.",
    capTitle: "Sur quoi préférez-vous ne pas déraper\u00A0?",
    capBody:
      "Choisissez une catégorie et un plafond mensuel. Un panneau dans Cap affichera un anneau qui se remplit à mesure que vous dépensez. Vous pourrez en ajouter d'autres dans Plan.",
    monthlyAmount: "Montant mensuel",
    dayOfMonth: "Jour du mois",
    monthlyCap: "Plafond mensuel",
    category: "Catégorie",
    continue: "Continuer",
    back: "Retour",
    skipForNow: "Passer pour l'instant",
    saving: "Enregistrement…",
    addIncome: "Ajouter le revenu",
    incomeAdded: "Revenu ajouté",
    adding: "Ajout…",
    addThisOne: "Ajouter celle-ci",
    setCapAndFinish: "Fixer le plafond et terminer",
    addedCount: {
      one: "{count} ajoutée — ajoutez-en une autre ou terminez ci-dessous.",
      other: "{count} ajoutées — ajoutez-en une autre ou terminez ci-dessous.",
    },
    reopen: "Prise en main",
    templateAdded: "{name} ajouté",
  },

  categories: {
    blurb:
      "Les catégories organisent vos transactions et vos récurrents. Une catégorie archivée garde son historique mais n'apparaît plus à la saisie.",
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
      "Si elle est utilisée par des transactions ou des récurrents, archivez-la plutôt.",
    emptyTitle: "Ajoutez votre première catégorie",
    emptyBody: "Revenus, dépenses, épargne, investissements.",
    countsTowardBudget: "Compte dans le budget mensuel",
    countsHintIncome:
      "Décochez pour de l'argent qui revient plutôt qui entre — un ami qui règle sa part, un remboursement. Il est retiré des dépenses du mois au lieu d'être compté comme un revenu.",
    countsHintSavings:
      "Décochez pour de l'argent qui ressort de l'épargne — un virement vers votre compte courant. Il est retiré de ce que vous avez mis de côté, et sort de la réserve derrière l'autonomie.",
    countsHintInvestment:
      "Décochez pour un achat de portefeuille suivi hors budget (par exemple des achats financés par un virement chez le courtier).",
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
    rerank: "Faire classer par un modèle",
    reranked: "Classé par un modèle",
    rerankStale: "Les chiffres ont bougé depuis ce classement.",
  },

  categoryScreen: {
    empty: "Rien à revoir pour l'instant",
    emptyBody:
      "Dès que quelques mois auront des transactions, la série de chaque catégorie apparaîtra ici.",
    normal: "{amount} dans un mois normal",
    normalShifted: "{amount} par période de paie",
    periodShifted:
      "Ces mouvements tombent de part et d'autre d'une fin de mois : chacun est compté dans la période à laquelle il appartient. Un mois ici peut différer du même mois dans le Ledger.",
    groupExpense: "Ce qui sort",
    groupIncome: "Ce qui entre",
    groupSavings: "Mis de côté",
    groupInvestment: "Investi",
    open: "Ouvrir {name}",
    close: "Fermer",
    behindThisMonth: "Derrière {month}",
    seeInLedger: "Tout voir dans le Ledger",
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
    marketValue: "Valeur de marché",
    value: "Valeur",
    invested: "Investi",
    market: "Marché",
    profitLoss: "+/-",
    walletPicker: "Portefeuille d'investissement",
    rangeAll: "Tout",
    positions: "Positions",
    orderBy: "Trier",
    orderByName: "Nom",
    orderByInvested: "Investi",
    noItems: "Aucune ligne dans ce portefeuille pour l'instant.",
    editPosition: "Modifier {name}",
    investedSuffix: "investi",
    fundingLabel: "Versements mensuels",
    perMonth: "/mois",
    emptyTitle: "Aucun investissement suivi pour l'instant",
    emptyBody:
      "Ajoutez des lignes dans chaque portefeuille pour suivre ce que vous avez investi et sa valeur actuelle.",
    emptyTitleMobile: "Ouvrir un portefeuille",
    emptyBodyMobile: "PEA, CTO et crypto arrivent ici.",
    trackTitle: "Suivre un investissement",
    trackBody: "Une contribution récurrente devient une position.",
    addBtcForValue:
      "Renseignez le total BTC pour la valeur de marché en direct",
    addSharesForValue:
      "Renseignez le nombre de parts pour la valeur de marché en direct",
    transferAmountPlaceholder: "Montant",
    addTransfer: "Ajouter le virement",
    deleteTransferTitle: "Supprimer ce virement\u00A0?",
    deleteTransferBody:
      "L'enregistrement du virement est retiré\u00A0; vos transactions ne sont pas touchées.",
  },

  fundCost: {
    title: "Ce que coûte la détention",
    weightedSuffix: "par an, pondéré",
    emptyBody:
      "Renseignez les frais courants de chaque ligne — la commission annuelle indiquée sur son DIC — et ceci devient un montant en euros. C'est le premier poste de coût de la plupart des portefeuilles, et le seul qui n'apparaît sur aucun relevé.",
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
    closeMonth: "Clôturer {month}",
    balance: "Solde",
    balancePrompt:
      "Combien votre compte contenait-il le {date}\u00A0? Additionnez les comptes d'où partent vos dépenses courantes — un seul chiffre suffit.",
    baselineNote:
      "Cette première clôture ne fixe que le point de départ. Il n'y a encore rien à comparer\u00A0; le mois prochain, si.",
    sameDayNote:
      "Relevez-le le même jour chaque mois. Ainsi les paiements par carte encore en route faussent la lecture de la même façon à chaque fois, et les mois restent comparables.",
    working: "Calcul…",
    seeWhatThatMeans: "Voir ce que cela donne",
    couldNotWorkOut: "Impossible de calculer cela.",
    couldNotClose: "Impossible de clôturer le mois.",
    startingPointSet: "Point de départ fixé",
    somethingMissing: "Il manque quelque chose",
    youKept: "Vous avez gardé {amount}",
    costMoreThanItBrought: "{month} a coûté plus qu'il n'a rapporté",
    keptRate:
      "{rate}% de ce qui est entré, en comptant ce que vous avez mis de côté.",
    keptRateUnknown: "En comptant ce que vous avez mis de côté.",
    cameIn: "Entré",
    recordedSpending: "Dépenses enregistrées",
    setAside: "Mis de côté",
    neverRecorded: "Jamais enregistré",
    overAllowance: "C'est {over} au-delà de votre enveloppe de {cap}.",
    insideAllowance: "Dans votre enveloppe de {cap}, avec {spare} de marge.",
    normalMonth: "Un mois normal chez vous tourne autour de {amount}.",
    unrecordedBlurb:
      "Des dépenses dont l'application n'a jamais entendu parler — les restaurants, les tournées, ce qu'on achète en rentrant. Rien à corriger, juste bon à savoir.",
    closing: "Clôture…",
    changeTheBalance: "Modifier le solde",
    done: "Terminé",
    reopen: "Ce solde était faux — réouvrir le mois",
    reopenShort: "Ce solde était faux — réouvrir",
    close: "Fermer",
    balanceOn: "Solde au {date}",
    unexplainedCredit:
      "Le compte contient {amount} de plus que les mouvements enregistrés ne le permettent. En général cela veut dire un revenu jamais saisi — ou une dépense saisie deux fois, ou un virement chez le courtier enregistré à la fois comme transaction et comme virement.",
    runwayBought: {
      one: "Cela fait {count} jour d'autonomie gagné.",
      other: "Cela fait {count} jours d'autonomie gagnés.",
    },
    setStartingBalance: "Fixez votre solde de départ",
    inviteBaseline:
      "Saisissez ce que votre compte contient réellement aujourd'hui. Dès le mois prochain, l'application pourra le comparer à ce qu'elle a enregistré et vous dire ce qu'elle n'a jamais vu — des espèces, un paiement oublié, une carte que vous ne suivez pas.",
    inviteAllowance:
      "Restez sous {cap} de dépenses non enregistrées pour garder la série en vie.",
    inviteNormal:
      "Un mois normal chez vous tourne autour de {amount} que l'application ne voit jamais.",
    inviteBare:
      "Un seul solde, et l'application peut calculer ce qu'elle n'a jamais vu.",
    closeTheMonth: "Clôturer le mois",
    monthsInARow: {
      one: "{count} mois d'affilée",
      other: "{count} mois d'affilée",
    },
    filledFromBank:
      "Rempli depuis votre banque. Modifiez-le si le jour de lecture n'est pas aujourd'hui.",
    balanceUnreadable:
      "Cela ne ressemble pas à un montant. Essayez plutôt {example}.",
    balancePlaceholder: "2400,50",
    reopened: "{month} réouvert",
    baselineSet:
      "{amount} au {date}. Clôturez le mois prochain et l'application pourra commencer à vous dire ce qu'elle n'a jamais vu.",
  },

  inbox: {
    fromYourBank: "De votre banque",
    review: "À vérifier",
    recentlyAdded: "Ajouté récemment",
    needsCategory: "Attend une catégorie",
    nothingWaiting: "Rien en attente",
    thatsTheInbox: "C'est tout",
    fetching: "Récupération…",
    fetchEverything: "Tout récupérer",
    pickCategoryFirst: "Choisissez d'abord une catégorie",
    adding: "Ajout…",
    add: "Ajouter",
    later: "Décider plus tard",
    done: "Terminé",
    close: "Fermer",
    filterCategories: "Filtrer les catégories",
    filterCategoriesPlaceholder: "Filtrer les catégories…",
    leftForLater: {
      one: "{count} laissée pour plus tard — elle est encore à vérifier.",
      other: "{count} laissées pour plus tard — elles sont encore à vérifier.",
    },
    taughtIt:
      "Tout ce que l'application reconnaissait déjà est passé directement. Répondre à celles-ci le lui apprend pour la prochaine fois.",
    nothingFromBank: "Rien en attente du côté de votre banque.",
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

  selectionBar: {
    region: "Transactions sélectionnées",
    regionMobile: {
      one: "{count} transaction sélectionnée",
      other: "{count} transactions sélectionnées",
    },
    countSelected: "{count} sélectionnées",
    move: "Déplacer",
    moveTo: {
      one: "Déplacer {count} transaction vers",
      other: "Déplacer {count} transactions vers",
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
      one: "{count} vient d'un modèle récurrent",
      other: "{count} viennent de modèles récurrents",
    },
  },

  calendarView: {
    monthlyCalendar: "Calendrier du mois",
    dayLabel: "{day} — {entries}",
    inAndOut: "{income} en entrée · {outflow} en sortie",
    selectedDay: "Détail du jour sélectionné",
    noTransactions: "Aucune transaction",
    emptyTitle: "Rien ce jour-là",
    emptyBody: "Ajoutez une transaction ou choisissez une autre date.",
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
    noAccount: "Pas de compte\u00A0?",
    noAccountYet: "Pas encore de compte\u00A0?",
    createOne: "En créer un",
    or: "ou",
    welcomeBack: "Content de vous revoir",
    signUpHeading: "Commencez à suivre vos revenus et vos dépenses",
    linkExpired: "Lien de connexion expiré ou invalide. Veuillez réessayer.",
    redirecting: "Redirection…",
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
    closingBalance: "Solde de clôture",
    howItAddsUp: "Comment on y arrive",
    monthRead: "Lecture du mois",
    whereItWent: "Où c'est parti",
    whatsLeft: "Ce qu'il reste",
    expectedImpact: "Impact prévu",
    expectedImpactPerMonth: "Impact prévu par mois",
    portfolioValue: "Valeur du portefeuille",
    monthlyBudgets: "Plafonds mensuels",
    savingsGoals: "Objectifs d'épargne",
    sampleHousing: "Logement",
    sampleEverythingElse: "Tout le reste",
    oneShare: "1 part",
    oneShareAtQuote: "1 part au cours actuel",
    sharePriced: "Au cours",
    templatesAllApplied: {
      one: "{count} récurrent, appliqué",
      other: "{count} récurrents, tous appliqués",
    },
  },

  marketingStat: {
    unrecordedIn: "Non enregistré en {month}",
    underAllowance: "sous votre enveloppe de {amount}",
    ofWhatCameIn: "{percent} de ce qui est entré",
    monthsValue: {
      one: "{count} mois",
      other: "{count} mois",
    },
    monthsInARow: {
      one: "{count} mois d'affilée",
      other: "{count} mois d'affilée",
    },
    inARow: "{count} d'affilée",
    inARowInsideAllowance: "d'affilée sous l'enveloppe",
    readyToClose: "{month} est prêt à être clôturé",
    keepTheRun:
      "Restez sous {amount} de dépenses non enregistrées pour continuer la série.",
    keptIn: "Gardé en {month}",
    leftIn: "Reste en {month}",
    ofEarned: "sur {amount} gagnés",
  },

  position: {
    fromRecurring: "Depuis un récurrent",
    customHolding: "Ligne personnalisée",
    noRecurringAvailable:
      "Aucun récurrent disponible pour ce portefeuille. Créez-en un sur la page Charges, ou utilisez une ligne personnalisée.",
    nameLabel: "Nom",
    namePlaceholder: "ex. ETF MSCI World",
    costBasis: "Total investi (prix de revient)",
    costBasisHint:
      "Le total investi indiqué par votre courtier pour cette ligne. Sert au calcul du +/- ; il n'est pas mis à jour par les transactions récurrentes.",
    changeFundPrefix: "Changez le fonds sur la page",
    changeFundLink: "Charges",
    changeFundSuffix: ".",
    linkEtfPrefix: "Liez d'abord votre ETF depuis",
    linkEtfLink: "Charges → {name}",
    linkEtfSuffix: ", puis saisissez le nombre total de parts ci-dessous.",
    chargePlaceholder: "ex. 0,20",
    isinLabel: "ISIN (facultatif)",
    isinHint:
      "Douze caractères, sur le DIC ou la fiche du fonds. La transparence en a besoin pour lire la composition ; les actions et le Bitcoin peuvent rester vides.",
    moneyWeightedReturn: "Rendement pondéré par les flux",
    amountIn: "versés",
    amountNow: "aujourd'hui",
    returnExplainer:
      "Annualisé sur chaque versement daté, pour qu'un versement mensuel soit comparé équitablement à un apport unique. Le gain absolu seul avantagerait celui dont l'argent est resté investi le plus longtemps.",
    ofTarget: "sur {target} visé",
    splitLeadPrefix: "Vos prochains",
    splitLeadSuffix: "combleraient l'écart le plus vite ainsi :",
    splitItemTo: "vers {wallet}",
    splitTail: " — rééquilibrer par les versements plutôt qu'en vendant.",
    noTargetHint:
      "Définissez une répartition cible pour voir la dérive du portefeuille et savoir où doit aller le prochain versement.",
    peaPaidIn: "Versé",
    peaOfCeiling: "sur {ceiling}",
    peaRoomLeft: "de marge restante",
    peaCashOnly:
      "Seuls les versements comptent dans le plafond ; la performance, non.",
    addItem: "Ajouter une ligne",
    addCryptoItem: "Ajouter une ligne crypto",
    itemAdded: "Ligne ajoutée",
    itemUpdated: "{name} mis à jour",
    itemRemoved: "{name} retiré",
    pickRecurring: "Choisissez-en un…",
    liveEstimate: "Estimation au cours du marché\u00A0:",
    itemType: "Type de ligne",
    recurringItem: "Récurrent associé",
    dcaBitcoin: "Montant fixe chaque mois · Bitcoin sur Bitstack",
    dcaEtf: "Montant fixe chaque mois · ETF défini dans Plan",
    trackedAsset: "Actif suivi",
    trackedEtf: "ETF suivi",
    bitcoin: "Bitcoin",
    shares: "Parts",
    totalBtc: "Total BTC",
    totalShares: "Total des parts",
    totalBtcHeld: "Total BTC détenu",
    totalSharesHeld: "Total des parts détenues",
    sharesHeldOptional: "Parts détenues (facultatif)",
    btcHint:
      "Depuis Bitstack — les fractions de BTC sont acceptées (virgule ou point).",
    sharesHint:
      "Depuis votre courtier — les fractions de parts sont acceptées (virgule ou point, ex. 1,1465).",
    manualValuePlaceholder: "Valeur totale du portefeuille chez votre courtier",
    marketValuePlaceholder: "Laisser vide pour utiliser le marché",
    brokerValue: "Le total de votre courtier (optionnel)",
    brokerValueHint:
      "Laissez vide — ou tapez 0 — et la valeur est calculée en direct depuis vos parts et le cours du marché. Ne le remplissez que si votre courtier affiche un total différent, puis épinglez-le ci-dessous pour qu'il soit retenu.",
    pinValue: "Utiliser ce chiffre plutôt que le cours du marché",
    pinValueHint:
      "Non épinglé, votre chiffre ne sert que de repli quand aucun cours ne peut être récupéré.",
    valuedLive: "Valorisé au marché",
    valuedPinned: "Valorisé sur votre chiffre",
    valuedManual: "Valorisé sur votre chiffre — aucun cours disponible",
    valuedCost:
      "Valorisé au prix de revient — ajoutez les parts pour suivre le marché",
    ongoingChargeLabel: "Frais courants du fonds (optionnel)",
    ongoingChargeHint:
      "Les frais annuels du fonds lui-même, en pourcentage — 0,20 pour 0,20 %. Ils figurent sur le DIC et n'apparaissent jamais sur un relevé, car ils sont prélevés sur la valeur du fonds. Ce ne sont pas les frais de votre courtier, que l'app ne suit pas.",
    perYear: "% par an",
    lookUpCharge: "Chercher les frais sur justETF",
    saving: "Enregistrement…",
    saveItem: "Enregistrer la ligne",
    savePosition: "Enregistrer la position",
    removing: "Retrait…",
    removeFromPortfolio: "Retirer du portefeuille",
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
    chartRange: "Période du graphique",
    totalInvested: "Total investi",
    averageBuyPrice: "Prix d'achat moyen",
    averageSharePrice: "Prix moyen par part",
    averageMonthly: "Contribution mensuelle moyenne",
    nextContribution: "Prochaine contribution",
    returnAmount: "Performance",
    returnPercent: "Performance %",
    noHistory: "Pas encore d'historique pour ce portefeuille.",
    oneMonthOnly:
      "Un seul mois d'historique pour l'instant — une courbe en demande deux.",
  },

  month: {
    inTheAccount: "Sur le compte",
    cameIn: "Entré",
    wentOut: "Sorti",
    savingsRate: "Taux d'épargne",
    leftIn: "Reste en {month}",
    overIn: "Dépassement en {month}",
    over: "Dépassement de",
    left: "Reste",
    today: "Aujourd'hui",
    monthEnd: "Fin de mois",
    finishedMonthNote:
      "Un mois terminé, tel que le journal l'a enregistré. Ce qu'un compte contient n'est vrai qu'aujourd'hui.",
    connectBankNote:
      "Connectez une banque pour afficher d'abord ce qu'il y a vraiment sur le compte.",
    setUpTitle: "Configurez votre mois",
    setUpBody:
      "Ajoutez une fois ce qui revient. Chaque mois est projeté à partir de là.",
    setUpCharges: "Configurer les charges",
    whereItWent: "Où c'est parti",
    capsAndGoals: "Plafonds et objectifs",
    moreThisMonth: "Plus sur ce mois",
    startingBalanceHint:
      "Indiquez un solde de départ pour commencer à clôturer les mois",
    nothingToApply: "Rien à appliquer",
    actionReopen: "Réouvrir",
    actionReview: "Vérifier",
    actionApply: "Appliquer",
    actionClose: "Clôturer",
    actionStart: "Commencer",
    attentionSwallowed: {
      one: "{count} transaction bancaire a été fusionnée par une synchronisation précédente",
      other:
        "{count} transactions bancaires ont été fusionnées par une synchronisation précédente",
    },
    attentionInbox: {
      one: "{count} transaction attend une catégorie",
      other: "{count} transactions attendent une catégorie",
    },
    attentionApply: {
      one: "{count} récurrent est prêt à être ajouté",
      other: "{count} récurrents sont prêts à être ajoutés",
    },
    attentionBaseline:
      "Saisissez une fois le solde de votre compte, pour commencer à capter les dépenses que l'application ne voit jamais",
    attentionReadyToClose: "{month} est prêt à être clôturé",
    attentionProposals: {
      one: "{count} charge a l'air de revenir",
      other: "{count} charges ont l'air de revenir",
    },
    invested: "Investi",
    streakInARow: "{count} d'affilée",
    bestStreak: "record {count}",
  },

  common: {
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    pickAMonth: "Choisir un mois",
    showYear: "Afficher {year}",
    thisMonth: "Ce mois-ci",
    monthClosed: "clôturé",
    monthRecords: "écritures",
    close: "Fermer",
    closeSheet: "Fermer le panneau",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    accountMenu: "Menu du compte",
    closeAccountMenu: "Fermer le menu du compte",
    view: "Vue",
    save: "Enregistrer",
    remove: "Retirer",
    cancel: "Annuler",
    signOut: "Se déconnecter",
    chartMode: "Mode du graphique",
    chartRange: "Période du graphique",
    unrealisedProfitLoss: "+/- latent",
    unrecordedAllowance: "Enveloppe non enregistrée",
    removePasskey: "Retirer la clé d'accès",
    remindersOff: "Rappels désactivés",
    remindersNeedPermission: "Les rappels demandent l'autorisation de notifier",
    typeDeleteToConfirm: "Tapez DELETE pour confirmer.",
    addNewOnly: "Ajouter seulement les nouveaux — ignorer les mises à jour",
    product: "Le produit",
    account: "Compte",
    marketing: "Présentation",
    nearbyPages: "Pages voisines",
    needsYou: "À votre attention",
    budgetView: "Vue du budget",
    arrivedCharges: "Charges qui semblent arrivées",
    applyRecurring: "Appliquer les récurrents",
    closePopUp: "Fermer la fenêtre",
    clearInstrument: "Retirer l'instrument sélectionné",
    searchInstrument: "Chercher par nom ou ISIN…",
    seeOnCalendar: "Voir le mois sur un calendrier",
    clearDate: "Effacer la date",
    date: "Date",
    pickADate: "Choisir une date",
    setUp: "Configuration",
    everyMonthClosed: "Tous les mois que vous avez clôturés",
    openWallets: "Ouvrir les portefeuilles",
    usePassword: "Utiliser le mot de passe",
    addTransaction: "Ajouter une transaction",
    capsAndNewMonths: "Plafonds et nouveaux mois",
    browserNotifications: "Notifications du navigateur",
    theRun: "La série",
    kept: "Gardé",
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
    thousands: "{value} k",
    perYear: "{rate} par an",
    percent: "{value} %",
    points: "{value} pts",
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
      one: "Supprimer {count} transaction\u00A0?",
      other: "Supprimer {count} transactions\u00A0?",
    },
    deletePermanent: "C'est irréversible.",
    deleteAllRecurring: {
      one: "Elle provient d'un modèle récurrent\u00A0: Appliquer la recréera si vous ne passez pas la date.",
      other:
        "Elles proviennent de modèles récurrents\u00A0: Appliquer les recréera si vous ne passez pas la date.",
    },
    deleteSomeRecurring:
      "{count} d'entre elles proviennent de modèles récurrents\u00A0: Appliquer les recréera si vous ne passez pas la date.",
    typeChangeAll: {
      one: "Elle change de type de catégorie, donc les totaux des mois passés et les dépenses non enregistrées vont bouger.",
      other:
        "Toutes changent de type de catégorie, donc les totaux des mois passés et les dépenses non enregistrées vont bouger.",
    },
    typeChangeSome:
      "{count} d'entre elles changent de type de catégorie, donc les totaux des mois passés et les dépenses non enregistrées vont bouger.",
    rulesLeftBehind: {
      one: "{names} restera classé à l'ancienne, car une transaction plus récente n'est pas sélectionnée.",
      other:
        "{names} resteront classés à l'ancienne, car des transactions plus récentes ne sont pas sélectionnées.",
    },
    rulesRewritten: "Désormais {names} sera classé en {target}.",
    recurringKeepCategory:
      "{count} proviennent de modèles récurrents, qui garderont leur propre catégorie.",
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
    body: "Une synchronisation plus ancienne a décidé que c'étaient des charges déjà écrites par vos modèles récurrents, sur la seule foi d'un montant identique à cinq jours près. Sur un relevé plein de petites sommes rondes, ça ne suffit pas\u00A0: la plupart sont probablement de vraies dépenses qui ne sont jamais arrivées dans votre journal. Les rouvrir les remet dans la boîte de revue, à vous de juger.",
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
    savings: "Mis de côté",
    remaining: "Reste",
    investments: "Investi",
    savingsRate: "Taux d'épargne",
    expensesPrevious: "Argent sorti sur les mêmes jours de {month}",
    expensesVsPrevious: "Écart avec {month}",
    expensesVsPreviousMissing: "Écart avec le mois dernier",
    expensesVsPreviousNote:
      "la même période dans les deux mois, pas un mois entier contre une partie",
    kept: "Gardé",
    keptRate: "Gardé, en part de ce qui est entré",
    unrecorded: "Dépenses non enregistrées",
    unrecordedNote: "mesuré sur le solde du compte, pas estimé",
    cashChange: "Ce que le compte a bougé",
    unrecordedSoFar: "Dépenses non enregistrées à ce jour",
    unrecordedSoFarNote: "mesuré, et pas définitif avant la clôture du mois",
    onHand: "Ce que les comptes contiennent",
    committed: "Doit encore partir",
    arriving: "Doit encore arriver",
    free: "À vous de dépenser",
    unrecordedAllowance: "Enveloppe non enregistrée",
    unrecordedAllowanceNote: "un plafond fixé d'après son propre historique",
    unrecordedOver: "Dépenses non enregistrées au-delà de l'enveloppe",
    unrecordedBaseline: "Dépenses non enregistrées habituelles",
    unrecordedBaselineNote:
      "la médiane des mois clôturés, pour qu'un seul voyage ne la déplace pas",
    streak: "Mois d'affilée dans l'enveloppe",
    bestStreak: "Meilleure série à ce jour",
    budgetSpent: "Plafond {label}, dépensé",
    budgetLeft: "Plafond {label}, restant",
    budgetOver: "Plafond {label}, dépassé de",
    goalSaved: "{name}, épargné",
    investedValue: "Valeur investie",
    inboxPending: "Écritures encore sans catégorie",
    chargesUnconfirmed: "Charges récurrentes pas encore confirmées",
  },

  bearingFacts: {
    netPosition: "Tout, additionné",
    netPositionNote:
      "comptes et investissements uniquement ; cette application n'enregistre aucune dette",
    onHand: "Sur les comptes",
    invested: "Investi",
    investedShare: "Part investie",
    free: "À dépenser ce mois-ci",
    committed: "Reste à partir ce mois-ci",
    arriving: "Reste à arriver ce mois-ci",
    savingsRate: "Taux d'épargne ce mois-ci",
    expensesVsPrevious: "Sorties par rapport à {month}",
    expensesVsPreviousNote:
      "la même portion des deux mois, pas un mois entier contre une partie",
    unrecordedSoFar: "Dépenses non enregistrées à ce jour",
    unrecordedSoFarNote:
      "mesurées, et non définitives tant que le mois n'est pas clôturé",
    unrecordedAllowance: "Enveloppe non enregistrée",
    unrecordedAllowanceNote:
      "un plafond établi à partir de l'historique de cette personne",
    unrecordedOver: "Dépenses non enregistrées au-delà de l'enveloppe",
    unrecordedBaseline: "Dépenses non enregistrées habituelles",
    unrecordedBaselineNote:
      "la médiane des mois clôturés, pour qu'un seul voyage ne la déplace pas",
    streak: "Mois d'affilée dans l'enveloppe",
    bestStreak: "Meilleure série à ce jour",
    monthlyNetAverage: "Ce qu'un mois garde habituellement, sur {count} mois",
    projectedBalance: "Où les comptes arrivent d'ici {month}",
    projectedBalanceNote:
      "un calcul sur des charges déjà programmées, moins ce que les mois clôturés mesurent qu'un mois normal coûte sans le voir",
    projectedBalanceNoteUnmeasured:
      "un calcul sur des charges déjà programmées ; les dépenses courantes ne sont pas encore mesurées",
    projectedAdded: {
      one: "Ce que le mois prochain ajoute aux comptes",
      other: "Ce que les {count} prochains mois ajoutent aux comptes",
    },
    projectedBalanceBare: "Où les comptes arrivent",
    projectedKept: "Tout ce qui est gardé, d'ici {month}",
    projectedKeptAdded: {
      one: "Ce que le mois prochain garde en tout",
      other: "Ce que les {count} prochains mois gardent en tout",
    },
    projectedKeptBare: "Tout ce qui est gardé",
    projectedKeptNote:
      "les comptes plus tout ce qui est mis de côté, compté à ce qui y a été versé et non à ce que cela pourrait devenir",
    projectedMonthlyNet:
      "Ce que chaque mois ajoute aux comptes, si rien ne change",
    committedMonthly: "Un mois de charges engagées",
    runwayMonths: "Mois que la réserve couvrirait",
    walletCost: "Versé dans les portefeuilles",
    walletGain: "Gain sur ce qui a été versé",
    walletReturn: "Rendement par an",
    walletReturnNote:
      "pondéré par les flux, la date de chaque achat compte donc",
    walletDrag: "Ce que la détention coûte par an",
    walletDragNote:
      "prélevé à l'intérieur des fonds, cela n'apparaît donc jamais comme une transaction",
    walletDragPartial: {
      one: "partiel — {count} ligne sans frais renseignés",
      other: "partiel — {count} lignes sans frais renseignés",
    },
    walletDrift: "Portefeuille le plus éloigné de sa cible",
    walletDriftNote:
      "en points de pourcentage, quel que soit le sens de l'écart",
    walletConcentration: "{name}, part des portefeuilles",
    walletConcentrationNote:
      "la plus grosse ligne, pesée contre ce qui est investi plutôt que contre les liquidités",
    contributionPace: "Versé chaque mois dans les portefeuilles",
    inboxPending: "Écritures encore sans catégorie",
  },

  categoryFacts: {
    normal: "Un mois normal",
    latest: "En {month}",
    drift: "Ce que la dérive vaut sur un mois",
    oddMonth: "De combien ce mois s'écarte d'un mois normal",
    monthsActive: "Mois où quelque chose est enregistré",
    shareOfMonth: "Part de tout ce qui est sorti ce mois-là",
    cap: "Le plafond de cette catégorie",
    capLeft: "Le plafond, restant ce mois-là",
    capOver: "Le plafond, dépassé de",
  },

  pulse: {
    headlineLeft: "Reste ce mois-ci",
    headlineShort: "Il manque",
    headlineFree: "À vous de dépenser",
    noBalance:
      "Connectez une banque pour voir ce qu'il y a vraiment sur le compte.",
    nothingDue: "Plus rien n'est prévu ce mois-ci.",
    afterLeaving: "Après tout ce qui doit encore partir.",
    includingArriving: "Y compris ce qui doit encore arriver.",
    afterBoth:
      "Après ce qui doit encore partir, et ce qui doit encore arriver.",
  },

  moneyOnHand: {
    stillToLeave: "encore à sortir",
    stillToArrive: "encore à arriver",
    pastMonthBanner: "Vous regardez {month} — un mois déjà terminé",
    countingAhead: "en comptant ce qui reste à venir",
    elapsedLabel: "{percent} % du mois écoulé",
    elapsedGone: "En {month}, {percent} % du mois est écoulé",
    unreadableAccounts: {
      one: "Impossible de lire {accounts} — son solde n'est pas compté ci-dessus.",
      other:
        "Impossible de lire {accounts} — leurs soldes ne sont pas comptés ci-dessus.",
    },
    fixLink: "Corriger",
    spendingDownTitle:
      "Dépenses en baisse de {percent} % par rapport aux mêmes jours en {month}",
    spendingUpTitle:
      "Dépenses en hausse de {percent} % par rapport aux mêmes jours en {month}",
    switchesTo: "Passer à {option}",
  },

  monthScore: {
    heading: "Dépenses non enregistrées, jusqu'ici",
    overRecorded:
      "Votre compte contient plus que ce que le journal permet — un revenu manque, ou quelque chose est enregistré deux fois. Rien à mesurer tant que ce n'est pas réglé.",
    capPrefixChosen: "de votre plafond de",
    capSuffixChosen: "",
    capPrefixUnchosen: "par rapport à un montant habituel de",
    meterLabel: "{spent} sur {target}",
    noNormalYet:
      "Clôturez deux mois et l'application saura à quoi ressemble une normale pour vous.",
    pastCap: "{amount} au-delà, alors que le mois est encore en cours.",
    roomLeft: "Il reste {amount} de marge ce mois-ci.",
    measuredNote:
      "Mesuré par rapport à votre dernière clôture, pas mémorisé — cela bouge donc avec la banque, et ce n'est définitif qu'une fois le mois clôturé.",
    notYetMeasured:
      "Clôturez un mois par rapport au solde de votre banque et ceci se remplit : l'application calcule ce qui a quitté le compte sans qu'aucune transaction ne l'explique.",
    findMissingEntry: "Trouver la transaction manquante",
    setUpCta: "Configurer",
  },

  cashAccounts: {
    tickHint: "Cochez celles que vous utilisez pour dépenser.",
    lastRead: "Dernière lecture {when}",
    noneTicked:
      "Rien n'est coché, les mois se clôturent donc encore à la main.",
    autoCloses:
      "Les mois se clôturent d'eux-mêmes une fois que le relevé couvre le jour où ils sont lus. Un mois dont les comptes cochés ne peuvent pas tous être lus attend, plutôt que de deviner.",
  },

  recentOnAccount: {
    title: "Dernier sur votre compte",
    toReview: "{count} à vérifier",
    waitingCategory: "en attente d'une catégorie",
    leftOut: "écarté",
    inYourLedger: "dans votre journal",
  },

  stillToCome: {
    title: "Encore à venir",
    arrivingNamed: "encore à arriver, {name} le {when}",
  },

  monthCloseHistory: {
    title: "Mois clôturés",
    normalMonthCost:
      "Un mois normal vous coûte environ {amount} que l'application ne voit jamais.",
    oneMoreForBaseline:
      "Encore une clôture, et il y aura un mois normal auquel vous comparer.",
    closeFromSurface: "Clôturez un mois depuis {surface} et il apparaîtra ici.",
    allowanceHint:
      "Ce que vous acceptez de dépenser sans l'enregistrer. Rester en dessous, c'est ce qui garde une série vivante.",
    useSuggested: "Utiliser {amount}",
    needMoreForSuggestion:
      "Clôturez un mois de plus, et l'application pourra suggérer un montant à partir de vos propres dépenses.",
    readingDayHeading: "Jour de lecture",
    readingDayHint:
      "Le jour du mois suivant où vous relevez le solde. Plus tard est plus sûr avec une carte à débit différé, car les dépenses par carte du mois doivent avoir été prélevées. Le plus important est que ce soit toujours le même jour.",
    startingPoint: "Point de départ",
    needsLook:
      "À vérifier — plus sur le compte que ce que les transactions permettent",
    neverRecordedAmount: "{amount} jamais enregistré",
    keptPercent: "{rate} % gardé",
    saved: "Enregistré",
  },

  projection: {
    heading: "Si rien ne change",
    window: {
      one: "Le mois prochain",
      other: "Les {count} prochains mois",
    },

    inAccounts: "Sur les comptes",
    kept: "Tout ce qui est gardé",
    by: "d'ici {month}",
    added: {
      one: "ajouté sur {count} mois",
      other: "ajouté sur {count} mois",
    },
    noOpeningBalance:
      "Aucun solde de compte comme point de départ : ce sont donc les montants que les mois ajoutent, et non là où ils vous laissent.",

    perMonth: "{amount} par mois en moyenne",
    shrinking: "Il sort plus qu'il n'entre, mois après mois.",
    accountsFalling:
      "Les comptes baissent parce que {amount} par mois partent en épargne et en portefeuille. Cet argent reste le vôtre — il est sur l'autre courbe.",

    madeOf: "Ce qui compose ce chiffre",
    income: "Revenus",
    committed: "Charges engagées",
    setAside: "Mis de côté",
    deployed: "Investi depuis un portefeuille",
    unrecorded: "Dépenses courantes",
    charges: {
      one: "{count} charge",
      other: "{count} charges",
    },
    noCharges: "rien de programmé",
    setAsideNote: "Sort du compte, reste à vous.",
    deployedNote:
      "Déjà dans un portefeuille : aucune des deux courbes ne bouge.",
    unrecordedMeasured: {
      one: "la médiane de {count} mois clôturé",
      other: "la médiane de {count} mois clôturés",
    },
    unrecordedNotYet:
      "Pas encore compté — clôturez deux mois et ce sera le cas.",
    noIncomeCharge:
      "Aucune charge n'apporte de revenu : votre salaire n'entre dans aucun de ces chiffres. Ajoutez-le dans Charges et tout change ici.",
    noIncomeCta: "Ajouter une charge",
    sparklineLabel: {
      one: "Comptes projetés et total gardé sur {count} mois",
      other: "Comptes projetés et total gardé sur {count} mois",
    },
  },

  runway: {
    underAMonth: "Moins d'un mois de charges engagées.",
    months: "{count} mois de charges engagées.",
  },

  allocation: {
    income: "Revenus",
    expenses: "Dépenses",
    savings: "Épargne",
    investments: "Investissements",
    remaining: "Reste",
    available: "Disponible",
    other: "Autre",
    allExpenses: "Toutes les dépenses",
    uncategorised: "Catégorie",
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
      "Jusqu'à aujourd'hui seulement — dépenses et achats de portefeuille à venir non comptés.",
    monthEndHint:
      "Inclut toutes les échéances dues ce mois-ci, achats de portefeuille compris.",
  },

  push: {
    monthOpen: {
      title: "Un nouveau mois",
      idle: "Appliquez vos récurrents pour le remplir, et voyez ce qu'il reste.",
      pending: {
        one: "{count} récurrent est prêt à être appliqué.",
        other: "{count} récurrents sont prêts à être appliqués.",
      },
    },
    arrived: {
      title: {
        one: "Est-ce bien arrivé\u00A0?",
        other: "Sont-ils bien arrivés\u00A0?",
      },
      body: {
        one: "Une charge récurrente semble déjà payée par votre banque.",
        other:
          "{count} charges récurrentes semblent déjà payées par votre banque.",
      },
    },
    breach: {
      title: "{label} dépasse son budget",
      body: "{spent} dépensés sur {limit}.",
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
    done: "Terminé",
    state: {
      confirmed: "Confirmé",
      toConfirm: "À confirmer",
    },
    misses: {
      hide: "Masquer ce qui n'a pas été proposé",
      show: {
        one: "{count} autre charge n'a pas été proposée — pourquoi\u00A0?",
        other:
          "{count} autres charges n'ont pas été proposées — pourquoi\u00A0?",
      },
      nothingAlike: "rien dans sa catégorie à rapprocher",
      refused:
        "vous avez dit que le mouvement le plus proche n'était pas le bon",
      notArrived: "le mouvement le plus proche n'a pas encore eu lieu",
      amountNear: "le plus proche était {amount}, trop loin de {expected}",
      amountNone: "aucun mouvement du bon montant",
      dateNear: {
        one: "le plus proche était à {count} jour, au-delà de la fenêtre de {window} jours",
        other:
          "le plus proche était à {count} jours, au-delà de la fenêtre de {window} jours",
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
    untracked:
      "Les lectures mensuelles ne sont pas encore en place (migration 024).",
    noWriter: "Aucun rédacteur n'est configuré.",
    noAnswer: "Le rédacteur n'a pas répondu à l'instant.",
    unusable: "La réponse du rédacteur n'était pas utilisable.",
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
    suggestionsHeading: "Ce qu'il faut changer",
    writing: "Écriture…",
    noReadsLeft: "Plus de lecture pour {month}",
    noReadsLeftGeneric: "Plus de lecture ce mois-ci",
    writeAgain: "Réécrire avec {model} ({left} restantes)",
    writeOne: "Écrire avec {model} ({left} restantes)",
    writtenToast: "Écrit pour {month}",
    writeAgainLabel: "Réécrire la lecture avec {model}",
    writeLabel: "Écrire la lecture avec {model}",
    writtenBy: "Écrit par {model}.",
    writtenByUnknown: "Écrit par un modèle que l'app n'enregistre plus.",
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
    writtenByUnknown: "Écrit par un modèle que l'app n'enregistre plus.",
  },

  /** La transparence : de quoi les portefeuilles sont faits. */
  lookThrough: {
    title: "Transparence",
    subtitle: "De quoi vos portefeuilles sont réellement faits",

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
      "consumer-discretionary": "Consommation discrétionnaire",
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

    costPerYear: "{amount} de frais par an",
    costAllIn: "({rate} tout compris)",

    countryShare: "{country}",
    franceShare: "France",
    europeShare: "Europe",
    usShare: "États-Unis",
    marketWeight: "Le marché lui donne {weight}",
    timesMarket: "{factor}× le poids du marché",
    inLineWithMarket: "Conforme au marché",

    fundCharges: "Les frais propres aux fonds",
    envelopeFeeHint:
      "Sur le relevé annuel de votre contrat, en pourcentage — généralement 0,5 à 0,8. Ils s'ajoutent aux frais courants de chaque support.",
    envelopeFee: "Les frais de l'enveloppe",
    chargesNote:
      "Ce sont les frais des fonds et de l'enveloppe. Les commissions de votre courtier et les frais de transaction ne sont pas suivis.",
    allIn: "Tout compris",
    perYear: "{amount} par an",
    overYears: "{amount} sur {years} ans",
    noChargeRecorded: "Aucuns frais renseignés",

    sameIndex: "Les deux suivent {index}",
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
      "Ce sont des mouvements entre lignes, pas de l'argent frais. Réorienter un virement mensuel arrive au même endroit sans vendre, ce qui dans un PEA est généralement la meilleure réponse.",

    readCoverage: "{share} de votre encours a été lu",
    notRead: "Pas encore lu",
    notReadBody:
      "{count} lignes n'ont pas été lues : leur composition est donc inconnue, et non vide. Les parts ci-dessus sont calculées sur le reste.",
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
        "{model} ne peut pas chercher sur le web avec cette formule : rien ne peut être consulté.",
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
        "{count} de vos lignes n'ont pas d'ISIN : il n'y a donc rien à rechercher. Ouvrez chacune depuis Positions et choisissez son instrument dans la recherche — c'est ce qui enregistre l'ISIN.",
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
        "Le chevauchement est un plancher, pas une mesure. Seules les plus grosses lignes publiées de chaque fonds ont été comparées : deux fonds présentés comme partageant peu peuvent en réalité être largement les mêmes sociétés — l'indice suivi est le signal le plus fiable.",
      staleReadings:
        "{count} lectures ont plus de six mois. Elles servent quand même : la composition de l'an dernier vaut mieux que rien.",
      noMarketValue:
        "Rien n'est détenu pour l'instant, il n'y a donc rien à examiner.",
      partialAxis:
        "Ces chiffres couvrent {coverage} de ce qui a été lu — une fiche ne publie pas toujours la répartition complète. Les parts sont celles publiées, pas une part de ce qui a été trouvé : elles ne totalisent donc pas l'ensemble.",
      unresolvable: {
        one: "L'or et les cryptos n'ont ni pays ni secteur — non pas non publiés : aucun. C'est détenu, et compté dans le total ci-dessus, mais les parts de cette page ne peuvent pas le décrire.",
        other:
          "L'or et les cryptos n'ont ni pays ni secteur — non pas non publiés : aucun. C'est détenu, et compté dans le total ci-dessus, mais les parts de cette page ne peuvent pas le décrire.",
      },
      geographyIsNotCurrency:
        "La géographie désigne ici où sont les sociétés, pas la devise dans laquelle vous êtes payé. Un fonds peut détenir des sociétés américaines et être libellé en euro.",
    },
  },

  /** La revue des portefeuilles : ce qu'un modèle tire de la transparence. */
  walletRead: {
    review: "Passer en revue avec {model}",
    reviewing: "Lecture…",
    reviewHint:
      "Lit les chiffres de cette page et dit ce qu'il en pense. {remaining} restantes ce mois-ci.",
    writtenBy: "Écrit par {model}.",
    writtenByUnknown: "Écrit par un modèle que l'app n'enregistre plus.",
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
      "Trop peu a été lu pour dire quoi que ce soit de l'ensemble du portefeuille.",
    unchanged: "Rien n'a bougé depuis la dernière revue.",
    untracked:
      "Les revues de portefeuille ne sont pas encore en place (migration 033).",
    noWriter: "Aucun rédacteur n'est configuré.",
    noAnswer: "Le rédacteur n'a pas répondu à l'instant.",
    unusable: "La réponse du rédacteur n'a pas pu être utilisée.",
    threwAway: "La réponse du rédacteur a été écartée. ({detail})",

    refusal: {
      wrongShape: "Pas la forme demandée",
      unknownDatum: "Elle citait « {id} », qui n'a jamais été transmis",
      unknownInstrument:
        "Elle proposait « {isin} », qui n'est pas un instrument connu de l'app",
      headlineHadFigure: "Le titre contenait un chiffre de son cru",
      headlineTooLong: "Le titre dépassait une ligne",
      everythingDropped: "Toutes les observations ont dû être écartées",
    },

    footing: {
      notAdvice:
        "Ce sont des informations sur vos propres avoirs, pas un conseil en investissement. Chaque chiffre est le calcul de l'app.",
      partiallyRead:
        "Certaines lignes n'ont pas été lues : ceci porte donc sur la partie du portefeuille que l'app peut voir.",
    },
  },

  bearing: {
    title: "Cap",
    headline: {
      onHand: "actuellement sur votre compte courant",
      free: "vous finirez le mois à",
      remaining: "enregistré comme restant",
    },
    cards: {
      month: "Ce mois-ci",
      now: "Les comptes",
      run: "Votre régularité",
      ahead: "L'année à venir",
      wallet: "Portefeuilles",
    },
    empty: "Dès qu'un mois sera enregistré, il y aura de quoi faire le point.",
    panel: {
      close: "Fermer",
      open: "Voir ce qui compose ce chiffre",
      footer: "Voir la surface complète",
      horizon: "Jusqu'où",
      monthScope: "Le mois affiché par ce panneau",
      streakMonths: {
        one: "{count} mois dans l'enveloppe",
        other: "{count} mois dans l'enveloppe",
      },
      streakNone:
        "Pas encore de série — clôturez un mois dans l'enveloppe pour la commencer.",
      bestRun: "Record : {count}",
      comparisonHeading: "Par rapport au mois dernier",
      trendHeading: "Mois par mois",
      trendThin:
        "Pas encore assez de mois pour parler de tendance — {count} jusqu'ici.",
      holdingsHeading: "Principales positions",
      moreHoldings: "{count} de plus",
      failed: "Le détail n'a pas pu être lu pour le moment.",
      retry: "Réessayer",
      cashAccountsHeading: "Quels comptes détiennent vos liquidités",
      cashAccountsBody:
        "Clôturer un mois compare ce que ces comptes détenaient au début et à la fin avec ce que le grand livre indique.",
      cashAccountsLapsed: "Le consentement a expiré — rien ne peut en être lu",
      cashAccountsLastRead: "Lu {when}",
    },
    spine: {
      ringUnmeasured: "Pas encore mesuré — aucun mois n'a été clôturé",
      ringMeasuring:
        "Mesure de votre premier mois — aucune enveloppe définie pour l'instant",
      ringUsed: "{percent} % de votre enveloppe utilisés",
      ringUsedOver: "{percent} % de votre enveloppe utilisés, déjà au-delà",
      ringStandingClear:
        "ce qu'il vous reste à dépenser couvre encore une enveloppe entière",
      ringStandingTight: "il vous reste moins d'une enveloppe à dépenser",
      ringStandingShort: "le mois est parti pour finir dans le rouge",
      moreWaiting: {
        one: "+{count} en attente",
        other: "+{count} en attente",
      },
    },
  },

  errorPage: {
    title: "Quelque chose s'est mal passé",
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
    refreshing: "Actualisation…",
    refresh: "Actualiser",
  },

  outbox: {
    retry: "Réessayer",
  },

  errors: {
    amountPositive: "Le montant doit être positif",
    invalidDate: "Date invalide",
    nothingSelected: "Rien de sélectionné",
    tooManySelected: "Sélectionnez au plus 200 transactions à la fois",
    pickCategory: "Choisissez une catégorie",
    pickDay: "Choisissez un jour entre 1 et 28",
    pickRecurring: "Choisissez un récurrent",
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
    nameTooLong40: "Le nom doit faire 40 caractères ou moins",
    nameRequiredCustom: "Le nom est obligatoire pour une ligne personnalisée",
    shareCountRequired: "Le nombre de parts est obligatoire",
    targetPositive: "L'objectif doit être positif",
    capNotNegative: "Un plafond ne peut pas être négatif",
    zeroOrMore: "Doit être 0 ou plus",
    positiveNumber:
      "Saisissez un nombre positif (virgule ou point pour les décimales)",
    chargeAsPercent: "Saisissez les frais en pourcentage, par exemple 0,20",
    chargeTooHigh:
      "Cela semble trop élevé — saisissez 0,20 pour 0,20 %, pas 20",
    notAnIsin: "Cela ne ressemble pas à un ISIN, par exemple IE00B4L5Y983",
    notABalance: "Cela ne ressemble pas à un solde",
    notACap: "Cela ne ressemble pas à un plafond",
    nothingToImport: "Rien à importer",
    tooManyRows: "Importez au plus 2000 lignes à la fois",
    invalidInput: "Saisie invalide",
    notAuthenticated: "Non authentifié",
    nameRequired: "Le nom est obligatoire",
    nameTooLong: "Le nom est trop long",
    // DELETE stays in English: it is a word the user has to type back
    // exactly, checked by `z.literal("DELETE")` in `../../validations/profile`,
    // so translating the prompt without translating the literal would lock
    // French readers out of their own account deletion.
    deleteConfirmation: "Tapez DELETE pour confirmer",
  },
};
