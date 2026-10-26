import { formatMonthLabel, formatPercentLabel } from "./constants";
import type { Locale } from "./i18n/locale";
import type { Translate } from "./i18n/t";

/**
 * « Relevé du mois »: one month as a few lines to share — an image, a
 * printed page — the same on both apps.
 *
 * « Votre année » shares its cards with no amount in them. A month shared
 * with a partner or an accountant is shared for its amounts, so here they
 * are the point and the choice is the person's: with `formatMoney`, the
 * figures; without it, the shares and the counts, as the year does.
 * Nothing here queries: Le point's own month (`BearingMonth`) is handed in.
 */

export interface MonthShareInput {
  year: number;
  month: number;
  /** Recorded this month. */
  income: number;
  spent: number;
  /** « Où c'est parti »: the biggest categories, and the rest. */
  spending: { top: { name: string; amount: number }[]; rest: number; total: number };
  /** This month's close, when it has one. */
  close: { kept: number | null; unrecorded: number | null } | null;
  /** Still to come, for the month in progress. */
  upcoming: { leaving: number; arriving: number } | null;
}

export interface MonthShareLine {
  id: "income" | "spent" | "net" | "kept" | "unrecorded" | "upcoming";
  label: string;
  figure: string;
}

export interface MonthShareCategory {
  name: string;
  figure: string;
  /** Of the month's spending, between 0 and 1. */
  ratio: number;
}

export interface MonthShare {
  title: string;
  lines: MonthShareLine[];
  categories: MonthShareCategory[];
}

export function monthShare(
  input: MonthShareInput,
  {
    t,
    locale,
    formatMoney,
  }: {
    t: Translate;
    locale: Locale;
    /** Null for the version with no amount: shares and a sign instead. */
    formatMoney: ((amount: number) => string) | null;
  },
): MonthShare {
  const money = (amount: number) =>
    formatMoney ? formatMoney(amount) : "";
  const lines: MonthShareLine[] = [];
  const net = Math.round((input.income - input.spent) * 100) / 100;

  if (formatMoney) {
    lines.push({ id: "income", label: t("monthShare.income"), figure: money(input.income) });
    lines.push({ id: "spent", label: t("monthShare.spent"), figure: money(input.spent) });
    lines.push({
      id: "net",
      label: t("monthShare.net"),
      figure: `${net >= 0 ? "+" : "−"}${money(Math.abs(net))}`,
    });
    if (input.close?.kept !== null && input.close?.kept !== undefined) {
      lines.push({ id: "kept", label: t("monthShare.kept"), figure: money(input.close.kept) });
    }
    if (input.close?.unrecorded !== null && input.close?.unrecorded !== undefined) {
      lines.push({
        id: "unrecorded",
        label: t("monthShare.unrecorded"),
        figure: money(input.close.unrecorded),
      });
    }
    if (input.upcoming && input.upcoming.leaving > 0) {
      lines.push({
        id: "upcoming",
        label: t("monthShare.upcoming"),
        figure: money(input.upcoming.leaving),
      });
    }
  } else {
    // No amount: the month's sign, and the rate kept when it was closed.
    lines.push({
      id: "net",
      label: t("monthShare.net"),
      figure: t(net >= 0 ? "monthShare.netAhead" : "monthShare.netBehind"),
    });
    if (
      input.close?.kept !== null &&
      input.close?.kept !== undefined &&
      input.income > 0
    ) {
      lines.push({
        id: "kept",
        label: t("monthShare.kept"),
        figure: formatPercentLabel(
          Math.round((input.close.kept / input.income) * 100),
          locale,
        ),
      });
    }
  }

  const total = input.spending.total;
  const categories: MonthShareCategory[] = input.spending.top.map((entry) => ({
    name: entry.name,
    figure: formatMoney
      ? formatMoney(entry.amount)
      : formatPercentLabel(total > 0 ? Math.round((entry.amount / total) * 100) : 0, locale),
    ratio: total > 0 ? Math.min(1, entry.amount / total) : 0,
  }));
  if (input.spending.rest > 0 && input.spending.top.length > 0) {
    categories.push({
      name: t("monthShare.everythingElse"),
      figure: formatMoney
        ? formatMoney(input.spending.rest)
        : formatPercentLabel(
            total > 0 ? Math.round((input.spending.rest / total) * 100) : 0,
            locale,
          ),
      ratio: total > 0 ? Math.min(1, input.spending.rest / total) : 0,
    });
  }

  return {
    title: t("monthShare.title", {
      month: formatMonthLabel(input.year, input.month, locale),
    }),
    lines,
    categories,
  };
}
