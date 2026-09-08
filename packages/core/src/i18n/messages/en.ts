import type { MessageTree } from "../t";

/**
 * What the app says, in English.
 *
 * This file is the source language and therefore also the schema: `./fr` is
 * annotated with `Messages`, which is `typeof en`, so a French translation
 * that is missing a key or has grown one of its own is a type error rather
 * than a surprise on a screen nobody was looking at. That is also why there
 * is no `as const` here — the leaves have to widen to `string` for another
 * language to be assignable to them.
 *
 * Grouped by what the words are for rather than by which file uses them,
 * following the precedent set by the marketing copy in
 * `apps/web/components/marketing/landing-copy.ts`: copy holds its voice only
 * if it can be read in one sitting, and a thousand flat keys sorted
 * alphabetically cannot be read at all. A group is expected to grow until it
 * is worth splitting; it is not expected to mirror the module layout.
 *
 * Messages with a `{ one, other }` shape are plural forms — see
 * `pluralCategory` in `../t` for which form a count selects, and note that
 * French puts zero in the singular, which is why these cannot be ternaries at
 * the call site.
 */
export const en = {
  /**
   * The five surfaces, and the Ledger's three views.
   *
   * The same words the phone's tab bar uses, so the two cannot drift — see
   * `apps/web/lib/navigation.ts` for why there are five of them.
   *
   * Two of these are the same word in French. "Charges" already means a
   * recurring cost, and "Plan" a plan; leaving them is the translation, not
   * the absence of one.
   */
  nav: {
    month: "Month",
    ledger: "Ledger",
    charges: "Charges",
    plan: "Plan",
    wallets: "Wallets",
    profile: "Profile",
    ledgerList: "List",
    ledgerCalendar: "Calendar",
    ledgerByCategory: "By category",
  },

  /**
   * Page titles.
   *
   * The five surfaces are named by `nav.*` and not repeated here, because the
   * page heading and the nav item must be the same word — they were not, and
   * that was a bug rather than a style: the loading skeletons said
   * "Transactions", "Recurring" and "Budgets" where their own pages said
   * "Ledger", "Charges" and "Plan", so every navigation flashed one name and
   * settled on another.
   */
  pages: {
    categories: "Categories",
    import: "Import",
  },

  /**
   * The settings screen, which is the same screen twice.
   *
   * Web and phone render the same sections in the same order from the same
   * `ListRow` shape, so they share these words. Where the two genuinely
   * differ they say so: the notifications footer is about this browser on one
   * and about this phone on the other, because that is the truth on each.
   */
  profile: {
    noName: "No name yet",
    notSet: "Not set",
    accountSection: "Account",
    name: "Name",
    displayName: "Display name",
    namePlaceholder: "Your name",
    saving: "Saving…",
    save: "Save",
    email: "Email",
    signedInWith: "Signed in with",
    moneySection: "Money",
    moneyFooter: "Currency changes the symbol, not the amounts.",
    categories: "Categories",
    budgetsAndGoals: "Budgets & goals",
    currency: "Currency",
    securitySection: "Security",
    securityFooterWeb:
      "Passwordless sign-in, bound to this site and stored on your device.",
    appUnlock: "App unlock",
    unlockWithBiometrics: "Unlock with biometrics",
    passkeys: "Passkeys",
    notificationsSection: "Notifications",
    notificationsFooterWeb:
      "This browser only — your phone has its own reminders.",
    notificationsFooterMobile:
      "Reminders for what repeats, plus a nudge when the bank leaves something needing a category.",
    remindersAndNudges: "Reminders and nudges",
    dataSection: "Data",
    deleteAllData: "Delete all data",
    deleteConfirmLabel: "Type DELETE to confirm",
    deleteConfirmPlaceholder: "Type DELETE",
    deleting: "Deleting…",
    deleteAllMyData: "Delete all my data",
    deleteAccount: "Delete account",
    deleteMyAccount: "Delete my account",
    /** What a server action that reported nothing in particular means. */
    saved: "Saved",
  },

  /**
   * The Ledger: searching, filtering, selecting and applying.
   *
   * The three plural ternaries this replaces read `count === 1 ? "transaction"
   * : "transactions"`, which is untranslatable twice over — French puts zero
   * in the singular, and it agrees the participle with the noun ("supprimée",
   * "supprimées"). Both forms have to be written out.
   */
  ledger: {
    applyPending: "Applying…",
    applyRecurring: "Apply recurring",
    applyWaiting: "Recurring changes are waiting to be applied",
    applyAllDone: "All recurring entries already applied",
    applyNothing: "Nothing to apply",
    applyResult: "Recurring applied: {parts}",
    applyAdded: "{count} added",
    applyUpdated: "{count} updated",
    emptyTitle: "Nothing recorded this month",
    emptyBody: "Add an entry, or apply the charges you already know repeat.",
    searchPlaceholder: "Search category or note…",
    searchLabel: "Search transactions",
    filterByCategory: "Filter by category",
    filterByTag: "Filter by tag",
    filterTransactions: "Filter transactions",
    allCategories: "All categories",
    allTags: "All tags",
    selectDone: "Done",
    select: "Select",
    clearAll: "Clear all",
    selectAll: "Select all",
    exportCsv: "Export these entries as CSV",
    importCsv: "Import a CSV statement",
    exportNothing: "Nothing to export for this view",
    noMatchTitle: "No matching entries",
    noMatchBody: "Try another search or filter.",
    entryCount: { one: "{count} entry", other: "{count} entries" },
    deleted: {
      one: "{count} transaction deleted",
      other: "{count} transactions deleted",
    },
    moved: {
      one: "{count} transaction moved to {name}",
      other: "{count} transactions moved to {name}",
    },
    /* The phone's Ledger adds a few of its own. */
    add: "Add",
    addTransaction: "Add transaction",
    importCsvShort: "Import CSV",
    clearSearch: "Clear search",
    allTypes: "All types",
    restore: "Restore",
    review: "Review",
    fillThisMonth: "Fill this month",
    selectHint: "Tap to select · Done to leave",
    editHint: "Tap to edit · long-press to select",
    needsCategory: {
      one: "{count} entry needs a category",
      other: "{count} entries need a category",
    },
    needsCategoryAction: {
      one: "{count} entry needs a category. Review",
      other: "{count} entries need a category. Review",
    },
    repeatTitle: "Repeat this today?",
    repeatBody: "Adds another {category} of {amount} dated today.",
    repeatConfirm: "Add for today",
  },

  /** Bringing a bank statement in from a file, step by step. */
  importer: {
    statusReady: "Ready",
    statusSkipped: "Skipped",
    statusProblem: "Problem",
    heading: "Import a bank statement",
    checkColumns: "Check the columns",
    columnDate: "Date",
    columnDescription: "Description",
    columnAmount: "Amount",
    columnCategory: "Category",
    columnStatus: "Status",
    debitColumn: "Money out (debit)",
    creditColumn: "Money in (credit)",
    notInThisFile: "Not in this file",
    reading: "Reading…",
    continue: "Continue",
    back: "Back",
    importing: "Importing…",
    importCount: "Import {count}",
    rowsReady: "{ready} of {total} rows ready",
    alreadyInLedger: {
      one: "{count} already in your ledger. ",
      other: "{count} already in your ledger. ",
    },
    couldNotRead: {
      one: "{count} could not be read. ",
      other: "{count} could not be read. ",
    },
    needCategory: {
      one: "{count} still needs a category.",
      other: "{count} still need a category.",
    },
    everyRowCategorised: "Every row has a category.",
    chooseFile: "Choose a file",
    chooseCategory: "Choose a category",
    firstRowIsHeader: "The first row is column names",
    setRemainingSpending: "Set all remaining spending to",
    setRemainingIncome: "Set all remaining income to",
    imported: {
      one: "Imported {count} transaction",
      other: "Imported {count} transactions",
    },
  },

  /** The Plan surface: spending caps, savings goals and tags. */
  plan: {
    capsHeading: "Spending caps",
    addCap: "Add a cap",
    addCapSubmit: "Add cap",
    update: "Update",
    cancel: "Cancel",
    monthlyLimit: "Monthly limit",
    capSaved: "Cap saved",
    capRemoved: "Cap removed",
    goalsHeading: "Savings goals",
    addGoal: "Add a goal",
    addGoalSubmit: "Add goal",
    updateGoal: "Update goal",
    goalTarget: "Target",
    goalTargetDate: "Target date",
    goalSaved: "Goal saved",
    goalRemoved: "Goal removed",
    allSavings: "All savings",
    tagsHeading: "Tags",
    tagsBlurb:
      "A second way to group an entry, cutting across categories — a holiday, a flatmate, a side project.",
    newTag: "New tag",
    addTag: "Add tag",
    tagAdded: "Tag added",
    goalName: "Goal name",
    deleteGoalTitle: "Delete this goal?",
    deleteCapTitle: "Delete this budget?",
    deleteWarning:
      "This cannot be undone. Your transactions are not affected.",
    goalReached: "Goal reached!",
    goalOverdue: "Target date passed — {amount} still to save.",
    goalOnSchedule: "Save {amount}/month to reach this by {month}.",
  },

  /**
   * Standing instructions: the form both apps use to write one.
   *
   * The three period names sit here rather than being drawn out of the
   * `recurrence.*` schedule labels above, because those are whole sentences
   * ("Weekly · Monday") and these are the bare words on three buttons. The
   * buttons used to render the raw enum value under a CSS `capitalize`, which
   * is only a translation while the enum happens to be English.
   */
  recurring: {
    addTitle: "Add recurring",
    editTitle: "Edit recurring",
    addTitleMobile: "Add recurring item",
    editTitleMobile: "Edit recurring item",
    close: "Close",
    category: "Category",
    description: "Description",
    descriptionPlaceholder: "e.g. Netflix, gym membership, CTO DCA",
    schedule: "Schedule",
    monthly: "Monthly",
    weekly: "Weekly",
    yearly: "Yearly",
    dayOfMonth: "Day of month",
    dayOfWeek: "Day of week",
    startsOn: "Starts on",
    endsOn: "Ends on",
    noStartDate: "No start date",
    noEndDate: "No end date",
    amount: "Amount",
    annualAmount: "Annual amount",
    amountType: "Amount type",
    fixedAmount: "Fixed EUR",
    sharesTimesPrice: "Shares × price",
    shareCount: "Number of shares",
    wholeSharesOnly: "Enter a whole number of shares",
    estimatedAmount: "Estimated amount",
    saving: "Saving…",
    save: "Save",
    delete: "Delete",
    deleting: "Deleting…",
    confirmDelete: "Confirm delete",
    savedHint: "Saved. Apply recurring in the Ledger to see the change.",
    updatedHint: "Updated. Apply recurring in the Ledger to see the change.",
    deletedHint: "Deleted — apply recurring in the Ledger to see the change.",
    brokerDcaNote:
      "Broker DCA entries are tracked for visibility but do not reduce your remaining budget.",
    bitstackNote:
      "Fixed EUR weekly buy on Bitstack. Market value on Wallets uses your total BTC × live BTC/EUR price.",
    sharesNote:
      "Pick your ETF and share count. Search by name or ISIN (e.g. LU1681043599). The app fetches the live price and computes the EUR amount when saving or applying recurring.",
    yearlyNote:
      "Counts as a monthly share in your budget (annual ÷ 12). The full payment is recorded once in the due month.",
  },

  /** The form both apps use to write or edit one transaction. */
  transaction: {
    addTitle: "Add transaction",
    editTitle: "Edit transaction",
    close: "Close",
    category: "Category",
    filterCategories: "Filter categories",
    filterCategoriesPlaceholder: "Filter categories…",
    amount: "Amount",
    date: "Date",
    note: "Note (optional)",
    notePlaceholder: "Description",
    tags: "Tags",
    saving: "Saving…",
    saveTransaction: "Save transaction",
    saved: "Transaction saved",
    duplicating: "Duplicating…",
    duplicateToToday: "Duplicate to today",
    duplicated: "Duplicated to today",
    deleteTransaction: "Delete transaction",
    deleting: "Deleting…",
    confirmDelete: "Yes, delete",
    deleted: "Transaction deleted",
    skipThisDate: "Skip this month / date",
    skipping: "Skipping…",
    confirmSkip: "Yes, skip this date",
    skipped: "Skipped for this date — won’t be re-applied",
    skipExplanation:
      "Skip this date only? The entry will be removed and Apply won’t recreate it. The recurring rule stays active for later months.",
    cancel: "Cancel",
  },

  /** The Charges surface: the list of standing instructions. */
  charges: {
    addCharge: "Add charge",
    kindOfCharge: "Kind of charge",
    activate: "Activate",
    deactivate: "Deactivate",
    toggleFor: "{action} {name}",
    fixedToBitcoin: "Fixed EUR → Bitcoin",
    emptyTitle: "No charges yet",
    emptyBody:
      "Rent, subscriptions, a monthly transfer into savings — anything you already know is coming.",
    emptyTitleMobile: "What repeats each month?",
    emptyBodyMobile: "Rent, salary, subscriptions, DCA.",
    openLedgerToApply: "Open the Ledger to apply these charges",
    remindTitle: "Want a nudge before these post?",
    remindBody:
      "One reminder the evening before each item is due, so nothing lands unnoticed. Entirely on your device.",
    remindYes: "Remind me",
    remindNo: "No thanks",
    remindNeedsPermission: "Reminders need notification permission",
    remindOn: "Reminders on — you'll hear the evening before",
  },

  /** The one-handed sheet for adding a transaction in a hurry. */
  quickAdd: {
    title: "Add transaction",
    close: "Close",
    deleteLastDigit: "Delete last digit",
    date: "Date",
    category: "Category",
    searchCategories: "Search categories",
    searchCategoriesPlaceholder: "Search categories…",
    filterCategories: "Filter categories",
    filterCategoriesPlaceholder: "Filter categories…",
    changeCategory: "{name} — change",
    notePlaceholder: "Where did it go?",
    saving: "Saving…",
    save: "Save",
    saveAndAnother: "Save & add another",
    saved: "Transaction saved",
    savedOffline:
      "Saved on this device — it will sync when you are back online",
  },

  /** First run: the two minutes that put real numbers on the dashboard. */
  onboarding: {
    progress: "Setup progress",
    welcomeTitle: "Welcome to Pluclair",
    welcomeBody:
      "Two minutes now and your dashboard will have real numbers in it instead of zeros.",
    currencyTitle: "Which currency do you think in?",
    currencyBody:
      "Every amount in the app is shown this way. You can change it later in Profile.",
    incomeTitle: "What comes in?",
    incomeBody:
      "Your monthly income is what everything else is measured against. Add it once and it repeats every month.",
    expensesTitle: "What goes out?",
    expensesBody:
      "Rent, subscriptions, bills — the charges you already know are coming. These are what make the forecast useful.",
    capTitle: "What would you rather not overspend?",
    capBody:
      "Pick one category and a monthly cap. Month will show a ring that fills as you spend against it. You can add more under Plan.",
    monthlyAmount: "Monthly amount",
    dayOfMonth: "Day of the month",
    monthlyCap: "Monthly cap",
    category: "Category",
    continue: "Continue",
    skipForNow: "Skip for now",
    saving: "Saving…",
    addIncome: "Add income",
    incomeAdded: "Income added",
    adding: "Adding…",
    addThisOne: "Add this one",
    setCapAndFinish: "Set the cap and finish",
    addedCount: {
      one: "{count} added — add another or finish below.",
      other: "{count} added — add another or finish below.",
    },
  },

  /** Categories: the labels the user files transactions under. */
  categories: {
    blurb:
      "Categories organise your transactions and recurring items. Archived categories keep their history but no longer appear when adding entries.",
    addCategory: "Add category",
    newCategory: "New category",
    editCategory: "Edit category",
    close: "Close",
    back: "Back",
    name: "Name",
    namePlaceholder: "Groceries",
    type: "Type",
    icon: "Icon",
    iconPicker: "Category icon",
    saving: "Saving…",
    saveCategory: "Save category",
    saved: "Category saved",
    added: "Category added",
    updated: "Category updated",
    archived: "Archived",
    archivedToast: "Category archived",
    restoredToast: "Category restored",
    archiveNamed: "Archive {name}",
    restoreNamed: "Restore {name}",
    deleted: "Category deleted",
    deleteWarning:
      "If it is used by transactions or recurring items, archive it instead.",
    emptyTitle: "Add your first category",
    emptyBody: "Income, spending, savings, investments.",
    countsTowardBudget: "Counts toward monthly budget",
    countsHintIncome:
      "Untick for money coming back rather than coming in — a friend settling their half, a refund. It is subtracted from the month's spending instead of counted as earnings.",
    countsHintSavings:
      "Untick for money coming back out of savings — a transfer to your current account. It is subtracted from what you set aside, and comes off the reserve behind the runway.",
    countsHintInvestment:
      "Untick for wallet DCA tracked outside the budget (e.g. buys funded by broker transfers).",
  },

  /** Wallets: what is invested, and what it is worth now. */
  wallets: {
    marketValue: "Market value",
    value: "Value",
    invested: "Invested",
    market: "Market",
    profitLoss: "P/L",
    walletPicker: "Investment wallet",
    showChart: "Show chart",
    hideChart: "Hide chart",
    emptyTitle: "No investments tracked yet",
    emptyBody:
      "Add items in each wallet to track what you already invested and your current market value.",
    emptyTitleMobile: "Start a wallet",
    emptyBodyMobile: "PEA, CTO and crypto land here.",
    trackTitle: "Track an investment",
    trackBody: "A recurring contribution becomes a position.",
    addBtcForValue: "Add total BTC for live market value",
    addSharesForValue: "Add total shares for live market value",
    transferAmountPlaceholder: "Amount",
    addTransfer: "Add transfer",
    deleteTransferTitle: "Delete this transfer?",
    deleteTransferBody:
      "The transfer record is removed; your transactions are not affected.",
  },

  /** Closing a month: reading the balance, and what follows from it. */
  monthClose: {
    closeMonth: "Close {month}",
    balance: "Balance",
    balancePrompt:
      "What did your account hold on {date}? Add up the accounts your day-to-day spending leaves from — one number is all this needs.",
    baselineNote:
      "This first one only sets the starting point. There is nothing to measure against yet; next month there will be.",
    sameDayNote:
      "Read it on the same day every month. That way the card payments still in flight are the same distortion each time, and the months stay comparable.",
    working: "Working it out…",
    seeWhatThatMeans: "See what that means",
    couldNotWorkOut: "Could not work that out.",
    couldNotClose: "Could not close the month.",
    startingPointSet: "Starting point set",
    somethingMissing: "Something is missing",
    youKept: "You kept {amount}",
    costMoreThanItBrought: "{month} cost more than it brought in",
    keptRate: "{rate}% of what came in, counting what you set aside.",
    keptRateUnknown: "Counting what you set aside.",
    cameIn: "Came in",
    recordedSpending: "Recorded spending",
    setAside: "Set aside",
    neverRecorded: "Never recorded",
    overAllowance: "That is {over} over your {cap} allowance.",
    insideAllowance: "Inside your {cap} allowance, with {spare} to spare.",
    normalMonth: "A normal month for you is around {amount}.",
    unrecordedBlurb:
      "Spending the app never heard about — the restaurants, the rounds, the things bought on the way home. Nothing to fix, just worth knowing.",
    closing: "Closing…",
    changeTheBalance: "Change the balance",
    done: "Done",
    reopen: "That balance was wrong — reopen the month",
    reopenShort: "That balance was wrong — reopen",
    close: "Close",
    balanceOn: "Balance on {date}",
    unexplainedCredit:
      "The account holds {amount} more than the recorded movements allow. Usually that means income that was never entered — or an expense entered twice, or a broker transfer recorded both as a transaction and as a transfer.",
    runwayBought: {
      one: "That is {count} day of runway bought.",
      other: "That is {count} days of runway bought.",
    },
  },

  /**
   * The review inbox: the bank rows the app would not file on its own.
   *
   * "Review" and "inbox" are the glossary's words for this — see the
   * `CONTEXT.md` entry, which is explicit that it is not a queue and not a
   * triage. The French keeps the same distinction: "à vérifier" is something
   * you look at, not something you process.
   */
  inbox: {
    fromYourBank: "From your bank",
    review: "Review",
    recentlyAdded: "Recently added",
    needsCategory: "Needs a category",
    nothingWaiting: "Nothing waiting",
    thatsTheInbox: "That's the inbox",
    fetching: "Fetching…",
    fetchEverything: "Fetch everything",
    pickCategoryFirst: "Pick a category first",
    adding: "Adding…",
    add: "Add",
    later: "Decide this one later",
    done: "Done",
    close: "Close",
    filterCategories: "Filter categories",
    filterCategoriesPlaceholder: "Filter categories…",
    leftForLater: {
      one: "{count} left for later — it is still in the inbox.",
      other: "{count} left for later — they are still in the inbox.",
    },
    taughtIt:
      "Anything the app already recognised went straight in. Answering these teaches it for next time.",
  },

  /** The bar that appears once rows are selected. */
  selectionBar: {
    region: "Selected transactions",
    regionMobile: {
      one: "{count} transaction selected",
      other: "{count} transactions selected",
    },
    countSelected: "{count} selected",
    move: "Move",
    moveTo: {
      one: "Move {count} transaction to",
      other: "Move {count} transactions to",
    },
    moving: "Moving…",
    confirmMove: "Yes, move them",
    pickCategory: "Pick a category",
    delete: "Delete",
    deleting: "Deleting…",
    confirmDelete: "Yes, delete",
    cancel: "Cancel",
    clear: "Clear selection",
  },

  /** The Ledger seen by date. */
  calendarView: {
    monthlyCalendar: "Monthly calendar",
    selectedDay: "Selected day details",
    noTransactions: "No transactions",
    emptyTitle: "Nothing on this day",
    emptyBody: "Add a transaction or pick another date.",
    emptyBodyMobile: "Add what happened.",
    recurring: "Recurring",
    all: "All",
  },

  /** Signing in and signing up. */
  auth: {
    signIn: "Sign in",
    signInHeading: "Sign in to track your finances",
    signingIn: "Signing in…",
    signUp: "Sign up",
    createAccount: "Create account",
    creating: "Creating…",
    email: "Email",
    emailAddress: "Email address",
    password: "Password",
    passwordPlaceholder: "Your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    pleaseWait: "Please wait…",
    withGoogleSignIn: "Sign in with Google",
    withGoogleSignUp: "Sign up with Google",
    withGoogleContinue: "Continue with Google",
    withPasskey: "Sign in with passkey",
    invalidCredentials: "Invalid credentials",
    haveAccount: "Already have an account?",
    noAccount: "No account?",
    noAccountYet: "No account yet?",
    createOne: "Create one",
  },

  /**
   * The marketing site's mock screens.
   *
   * Sample figures and sample category names, so a visitor sees the app as it
   * would read for them. The names are copy rather than data: nobody's
   * "Housing" category is being displayed, so translating it is right.
   */
  marketingMock: {
    whereItWent: "Where it went",
    whatsLeft: "What's left",
    expectedImpact: "Expected impact",
    expectedImpactPerMonth: "Expected impact per month",
    portfolioValue: "Portfolio value",
    monthlyBudgets: "Monthly budgets",
    savingsGoals: "Savings goals",
    sampleHousing: "Housing",
    sampleEverythingElse: "Everything else",
  },

  /** Wallet detail: the position sheet, the targets and the performance card. */
  position: {
    addItem: "Add item",
    addCryptoItem: "Add crypto item",
    itemAdded: "Item added",
    itemUpdated: "{name} updated",
    itemType: "Item type",
    recurringItem: "Recurring item",
    dcaBitcoin: "Fixed EUR DCA · Bitcoin on Bitstack",
    dcaEtf: "Fixed EUR DCA · ETF set under Plan",
    trackedAsset: "Tracked asset",
    trackedEtf: "Tracked ETF",
    bitcoin: "Bitcoin",
    shares: "Shares",
    totalBtc: "Total BTC",
    totalShares: "Total shares",
    totalBtcHeld: "Total BTC held",
    totalSharesHeld: "Total shares held",
    sharesHeldOptional: "Shares held (optional)",
    btcHint: "From Bitstack — fractional BTC OK (use comma or dot).",
    sharesHint:
      "From your broker — fractional shares OK (use comma or dot, e.g. 1,1465).",
    manualValuePlaceholder: "Total portfolio value from your broker",
    marketValuePlaceholder: "Leave empty to use market",
    lookUpCharge: "Look up the charge on justETF",
    saving: "Saving…",
    saveItem: "Save item",
    savePosition: "Save position",
    removing: "Removing…",
    removeFromPortfolio: "Remove from portfolio",
    removePosition: "Remove position",
    confirmRemove: "Yes, remove",
    cancel: "Cancel",
    close: "Close",
    allocation: "Allocation",
    setTargets: "Set targets",
    saveTargets: "Save targets",
    targetsSaved: "Targets saved",
    saved: "Saved",
    save: "Save",
    openedOn: "Opened on",
    peaOpenedLabel: "Set the date the PEA was opened",
    peaOpenedHint: "Add the opening date to track the five-year mark.",
    chartRange: "Chart range",
    totalInvested: "Total invested",
    averageBuyPrice: "Average buy price",
    averageSharePrice: "Average share price",
    averageMonthly: "Average monthly contribution",
    nextContribution: "Next contribution",
    returnAmount: "Return",
    returnPercent: "Return %",
    noHistory: "No history for this wallet yet.",
    oneMonthOnly: "One month of history so far — a line needs at least two.",
  },

  /**
   * The Month surface: the headline figure and the attention list.
   *
   * Five of these were `count === 1 ? "entry was" : "entries were"` — a noun
   * and its verb agreed by ternary, which is the shape that cannot cross a
   * language. French agrees the participle with the noun as well, so both
   * halves have to be written out per form.
   */
  month: {
    inTheAccount: "In the account",
    cameIn: "Came in",
    wentOut: "Went out",
    savingsRate: "Savings rate",
    leftIn: "Left in {month}",
    overIn: "Over in {month}",
    over: "Over by",
    left: "Left",
    today: "Today",
    monthEnd: "Month end",
    finishedMonthNote:
      "A finished month, as the ledger recorded it. What an account holds is only ever true today.",
    connectBankNote: "Connect a bank to lead with what is actually in your account.",
    setUpTitle: "Set up your month",
    setUpBody: "Add what repeats once. Every month is forecast from it.",
    setUpCharges: "Set up charges",
    whereItWent: "Where it went",
    capsAndGoals: "Caps and goals",
    moreThisMonth: "More this month",
    startingBalanceHint: "Set a starting balance to begin closing months",
    nothingToApply: "Nothing to apply",
    actionReopen: "Reopen",
    actionReview: "Review",
    actionApply: "Apply",
    actionClose: "Close",
    actionStart: "Start",
    attentionSwallowed: {
      one: "{count} bank entry was merged away by an earlier sync",
      other: "{count} bank entries were merged away by an earlier sync",
    },
    attentionInbox: {
      one: "{count} entry needs a category",
      other: "{count} entries need a category",
    },
    attentionApply: {
      one: "{count} recurring item is ready to add",
      other: "{count} recurring items are ready to add",
    },
    attentionBaseline:
      "Enter your account balance once, to start catching spending the app never sees",
    attentionReadyToClose: "{month} is ready to close",
    attentionProposals: {
      one: "{count} charge looks like it repeats",
      other: "{count} charges look like they repeat",
    },
  },

  /**
   * Words that belong to no one surface.
   *
   * Mostly the labels a screen reader reads out. They matter more than they
   * look: a sighted reader can skip a chevron, and somebody using a screen
   * reader in French cannot skip hearing "Previous month" in English.
   */
  common: {
    previousMonth: "Previous month",
    nextMonth: "Next month",
    pickAMonth: "Pick a month",
    close: "Close",
    closeSheet: "Close sheet",
    accountMenu: "Account menu",
    closeAccountMenu: "Close account menu",
    view: "View",
    save: "Save",
    remove: "Remove",
    cancel: "Cancel",
    signOut: "Sign out",
    chartMode: "Chart mode",
    chartRange: "Chart range",
    unrealisedProfitLoss: "Unrealised P/L",
    unrecordedAllowance: "Unrecorded allowance",
    removePasskey: "Remove passkey",
    remindersOff: "Reminders off",
    remindersNeedPermission: "Reminders need notification permission",
    typeDeleteToConfirm: "Type DELETE to confirm.",
    addNewOnly: "Add new only — skip updates",
    /* The last of the shared labels, mostly for screen readers. */
    product: "Product",
    account: "Account",
    marketing: "Marketing",
    nearbyPages: "Nearby pages",
    needsYou: "Needs you",
    budgetView: "Budget view",
    arrivedCharges: "Charges that look like they arrived",
    applyRecurring: "Apply recurring",
    closePopUp: "Close pop-up",
    clearInstrument: "Clear selected instrument",
    searchInstrument: "Search by name or ISIN…",
    seeOnCalendar: "See the month on a calendar",
    clearDate: "Clear date",
    setUp: "Set up",
    everyMonthClosed: "Every month you have closed",
    openWallets: "Open wallets",
    trendRange: "Trend range",
    usePassword: "Use password",
    walkMeThrough: "Walk me through the setup",
    addTransaction: "Add transaction",
    capsAndNewMonths: "Caps and new months",
    browserNotifications: "Browser notifications",
    theRun: "The run",
    kept: "Kept",
  },

  /** Choosing a language, and being asked whether to. */
  locale: {
    /** The row in the profile's Money section, beside Currency. */
    settingLabel: "Language",
    settingHint: "Changes every word in the app. Figures follow it too.",

    /**
     * The banner shown when the country a request arrives from suggests a
     * language other than the one on screen. The offer is rendered in the
     * language being offered and the refusal in the language in use, so
     * whichever one the reader actually knows, half the banner is legible.
     */
    suggest: {
      title: "Read Pluclair in English?",
      body: "You can change this at any time from your profile.",
      accept: "Switch to English",
      dismiss: "Keep English",
    },
  },

  /**
   * Units and suffixes that ride along with a figure.
   *
   * Templates rather than bare suffixes because where the unit goes, and
   * whether a space precedes it, is part of the language: French writes
   * "1,2 k" with a space and English writes "1.2k" without one.
   */
  units: {
    thousands: "{value}k",
    perYear: "{rate} a year",
    percent: "{value}%",
  },

  /**
   * How a standing instruction's schedule reads.
   *
   * Note that `yearly` puts the month before the day and the French one puts
   * the day before the month. That ordering is not a formatting detail that
   * could be factored out — it is the sentence — which is why the whole
   * label is one message rather than a template with the parts assembled by
   * the caller.
   */
  recurrence: {
    weekly: "Weekly · {day}",
    yearly: "Yearly · {month} {day}",
    monthly: "Monthly · day {day}",
  },

  /**
   * How old the figures on screen are, in words.
   *
   * English puts the elapsed time first and French puts it last ("2 hours
   * ago" against "il y a 2 heures"), so again the whole phrase is the
   * message.
   */
  pullAge: {
    never: "never",
    justNow: "just now",
    minutes: "{count} min ago",
    hours: { one: "{count} hour ago", other: "{count} hours ago" },
    yesterday: "yesterday",
    days: { one: "{count} day ago", other: "{count} days ago" },
  },

  /** Dates, and the two days that have names instead of dates. */
  calendar: {
    today: "Today",
    yesterday: "Yesterday",
  },

  /**
   * Joining names into a sentence.
   *
   * The conjunction and the overflow are separate messages because they are
   * separate decisions: French joins with "et" and English with "and", but
   * both stop naming at the same count, which is the caller's rule and not
   * the language's.
   */
  list: {
    conjunction: "{first} and {last}",
    more: "{names} and {count} more",
  },

  /** Acting on several transactions at once, and what it will do. */
  selection: {
    deleteConfirm: {
      one: "Delete {count} transaction?",
      other: "Delete {count} transactions?",
    },
    deletePermanent: "This cannot be undone.",
    deleteAllRecurring: {
      one: "It comes from a recurring template, so Apply will recreate it unless you skip the date.",
      other:
        "They come from recurring templates, so Apply will recreate them unless you skip the date.",
    },
    deleteSomeRecurring:
      "{count} of them come from recurring templates, so Apply will recreate those unless you skip the date.",
    typeChangeAll: {
      one: "This one moves to a different kind of category, so past months' totals and unrecorded spending will change.",
      other:
        "All of them move to a different kind of category, so past months' totals and unrecorded spending will change.",
    },
    typeChangeSome:
      "{count} of them move to a different kind of category, so past months' totals and unrecorded spending will change.",
    rulesLeftBehind: {
      one: "{names} will still be filed the old way, because a newer entry for it is not selected.",
      other:
        "{names} will still be filed the old way, because a newer entry for them is not selected.",
    },
    rulesRewritten: "From now on {names} will be filed as {target}.",
    recurringKeepCategory:
      "{count} came from recurring templates, which will keep using their own category.",
  },

  /** Why a bank row is sitting in the review inbox rather than filed. */
  bankReview: {
    moneyIn: "Money arriving — say what it was",
    possibleRefund: "Looks like a refund from somewhere you usually spend",
    needsALook: "Cash or a transfer — not spending yet",
    noSuchCategory: "No category for this kind of spending yet",
    possibleDuplicate: "You may already have entered this",
    unknownMerchant: "First time here",
    /** A row in the inbox that has not been given a reason of its own. */
    waiting: "Waiting",
  },

  /** Why there is no annualised rate to show. */
  investmentReturn: {
    noContributions: "No contributions yet",
    tooShort: "Too new to annualise",
    notSolvable: "Not enough history",
  },

  /** The four things a category can be. Mirrors the `category_type` enum. */
  categoryType: {
    income: "Income",
    expense: "Expense",
    savings: "Savings",
    investment: "Investment",
  },

  /**
   * The named figures a month read may refer to.
   *
   * Keyed by the same names as the fact ids in `../month-facts`, but
   * deliberately not derived from them: an id is a protocol token the model
   * writes back as `{{fact:income}}` and must never change, where a label is
   * prose and may be reworded freely. Keeping them separate is what makes it
   * safe to reword one without breaking every stored read.
   *
   * These reach the model, not just the screen — the prompt lists each fact
   * as "id | label | value" — so a French reader's read is written from
   * French labels, which is what makes the prose idiomatic rather than
   * translated.
   */
  facts: {
    income: "Money in",
    expenses: "Money out",
    savings: "Set aside",
    remaining: "Left over",
    investments: "Invested",
    savingsRate: "Savings rate",
    expensesPrevious: "Money out over the same days of {month}",
    expensesVsPrevious: "Change against {month}",
    expensesVsPreviousMissing: "Change against last month",
    expensesVsPreviousNote:
      "the same stretch of both months, not a whole month against a part",
    kept: "Kept",
    keptRate: "Kept, as a share of what came in",
    unrecorded: "Unrecorded spending",
    unrecordedNote: "measured against the account balance, not estimated",
    cashChange: "What the account moved",
    unrecordedSoFar: "Unrecorded spending so far",
    unrecordedSoFarNote: "measured, and not final until the month is closed",
    onHand: "What the accounts hold",
    committed: "Still to leave",
    arriving: "Still to arrive",
    free: "Yours to spend",
    unrecordedAllowance: "Unrecorded allowance",
    unrecordedAllowanceNote: "a cap set from this person's own history",
    unrecordedOver: "Unrecorded spending over the allowance",
    unrecordedBaseline: "Usual unrecorded spending",
    unrecordedBaselineNote:
      "the median across closed months, so one holiday does not move it",
    streak: "Months in a row inside the allowance",
    bestStreak: "Best run so far",
    budgetSpent: "{label} cap, spent",
    budgetLeft: "{label} cap, left",
    budgetOver: "{label} cap, gone over by",
    goalSaved: "{name}, saved",
    investedValue: "Invested value",
    inboxPending: "Entries still waiting for a category",
    chargesUnconfirmed: "Recurring charges not yet confirmed",
  },

  /** The Month page's headline figure, and the line under it. */
  pulse: {
    headlineLeft: "Left this month",
    headlineShort: "Short by",
    headlineFree: "Yours to spend",
    noBalance: "Connect a bank to see what is actually in your account.",
    nothingDue: "Nothing else is due this month.",
    afterLeaving: "After everything still due to leave.",
    includingArriving: "Including what is still due to arrive.",
    afterBoth: "After what is still due to leave, and what is still to arrive.",
  },

  /** How long the reserve covers the committed costs. */
  runway: {
    underAMonth: "Under a month of committed costs.",
    months: "{count} months of committed costs.",
  },

  /** Where a month's income went. Used by the flow chart and the caps. */
  allocation: {
    income: "Income",
    expenses: "Expenses",
    savings: "Savings",
    investments: "Investments",
    remaining: "Remaining",
    available: "Available",
    other: "Other",
    allExpenses: "All expenses",
    uncategorised: "Category",
  },

  /**
   * The five-year clock on a PEA.
   *
   * The year and month counts are their own messages so they can be composed
   * into either sentence below — and because "mois" is the same word in the
   * French singular and plural, which no amount of string concatenation at
   * the call site would have got right.
   */
  pea: {
    matured: "Past five years — withdrawals keep the plan's tax treatment.",
    thisMonth: "Five years is reached this month.",
    inMonths: {
      one: "One month until the five-year mark.",
      other: "{count} months until the five-year mark.",
    },
    inYears: "{years} until the five-year mark.",
    inYearsAndMonths: "{years} and {months} until the five-year mark.",
    yearCount: { one: "{count} year", other: "{count} years" },
    monthCount: { one: "{count} month", other: "{count} months" },
  },

  /**
   * This month set against the last one.
   *
   * Phrased as "compared to X" rather than "than X" so that the month name
   * is never preceded by a word that elides in French: "que août" is wrong
   * and "qu'août" is right, and no template can choose between them. "à
   * août" sidesteps the question entirely.
   */
  comparison: {
    flat: "About the same as {when}.",
    up: "{amount} more than {when}.",
    down: "{amount} less than {when}.",
    thisPointIn: "this point in {month}",
  },

  /** Which occurrences a month's figures count. */
  budgetView: {
    currentOption: "Current · {date}",
    monthEndOption: "End of month · {date}",
    currentHint: "Through today only — future expenses and DCA not counted yet.",
    monthEndHint: "Includes all recurring due this month, including wallet DCA.",
  },

  /**
   * Push copy, composed on a server for a reader who is not there.
   *
   * The one place a browser preference is no use at all, which is why the
   * locale has to be stored per user and not only in a cookie.
   */
  push: {
    monthOpen: {
      title: "A new month",
      idle: "Apply your recurring to fill it in, and see what's left.",
      pending: {
        one: "{count} recurring item is ready to apply.",
        other: "{count} recurring items are ready to apply.",
      },
    },
    arrived: {
      title: {
        one: "Did this arrive?",
        other: "Did these arrive?",
      },
      body: {
        one: "One recurring charge looks like your bank already paid it.",
        other:
          "{count} recurring charges look like your bank already paid them.",
      },
    },
    breach: {
      title: "{label} is over budget",
      body: "{spent} spent of {limit}.",
    },
  },

  /** A bank movement paired with the occurrence a template called for. */
  fulfilment: {
    onTheDay: "on the day it was due",
    late: { one: "{count} day late", other: "{count} days late" },
    early: { one: "{count} day early", other: "{count} days early" },
    exact: "The same to the cent, {when}",
    more: "{amount} more than expected, {when}",
    less: "{amount} less than expected, {when}",
  },

  /** Bringing a bank statement in from a file. */
  csvImport: {
    noDate: "No readable date",
    noAmount: "No readable amount",
    duplicate: "Already in your ledger",
  },

  /** Odds and ends the app supplies where the user's own words are absent. */
  fallback: {
    /** An investment category that holds a position without counting in the summary. */
    trackingSuffix: "{name} · tracking",
    /** The first point on an investment chart, before any month of its own. */
    chartStart: "Start",
    /** A bank row that named neither a counterparty nor a reference. */
    bankTransaction: "Bank transaction",
    /** Stands in for a figure that does not exist rather than one that is zero. */
    noValue: "—",
  },

  /** Why the writer will not write a read right now. */
  monthRead: {
    allowanceSpent: "You have used all {allowance} reads for {month}.",
    coolingDown: "One was just written — try again in {seconds}s.",
    inFlight: "A read is already being written.",
    nothingToSay: "There is not enough in {month} to write about yet.",
    untracked: "Monthly reads are not set up yet (migration 024).",
    /* What a press comes back with when there is no read to show. */
    noWriter: "No writer is configured.",
    noAnswer: "The writer did not answer just now.",
    unusable: "The writer's answer could not be used.",
    threwAway:
      "The writer used a figure the app did not give it, so the read was thrown away. ({detail})",
    /**
     * Shown when a stored read is in a language the reader has since
     * switched away from. It states the fact and leaves the choice: the
     * write button beside it is the fix, and spending an allowance is
     * not something to do on somebody's behalf.
     */
    writtenInOtherLanguage: "Written in {language}.",
    /**
     * Why an answer was thrown away.
     *
     * These reach a reader, though only on the failure path: `write.ts` wraps
     * one in a sentence saying the read was discarded. Kept short and plain
     * for that reason — the person reading it wanted a paragraph about their
     * month and got an apology, so the apology should at least be legible.
     */
    refusal: {
      wrongShape: "Not the shape asked for",
      unknownDatum: 'It referred to "{id}", which was never sent',
      headlineHadFigure: "The headline contained a figure of its own",
      headlineTooLong: "The headline was longer than one line",
      everythingDropped: "Every observation had to be dropped",
    },
  },

  /**
   * Validation and refusal messages.
   *
   * Zod schemas are built when their module loads, long before any request
   * has a locale, so they carry these keys rather than these sentences and
   * the client resolves them at the point it shows a toast.
   */
  errors: {
    /**
     * Validation messages, carried by the Zod schemas as keys.
     *
     * A schema is built when its module loads, before any request has a
     * language, so it cannot translate its own message. It emits the key and
     * whoever shows the failure resolves it — see `resolveMessage` in
     * `../t` for why that is safe for the other errors sharing the field.
     */
    amountPositive: "Amount must be positive",
    invalidDate: "Invalid date",
    nothingSelected: "Nothing selected",
    tooManySelected: "Select at most 200 transactions at a time",
    pickCategory: "Pick a category",
    pickDay: "Pick a day between 1 and 28",
    pickRecurring: "Pick a recurring item",
    selectEtf: "Select an ETF from the search results",
    endBeforeStart: "End date must be on or after start date",
    passwordTooShort: "Password must be at least 6 characters",
    descriptionTooLong: "Description must be 500 characters or less",
    nameTooLong100: "Name must be 100 characters or less",
    nameTooLong40: "Name must be 40 characters or less",
    nameRequiredCustom: "Name is required for custom holdings",
    shareCountRequired: "Share count is required",
    targetPositive: "Target must be positive",
    capNotNegative: "A cap cannot be negative",
    zeroOrMore: "Must be 0 or more",
    positiveNumber: "Enter a positive number (comma or dot for decimals)",
    chargeAsPercent: "Enter the charge as a percentage, e.g. 0.20",
    chargeTooHigh: "That looks too high — enter 0.20 for 0.20%, not 20",
    notABalance: "That does not look like a balance",
    notACap: "That does not look like a cap",
    nothingToImport: "Nothing to import",
    tooManyRows: "Import at most 2000 rows at a time",
    invalidInput: "Invalid input",
    notAuthenticated: "Not authenticated",
    nameRequired: "Name is required",
    nameTooLong: "Name is too long",
    deleteConfirmation: "Type DELETE to confirm",
  },
} satisfies MessageTree;

export type Messages = typeof en;
