import { formatCurrency, formatDayMonth, type CurrencyCode } from "./constants";
import type { Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { LeftToSpend } from "./left-to-spend";

/**
 * The Android home-screen widget (`docs/plans/EVERYDAY_PLAN.md`, phase 3):
 * « Il vous reste » as Le point says it, and two ways in — « + » for the add
 * sheet, and the rest of the widget for Le point.
 *
 * The phone keeps the figure it last read; the widget draws it from there,
 * with no screen of the app open. Two rules decide whether the figure shows,
 * and both are here so they are tested rather than remembered:
 *
 * - Only on the day it was read. Yesterday's figure has one day too many
 *   and yesterday's charges still in it, and it would say so in the
 *   confident voice of today's.
 * - Never with the privacy blur on: a home screen is seen by whoever holds
 *   the phone. The widget then keeps « + » and « Le point » only.
 */

/** The figure as the phone stored it for the widget. */
export interface WidgetFigure {
  /** Null when there is none to show: no balance known yet. */
  left: LeftToSpend | null;
  /** The day it was read, `YYYY-MM-DD`. */
  readOn: string;
}

/** The two ways into the app, in the reader's language. */
interface WidgetWays {
  /** The « + »'s spoken name. */
  add: string;
  bearing: string;
}

export type WidgetFace =
  | ({
      kind: "figure";
      /** « Il vous reste », or « Il vous manque » below zero. */
      title: string;
      /** Always positive: the title carries the sign. */
      amount: string;
      until: string;
      perDay: string | null;
    } & WidgetWays)
  | ({ kind: "bare" } & WidgetWays);

/**
 * What the widget draws: the figure, worded as on Le point, or only the
 * ways in.
 */
export function widgetFace({
  figure,
  today,
  hidden,
  locale,
  currency,
}: {
  figure: WidgetFigure | null;
  today: string;
  /** The privacy blur. */
  hidden: boolean;
  locale: Locale;
  currency: CurrencyCode;
}): WidgetFace {
  const t = translator(locale);
  const ways: WidgetWays = { add: t("widget.add"), bearing: t("nav.bearing") };
  const left = figure !== null && figure.readOn === today ? figure.left : null;
  if (hidden || left === null) {
    return { kind: "bare", ...ways };
  }

  const short = left.amount < 0;
  const until = left.payDay
    ? t(short ? "leftToSpend.byPayDay" : "leftToSpend.untilPayDay", {
        date: formatDayMonth(left.payDay, locale),
      })
    : t(short ? "leftToSpend.byMonthEnd" : "leftToSpend.untilMonthEnd");
  return {
    kind: "figure",
    title: t(short ? "leftToSpend.missing" : "leftToSpend.title"),
    amount: formatCurrency(Math.abs(left.amount), currency, locale),
    until,
    perDay:
      left.perDay === null
        ? null
        : t("leftToSpend.perDay", {
            amount: formatCurrency(left.perDay, currency, locale),
          }),
    ...ways,
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isLeftToSpend(value: unknown): value is LeftToSpend {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const left = value as Record<string, unknown>;
  return (
    typeof left.amount === "number" &&
    Number.isFinite(left.amount) &&
    typeof left.through === "string" &&
    (left.payDay === null ||
      (typeof left.payDay === "string" && ISO_DAY.test(left.payDay))) &&
    typeof left.days === "number" &&
    (left.perDay === null || typeof left.perDay === "number") &&
    typeof left.marge === "number"
  );
}

/**
 * The stored figure, read back from the phone's storage; null for anything
 * that is not one — nothing stored, an older shape, a damaged value. The
 * widget then draws its ways in, which is never wrong.
 */
export function parseWidgetFigure(raw: string | null): WidgetFigure | null {
  if (raw === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { left, readOn } = value as Record<string, unknown>;
  if (typeof readOn !== "string" || !ISO_DAY.test(readOn)) {
    return null;
  }
  if (left !== null && !isLeftToSpend(left)) {
    return null;
  }
  return { left, readOn };
}
