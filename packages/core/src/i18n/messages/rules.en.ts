/**
 * « Règles de rangement »: the rules a person writes for filing a line
 * (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 3). `en.ts` mounts it as
 * `rules`.
 */
export const rulesEn = {
  title: "Filing rules",
  intro:
    "A line that contains these words is filed here, every time — before anything the app learned on its own.",
  empty: "No rule yet",
  emptyBody:
    "Write one from the review with “Always file here”, or here, with the words to find and the category they go to.",
  words: "Words to find",
  wordsPlaceholder: "e.g. NAVIGO",
  wordsTooShort: "Two characters at least",
  wordsTooLong: "Eighty characters at most",
  category: "Category",
  direction: "Money",
  directionOut: "Going out",
  directionIn: "Coming in",
  add: "Add the rule",
  adding: "Adding…",
  added: "Rule added",
  delete: "Delete",
  deleteNamed: "Delete the rule “{words}”",
  deleted: "Rule deleted",
  edit: "Edit",
  editNamed: "Edit the rule “{words}”",
  save: "Save",
  saving: "Saving…",
  saved: "Rule saved",
  alreadyExists: "A rule with these words already exists",
  applied: { one: "{count} line filed", other: "{count} lines filed" },
  appliedNone: "No line filed yet",
  from: "From “{line}”",
  always: "Always file here",
  alwaysHint: "Writes a rule with these words: “{words}”",
  ruleWritten: "Rule written: “{words}” → {category}",
  link: "Filing rules",
  linkHint: "The words you decided, and where they go",
};
