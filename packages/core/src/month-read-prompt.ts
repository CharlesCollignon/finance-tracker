/**
 * What the writer is asked.
 *
 * Two jobs, and the second is the awkward one. The first is describing a
 * month's figures. The second is keeping a language model inside a vocabulary
 * this app has spent a lot of effort fixing: a read that calls a month close
 * a "reconciliation", or unrecorded spending a "leak", contradicts every
 * label printed around it, and the reader has no way to tell which of the two
 * is wrong.
 *
 * The figure rule is stated first and repeated as the last line. That is not
 * belt-and-braces for its own sake — instruction adherence decays across a
 * long system message, and this is the one rule whose failure is expensive.
 *
 * The naming rule sits beside it, in both positions, and for a measured
 * reason: stated once in the middle it was ignored by every model tried, and
 * the figure rule beside it was obeyed by all of them. Position is doing more
 * work here than wording.
 *
 * The version constant is stored on each read, so a read written under an
 * older prompt is identifiable. It deliberately does not invalidate anything:
 * re-writing every stored read because the prompt was tweaked would spend a
 * user's whole allowance on a change they did not ask for.
 */

import { formatFact, type MonthFacts } from "./month-facts";
import type { MonthReadRequest } from "./month-read";

export const MONTH_READ_PROMPT_VERSION = 2;

const FIGURE_RULE =
  "Every figure you mention must be written as {{fact:id}}, using an id from " +
  "the list you are given. Never write a number yourself — not a digit, not " +
  "a spelled-out amount, not a sum, a difference, a percentage or a target " +
  "of your own. If something you want to say needs a figure that is not in " +
  "the list, say it without the figure or do not say it.";

/**
 * The mistake the figure rule invites.
 *
 * Told to write every figure as a placeholder, a model starts using the
 * placeholder *as the name of the thing* — "cut {{fact:top-expense:c4}} by
 * {{fact:budget-left:b2}}", which renders as "cut 340,00 € by 60,00 €" and
 * tells the reader nothing about which category to cut. Observed, not
 * imagined: it is what the first live answers did.
 *
 * The example uses a real id, and deliberately. An earlier version showed the
 * shape with a made-up one, the next answer cited it verbatim, and the
 * verifier refused the read — an instruction that demonstrates an id has to
 * demonstrate one that exists.
 *
 * The second half is about a failure the figure rule does not cover, because
 * it is not a made-up number. A model that wants the overshoot and has only
 * the allowance will point at the allowance and call it the overshoot: every
 * figure real, the sentence false. `month-facts.ts` answers this properly by
 * supplying the derived figures, and this sentence is the belt to that
 * braces — the pack cannot anticipate every relationship a model might want.
 */
const NAMING_RULE =
  "A placeholder is a number, not a name. Name the category, the cap or the " +
  'month in words, and put the figure beside it: "you spent ' +
  '{{fact:expenses}}", never "the {{fact:expenses}} was high". Each figure\'s ' +
  "label is in the list; use those words for the name. And use each figure " +
  'for what its label says it is: "exceeded the allowance by ' +
  '{{fact:unrecorded-allowance}}" points at the allowance and calls it the ' +
  "amount it was exceeded by, which is a different thing.";

/**
 * What `basis` is for, which the shape alone does not say.
 *
 * The declaration is what makes a claim checkable later — it is how the app
 * knows which figures a sentence rests on, and so whether it still stands
 * when one of them moves. A model given no explanation of the field fills it
 * with the placeholder form it was just taught; the app forgives that, and
 * this is the sentence that stops it happening in the first place.
 */
const BASIS_RULE =
  "Each observation and suggestion carries a basis: the ids it rests on, " +
  'written bare — "expenses", not "{{fact:expenses}}". Every id you use in ' +
  "the text must be listed there, and list nothing you did not use.";

/**
 * The words this app uses, and the ones it refuses.
 *
 * Lifted from CONTEXT.md rather than paraphrased. Each pairing is there
 * because the wrong word is actively misleading, not merely off-brand:
 * "forecast" implies a prediction where the app means a projection of things
 * already scheduled, and "budget" for the allowance collides with the
 * per-category caps, which are a different feature.
 */
const VOCABULARY = [
  '"Unrecorded spending" — what a balance proves left the account that no ' +
    "entry explains. It is measured, not estimated, and never negative. " +
    'Never call it a "leak", "untracked" or "missing".',
  '"Kept" — the cash a month left in the account plus everything ' +
    'deliberately set aside. Never call it "saved", "surplus" or "profit".',
  '"Unrecorded allowance" — a cap on unrecorded spending, set from this ' +
    'person\'s own history. Never call it a "budget", "target" or "limit".',
  '"Month close" — recording what the account held and what follows from ' +
    'it. Never call it a "reconciliation" or "month end".',
  'A projection of charges already scheduled is not a "forecast".',
];

function factLines(
  facts: MonthFacts,
  formatMoney: (amount: number) => string,
): string {
  return facts.facts
    .map((fact) => {
      const rise =
        fact.sense === "up-is-good"
          ? "rising is good"
          : fact.sense === "up-is-bad"
            ? "rising is bad"
            : "neither good nor bad";
      const note = fact.note ? ` | ${fact.note}` : "";
      return `  ${fact.id} | ${fact.label} | ${formatFact(fact, formatMoney)} | ${rise}${note}`;
    })
    .join("\n");
}

const MISSING_WORDS: Record<string, string> = {
  "no-bank": "no bank is connected, so this cannot be known",
  "no-close": "no month has been closed yet, so this cannot be measured",
  "no-cap": "no allowance has been set",
  "month-unfinished": "the month is not over yet",
  "not-recorded": "nothing was recorded for it",
};

function missingLines(facts: MonthFacts): string {
  return facts.missing
    .map((row) => `  ${row.id} | ${row.label} | ${MISSING_WORDS[row.why]}`)
    .join("\n");
}

export interface BuildPromptOptions {
  /**
   * How money is written in the prompt. The server default is euro, and it is
   * safe for this to differ from the reader's chosen currency precisely
   * because nothing the model formats ever reaches a screen.
   */
  money: (amount: number) => string;
}

export function buildMonthReadPrompt(
  facts: MonthFacts,
  { money }: BuildPromptOptions,
): MonthReadRequest {
  const provisional = facts.state === "in-progress";

  const system = [
    "You write a short read of one person's month with their own money, for",
    "them to read. Second person, no greeting, no sign-off, no emoji.",
    "",
    FIGURE_RULE,
    NAMING_RULE,
    "",
    BASIS_RULE,
    "",
    "Use these words exactly, and avoid the ones marked:",
    ...VOCABULARY.map((line) => `- ${line}`),
    "",
    "Say what to change. Name a cut, a cap, a habit or something to check.",
    "Every suggestion must point at a category, a cap or one of the figures",
    "you were given — advice that would fit anyone's month is not worth the",
    "space. Do not congratulate; a suggestion is advice, not encouragement.",
    "",
    "What you cannot know, and must not pretend to:",
    "- You see only the totals given. You cannot see individual payments,",
    "  merchants, or which shop anything came from.",
    "- You know nothing about this person's job security, dependents, debts,",
    "  risk tolerance or plans.",
    "- Give no product, tax or investment advice, and never suggest moving",
    "  money between real accounts.",
    "",
    "Each figure says whether rising is good or bad. Do not treat a rise in a",
    'figure marked "rising is bad" as good news.',
    "",
    provisional
      ? 'This month is still running. Say "so far" where it matters, and never speak of it as finished or of its unrecorded spending as settled.'
      : "This month is over, so its figures are settled.",
    "",
    facts.coverage === "partial"
      ? "The picture is incomplete — some entries are not yet categorised, or nothing has been closed. Say so rather than writing as though the categories were complete."
      : "",
    "",
    // Stated in sentences rather than characters. The app caps a claim at a
    // length a card can hold, and a model asked for "240 characters" cannot
    // count them; asked for two sentences, it lands inside the cap.
    "At most four observations and three suggestions. Two sentences each, and",
    "no more. The headline is one short clause.",
    "",
    FIGURE_RULE,
    NAMING_RULE,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const user = [
    `Month: ${facts.monthLabel} (${provisional ? "still running" : "over"})`,
    "",
    "Figures you may refer to — id | what it is | value | when it rises",
    factLines(facts, money),
    facts.missing.length > 0 ? "" : null,
    facts.missing.length > 0 ? "Not known, and why" : null,
    facts.missing.length > 0 ? missingLines(facts) : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { system, user };
}
