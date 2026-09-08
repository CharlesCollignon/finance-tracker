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
    month: "Mois",
    ledger: "Journal",
    charges: "Charges",
    plan: "Plan",
    wallets: "Portefeuilles",
    profile: "Profil",
    ledgerList: "Liste",
    ledgerCalendar: "Calendrier",
    ledgerByCategory: "Par catégorie",
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
  },

  ledger: {
    applyPending: "Application…",
    applyRecurring: "Appliquer les récurrents",
    applyWaiting: "Des récurrents attendent d'être appliqués",
    applyAllDone: "Tous les récurrents sont déjà appliqués",
    applyNothing: "Rien à appliquer",
    applyResult: "Récurrents appliqués\u00A0: {parts}",
    applyAdded: "{count} ajoutés",
    applyUpdated: "{count} mis à jour",
    emptyTitle: "Rien d'enregistré ce mois-ci",
    emptyBody:
      "Ajoutez une écriture, ou appliquez les charges que vous savez déjà récurrentes.",
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
    exportCsv: "Exporter ces écritures en CSV",
    importCsv: "Importer un relevé CSV",
    exportNothing: "Rien à exporter pour cette vue",
    noMatchTitle: "Aucune écriture correspondante",
    noMatchBody: "Essayez une autre recherche ou un autre filtre.",
    entryCount: { one: "{count} écriture", other: "{count} écritures" },
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
      one: "{count} écriture attend une catégorie",
      other: "{count} écritures attendent une catégorie",
    },
    needsCategoryAction: {
      one: "{count} écriture attend une catégorie. Vérifier",
      other: "{count} écritures attendent une catégorie. Vérifier",
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
  },

  plan: {
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
      "Une deuxième façon de regrouper une écriture, en travers des catégories — des vacances, un colocataire, un projet à côté.",
    newTag: "Nouvelle étiquette",
    addTag: "Ajouter l'étiquette",
    tagAdded: "Étiquette ajoutée",
    goalName: "Nom de l'objectif",
    deleteGoalTitle: "Supprimer cet objectif\u00A0?",
    deleteCapTitle: "Supprimer ce plafond\u00A0?",
    deleteWarning:
      "C'est irréversible. Vos transactions ne sont pas touchées.",
    goalReached: "Objectif atteint\u00A0!",
    goalOverdue: "Date cible dépassée — {amount} encore à épargner.",
    goalOnSchedule: "Épargnez {amount}/mois pour y arriver avant {month}.",
  },

  recurring: {
    addTitle: "Ajouter un récurrent",
    editTitle: "Modifier le récurrent",
    addTitleMobile: "Ajouter un récurrent",
    editTitleMobile: "Modifier le récurrent",
    close: "Fermer",
    category: "Catégorie",
    description: "Libellé",
    descriptionPlaceholder: "ex. Netflix, salle de sport, DCA CTO",
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
    shareCount: "Nombre de parts",
    wholeSharesOnly: "Saisissez un nombre entier de parts",
    estimatedAmount: "Montant estimé",
    saving: "Enregistrement…",
    save: "Enregistrer",
    delete: "Supprimer",
    deleting: "Suppression…",
    confirmDelete: "Confirmer la suppression",
    savedHint:
      "Enregistré. Appliquez les récurrents dans le Journal pour voir le changement.",
    updatedHint:
      "Mis à jour. Appliquez les récurrents dans le Journal pour voir le changement.",
    deletedHint:
      "Supprimé — appliquez les récurrents dans le Journal pour voir le changement.",
    brokerDcaNote:
      "Les DCA chez le courtier sont suivis pour information mais ne réduisent pas votre budget restant.",
    bitstackNote:
      "Achat hebdomadaire à montant fixe en EUR sur Bitstack. La valeur de marché dans Portefeuilles utilise votre total BTC × le cours BTC/EUR en direct.",
    sharesNote:
      "Choisissez votre ETF et le nombre de parts. Cherchez par nom ou par ISIN (ex. LU1681043599). L'application récupère le cours en direct et calcule le montant en euros à l'enregistrement ou à l'application.",
    yearlyNote:
      "Compté comme une part mensuelle dans votre budget (annuel ÷ 12). Le paiement complet est enregistré une fois, le mois dû.",
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
      "Passer cette date seulement\u00A0? L'écriture sera retirée et Appliquer ne la recréera pas. Le récurrent reste actif pour les mois suivants.",
    cancel: "Annuler",
  },

  charges: {
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
    emptyBodyMobile: "Loyer, salaire, abonnements, DCA.",
    openLedgerToApply: "Ouvrir le Journal pour appliquer ces charges",
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
  },

  onboarding: {
    progress: "Progression de la configuration",
    welcomeTitle: "Bienvenue sur Pluclair",
    welcomeBody:
      "Deux minutes maintenant, et votre tableau de bord affichera de vrais chiffres au lieu de zéros.",
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
      "Choisissez une catégorie et un plafond mensuel. Mois affichera un anneau qui se remplit à mesure que vous dépensez. Vous pourrez en ajouter d'autres dans Plan.",
    monthlyAmount: "Montant mensuel",
    dayOfMonth: "Jour du mois",
    monthlyCap: "Plafond mensuel",
    category: "Catégorie",
    continue: "Continuer",
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
      "Décochez pour un DCA de portefeuille suivi hors budget (par exemple des achats financés par un virement chez le courtier).",
  },

  wallets: {
    marketValue: "Valeur de marché",
    value: "Valeur",
    invested: "Investi",
    market: "Marché",
    profitLoss: "+/-",
    walletPicker: "Portefeuille d'investissement",
    showChart: "Afficher le graphique",
    hideChart: "Masquer le graphique",
    emptyTitle: "Aucun investissement suivi pour l'instant",
    emptyBody:
      "Ajoutez des lignes dans chaque portefeuille pour suivre ce que vous avez investi et sa valeur actuelle.",
    emptyTitleMobile: "Ouvrir un portefeuille",
    emptyBodyMobile: "PEA, CTO et crypto arrivent ici.",
    trackTitle: "Suivre un investissement",
    trackBody: "Une contribution récurrente devient une position.",
    addBtcForValue: "Renseignez le total BTC pour la valeur de marché en direct",
    addSharesForValue:
      "Renseignez le nombre de parts pour la valeur de marché en direct",
    transferAmountPlaceholder: "Montant",
    addTransfer: "Ajouter le virement",
    deleteTransferTitle: "Supprimer ce virement\u00A0?",
    deleteTransferBody:
      "L'enregistrement du virement est retiré\u00A0; vos transactions ne sont pas touchées.",
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
    keptRate: "{rate}% de ce qui est entré, en comptant ce que vous avez mis de côté.",
    keptRateUnknown: "En comptant ce que vous avez mis de côté.",
    cameIn: "Entré",
    recordedSpending: "Dépenses enregistrées",
    setAside: "Mis de côté",
    neverRecorded: "Jamais enregistré",
    overAllowance: "C'est {over} au-delà de votre enveloppe de {cap}.",
    insideAllowance:
      "Dans votre enveloppe de {cap}, avec {spare} de marge.",
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
  },

  calendarView: {
    monthlyCalendar: "Calendrier du mois",
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
  },

  marketingMock: {
    whereItWent: "Où c'est parti",
    whatsLeft: "Ce qu'il reste",
    expectedImpact: "Impact prévu",
    expectedImpactPerMonth: "Impact prévu par mois",
    portfolioValue: "Valeur du portefeuille",
    monthlyBudgets: "Plafonds mensuels",
    savingsGoals: "Objectifs d'épargne",
    sampleHousing: "Logement",
    sampleEverythingElse: "Tout le reste",
  },

  position: {
    addItem: "Ajouter une ligne",
    addCryptoItem: "Ajouter une ligne crypto",
    itemAdded: "Ligne ajoutée",
    itemUpdated: "{name} mis à jour",
    itemType: "Type de ligne",
    recurringItem: "Récurrent associé",
    dcaBitcoin: "DCA à montant fixe · Bitcoin sur Bitstack",
    dcaEtf: "DCA à montant fixe · ETF défini dans Plan",
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
      one: "{count} écriture bancaire a été fusionnée par une synchronisation précédente",
      other:
        "{count} écritures bancaires ont été fusionnées par une synchronisation précédente",
    },
    attentionInbox: {
      one: "{count} écriture attend une catégorie",
      other: "{count} écritures attendent une catégorie",
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
  },

  common: {
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    pickAMonth: "Choisir un mois",
    close: "Fermer",
    closeSheet: "Fermer le panneau",
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
    setUp: "Configuration",
    everyMonthClosed: "Tous les mois que vous avez clôturés",
    openWallets: "Ouvrir les portefeuilles",
    trendRange: "Période de la tendance",
    usePassword: "Utiliser le mot de passe",
    walkMeThrough: "Guidez-moi dans la configuration",
    addTransaction: "Ajouter une transaction",
    capsAndNewMonths: "Plafonds et nouveaux mois",
    browserNotifications: "Notifications du navigateur",
    theRun: "La série",
    kept: "Gardé",
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
      one: "{names} restera classé à l'ancienne, car une écriture plus récente n'est pas sélectionnée.",
      other:
        "{names} resteront classés à l'ancienne, car des écritures plus récentes ne sont pas sélectionnées.",
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
    unrecordedSoFarNote:
      "mesuré, et pas définitif avant la clôture du mois",
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

  pulse: {
    headlineLeft: "Reste ce mois-ci",
    headlineShort: "Il manque",
    headlineFree: "À vous de dépenser",
    noBalance: "Connectez une banque pour voir ce qu'il y a vraiment sur le compte.",
    nothingDue: "Plus rien n'est prévu ce mois-ci.",
    afterLeaving: "Après tout ce qui doit encore partir.",
    includingArriving: "Y compris ce qui doit encore arriver.",
    afterBoth:
      "Après ce qui doit encore partir, et ce qui doit encore arriver.",
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
      "Jusqu'à aujourd'hui seulement — dépenses et DCA à venir non comptés.",
    monthEndHint:
      "Inclut tout le récurrent dû ce mois-ci, DCA des portefeuilles compris.",
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
    descriptionTooLong: "Le libellé doit faire 500 caractères ou moins",
    nameTooLong100: "Le nom doit faire 100 caractères ou moins",
    nameTooLong40: "Le nom doit faire 40 caractères ou moins",
    nameRequiredCustom: "Le nom est obligatoire pour une ligne personnalisée",
    shareCountRequired: "Le nombre de parts est obligatoire",
    targetPositive: "L'objectif doit être positif",
    capNotNegative: "Un plafond ne peut pas être négatif",
    zeroOrMore: "Doit être 0 ou plus",
    positiveNumber: "Saisissez un nombre positif (virgule ou point pour les décimales)",
    chargeAsPercent: "Saisissez les frais en pourcentage, par exemple 0,20",
    chargeTooHigh:
      "Cela semble trop élevé — saisissez 0,20 pour 0,20 %, pas 20",
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
