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
   *
   * **Before renaming a surface, read the rest of this comment.** Copy that
   * names a screen outlives the screen, and it is never found by grepping
   * for the key — the sentence spells the old name out, in prose, in two
   * languages, in a file nobody associates with navigation. Three separate
   * sweeps have now each found instances the one before it could not see,
   * and the reason is always the same: the sweeper knew the name being
   * retired *this week* and not the ones retired before it.
   *
   * So the list, read out of the history of this file's two sources
   * (`apps/web/lib/navigation.ts` and `apps/mobile/src/app/(tabs)/_layout.tsx`).
   * Every name either has carried and no longer does:
   *
   * - **Dashboard** → Home → Month → (retired; `/bearing` answers it now)
   * - **Home** → Month → (retired). Web's `/dashboard` label until `e49abd7`,
   *   the phone's tab title from `9c67bfe` until `7dea42d`.
   * - **Month** → (retired). The one this plan deleted.
   * - **Money**, **Transactions**, **Transaction** → Ledger
   * - **Recurring** → Charges. The route is still `/recurring`, which is why
   *   this one hides so well.
   * - **Planning** → Plan
   * - **History**, **Calendar** → views inside the Ledger, not destinations
   * - **Settings** — never in either nav, and hardcoded in both clients'
   *   account menus anyway. A name the app never had is as findable as one
   *   it used to have, and only by reading.
   *
   * The paths are not the list: `/dashboard`, `/recurring`, `/budgets`,
   * `/transactions` and `/investments` all outlived the words above, so
   * matching on the route finds nothing.
   */
  nav: {
    bearing: "Bearing",
    ledger: "Ledger",
    charges: "Charges",
    plan: "Plan",
    wallets: "Wallets",
    profile: "Profile",
    ledgerList: "List",
    ledgerCalendar: "Calendar",
    ledgerByCategory: "By category",
    walletsPositions: "Positions",
    walletsLookThrough: "Look-through",

    /** The count on a destination that has things waiting behind it. */
    waiting: "{count} waiting",
    /** The control that folds a surface's views away, and unfolds them. */
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
    /* What each of the two destructive rows takes with it. */
    wipeBlurb:
      "Transactions, recurring templates, positions and categories. Your account stays.",
    closeBlurb: "Permanent. Everything above goes with it.",
    /**
     * Why the row below is inert on a deployment that cannot do it.
     *
     * Operational rather than conversational, and translated anyway: it is
     * on screen, and a French reader meeting one English paragraph in the
     * middle of their settings learns that the translation is partial.
     */
    deleteNeedsServiceKey:
      "Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server (local: .env.local, production: Vercel env vars).",
  },

  /**
   * The passkey list inside the Security section.
   *
   * What a passkey is gets said by the section's own footer, so these are
   * only the words the list itself needs: what it looks like empty, what an
   * unnamed key is called, and when each one was added.
   */
  passkeys: {
    none: "No passkeys yet.",
    unnamed: "Passkey",
    added: "Added {date}",
    working: "Please wait…",
    add: "Add passkey",
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
    applyAllDone: "All recurring occurrences already applied",
    applyNothing: "Nothing to apply",
    applyResult: "Recurring applied: {parts}",
    applyAdded: "{count} added",
    applyUpdated: "{count} updated",
    emptyTitle: "Nothing recorded this month",
    emptyBody:
      "Add a transaction, or apply the charges you already know repeat.",
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
    exportCsv: "Export these transactions as CSV",
    importCsv: "Import a CSV statement",
    exportNothing: "Nothing to export for this view",
    noMatchTitle: "No matching transactions",
    noMatchBody: "Try another search or filter.",
    entryCount: {
      one: "{count} transaction",
      other: "{count} transactions",
    },
    /**
     * The same line under a filter, which states two numbers.
     *
     * `count` is how many are showing, because that is the number the French
     * noun agrees with — "1 transaction sur 5". English pluralises on the
     * total instead, so both its forms are identical, the way
     * `importer.alreadyInLedger` already carries two identical forms for a
     * split French needs and English does not.
     */
    shownOfTotal: {
      one: "{count} of {total} transactions",
      other: "{count} of {total} transactions",
    },
    exported: {
      one: "Exported {count} transaction",
      other: "Exported {count} transactions",
    },
    /* The Ledger's own totals strip, which describes what is on screen. */
    in: "In",
    out: "Out",
    leftAtMonthEnd: "Left at month end",
    clearFilters: "Clear filters",
    /* What a row's own control is called, for a reader who cannot see it. */
    selectRow: "Select {name}",
    editRow: "Edit {name}",
    /** Stands in when a move's target category cannot be named. */
    theNewCategory: "the new category",
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
      one: "{count} transaction needs a category",
      other: "{count} transactions need a category",
    },
    needsCategoryAction: {
      one: "{count} transaction needs a category. Review",
      other: "{count} transactions need a category. Review",
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
    /* Reading the file, before there is anything to map. */
    intro:
      "Export a CSV from your bank and drop it here. The file is read in your browser — nothing is uploaded, and nothing is saved until you have reviewed every row.",
    dropFile: "Drop a .csv file here",
    fileTooLarge: "That file is larger than 5 MB — is it the right export?",
    fileNoRows: "That file has no rows in it.",
    noRowsRead: "No rows could be read from that file.",
    /* Mapping. `columnNumber` stands in for a column the file did not name. */
    columnNumber: "Column {number}",
    rowCount: { one: "{count} row", other: "{count} rows" },
    guesses: "These are the app’s guesses. Change any that are wrong.",
    spendingIs: "In this file, spending is",
    signNegative: "Negative (−12.50)",
    signPositive: "Positive (12.50)",
    /* Reviewing. */
    categoryForLine: "Category for line {line}",
    choose: "Choose…",
  },

  /** The Plan surface: spending caps, savings goals and tags. */
  plan: {
    runwayLead: "Everything you have logged as savings covers",
    runwayRate: "at {amount} a month.",
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
      "A second way to group a transaction, cutting across categories — a holiday, a flatmate, a side project.",
    newTag: "New tag",
    addTag: "Add tag",
    tagAdded: "Tag added",
    goalName: "Goal name",
    deleteGoalTitle: "Delete this goal?",
    deleteCapTitle: "Delete this budget?",
    deleteWarning: "This cannot be undone. Your transactions are not affected.",
    goalReached: "Goal reached!",
    goalOverdue: "Target date passed — {amount} still to save.",
    goalOnSchedule: "Save {amount}/month to reach this by {month}.",
    globalMonthlyLimit: "Global monthly limit",
    goalTargetDateOptional: "Target date (optional)",
    /**
     * Said only when there is nothing to show yet, which is why neither
     * blurb points at the rings: on the screen that renders them, this
     * sentence is what stands in their place.
     */
    capsBlurb:
      "A cap is a monthly ceiling — on one category, or on everything. Add one and you will see how close you are to it.",
    goalsBlurb:
      "A goal is an amount to reach — a deposit, a trip, a buffer. Set aside money in a savings category and it fills.",
    /** Screen-reader labels for the rings, which are drawings otherwise. */
    capOn: "Cap on {label}",
    capRemoveHint: "Long press to remove this cap",
    goalNamed: "Goal {name}",
    goalRemoveHint: "Long press to remove this goal",
    amountOfTotal: "{amount} of {total}",
    /** Web's rings are buttons that open the form, so they name that. */
    editCapOn: "Edit the cap on {label}",
    editGoalNamed: "Edit the goal {name}",
    capScope: "Scope",
    trackCategoryOptional: "Track category (optional)",
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
    /**
     * Whether a template is running.
     *
     * `RecurringView` spelled these two words in English in the JSX, so a
     * French reader got "On"/"Off" in a row where everything else was
     * translated. The marketing mock copied the same literals. One key, said
     * in both places.
     */
    on: "On",
    off: "Off",
    addTitle: "Add recurring",
    editTitle: "Edit recurring",
    addTitleMobile: "Add recurring item",
    editTitleMobile: "Edit recurring item",
    close: "Close",
    category: "Category",
    description: "Description",
    descriptionPlaceholder: "e.g. Netflix, gym membership, monthly ETF buy",
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
    fetchingPrice: "Fetching price…",
    /**
     * What a share-priced estimate is made of. The unit belongs to the
     * sentence, so "/ share" is inside the message rather than appended to a
     * formatted figure.
     */
    perSharePrice: "@ {price} / share",
    convertedFrom: "({amount} converted)",
    descriptionOptional: "Description (optional)",
    monthOfYear: "Month",
    activePeriod: "Active period (optional)",
    activePeriodNote:
      "Leave both empty to run until you stop it. Set both for a fixed instalment plan — a property tax spread over several months, say.",
    saving: "Saving…",
    save: "Save",
    delete: "Delete",
    deleteItem: "Delete recurring item",
    deleteExplanation:
      "Delete this recurring template? Past transactions stay in your ledger.",
    deleting: "Deleting…",
    confirmDelete: "Confirm delete",
    savedHint: "Saved. Apply recurring in the Ledger to see the change.",
    updatedHint: "Updated. Apply recurring in the Ledger to see the change.",
    deletedHint: "Deleted — apply recurring in the Ledger to see the change.",
    brokerDcaNote:
      "Buys at the broker are tracked for visibility but do not reduce your remaining budget.",
    bitstackNote:
      "Fixed EUR weekly buy on Bitstack. Market value on Wallets uses your total BTC × live BTC/EUR price.",
    sharesNote:
      "Pick your ETF and share count. Search by name or ISIN (e.g. LU1681043599). The app fetches the live price and computes the EUR amount when saving or applying recurring.",
    yearlyNote:
      "Counts as a monthly share in your budget (annual ÷ 12). The full payment is recorded once in the due month.",
    /**
     * The two blocks under a fixed-price template that buys something.
     *
     * "DCA" is what these said, and `CONTEXT.md` refuses the word: a
     * standing instruction to buy is a recurring template, and one priced by
     * a share count is a share-priced template. Neither of these is either —
     * they are fixed amounts that happen to buy an instrument — so they say
     * what the money does instead of naming a strategy.
     */
    trackedFund: "Tracked ETF / fund",
    trackedFundNote:
      "A fixed euro charge: pick the ETF it buys. On Wallets, enter how many shares you hold altogether for a live market value.",
    bitcoinTitle: "Bitcoin charge",
    bitcoinNote:
      "Each buy converts your euro amount to BTC. Enter your total BTC balance on Wallets for a live value.",
  },

  /**
   * Finding an instrument by name or ISIN.
   *
   * An ISIN is twelve characters, which is long enough that a reader is
   * halfway through one before the search has anything to say — hence a line
   * that tells them to keep going rather than an empty list that reads as no
   * match.
   */
  instrument: {
    label: "ETF / fund",
    /** Names the results list for a reader who arrives at it by keyboard. */
    resultsLabel: "Matching instruments",
    searching: "Searching…",
    isinKeepTyping: "An ISIN is 12 characters — keep typing…",
    noResults: "No instruments found. Try a name or a 12-character ISIN.",
  },

  /**
   * Turning the occurrences a month calls for into transactions.
   *
   * The counts are plural messages rather than `count === 1` ternaries for
   * the reason the rest of this file gives: French puts zero in the singular
   * and agrees its participles.
   */
  applyRecurring: {
    blurb:
      "Writes the transactions this month's charges call for. What you have already recorded is left alone unless you confirm the updates below.",
    repriceNote: {
      one: "{count} occurrence is priced from the market and still dated ahead. It follows its instrument on its own — nothing to confirm.",
      other:
        "{count} occurrences are priced from the market and still dated ahead. They follow their instruments on their own — nothing to confirm.",
    },
    updateExisting: "Update existing ({count})",
    updateExistingNote:
      "These were applied already, but the recurring template has changed since — its amount, its note or its category.",
    addNew: "Add new ({count})",
    noteUpdated: "Note updated to match the recurring template",
    movedToCategory: "Moved to the recurring template's category",
    applying: "Applying…",
    nothingSelected: "Nothing selected",
    applySelected: {
      one: "Apply {count} selected",
      other: "Apply {count} selected",
    },
    applyNew: { one: "Apply {count} new", other: "Apply {count} new" },
  },

  /**
   * Standing charges the statement implies, offered rather than created.
   *
   * Nothing here writes a template — the app proposes and the user agrees —
   * so every word is an offer, and refusing one is a decision the app records
   * rather than a dismissal that lasts until the next page load.
   */
  recurringProposals: {
    lead: {
      one: "{count} charge in your statement looks like it repeats.",
      other: "{count} charges in your statement look like they repeat.",
    },
    everyWeek: "every week",
    everyMonth: "every month",
    everyYear: "every year",
    seenTimes: { one: "seen {count} time", other: "seen {count} times" },
    accept: "Add",
    refuse: "Not this",
    added: "Added",
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
    /** The disabled first option of every category picker. */
    selectCategory: "Select category",
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
      "Skip this date only? The transaction will be removed and Apply won’t recreate it. The recurring template stays active for later months.",
    deleteExplanation:
      "Delete this transaction permanently? Apply may write it again if the recurring template still calls for it.",
    cancel: "Cancel",
  },

  /** The Charges surface: the list of standing instructions. */
  charges: {
    blurb: "What you already know is coming, every month.",
    /**
     * The four scoreboard tiles.
     *
     * One word each, because the tiles carry nothing else — a label that
     * wraps to two lines in a narrow column stops being a label and starts
     * being a sentence competing with the figure under it. `perMonth` sits
     * once beneath the row rather than four times inside it; the period is
     * the same for all four and repeating it is the chrome this header was
     * asked to lose.
     */
    tileIncome: "Income",
    tileCommitted: "Committed",
    tileSetAside: "Set aside",
    tileLeft: "Left",
    perMonth: "Per month",
    /** After a group's monthly figure: "€1,240 / mo". */
    perMonthSuffix: " / mo",
    /**
     * Shown where the income figure would be, when no income charge exists.
     * A `0 €` there would read as measured; this says the box is waiting.
     */
    noIncomeYet: "No income charge yet — add one and this fills in.",
    /**
     * What goes to the broker, either side of the figure.
     *
     * Two fragments rather than one template because the amount is its own
     * element — that is what lets the privacy blur cover the figure without
     * covering the sentence around it.
     */
    ofWhichMovedBefore: "of which",
    ofWhichMovedAfter: "moved into the broker — tracked, but not spent.",
    nothingHereYet: "Nothing here yet.",
    editNamed: "Edit {name}",
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
    emptyBodyMobile: "Rent, salary, subscriptions, a monthly ETF buy.",
    openLedgerToApply: "Open the Ledger to apply these charges",
    /**
     * The banner above the list when this month was written before these
     * charges changed.
     *
     * Split in three because web draws the link through the middle clause
     * only, while the phone makes the whole banner one target and joins the
     * three back into a sentence. `openLedgerToApply` above is that target's
     * accessible name, which is why it is a whole sentence and these are not.
     */
    applyPendingBefore:
      "These charges have changed since this month was written.",
    applyPendingLink: "Open the Ledger",
    applyPendingAfter: "and apply them.",
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
    /* The three field names, one of which is only ever heard. */
    amount: "Amount",
    note: "Note",
    tags: "Tags",
    allCategories: "All categories",
    noCategoryMatch: "No category matches “{query}”.",
    /**
     * The running tally while saving several in a row. Both forms are the
     * same in English and differ in French, which agrees the participle.
     */
    savedKeepGoing: {
      one: "{count} saved — keep going.",
      other: "{count} saved — keep going.",
    },
  },

  /** First run: the two minutes that put real numbers on the Bearing. */
  onboarding: {
    progress: "Setup progress",
    welcomeTitle: "Welcome to Pluclair",
    welcomeBody:
      "Two minutes now and the Bearing will have real numbers in it instead of zeros.",
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
      "Pick one category and a monthly cap. A panel on the Bearing will show a ring that fills as you spend against it. You can add more under Plan.",
    monthlyAmount: "Monthly amount",
    dayOfMonth: "Day of the month",
    monthlyCap: "Monthly cap",
    category: "Category",
    continue: "Continue",
    /**
     * The step-back control, on every step but the first.
     *
     * Its own word rather than `common.*` because it names a move inside the
     * wizard: the browser's Back does the same thing here, and the label has
     * to read as the step before this one rather than as the page before it.
     */
    back: "Back",
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
    /**
     * The way back here, from web's account menu and the phone's Profile
     * screen alike.
     *
     * Web reached `/welcome` from exactly one place — a `router.push` the
     * instant a sign-up succeeded — so a reader who skipped it, or who
     * signed in later on another device, had no route back. The phone's
     * launch-time gate only pushes to `/onboarding` while `onboarded ===
     * false`, so once that flag flips it has the identical gap. Both surfaces
     * share this key, worded as somewhere to go rather than as something
     * owed, because most readers who open it have already finished.
     */
    reopen: "Set-up walkthrough",
    /** One of the charges the third step collects, once it is saved. */
    templateAdded: "{name} added",
  },

  /** Categories: the labels the user files transactions under. */
  categories: {
    blurb:
      "Categories organise your transactions and recurring templates. Archived categories keep their history but no longer appear when adding transactions.",
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
    editNamed: "Edit {name}",
    deleteNamed: "Delete {name}",
    /** The confirming half of the pair the row swaps in before deleting. */
    confirmDelete: "Delete",
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
      "Untick for wallet buys tracked outside the budget (e.g. buys funded by broker transfers).",
    /**
     * The badge on a category that does not count toward the month.
     *
     * One word per type, because the flag means something different for each:
     * an investment bought with money that already left, savings coming back
     * out, income that is a refund rather than earnings.
     */
    notCountingInvestment: "Tracking",
    notCountingSavings: "Withdrawal",
    notCountingIncome: "Reimbursement",
  },

  /**
   * What a finding says, in words.
   *
   * No amount appears in any of these. A figure inside a sentence cannot be
   * blurred by privacy mode and cannot follow the currency toggle, which is
   * the same reason `month-facts.ts` gives for placeholders. The euro weight
   * is rendered beside the sentence, in its own element.
   *
   * `months` is a count and takes plural forms; French puts zero in the
   * singular, so these cannot be ternaries at the call site.
   */
  categoryFindings: {
    driftUp: {
      one: "has climbed for {months} month running",
      other: "has climbed for {months} months running",
    },
    driftDown: {
      one: "has fallen for {months} month running",
      other: "has fallen for {months} months running",
    },
    oddMonthHigh: "{month} stands well above a normal month here",
    oddMonthLow: "{month} stands well below a normal month here",
    goneQuiet: {
      one: "nothing recorded for {months} month, after a steady run",
      other: "nothing recorded for {months} months, after a steady run",
    },
    appeared: "new since {month}, and steady since",
    /**
     * Both directions, because the pattern has both.
     *
     * A calendar month can be reliably *below* its category's normal year
     * after year as easily as above it — a commuter pass nobody buys in
     * August — and `seasonalMonths` reports that case. One sentence saying
     * "runs high" would describe it exactly backwards.
     */
    everyYear: "{month} runs high here every year",
    everyYearLow: "{month} runs low here every year",
    weightPerMonth: "{amount} a month",
    weightOnce: "{amount}",
    bandTitle: "What moved",
    bandEmpty: "Nothing has moved enough to be worth a sentence.",
    /**
     * The band's own model call, and why none of these says "reading".
     *
     * A reading is the other feature on this screen — the prose a model
     * writes about one category, in the panel, behind its own button. This
     * one writes nothing at all: it re-orders findings the app has already
     * found, and every figure beside them stays the app's. Naming both "a
     * reading" offered one screen two different features under one word.
     *
     * So the three read as one family on the verb that says what actually
     * happens: order, Ordered, order. French keeps the same discipline on
     * classer, Classé, classement.
     */
    rerank: "Ask a model to order these",
    reranked: "Ordered by a model",
    rerankStale: "The figures have moved since this order was chosen.",
  },

  /** The by-category screen's own furniture. */
  categoryScreen: {
    empty: "Nothing to look back on yet",
    emptyBody:
      "Once a few months have transactions in them, each category's run shows up here.",
    normal: "{amount} in a normal month",
    normalShifted: "{amount} per pay period",
    periodShifted:
      "These land either side of a month end, so each is counted against the period it belongs to. A month here can differ from the same month in the Ledger.",
    groupExpense: "Going out",
    groupIncome: "Coming in",
    groupSavings: "Set aside",
    groupInvestment: "Invested",
    open: "Open {name}",
    close: "Close",
    behindThisMonth: "Behind {month}",
    seeInLedger: "See all in the Ledger",
    months: "Last {count} months",
  },

  /**
   * The one-bar breakdown, wherever it is drawn.
   *
   * Three screens show `SpendStrip` — the month's wallets, a Bearing panel
   * and the findings band — so its two strings live at the top level rather
   * than under any one of them.
   */
  spendStrip: {
    /** The pooled tail, under the bands that got a colour of their own. */
    more: {
      one: "{count} more",
      other: "{count} more",
    },
    /** What a screen reader is told about the bar itself. */
    label: {
      one: "Spending split across {count} category",
      other: "Spending split across {count} categories",
    },
  },

  /** Wallets: what is invested, and what it is worth now. */
  wallets: {
    /** The quotes, and taking fresh ones. */
    refreshQuotes: "Refresh prices",
    refreshingQuotes: "Refreshing…",
    quotesRefreshed: "Prices refreshed",
    marketValue: "Market value",
    value: "Value",
    invested: "Invested",
    market: "Market",
    profitLoss: "P/L",
    walletPicker: "Investment wallet",
    /** The widest range of the price line. The others need no translation. */
    rangeAll: "All",
    positions: "Positions",
    /**
     * How the holdings in a wallet are ordered.
     *
     * They came back in whatever order the query happened to return them,
     * which is no order at all: a wallet with a dozen lines was a list you
     * had to read all of to find one. Two orders and no direction toggle —
     * names are looked up in, so they run A to Z; amounts are scanned for the
     * big ones, so they run largest first.
     */
    orderBy: "Order",
    orderByName: "Name",
    orderByInvested: "Invested",
    noItems: "No items yet in this wallet.",
    editPosition: "Edit {name}",
    /**
     * Fragments, not sentences, wherever a figure sits inside one.
     *
     * `.privacy-amount` is a blur filter, so an amount has to keep its own
     * element. Folding it into an interpolated sentence would blur the words
     * around it too. Both languages put the figure in the same place in each
     * of these, which is what makes the split safe.
     */
    investedSuffix: "invested",
    fundingLabel: "Monthly contributions",
    perMonth: "/mo",
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

  /** The ongoing-charge card at the foot of the investments page. */
  fundCost: {
    title: "What holding this costs",
    weightedSuffix: "a year, weighted",
    emptyBody:
      "Add each holding's ongoing charge — the yearly fee on its KID — and this becomes a figure in euros. It is the biggest cost most portfolios have and the only one that never shows up on a statement.",
    aYearOn: "a year on",
    overYears: "over {years} years at this balance",
    cheapestPrefix: "Your cheapest holding is",
    cheapestAt: "at {charge}. At that rate the same",
    wouldCost: "would cost",
    differenceOf: "— a difference of",
    aYear: "a year.",
    missingCharge: {
      one: "{count} holding has no charge recorded",
      other: "{count} holdings have no charge recorded",
    },
    partialSuffix: ", so this total is partial.",
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
    /**
     * The card that offers the close, before the sheet opens. Which of the
     * four `invite*` lines is shown is decided by `closeInvitation` in
     * `../../month-close`, not at the call site.
     *
     * `inviteNormal` is deliberately not `normalMonth` above, which says the
     * same figure in six fewer words. On the sheet that wording sits directly
     * under a "Never recorded" total and the reader can see what the number
     * is; on this card there is no other figure at all, so the short version
     * reads as what a month costs to live, which it is not.
     */
    setStartingBalance: "Set your starting balance",
    inviteBaseline:
      "Type in what your account actually holds today. From next month the app can compare that against what it recorded, and tell you what it never saw — cash, a forgotten tap, a card you do not track.",
    inviteAllowance:
      "Stay under {cap} of unrecorded spending to keep the run going.",
    inviteNormal:
      "A normal month for you is around {amount} the app never sees.",
    inviteBare: "One balance, and the app can work out what it never saw.",
    /** The card's own button, which names no month — the heading above it does. */
    closeTheMonth: "Close the month",
    monthsInARow: {
      one: "{count} month in a row",
      other: "{count} months in a row",
    },
    filledFromBank:
      "Filled in from your bank. Change it if the reading day differs from today.",
    /**
     * A sample balance, and a real translation rather than a stray literal:
     * French writes the decimal with a comma, so an English-shaped example
     * in the field teaches the wrong format to the reader who needs it most.
     */
    balanceUnreadable:
      "That does not look like an amount. Try something like {example}.",
    balancePlaceholder: "2400.50",
    reopened: "{month} reopened",
    baselineSet:
      "{amount} on {date}. Close next month and the app can start telling you what it never saw.",
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
    nothingFromBank: "Nothing waiting from your bank.",
    leaveOut: "Leave out",
    /* The other column: what was decided, and how to take it back. */
    recentlyDecided: "Recently decided",
    putOneBack: "Put one back if it went to the wrong place.",
    leftOut: "left out",
    inYourLedger: "in your ledger",
    move: "Move",
    changeCategory: "Change category",
    undo: "Undo",
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
    /** How much of the selection Apply would put back if it were deleted. */
    fromRecurring: {
      one: "{count} from a recurring template",
      other: "{count} from recurring templates",
    },
  },

  /** The Ledger seen by date. */
  calendarView: {
    monthlyCalendar: "Monthly calendar",
    /**
     * A day cell's accessible name, and the two figures under a month.
     *
     * `inAndOut` is one message rather than two amounts with "in" and "out"
     * placed around them by the layout: where those words fall in the
     * sentence is the language's decision.
     */
    dayLabel: "{day} — {entries}",
    inAndOut: "{income} in · {outflow} out",
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
    or: "or",
    welcomeBack: "Welcome back",
    signUpHeading: "Start tracking income and expenses",
    linkExpired: "Sign-in link expired or invalid. Please try again.",
    redirecting: "Redirecting…",
    waitingForPasskey: "Waiting for passkey…",
    /**
     * Getting back in.
     *
     * `resetSent` says the same thing whether or not the address has an
     * account behind it. That is the wording, not a hedge: a reply that
     * distinguished the two would tell anybody who asked which addresses are
     * registered here.
     */
    forgotPassword: "Forgot password?",
    resetHeading: "Reset your password",
    resetBody:
      "Enter your email address and we will send you a link back into your ledger.",
    sendResetLink: "Send the link",
    sendingResetLink: "Sending…",
    resetSent:
      "If there is an account for {email}, a link is on its way. Check your inbox, and your spam folder.",
    backToSignIn: "Back to sign in",
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
    /**
     * The close mock's four rows, and the heading over them.
     *
     * "How it adds up" rather than "How it reconciled": the close's own
     * vocabulary rules out calling it a reconciliation, and a marketing mock
     * is the last place that should be the one surface using the word.
     */
    openingBalance: "Opening balance",
    recordedIn: "Recorded in",
    recordedOut: "Recorded out",
    closingBalance: "Closing balance",
    howItAddsUp: "How it adds up",
    /** The read's own card heading, which the app draws from its surface. */
    monthRead: "Month read",
    whatsLeft: "What's left",
    expectedImpact: "Expected impact",
    expectedImpactPerMonth: "Expected impact per month",
    portfolioValue: "Portfolio value",
    monthlyBudgets: "Monthly budgets",
    savingsGoals: "Savings goals",
    sampleHousing: "Housing",
    sampleEverythingElse: "Everything else",
    /** The Charges mock's share-priced template, which the other three are
     * not: its amount is a quote times a quantity rather than a figure
     * anybody typed. */
    oneShare: "1 share",
    oneShareAtQuote: "1 share at the current quote",
    sharePriced: "Share-priced",
    templatesAllApplied: {
      one: "{count} template, applied",
      other: "{count} templates, all applied",
    },
  },

  /**
   * Sentences the sample month is written into.
   *
   * Their own group rather than more of `marketingMock` because they are not
   * only a mock's: the landing page prints the same three figures in glass
   * panels beside the device frames, in the same words. One home means the
   * page and the screenshot of the app cannot drift apart, which is the whole
   * claim the section is making.
   *
   * Every one of them carries a figure, which is why they are here and not in
   * `landing-copy`: a translated sentence with a `{placeholder}` is the thing
   * the catalogue exists to hold, and the marketing copy files are prose that
   * takes no arguments.
   */
  marketingStat: {
    unrecordedIn: "Unrecorded in {month}",
    underAllowance: "under your {amount} allowance",
    /** `{percent}` arrives already carrying its sign, from `units.percent`:
     * English closes it up, French wants a space before it. */
    ofWhatCameIn: "{percent} of what came in",
    monthsValue: {
      one: "{count} month",
      other: "{count} months",
    },
    monthsInARow: {
      one: "{count} month in a row",
      other: "{count} months in a row",
    },
    inARow: "{count} in a row",
    inARowInsideAllowance: "in a row inside the allowance",
    readyToClose: "{month} is ready to close",
    keepTheRun:
      "Stay under {amount} of unrecorded spending to keep the run going.",
    keptIn: "Kept in {month}",
    leftIn: "Left in {month}",
    ofEarned: "of {amount} earned",
  },

  /** Wallet detail: the position sheet, the targets and the performance card. */
  position: {
    /* The sheet's own fields. */
    fromRecurring: "From recurring",
    customHolding: "Custom holding",
    noRecurringAvailable:
      "No recurring items available for this column. Add one on the Charges page or use a custom holding.",
    nameLabel: "Name",
    namePlaceholder: "e.g. MSCI World ETF",
    costBasis: "Total invested (cost basis)",
    costBasisHint:
      "Your broker's total invested amount for this position. Used for P/L — not updated from recurring transactions.",
    /**
     * The link is the surface's own name, not the route's: the path is still
     * `/recurring` but the tab has been called Charges for two releases, and
     * this said "Recurring" — a page nobody can find in the nav.
     */
    changeFundPrefix: "Change the fund on the",
    changeFundLink: "Charges",
    changeFundSuffix: " page.",
    /**
     * The other branch of the same sheet, pointing at the same page — which
     * is why it is split the same way rather than interpolated. It said
     * "Recurring" while the branch above said "Charges", so one sheet named
     * one page twice, differently, and both links went to `/recurring`.
     *
     * Split rather than one string with a `{name}` because the two languages
     * put "first" in different places: English trails it after the link,
     * French wants "d'abord" before it.
     */
    linkEtfPrefix: "Link your ETF under",
    linkEtfLink: "Charges → {name}",
    linkEtfSuffix: " first, then enter total shares below.",
    chargePlaceholder: "e.g. 0,20",
    /**
     * The ISIN, typed rather than found.
     *
     * Yahoo's search answers with a symbol and a name and never an ISIN, so
     * the only way one ever reached a position was to paste the ISIN into the
     * search box itself. That is not a thing anyone discovers, and without an
     * ISIN the look-through cannot read what a fund holds — hence a field.
     */
    isinLabel: "ISIN (optional)",
    isinHint:
      "Twelve characters, on the fund's KID or factsheet. The look-through needs it to read what the fund holds; equities and Bitcoin can be left empty.",

    /* The plan panel: the return, the split, and the PEA ceiling. */
    moneyWeightedReturn: "Money-weighted return",
    amountIn: "in",
    amountNow: "now",
    returnExplainer:
      "Annualised across every dated contribution, so paying in monthly is measured fairly against a lump sum. Absolute gain alone would flatter whichever had money in longest.",
    ofTarget: "of {target} target",
    splitLeadPrefix: "Your next",
    splitLeadSuffix: "would close the gap fastest as",
    splitItemTo: "to {wallet}",
    splitTail: "— rebalancing by contribution rather than by selling.",
    noTargetHint:
      "Set a target split to see how far the portfolio has drifted, and where the next contribution should go.",
    peaPaidIn: "Paid in",
    peaOfCeiling: "of {ceiling}",
    peaRoomLeft: "of room left",
    peaCashOnly:
      "Only cash paid in counts against the ceiling — growth does not.",
    addItem: "Add item",
    addCryptoItem: "Add crypto item",
    itemAdded: "Item added",
    itemUpdated: "{name} updated",
    itemRemoved: "{name} removed",
    /** The disabled first option of the recurring-template picker. */
    pickRecurring: "Pick one…",
    /** What the live quote is worth, above the field it would fill. */
    liveEstimate: "Live market estimate:",
    itemType: "Item type",
    recurringItem: "Recurring item",
    dcaBitcoin: "Fixed EUR each month · Bitcoin on Bitstack",
    dcaEtf: "Fixed EUR each month · ETF set under Plan",
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
    /** The broker override, and the pin that makes it win. */
    brokerValue: "Your broker's total (optional)",
    brokerValueHint:
      "Leave this empty — or type 0 — and the value is computed live from your shares and the market price. Fill it in only when your broker shows a different total, then pin it below to make it stick.",
    pinValue: "Use this figure instead of the market price",
    pinValueHint:
      "Unpinned, your figure is only a fallback for when no price can be fetched.",
    valuedLive: "Valued from the market",
    valuedPinned: "Valued from your figure",
    valuedManual: "Valued from your figure — no market price available",
    valuedCost: "Valued at what it cost — add shares to follow the market",
    /** The fund's own charge, which is not the broker's. */
    ongoingChargeLabel: "The fund's ongoing charge (optional)",
    ongoingChargeHint:
      "The fund's own yearly fee as a percentage — 0.20 for 0.20%. It is on the KID and never appears on a statement, because it comes out of the fund's value. This is not your broker's commission, which the app does not track.",
    perYear: "% a year",
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
   * Figures for the Bearing's hero card and its attention list.
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
    connectBankNote:
      "Connect a bank to lead with what is actually in your account.",
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
      one: "{count} bank transaction was merged away by an earlier sync",
      other: "{count} bank transactions were merged away by an earlier sync",
    },
    attentionInbox: {
      one: "{count} transaction needs a category",
      other: "{count} transactions need a category",
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
    /** What is invested, on the Wallets tile's own strip in a Bearing panel. */
    invested: "Invested",
    /**
     * A closing streak, badged beside `MonthScore` and `MonthCloseHistory`'s
     * own headings. Not a plural message: the noun these describe ("in a
     * row", "best") never changes shape with the count, only the numeral
     * does, so a `{ one, other }` split would carry two identical forms.
     */
    streakInARow: "{count} in a row",
    bestStreak: "best {count}",
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
    /* The month picker's own grid: its year stepper, its shortcut, its key. */
    showYear: "Show {year}",
    thisMonth: "This month",
    monthClosed: "closed",
    monthRecords: "records",
    close: "Close",
    closeSheet: "Close sheet",
    openMenu: "Open menu",
    closeMenu: "Close menu",
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
    usePassword: "Use password",
    addTransaction: "Add transaction",
    capsAndNewMonths: "Caps and new months",
    browserNotifications: "Browser notifications",
    theRun: "The run",
    kept: "Kept",
    /**
     * The privacy blur's toggle, which is an icon and nothing else — so
     * these two are the whole of its wording, seen only by a screen reader
     * and in the tooltip.
     */
    showAmounts: "Show amounts",
    hideAmounts: "Hide amounts",
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
    months: "{value} months",
    /** Percentage points of drift from a target weight, never per cent. */
    points: "{value} pts",
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
      one: "{names} will still be filed the old way, because a newer transaction for it is not selected.",
      other:
        "{names} will still be filed the old way, because a newer transaction for them is not selected.",
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

  /**
   * Bank rows an earlier sync merged away on its own.
   *
   * "Rows" rather than transactions, deliberately: these never became
   * transactions, which is the whole complaint — the sync filed them against
   * a recurring template on nothing more than a matching amount, and what it
   * swallowed was spending nobody ever saw.
   */
  swallowed: {
    title: {
      one: "{count} bank row was merged away",
      other: "{count} bank rows were merged away",
    },
    body: "An earlier sync decided these were charges your recurring templates had already written, on nothing more than a matching amount within five days. On a statement of small round figures that is not enough to go on, so most of them are probably real spending that never reached your ledger. Reopening puts them back in the review inbox for you to judge.",
    reopenAll: "Reopen them all",
    reopening: "Reopening…",
    reopened: "Reopened",
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
    inboxPending: "Transactions still waiting for a category",
    chargesUnconfirmed: "Recurring charges not yet confirmed",
  },

  /**
   * The figures the Bearing may show, and a model may name.
   *
   * A separate family from `facts` above even where a label is nearly the
   * same, because the two packs are read in different company. In a month
   * read "Still to leave" sits under that month's heading and needs no
   * qualifier; on the Bearing it sits beside a twelve-month projection and a
   * portfolio, so it has to say which month it means. Merging them would
   * force one wording to serve two contexts, and the loser is always the
   * one with less surrounding text — which here is the one made of
   * nothing but figures.
   */
  bearingFacts: {
    netPosition: "Everything, added up",
    netPositionNote: "accounts and investments only; this app records no debts",
    onHand: "In the accounts",
    invested: "Invested",
    investedShare: "Share of it invested",
    free: "Yours to spend this month",
    committed: "Still to leave this month",
    arriving: "Still to arrive this month",
    savingsRate: "Savings rate this month",
    expensesVsPrevious: "Money out against {month}",
    expensesVsPreviousNote:
      "the same stretch of both months, not a whole month against a part",
    unrecordedSoFar: "Unrecorded spending so far",
    unrecordedSoFarNote: "measured, and not final until the month is closed",
    unrecordedAllowance: "Unrecorded allowance",
    unrecordedAllowanceNote: "a cap set from this person's own history",
    unrecordedOver: "Unrecorded spending over the allowance",
    unrecordedBaseline: "Usual unrecorded spending",
    unrecordedBaselineNote:
      "the median across closed months, so one holiday does not move it",
    streak: "Months in a row inside the allowance",
    bestStreak: "Best run so far",
    monthlyNetAverage: "What a month has typically kept, over {count} months",
    projectedBalance: "Where the accounts land by {month}",
    projectedBalanceNote:
      "arithmetic on charges already scheduled, less what closed months measure a normal one costs unseen",
    projectedBalanceNoteUnmeasured:
      "arithmetic on charges already scheduled; everyday spending is not measured yet",
    projectedAdded: {
      one: "What the next month adds to the accounts",
      other: "What the next {count} months add to the accounts",
    },
    projectedBalanceBare: "Where the accounts land",
    projectedKept: "Everything kept, by {month}",
    projectedKeptAdded: {
      one: "What the next month keeps altogether",
      other: "What the next {count} months keep altogether",
    },
    projectedKeptBare: "Everything kept",
    projectedKeptNote:
      "the accounts plus everything set aside, counted at what was put in rather than at what it might grow to",
    projectedMonthlyNet:
      "What each month adds to the accounts, if nothing changes",
    committedMonthly: "One month of committed costs",
    runwayMonths: "Months the set-aside would cover",
    walletCost: "Put into the wallets",
    walletGain: "Gain on what was put in",
    walletReturn: "Return a year",
    walletReturnNote: "money-weighted, so the timing of each purchase counts",
    walletDrag: "What holding it costs a year",
    walletDragNote:
      "charged inside the funds, so it never appears as a transaction",
    walletDragPartial: {
      one: "partial — {count} holding has no charge recorded",
      other: "partial — {count} holdings have no charge recorded",
    },
    walletDrift: "Furthest a wallet is from its target",
    walletDriftNote: "in percentage points, whichever way it has drifted",
    walletConcentration: "{name}, share of the wallets",
    walletConcentrationNote:
      "the largest single holding, weighed against what is invested rather than against cash",
    contributionPace: "Going into the wallets each month",
    inboxPending: "Transactions still waiting for a category",
  },

  /**
   * The figures a read of one category may name.
   *
   * A third family beside `facts` and `bearingFacts`, and separate for the
   * same reason those two are separate from each other: these labels are read
   * with nothing around them but one category's name. "A normal month" needs
   * no qualifier here because the panel above already says whose normal it
   * is; on the Bearing the same words would have to say which category, and
   * in a month read they would have to say which month.
   *
   * These reach the model as well as the screen — `category-read-prompt.ts`
   * lists each one as "id | label | value" — so the label is also the name
   * the prose is told to use for the figure.
   */
  categoryFacts: {
    normal: "A normal month",
    latest: "In {month}",
    /**
     * A rate, and worded as one. The finding's own weight line says
     * "{amount} a month" for the same number, and a label that dropped the
     * "a month" would invite a read calling a monthly drift a total.
     */
    drift: "What the drift is worth in a month",
    oddMonth: "How far that month sat from a normal one",
    monthsActive: "Months with something recorded",
    shareOfMonth: "Share of everything that went out that month",
    cap: "The cap on this category",
    /**
     * The two the cap is useless without, worded as `facts.budgetLeft` and
     * `facts.budgetOver` are. "Left" is unclamped and goes negative when the
     * cap is breached; "gone over by" is the same breach as a positive
     * figure, which is the one a read actually wants to quote.
     */
    capLeft: "The cap, left that month",
    capOver: "The cap, gone over by",
  },

  /**
   * What the `MoneyOnHand` hero's headline figure is called, and the line
   * under it — the hero itself being drawn inside a Bearing panel on both
   * clients, which is the only place it renders.
   *
   * Three headline labels, and they are not evenly reachable. Both heroes
   * call `pulseHeadline` only when the balance is readable, so the only two
   * they can ever show are `headlineShort` and `headlineFree`. The Bearing's
   * own headline reaches for `headlineShort` directly — the same negative
   * `free`, said in the same words on both clients — and calls the other two
   * cases by the fact pack's names rather than by these.
   *
   * That leaves **`headlineLeft` rendering nowhere today**: `pulseHeadline`
   * returns it only when `onHand` is null, and nothing calls it in that
   * state. It stays because the function's contract needs it — a pulse with
   * no balance is an ordinary pulse, and its headline is the month's
   * arithmetic rather than money in an account, which is precisely the
   * distinction the other two labels must not be stretched over.
   *
   * The five explanation lines are the phone's alone: web's hero dropped
   * `pulseExplanation` in favour of the terms it spells out in figures, and
   * says `month.connectBankNote` / `month.finishedMonthNote` in the one case
   * where there is no figure to explain.
   */
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

  /**
   * `MoneyOnHand`'s own words, on both clients — the hero card the retired
   * Month screen used to lead with, now drawn inside a Bearing panel.
   */
  moneyOnHand: {
    /**
     * The other two terms in the same row. "In the account" is
     * `month.inTheAccount`, shared with this one rather than repeated here
     * — the phone used to carry its own lower-cased copy of that label,
     * which was the bug: two keys saying the same figure two different
     * ways, not the casing itself.
     */
    stillToLeave: "still to leave",
    stillToArrive: "still to arrive",
    pastMonthBanner: "Looking at {month} — a month that has ended",
    /** Trails a figure already stated by `month.overIn` / `month.leftIn`. */
    countingAhead: "counting what is still to come",
    /** The progress bar's own accessible name; the line under it is separate. */
    elapsedLabel: "{percent}% of the month elapsed",
    elapsedGone: "{percent}% of {month} gone",
    unreadableAccounts: {
      one: "Could not read {accounts} — its balance is not counted above.",
      other:
        "Could not read {accounts} — their balances are not counted above.",
    },
    fixLink: "Fix",
    spendingDownTitle:
      "Spending down {percent}% against the same days of {month}",
    spendingUpTitle: "Spending up {percent}% against the same days of {month}",
    /** The phone's today/month-end toggle, its accessible hint. */
    switchesTo: "Switches to {option}",
  },

  /**
   * `MonthScore`'s own words, on both clients: how the month is going
   * against the unrecorded-spending target.
   */
  monthScore: {
    heading: "Unrecorded spending, so far",
    overRecorded:
      "Your account holds more than the ledger allows — income is missing, or something is recorded twice. Nothing to measure until that is sorted.",
    /**
     * The line above the meter reads "<prefix> <amount>[ <suffix>]" with the
     * amount its own element so privacy mode can blur it — which is why this
     * is two fragments either side of a figure rather than one template.
     */
    capPrefixChosen: "of your",
    capSuffixChosen: "cap",
    capPrefixUnchosen: "against a usual",
    /** The meter bar's own accessible name. */
    meterLabel: "{spent} of {target}",
    noNormalYet:
      "Close two months and the app will know what normal looks like for you.",
    pastCap: "{amount} past it, with the month still running.",
    roomLeft: "{amount} of room left this month.",
    measuredNote:
      "Measured against your last close, not remembered — so it moves when the bank does, and it is not final until the month is closed.",
    notYetMeasured:
      "Close a month against your bank balance and this fills in: the app works out what left the account that no transaction explains.",
    findMissingEntry: "Find the missing transaction",
    /**
     * The footer link's third state, offered when there is nothing yet to
     * measure. Its own key rather than `common.setUp` (a title, "Set up",
     * used on the onboarding screen) because this is a CTA link and reads in
     * a different register — a link says "Set this up", a heading doesn't.
     */
    setUpCta: "Set this up",
  },

  /**
   * `CashAccountsCard`'s own words — the web-only, editable list of which
   * accounts count as cash. The phone draws the same list read-only inside a
   * Bearing panel, under `bearing.panel.cashAccounts*`; the heading and the
   * lapsed-consent line say the same thing there and share those keys, and
   * only the words unique to being editable live here.
   */
  cashAccounts: {
    tickHint: "Tick the ones you spend from.",
    lastRead: "Last read {when}",
    noneTicked: "Nothing is ticked, so months are still closed by hand.",
    autoCloses:
      "Months close on their own once the statement covers the day they are read on. A month whose ticked accounts cannot all be read waits instead of guessing.",
  },

  /** `RecentOnAccount`'s own words, on both clients. */
  recentOnAccount: {
    title: "Last on your account",
    toReview: "{count} to review",
    waitingCategory: "waiting for a category",
    leftOut: "left out",
    inYourLedger: "in your ledger",
  },

  /** `StillToCome`'s own words, on both clients. */
  stillToCome: {
    title: "Still to come",
    arrivingNamed: "still to arrive, {name} on {when}",
  },

  /** `MonthCloseHistory` / `MonthCloseHistoryCard`'s own words. */
  monthCloseHistory: {
    title: "Closed months",
    normalMonthCost:
      "A normal month costs you about {amount} the app never sees.",
    oneMoreForBaseline:
      "One more close and there will be a normal month to compare against.",
    /**
     * Both clients say which surface, with the same `nav.*` word, so the
     * two cannot drift the way this once did: `MonthCloseHistoryCard` used
     * to hardcode "Home" and the web named Month after Month was retired.
     *
     * "Home" was not a surface this app never had — an earlier note here
     * said so, and it was wrong. It was *this* surface's own name: web's
     * `/dashboard` was labelled "Home" until `e49abd7` renamed it Month, and
     * the phone's first tab was "Dashboard", then "Home" (`9c67bfe`), then
     * "Month" (`7dea42d`), before the screen was retired altogether. The
     * string was two renames stale rather than invented, which is precisely
     * why it survived: it had been correct, so nobody reading it heard
     * anything wrong. See `nav`'s comment above for the whole list of names
     * this app has used and dropped.
     *
     * `nav.plan` because that is `navigation.ts`'s own `labelKey` for
     * `/budgets`, which is where web's `MonthCloseCard` opens the close
     * sheet, and which the phone answers from `planning.tsx` — the route
     * `PHONE_PATHS["/budgets"]` and the Bearing spine both already point at
     * for the close. The word is therefore right on both, and the phone's
     * `MonthCloseSheet` is now mounted there too — it had lost its only
     * caller when the Month tab was deleted, which made this sentence an
     * instruction a phone reader could not follow.
     */
    closeFromSurface: "Close a month from {surface} and it will appear here.",
    allowanceHint:
      "What you are willing to spend without recording it. Coming in under it is what keeps a run alive.",
    useSuggested: "Use {amount}",
    needMoreForSuggestion:
      "Close one more month and the app can suggest a figure from your own spending.",
    readingDayHeading: "Reading day",
    readingDayHint:
      "Which day of the following month you read the balance on. Later is safer with a deferred-debit card, because the month’s card spending has to have landed. What matters most is that it is always the same day.",
    startingPoint: "Starting point",
    needsLook: "Needs a look — more in the account than the records allow",
    neverRecordedAmount: "{amount} never recorded",
    keptPercent: "{rate}% kept",
    saved: "Saved",
  },

  /**
   * The Plan card that walks the standing charges forward.
   *
   * Two tracks and the ingredients behind them. The card used to state one
   * number and one caveat, and its whole failure mode was that somebody
   * whose pay was not a charge had no way to see that from it — hence
   * `madeOf` and `noIncomeCharge`, which are the point of the group rather
   * than trimming round the edge of it.
   *
   * "Sur les comptes" / "Tout ce qui est gardé" are borrowed from
   * `bearingFacts` on purpose. The same arithmetic must not go by two names
   * on two surfaces.
   */
  projection: {
    heading: "If nothing changes",
    window: {
      one: "Next month",
      other: "Next {count} months",
    },

    inAccounts: "In the accounts",
    kept: "Everything kept",
    by: "by {month}",
    added: {
      one: "added over {count} month",
      other: "added over {count} months",
    },
    noOpeningBalance:
      "No account balance to start from, so these are what the months add rather than where they leave you.",

    perMonth: "{amount} a month on average",
    shrinking: "More leaves than arrives, month after month.",
    accountsFalling:
      "The accounts fall because {amount} a month goes into savings and wallets. That money is still yours — it is on the other line.",

    madeOf: "What this is made of",
    income: "Income",
    committed: "Committed costs",
    setAside: "Set aside",
    deployed: "Put to work inside a wallet",
    unrecorded: "Everyday spending",
    charges: {
      one: "{count} charge",
      other: "{count} charges",
    },
    noCharges: "nothing scheduled",
    setAsideNote: "Leaves the account, stays yours.",
    deployedNote: "Already inside a wallet, so neither line moves.",
    unrecordedMeasured: {
      one: "the median of {count} closed month",
      other: "the median of {count} closed months",
    },
    unrecordedNotYet: "Not counted yet — close two months and it will be.",
    noIncomeCharge:
      "No charge brings money in, so your pay is in none of this. Add it under Charges and every figure here changes.",
    noIncomeCta: "Add a charge",
    /** The web sparkline's own accessible name; the phone draws no equivalent. */
    sparklineLabel: {
      one: "Projected accounts and total kept over {count} month",
      other: "Projected accounts and total kept over {count} months",
    },
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
    currentHint:
      "Through today only — future expenses and wallet buys not counted yet.",
    monthEndHint:
      "Includes every occurrence due this month, wallet buys included.",
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
    /** Plural on how many are being asked about, which the words do not name. */
    askTitle: { one: "Did this arrive?", other: "Did these arrive?" },
    thatsIt: "That's it",
    notIt: "Not it",
    /** Fallback for a decision whose server action returned no message of its own. */
    done: "Done",
    /**
     * What a ledger row says about itself.
     *
     * Short enough to sit in a row's subtitle beside the note, and worded as
     * the state rather than the action: the row states it, some other surface
     * changes it.
     */
    state: {
      confirmed: "Confirmed",
      toConfirm: "To confirm",
    },
    /**
     * Why a charge was never offered for confirming.
     *
     * An absence needs a reason more than a presence does — a matcher that
     * silently declines looks broken, where one that says "nothing in its
     * category to match" is obviously working and obviously narrow. Lower case
     * because each of these follows a "label · amount · date ·" prefix.
     */
    misses: {
      hide: "Hide what was not offered",
      show: {
        one: "{count} other charge was not offered — why?",
        other: "{count} other charges were not offered — why?",
      },
      nothingAlike: "nothing in its category to match",
      refused: "you said the nearest movement was not it",
      notArrived: "the nearest movement has not happened yet",
      amountNear: "nearest was {amount}, too far from {expected}",
      amountNone: "no movement of the right size",
      dateNear: {
        one: "nearest was {count} day away, beyond the {window}-day window",
        other: "nearest was {count} days away, beyond the {window}-day window",
      },
      dateNone: "no movement near enough in time",
    },
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

    /**
     * The `MonthRead` card itself: heading, empty state, and the write
     * button's own states. "On this page" and "on this screen" are two keys
     * rather than one because they are the one word each client's own
     * component already said differently before this sweep.
     */
    title: "The read",
    /**
     * "A model" named nothing. Somebody deciding how much weight to give a
     * paragraph needs to know what wrote it, and the app knows.
     */
    subtitleWeb:
      "Written by {model}, from the figures on this page. It cannot see your accounts.",
    subtitleMobile:
      "Written by {model}, from the figures on this screen. It cannot see your accounts.",
    empty: "Nothing has been written about {month} yet.",
    suggestionsHeading: "What to change",
    writing: "Writing…",
    noReadsLeft: "No reads left for {month}",
    noReadsLeftGeneric: "No reads left this month",
    writeAgain: "Write it again with {model} ({left} left)",
    writeOne: "Write with {model} ({left} left)",
    writtenToast: "Written for {month}",
    /** The phone's write button, read by a screen reader without the count. */
    writeAgainLabel: "Write the read again with {model}",
    writeLabel: "Write the read with {model}",
    /** Who wrote the stored read, from the model recorded on it. */
    writtenBy: "Written by {model}.",
    writtenByUnknown: "Written by a model this app no longer records.",
    /**
     * How well the read still stands, with the count as the sentence's
     * subject: "{count} figures this rests on have moved…".
     *
     * What ages is the judgement and never the figures — those are rendered
     * against what they are now, which is what `standingProvisional` says
     * for a read that has nothing to flag yet.
     */
    standingMoved: {
      one: "One figure this rests on has moved since it was written, {age}.",
      other:
        "{count} figures this rests on have moved since it was written, {age}.",
    },
    standingProvisional: "Written {age}, from the figures as they stood then.",
    standingWritten: "Written {age}.",
  },

  /**
   * The read of one category, which borrows most of its words.
   *
   * `monthRead.refusal.wrongShape`, `.unknownDatum` and `.everythingDropped`
   * say nothing about a month, so a category read uses those rather than
   * repeating them here. Only the one refusal a month read cannot produce is
   * its own: over there a figure inside an observation costs that
   * observation, because three others survive it; here there are at most two,
   * so it costs the read.
   */
  categoryRead: {
    refusal: {
      claimHadFigure: "It wrote a figure of its own",
    },

    /** No writer configured on this deployment; the panel's write button is absent. */
    noWriter: "No writer is configured.",
    /**
     * The category named no longer belongs to the caller — deleted, most
     * likely, in the moments between the panel opening and the button being
     * pressed. Rare enough that it earns one honest sentence rather than
     * being folded into `noWriter`, which would say something untrue.
     */
    gone: "This category is no longer available.",

    /**
     * Shown when a stored read is in a language the reader has since
     * switched away from. Mirrors `monthRead.writtenInOtherLanguage`.
     */
    writtenInOtherLanguage: "Written in {language}.",

    /**
     * The panel card itself: heading, empty state, and the write button's
     * own states — the by-category screen's equivalents of `monthRead`'s.
     * Kept as separate keys rather than reused, because the surface they
     * sit on is a panel under a chart, not a page of its own.
     */
    title: "The read",
    subtitle:
      "Written by {model}, from the figures on this panel. It cannot see your accounts.",
    empty: "Nothing has been written about this category yet.",
    writing: "Writing…",
    noReadsLeft: "No reads left this month",
    writeAgain: "Write it again with {model} ({left} left)",
    writeOne: "Write with {model} ({left} left)",
    writtenToast: "Written for {category}",
    /** Who wrote the stored read, from the model recorded on it. */
    writtenBy: "Written by {model}.",
    writtenByUnknown: "Written by a model this app no longer records.",
  },

  /**
   * The look-through: what the wallets are made of, and the read over it.
   *
   * Two registers here. The labels describe arithmetic the app did and are
   * plain to the point of dullness, because they sit beside figures that are
   * the actual content. The caveats are the opposite — they are the whole
   * reason this surface can be trusted, so they are written out in full
   * rather than abbreviated into a tooltip nobody opens.
   */
  lookThrough: {
    title: "Look-through",
    subtitle: "What your wallets are actually made of",

    /* The sections, in the order they appear. */
    geography: "Where the money is",
    sectors: "What it is in",
    charges: "What it costs",
    doublingUp: "Where you are doubling up",
    wrappers: "Where things sit",
    target: "A target to aim at",

    /**
     * The pooled row at the foot of a weighting, and what pressing it does.
     *
     * It was `${count} more`, written into both call sites in English, so a
     * French reader got "6 more" under a list of countries named in French.
     */
    restCountries: {
      one: "1 more country",
      other: "{count} more countries",
    },
    restSectors: {
      one: "1 more sector",
      other: "{count} more sectors",
    },
    showRest: "Show them",
    hideRest: "Hide them",

    /** The charge, promoted to sit under the total it is charged on. */
    costPerYear: "{amount} a year in charges",
    costAllIn: "({rate} all in)",

    /**
     * The eleven sectors, named.
     *
     * These lived in `SECTOR_LABELS` in core as a plain English record, which
     * meant a French reader got "Consumer discretionary" under a heading
     * reading "Ce qu'il y a dedans". The ids stay in core, because they are a
     * closed vocabulary a reading is verified against; the words belong here,
     * with the rest of the app's voice.
     */
    sectorLabels: {
      energy: "Energy",
      materials: "Materials",
      industrials: "Industrials",
      "consumer-discretionary": "Consumer discretionary",
      "consumer-staples": "Consumer staples",
      "health-care": "Health care",
      financials: "Financials",
      "information-technology": "Information technology",
      "communication-services": "Communication services",
      utilities: "Utilities",
      "real-estate": "Real estate",
    },

    /* Geography. */
    countryShare: "{country}",
    franceShare: "France",
    europeShare: "Europe",
    usShare: "United States",
    marketWeight: "Market weighs it {weight}",
    timesMarket: "{factor}× the market's weight",
    inLineWithMarket: "In line with the market",

    /* Charges. */
    fundCharges: "The funds' own charges",
    envelopeFeeHint:
      "On your contract's annual statement, as a percentage — typically 0.5 to 0.8. It is charged on top of each fund's own ongoing charge.",
    envelopeFee: "The envelope's fee",
    chargesNote:
      "These are the funds' and the envelope's charges. Your broker's commission and transaction costs are not tracked.",
    allIn: "All in",
    perYear: "{amount} a year",
    overYears: "{amount} over {years} years",
    noChargeRecorded: "No charge recorded",

    /* Doubling up. */
    sameIndex: "Both track {index}",
    nestedIndex: "{outer} contains {inner}",
    sharedCompanies: "Shares {count} of its largest holdings with {other}",
    overlapAtLeast: "At least {share} the same companies",

    /* Wrappers. */
    cannotSitHere: "{name} cannot be held in a {wallet}",
    couldSitIn: "It could go in a {wallets}",

    /* The target. */
    targetWeight: "{weight}",
    currentWeight: "now {weight}",
    buy: "Buy {amount}",
    sell: "Sell {amount}",
    noMoveNeeded: "Already where it should be",
    rebalanceNote:
      "These are moves between holdings, not new money. Redirecting a monthly transfer gets to the same place without selling, which inside a PEA is usually the better answer.",

    /* What the app could not see. */
    readCoverage: "{share} of your value has been read",
    notRead: "Not yet read",
    notReadBody:
      "{count} holdings have not been read, so what they contain is unknown rather than empty. The shares above are worked out over the rest.",
    readOne: "Read this one",
    readingOne: "Reading…",
    readAll: "Read the rest",
    lastRead: "Read {when}",

    /**
     * Why a walk down the queue stopped before the queue was empty.
     *
     * Its own words rather than `walletRead`'s. That namespace is about the
     * writer — the model that turns these figures into prose — and borrowing
     * "the writer did not answer" for a reading that was merely refused *yet*
     * is how a two-second cooldown came to look like a broken feature.
     */
    halt: {
      cooling: "Still finishing the last one — try again in a moment.",
      allowance: "This month's reading allowance is used up.",
      notYours: "That instrument is no longer one of your holdings.",
      noReader: "No reader is configured.",
      /**
       * The five that replaced one catch-all.
       *
       * Every one of these used to read "That instrument could not be read
       * just now", which told a reader nothing and, worse, blamed the
       * instrument for three problems that were the reader's.
       */
      notSetUp: "Instrument readings are not set up yet (migration 032).",
      noSearch:
        "{model} cannot search the web on this plan, so nothing can be looked up.",
      providerDown: "{model} did not answer just now.",
      nothingFound: "Nothing published could be found for {name}.",
      wrongInstrument: "What came back for {name} was about something else.",
      signedOut: "You have been signed out.",
    },

    /** How a walk down the queue ended, once it has been all the way down. */
    readRest: {
      allRead: {
        one: "One instrument read.",
        other: "{count} instruments read.",
      },
      someSkipped: {
        one: "{read} read. One could not be read and was left as it is.",
        other:
          "{read} read. {count} could not be read and were left as they are.",
      },
      noneRead: {
        one: "One instrument could not be read.",
        other: "None of the {count} instruments could be read.",
      },
    },

    /* The caveats, said plainly. */
    caveats: {
      /**
       * The card's own title, and the four group headings under it.
       *
       * One stable title, because the groups each carry their own heading
       * now. It used to be the title that changed — "Not identified yet" when
       * anything lacked an ISIN, "Not read yet" otherwise — which meant a
       * card holding a coin, a gold ETC and nothing unread at all announced
       * itself as being about instruments waiting to be read.
       */
      notCovered: "What these shares do not cover",
      unresolvableHeading: "Nothing to look through to",
      /** The four reasons a holding is not covered, each with its own fix. */
      noIsin: "Not identified yet",
      noIsinBody:
        "{count} of your holdings have no ISIN, so there is nothing to look up. Open each one on Positions and choose its instrument from the search — that is what records the ISIN.",
      goToPositions: "Open Positions",
      neverRead: "Not read yet",
      neverReadBody:
        "{count} instruments have an ISIN but have not been read. Reading one looks up what it holds — its charge, its countries, its sectors.",
      readNothingUseful: "Read, but incomplete",
      readNothingUsefulBody:
        "{count} readings found a charge but no countries and no sectors, and the factsheet did not say why. Reading again may find more.",
      needsAReading:
        "Read at least one instrument first — there is nothing to review yet.",
      /**
       * Deliberately no longer "have not been read". Two of the four groups
       * below have been read, or never can be, and a lead sentence that
       * called all of them unread was contradicted by the headings under it.
       */
      unclassified:
        "{share} of your invested value is not covered by the shares on this page. Every share here is worked out over the part that is.",
      overlapIsAFloor:
        "Overlap is a floor, not a measurement. Only each fund's published largest holdings were compared, so two funds shown as sharing a little may in truth be largely the same companies — the index they track is the more reliable signal.",
      staleReadings:
        "{count} readings are more than six months old. They are still used, because last year's composition is a better answer than none.",
      noMarketValue:
        "Nothing is held yet, so there is nothing to look through.",
      partialAxis:
        "These figures cover {coverage} of what was read — a factsheet does not always publish the full breakdown. The shares are what was published, not a share of what was found, so they do not add up to everything.",
      /**
       * Held, and there is nothing to look it up in — ever.
       *
       * Deliberately not a call to action, which is the whole point of the
       * group. The block above it tells the reader to open Positions and
       * record an instrument, and the one above that offers to read it again;
       * for a coin the first sends them hunting for an identifier that was
       * never issued, and for gold the second promises a breakdown that does
       * not exist. Both complaints produced this sentence.
       */
      unresolvable: {
        one: "Gold and crypto have no countries and no sectors — not unpublished ones, none. It is held, and counted in the total above, but the shares on this page cannot describe it.",
        other:
          "Gold and crypto have no countries and no sectors — not unpublished ones, none. These are held, and counted in the total above, but the shares on this page cannot describe them.",
      },
      geographyIsNotCurrency:
        "Geography here means where the companies are, not what currency you are paid in. A fund can hold American companies and be priced in euro.",
    },
  },

  /**
   * The wallet read: what a model made of the look-through.
   *
   * The refusals reach a reader, unlike the ones on a month read, because
   * this button is on a page that is perfectly usable without it — so
   * "nothing happened and here is why" is an ordinary outcome rather than an
   * apology for an empty screen.
   */
  walletRead: {
    /**
     * The button that spends a call, and what it says while spending.
     *
     * It said "Review". Which is a verb with no subject: a reader pressing it
     * was told neither that a model would answer nor which one, and the
     * small print underneath called it "a model" as though naming it were
     * indiscreet. The maker's name goes on the control; the exact model goes
     * in the footing under the read it wrote.
     */
    review: "Review with {model}",
    reviewing: "Reading…",
    reviewHint:
      "Reads the figures on this page and says what it makes of them. {remaining} left this month.",
    /**
     * Who wrote this one — the model recorded on the read itself, not the
     * one configured today. A read written six weeks ago was written by
     * whatever answered then, and saying otherwise would be a small lie told
     * by the very sentence that exists to be exact.
     */
    writtenBy: "Written by {model}.",
    writtenByUnknown: "Written by a model this app no longer records.",
    /** The stored read. */
    readAt: "Read {when}",
    stale: "Your positions have moved since this was written",
    writtenInOtherLanguage: "Written in {language}.",
    empty: "Nothing has been read yet.",
    emptyBody:
      "The figures above stand on their own. A read adds what someone might make of them.",

    /* Why a press came back with nothing. */
    allowanceSpent: "You have used all {allowance} reads this month.",
    coolingDown: "One was just written — try again in {seconds}s.",
    inFlight: "A read is already being written.",
    nothingToSay:
      "Not enough has been read yet to say anything about the whole portfolio.",
    unchanged: "Nothing has moved since the last read.",
    untracked: "Wallet reads are not set up yet (migration 033).",
    noWriter: "No writer is configured.",
    noAnswer: "The writer did not answer just now.",
    unusable: "The writer's answer could not be used.",
    threwAway: "The writer's answer was thrown away. ({detail})",

    /** Why an answer was thrown away. Short and plain; these are shown. */
    refusal: {
      wrongShape: "Not the shape asked for",
      unknownDatum: 'It referred to "{id}", which was never sent',
      unknownInstrument:
        'It proposed "{isin}", which is not an instrument this app knows',
      headlineHadFigure: "The headline contained a figure of its own",
      headlineTooLong: "The headline was longer than one line",
      everythingDropped: "Every observation had to be dropped",
    },

    footing: {
      notAdvice:
        "This is information about your own holdings, not investment advice. Every figure is the app's own arithmetic.",
      partiallyRead:
        "Some holdings have not been read, so this is a verdict on the part of your portfolio the app can see.",
    },
  },

  /**
   * The Bearing: the whole position, on one screen.
   *
   * Deliberately sparse. This is the app's most figure-dense screen and every
   * sentence added to it is a sentence competing with the numbers it exists
   * to frame — so the words here are a title, five card names and the one
   * line for a reader who has nothing recorded yet, and nothing else.
   *
   * It used to be twice this size. A model arranged the figures, the reader
   * could overrule it by dragging, and that machinery needed a button, a
   * hint, an allowance counter, a drag-handle label, a staleness clause and
   * a whole family of refusals for when the model answered badly. Five fixed
   * cards need none of it: nothing is ranked, so nothing has to explain its
   * ranking or apologise for failing to produce one.
   */
  bearing: {
    title: "Bearing",
    /**
     * The two figures at the top of the screen, and the fallback for the
     * second of them.
     *
     * Deliberately lower-case fragments that lead into the number rather than
     * naming it: the figure completes the phrase. That is also what retired
     * the old negative-case swap. The headline used to switch to
     * `pulse.headlineShort` ("Short by") when `free` went under, because
     * "Yours to spend this month −412,00 €" read as an offer at the largest
     * type in the app. "You'll finish the month at −412,00 €" does not, so
     * one wording now serves both signs and the red carries the rest.
     *
     * Not `bearingFacts.onHand` / `bearingFacts.free`: those are the pack's
     * labels and still name the same two figures on the cards below, where a
     * noun phrase in a list is right and a sentence fragment would not be.
     */
    headline: {
      onHand: "currently in your current account",
      free: "you'll finish the month at",
      /**
       * When no balance is readable to lead it — the ladder's fallback to
       * what the ledger recorded rather than a confident zero. See
       * `resolveSpine` in `packages/core/src/spine.ts`.
       */
      remaining: "recorded as left",
    },
    /** The five cards' names, in `CARD_ORDER`. */
    cards: {
      month: "This month",
      now: "The accounts",
      run: "Your run",
      ahead: "The year ahead",
      wallet: "Wallets",
    },
    empty:
      "Once a month has been recorded there will be something to stand on.",
    panel: {
      close: "Close",
      open: "Show what this is made of",
      footer: "See the full surface",
      horizon: "How far ahead",
      /** The month stepper above a month panel, for a screen reader. */
      monthScope: "Which month this panel shows",
      /** The run, in the streak chrome. */
      streakMonths: {
        one: "{count} month inside the allowance",
        other: "{count} months inside the allowance",
      },
      streakNone:
        "No run yet — close a month inside the allowance to start one.",
      bestRun: "Best so far: {count}",
      /** Block headings. The blocks themselves state figures, not what they are. */
      comparisonHeading: "Against last month",
      trendHeading: "Month by month",
      /**
       * Below `MIN_MONTHS_FOR_TREND` months with any activity, drawn as a
       * list instead of bars — see `Trend` in `panel-blocks.tsx` for why.
       */
      trendThin: "Not enough months yet to call it a trend — {count} so far.",
      holdingsHeading: "Biggest holdings",
      moreHoldings: "{count} more",
      /** When the detail could not be fetched. The figure above is still true. */
      failed: "The detail could not be read just now.",
      retry: "Try again",
      /**
       * The phone's `cash-accounts` block. Shared with the web's
       * `CashAccountsCard`, which said the same two lines in its own
       * pre-existing English until this key replaced them; its body goes on
       * to explain the tick box the phone's read-only list does not have,
       * which is why the body's continuation and the "last read" line live
       * under `cashAccounts.*` instead of here.
       */
      cashAccountsHeading: "Which accounts hold your cash",
      cashAccountsBody:
        "Closing a month compares what these held at the start and the end against what the ledger says happened.",
      cashAccountsLapsed: "Consent has lapsed — nothing can be read from it",
      cashAccountsLastRead: "Read {when}",
    },
    /**
     * What the ring reads out — see `resolveSpine`'s doc comment in
     * `packages/core/src/spine.ts` for the ladder behind it.
     *
     * The spine was one figure, one ring and one flame fixed above the bento,
     * and it had a `regionLabel` ("Where you stand") naming that band. The
     * band is gone: the figure is the page's own headline, the ring lives
     * inside the "Your run" card, whose name already names it, and the flame
     * is not drawn there because `streak` and `best-streak` are figures the
     * same card lists as rows. So only the ring's own wording is left here.
     * The flame badge was the one thing on this surface that borrowed
     * `month.streakInARow` and `month.bestStreak`; both keys stay where they
     * are and are still said by `MonthScore` and `MonthCloseHistory` on both
     * clients, but nothing under `bearing.spine` reaches for them any more.
     */
    spine: {
      /** The ring's `dark` state: something could be measured, nothing has. */
      ringUnmeasured: "Not measured yet — no month has closed",
      /** The ring's `arc` state: measuring has started, there is no cap. */
      ringMeasuring: "Measuring your first month — no allowance set yet",
      /**
       * The ring's `proportion` state, said as two clauses joined by " · ".
       *
       * They were one sentence and could contradict itself. The percentage
       * comes off `capRatio` — unrecorded spending against the cap — while
       * the tone comes off `standing`, which compares what is left to spend
       * against that same cap. Those are near-orthogonal, so the single
       * sentence "100% of your allowance used, comfortably clear" was a
       * routine output: a screen-reader user heard a verdict no sighted
       * reader was shown, welded onto a figure it was not about.
       *
       * Now each clause states its own basis and neither qualifies the
       * other. `ringUsed*` is the ring's fill and the overshoot lap; the
       * `ringStanding*` line is the colour. Same two signals, same two spec
       * rows, said separately because they measure separately.
       */
      ringUsed: "{percent}% of your allowance used",
      /** The overshoot lap, in words. `{percent}` is the true ratio, not the fill's. */
      ringUsedOver: "{percent}% of your allowance used, already past it",
      ringStandingClear: "what is left to spend still covers a full allowance",
      ringStandingTight: "less than a full allowance left to spend",
      ringStandingShort: "the month is set to end short",
      /** The rest of the attention list, folded behind the one row shown. */
      moreWaiting: {
        one: "+{count} more waiting",
        other: "+{count} more waiting",
      },
    },
  },

  /**
   * Validation and refusal messages.
   *
   * Zod schemas are built when their module loads, long before any request
   * has a locale, so they carry these keys rather than these sentences and
   * the client resolves them at the point it shows a toast.
   */
  /**
   * When a page cannot be drawn at all.
   *
   * Two screens with nothing else in common beyond being the last thing a
   * reader sees before they give up, which is exactly why they are worth
   * translating: the app is at its least trustworthy here, and a paragraph
   * that switches to English while apologising is one more thing gone wrong.
   */
  errorPage: {
    title: "Something went wrong",
    body: "We couldn’t load this page. Your data is safe — try again, and if the problem persists, sign out and back in.",
    tryAgain: "Try again",
    notFoundTitle: "Page not found",
    notFoundBody: "The page you’re looking for doesn’t exist or has moved.",
    goHome: "Go home",
  },

  /**
   * The refresh, in both its shapes.
   *
   * The icon in the header has no visible words at all — these are its
   * accessible name and its tooltip — and the wide one in the sidebar says
   * how old the figures are beside them.
   */
  refresh: {
    reloadEverything: "Reload everything",
    askingBank: "Asking your bank…",
    lastChecked: "Refresh — last checked {age}",
    askBank: "Ask your bank for anything new",
    refreshing: "Refreshing…",
    refresh: "Refresh",
  },

  /** Sending again what is still only on this device. */
  outbox: {
    retry: "Retry",
  },

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
    notAnIsin: "That does not look like an ISIN, e.g. IE00B4L5Y983",
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
