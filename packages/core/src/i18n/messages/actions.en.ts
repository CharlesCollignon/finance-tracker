/**
 * What an action says when it is done or has failed — the server actions on
 * the web and the phone's mutations, which used to hand English sentences
 * straight to a toast. They return these keys instead, and both toast
 * providers resolve a key to the reader's language (see `resolveMessage`).
 *
 * Its own file so the group can grow without touching the main catalogue;
 * `en.ts` mounts it as `actions`.
 */
export const actionsEn = {
  /* Input that did not survive validation, beyond `errors.invalidInput`. */
  invalidDateRange: "Invalid date range",
  invalidStartingBalance: "Enter a valid starting balance",
  shareCountPositive: "Share count must be a positive number",
  unsupportedLanguage: "Unsupported language",

  /* Something the action needed is gone. */
  transactionNotFound: "That entry no longer exists",
  recurringNotFound: "That recurring entry no longer exists",
  categoryMissing: "That category no longer exists.",
  oneCategoryMissing: "One of the categories no longer exists.",
  categoryInUse:
    "This category is used by entries or recurring entries. Archive it instead.",
  categoryExists: "A category with this name and type already exists.",

  /* The fallbacks when a failure carries no message of its own. */
  couldNotPrice: "Could not price this instrument.",
  couldNotSaveRecurring: "Could not save the recurring entry",
  couldNotFillMonth: "Could not fill this month.",
  couldNotRecord: "Could not record it",
  couldNotSavePosition: "Could not save this position.",
  couldNotRemovePosition: "Could not remove this position.",
  couldNotSearch: "Could not search instruments. Try again.",
  couldNotFetchPrice: "Could not fetch the latest price. Try again.",
  couldNotEstimate: "Could not estimate the amount from the current price.",
  couldNotReachBank: "Could not reach the bank.",
  couldNotAddEntry: "Could not add that entry",
  deleteFailed: "Could not delete",

  /* Account and settings. */
  profileUpdated: "Profile updated",
  allDataDeleted:
    "All finance data deleted. Default categories will be restored on your next visit.",

  /* Recurring entries and their occurrences. */
  skipRemoved: "Back in the month",

  /* Month close. */
  closeTooEarly:
    "This month can be closed from {date}, once the last of its spending has landed.",
  closeRemoved: "Close removed",
  capSet: "Cap set",
  readingDayUpdated: "Reading day updated",

  /* Matching bank movements to recurring entries. */
  fulfilmentSetup:
    "Confirming recurring entries needs migration 023 — run it and this will work.",
  recurringGone: "That recurring entry is no longer here",
  movementTaken:
    "That movement is already accounted for by another recurring entry",
  counted: "Counted — it is no longer forecast",
  pairingDismissed: "Won't suggest that pairing again",
  backInForecast: "Back in the forecast",
  countedForMonth: "Counted for {month}",
  movedBack: "Moved back to {date}",
  cashDateSetup:
    "Counting an income for next month needs migration 045 — run it and this will work.",

  /* The bank inbox. */
  entryNoLongerWaiting: "That entry is no longer waiting",
  entryAlreadyDealtWith: "That entry has already been dealt with",
  alreadyInLedger: "Already in your ledger — filed against the entry you had",
  leftOut: "Left out",
  entryNotInLedger: "That entry is not in your ledger",
  moved: "Moved",
  entryNoLongerHere: "That entry is no longer here",
  entryAlreadyWaiting: "That entry is already waiting",
  backInInbox: "Back in the inbox",
  entriesBackInInbox: {
    one: "{count} entry is back in the inbox",
    other: "{count} entries are back in the inbox",
  },
  suggestionGone: "That one is no longer being suggested",
  suggestionDismissed: "Won't suggest that again",
  proposalAdded: "{name} added",

  /* What a press of Refresh brought, joined with commas. */
  nothingNew: "Nothing new",
  syncAdded: { one: "{count} added", other: "{count} added" },
  syncAlreadySeen: {
    one: "{count} already seen",
    other: "{count} already seen",
  },
  syncAlreadyRecorded: {
    one: "{count} already recorded",
    other: "{count} already recorded",
  },
  syncToReview: { one: "{count} to review", other: "{count} to review" },
  syncMonthsClosed: {
    one: "{count} month closed",
    other: "{count} months closed",
  },
  syncNeedReconnect: {
    one: "{count} account needs reconnecting",
    other: "{count} accounts need reconnecting",
  },
};
