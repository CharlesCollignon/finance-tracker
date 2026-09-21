import { estimateMonthlyAmount } from "./recurrence";
import type { RecurringTemplateWithCategory } from "./types/database";

/**
 * What the standing instructions add up to in a month, split by what kind of
 * money each one is.
 *
 * This is one module because both clients need the same answer and
 * `estimateMonthlyAmount` cannot give it: that function knows a template's
 * rhythm and its amount and nothing about its category, so every caller that
 * wanted a total did its own filtering. Both clients did, both filtered on
 * `counts_toward_summary` alone, and both would therefore have added a salary
 * into a figure labelled "Committed every month" the moment an income
 * template became creatable.
 *
 * `committed` is expenses only. `buildRunway` already draws that line and says
 * why: savings and investment contributions are what a person under pressure
 * stops first, so counting them as committed overstates what a month actually
 * demands of someone.
 */
export interface RecurringRollup {
  /** Income templates, per month. */
  income: number;
  /** Recurring expenses, per month. Not savings, not investments. */
  committed: number;
  /** Savings and investment contributions, per month. */
  setAside: number;
  /** Templates the summary does not count — a transfer into a broker. */
  deployed: number;
  /**
   * What is genuinely free: `income - committed - setAside`.
   *
   * Contributions are subtracted even though they are not spending, because
   * this figure answers "what can I still decide about this month" and money
   * already promised to a fund is not that. It is the honest version of the
   * question rather than the flattering one: leaving contributions out would
   * report a saver as having more room than a spender with the same income
   * and the same rent, when they have exactly the same room and one of them
   * has already used it.
   */
  left: number;
}

/**
 * `year` and `month` are passed through to `estimateMonthlyAmount`, which
 * needs them to answer for a weekly template — how much a month costs depends
 * on how many times the day falls inside it. Left off, it answers for now.
 */
export function rollUpRecurring(
  templates: RecurringTemplateWithCategory[],
  year?: number,
  month?: number,
): RecurringRollup {
  let income = 0;
  let committed = 0;
  let setAside = 0;
  let deployed = 0;

  for (const template of templates) {
    if (!template.active) {
      continue;
    }

    const monthly = estimateMonthlyAmount(template, year, month);

    // Checked before the type, not after: a transfer into a broker is money
    // that never left the user's own hands, and the summary leaves it out
    // whatever category carries it.
    if (template.categories.counts_toward_summary === false) {
      deployed += monthly;
      continue;
    }

    switch (template.categories.type) {
      case "income":
        income += monthly;
        break;
      case "expense":
        committed += monthly;
        break;
      default:
        setAside += monthly;
    }
  }

  return {
    income,
    committed,
    setAside,
    deployed,
    left: income - committed - setAside,
  };
}
