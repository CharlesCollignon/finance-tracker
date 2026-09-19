/**
 * The figures a read of one category is allowed to refer to.
 *
 * The contract `month-facts.ts` sets out, narrowed from a whole month to one
 * category's run of months: a model is handed this pack and names figures by
 * id; the app substitutes its own formatted value at render time. The three
 * reasons given over there hold here unchanged — the display currency is a
 * client-side preference the server cannot know, amounts are blurred one
 * element at a time and prose cannot be, and a figure nobody computed has no
 * business on a screen — so this reuses `MonthFact`, `MissingFact` and
 * `FactPack` rather than starting a parallel vocabulary.
 *
 * What is different is how few figures there are. A month pack runs to thirty
 * datums across a dozen families; a category has nine at most, and the read on
 * the other side of them is two sentences long. That changes what the pack
 * owes the model: with thirty figures a missing one is noise, with nine it is
 * a hole the model will fill by inference. Hence `nothing-found` — a drift
 * that did not clear its floor is handed over as an absence with a reason,
 * because a model given a normal and a latest that differ will otherwise
 * announce a drift nobody measured. Hence, too, `cap-left` and `cap-over`:
 * a model that wants the overshoot and holds only the cap will point at the
 * cap and call it the overshoot, which is the failure `month-facts.ts`
 * documents having already paid for.
 *
 * Pure, and deliberately so: everything here is testable without a database,
 * a network or a model.
 */

import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type {
  FactPack,
  FactSense,
  MissingFact,
  MonthFact,
} from "./month-facts";
import type { CategoryType } from "./types/database";

export interface CategoryFactsInput {
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  /** The median month. */
  normal: number;
  /** The month on screen, or null when nothing was recorded in it. */
  latest: number | null;
  monthsActive: number;
  /** "September 2026", already formatted by the caller in the read's locale. */
  monthLabel: string;
  /** Signed: positive is up. Null when there is no drift finding. */
  drift: number | null;
  /** Distance from normal, signed. Null when there is no odd month. */
  oddMonth: number | null;
  /** This category's share of the month's expenses, 0 to 1. */
  shareOfMonth: number | null;
  /** The category's cap, or null when it has none. */
  cap: number | null;
  /**
   * The language the labels are written in.
   *
   * Part of the input rather than a second argument for the reason
   * `BuildMonthFactsInput` gives: these labels do not only reach a screen,
   * `./category-read-prompt` lists each fact as "id | label | value" for the
   * model, so this is what decides which language the read comes back in.
   */
  locale?: Locale;
}

export interface CategoryFacts extends FactPack {
  categoryId: string;
  categoryName: string;
  /**
   * Carried on the pack as well as used to choose each `sense`, because the
   * prompt says out loud what kind of category this is. A read that treats
   * money set aside as money going out is worse than no read.
   */
  type: CategoryType;
  monthLabel: string;
  facts: MonthFact[];
  missing: MissingFact[];
  /** Too little recorded to be worth a read; the writer is not asked. */
  thin: boolean;
}

/**
 * How many months with something in them before a read is worth writing.
 *
 * Three, because below that there is no run to read. A normal taken over one
 * or two months *is* those months, and `category-findings.ts` cannot produce
 * a drift or an odd month at all — so the model would be handed a figure and
 * a restatement of it, and asked for an insight.
 */
export const MIN_MONTHS_FOR_CATEGORY_READ = 3;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Percentages are carried as points, the way `month-facts` carries them. */
function points(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

/**
 * Which way this category's figures want to move.
 *
 * Exported because it is a judgement about the domain rather than about this
 * pack, and because getting it wrong is the one error here a reader would
 * notice: a read congratulating someone on a rise in groceries, or warning
 * them about a rise in their salary, is advice pointing the wrong way, which
 * `month-facts.ts` says plainly is worse than no advice.
 *
 * `normal` and `months-active` are neutral rather than taking this, because a
 * category costing more in an ordinary month is not itself good or bad news —
 * it is the scale everything else is read against.
 */
export function categorySense(type: CategoryType): FactSense {
  return type === "expense" ? "up-is-bad" : "up-is-good";
}

export function buildCategoryFacts(input: CategoryFactsInput): CategoryFacts {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const t = translator(locale);
  const sense = categorySense(input.type);

  const facts: MonthFact[] = [];
  const missing: MissingFact[] = [];

  const monthLabel = t("categoryFacts.latest", { month: input.monthLabel });

  facts.push({
    id: "normal",
    label: t("categoryFacts.normal"),
    unit: "money",
    value: round(input.normal),
    sense: "neutral",
  });

  if (input.latest === null) {
    missing.push({ id: "latest", label: monthLabel, why: "not-recorded" });
  } else {
    facts.push({
      id: "latest",
      label: monthLabel,
      unit: "money",
      value: round(input.latest),
      sense,
    });
  }

  // Signed, and deliberately: `CategoryFinding.severity` is always positive
  // with the direction beside it, which suits a caption next to an arrow and
  // not a figure dropped into a sentence. A model handed an unsigned drift
  // would have to be told which way it went in prose, and that is exactly the
  // sort of restatement it gets wrong.
  if (input.drift === null) {
    missing.push({
      id: "drift",
      label: t("categoryFacts.drift"),
      why: "nothing-found",
    });
  } else {
    facts.push({
      id: "drift",
      label: t("categoryFacts.drift"),
      unit: "money",
      value: round(input.drift),
      sense,
    });
  }

  if (input.oddMonth === null) {
    missing.push({
      id: "odd-month",
      label: t("categoryFacts.oddMonth"),
      why: "nothing-found",
    });
  } else {
    facts.push({
      id: "odd-month",
      label: t("categoryFacts.oddMonth"),
      unit: "money",
      value: round(input.oddMonth),
      sense,
    });
  }

  facts.push({
    id: "months-active",
    label: t("categoryFacts.monthsActive"),
    unit: "count",
    value: Math.round(input.monthsActive),
    sense: "neutral",
  });

  // A share of the month's spending, so only a spending category has one —
  // and the type is what decides that, not whether a number happened to
  // arrive. A caller handing an income category a share would otherwise get
  // a figure labelled for money going out and marked "up-is-bad" on money
  // coming in, which is the wrong-direction advice `month-facts.ts` calls
  // worse than none.
  //
  // For a category that is not spending the datum is not absent, it does not
  // exist: saying "not known, and why" about a question nobody asked invites
  // a sentence explaining the absence to a reader who never wondered.
  if (input.type === "expense") {
    if (input.shareOfMonth === null) {
      missing.push({
        id: "share-of-month",
        label: t("categoryFacts.shareOfMonth"),
        why: "not-recorded",
      });
    } else {
      facts.push({
        id: "share-of-month",
        label: t("categoryFacts.shareOfMonth"),
        unit: "percent",
        value: points(input.shareOfMonth),
        sense: "up-is-bad",
      });
    }
  }

  /* ------------------------------------------------------------ the cap */

  // A cap and a month's spending, with nothing derived from the two, is the
  // shape `month-facts.ts` already paid to learn about. Every model tried
  // wrote "overshooting the cap by −62,40 €": it saw the breach correctly and
  // quoted the nearest figure it had as the size of it, because that was the
  // only figure it had. A note telling it not to did not help, "and should
  // not have been expected to — the model was not confused, it was making
  // do". So the arithmetic is done here, where it can be tested, rather than
  // forbidden over there.
  //
  // `cap-left` earns its place separately: "you have this much left this
  // month" is the most useful sentence a cap makes possible, and it cannot be
  // written at all from a cap and a total.
  if (input.cap === null) {
    // One absence, one line. The two derived figures do not exist without a
    // cap, and three lines saying "no cap has been set" is noise — the same
    // judgement `month-facts.ts` makes for `unrecorded-over`.
    missing.push({
      id: "cap",
      label: t("categoryFacts.cap"),
      why: "no-cap",
    });
  } else {
    facts.push({
      id: "cap",
      label: t("categoryFacts.cap"),
      unit: "money",
      value: round(input.cap),
      sense: "neutral",
    });

    if (input.latest === null) {
      // The cap stands, but nothing was recorded against it, so what is left
      // of it is genuinely unknown rather than the whole cap.
      missing.push({
        id: "cap-left",
        label: t("categoryFacts.capLeft"),
        why: "not-recorded",
      });
    } else {
      // Unclamped, so it goes negative when the cap is breached. That sign is
      // the point: a model reading "left" as a floor of zero would miss the
      // breach entirely.
      const left = round(input.cap - input.latest);
      facts.push({
        id: "cap-left",
        label: t("categoryFacts.capLeft"),
        unit: "money",
        value: left,
        sense: "up-is-good",
      });

      // The overshoot, positive, as a figure of its own — only when there is
      // one, exactly as `budget-over` appears only when `row.over`.
      if (left < 0) {
        facts.push({
          id: "cap-over",
          label: t("categoryFacts.capOver"),
          unit: "money",
          value: -left,
          sense: "up-is-bad",
        });
      }
    }
  }

  return {
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    type: input.type,
    monthLabel: input.monthLabel,
    facts,
    missing,
    thin: input.monthsActive < MIN_MONTHS_FOR_CATEGORY_READ,
  };
}
