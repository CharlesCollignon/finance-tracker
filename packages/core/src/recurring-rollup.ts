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
   * The cash the month leaves in the account:
   * `income - committed - setAside - deployed`.
   *
   * Every outflow comes out, including the ones that are not spending.
   * `CONTEXT.md` splits Kept into "the cash it left in the account plus
   * everything deliberately set aside", and this is the first half — so a
   * contribution to a fund and a transfer into a broker both reduce it, for
   * the same reason a direct debit does. The money is still the reader's; it
   * is simply no longer in the account this figure is about.
   *
   * Leaving them out would flatter a saver: someone contributing 400 a month
   * and someone contributing nothing, on the same income with the same rent,
   * would read as having different amounts left when the account says
   * otherwise.
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
    left: income - committed - setAside - deployed,
  };
}
