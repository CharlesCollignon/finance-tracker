"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react";
import type { CategoryFacts } from "@finance/core/category-facts";
import type { CategoryRead as CategoryReadValue } from "@finance/core/category-read";
import type { Locale } from "@finance/core/i18n/locale";
import { BarSeries } from "@/components/finance/charts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { TONE, type CategoryCard } from "./CategoryTile";
import { CategoryRead } from "./CategoryRead";

export interface PanelTransaction {
  id: string;
  occurredOn: string;
  note: string | null;
  amount: number;
}

interface CategoryPanelProps {
  card: CategoryCard;
  behind: PanelTransaction[];
  behindMonthLabel: string;
  /** The month `behind` belongs to, as `YYYY-MM` — the Ledger link's `y`/`m`. */
  behindMonthKey: string;
  onClose: () => void;
  id: string;
  /** Null when nothing has been written for this category. */
  read: CategoryReadValue | null;
  /** The category's current figures, labelled in `readLocale`. Null iff `read` is. */
  readFacts: CategoryFacts | null;
  readLocale: Locale;
  /** Too little recorded to be worth a read; the writer is not offered. */
  readThin: boolean;
  readWritesLeft: number;
  readConfigured: boolean;
}

/**
 * One category, opened in place.
 *
 * Holds every finding for this category rather than only the one that reached
 * the band, because the band is a shortlist and this is the whole answer.
 */
export function CategoryPanel({
  card,
  behind,
  behindMonthLabel,
  behindMonthKey,
  onClose,
  id,
  read,
  readFacts,
  readLocale,
  readThin,
  readWritesLeft,
  readConfigured,
}: CategoryPanelProps) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const reducedMotion = usePrefersReducedMotion();
  const { history, normal, drawn, findings } = card;
  const [ledgerYear, ledgerMonth] = behindMonthKey
    .split("-")
    .map((part) => Number(part));

  return (
    <section
      id={id}
      className={cn(
        "mt-2 flex flex-col gap-4 rounded-card p-card border border-hairline-strong",
        !reducedMotion && "motion-safe:animate-in motion-safe:fade-in",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold">{history.name}</h3>
          <p className="text-sm text-muted-foreground">
            {t(
              history.periodShifted
                ? "categoryScreen.normalShifted"
                : "categoryScreen.normal",
              { amount: formatMoney(normal) },
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("categoryScreen.close")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X size={ICON.sm} />
        </button>
      </header>

      {findings.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {findings.map((finding) => (
            <li key={finding.id} className="text-sm text-muted-foreground">
              {t(finding.messageKey, finding.params)}
            </li>
          ))}
        </ul>
      ) : null}

      {history.periodShifted ? (
        <p className="text-xs text-muted-foreground">
          {t("categoryScreen.periodShifted")}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("categoryScreen.months", { count: drawn.length })}
      </p>

      <BarSeries
        color={TONE[history.type] ?? "var(--chart-1)"}
        points={drawn.map((point) => ({
          key: point.monthKey,
          label: point.shortLabel,
          value: point.total,
          empty: point.empty,
        }))}
      />

      {behind.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("categoryScreen.behindThisMonth", { month: behindMonthLabel })}
          </h4>
          <ul className="flex flex-col">
            {behind.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0"
              >
                <span className="min-w-0 truncate">
                  {entry.note ?? entry.occurredOn}
                </span>
                <span className="shrink-0 tabular-nums">
                  <PrivateAmount>{formatMoney(entry.amount)}</PrivateAmount>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
       * `/transactions` reads `y`/`m`, not a category filter (see
       * apps/web/app/(app)/transactions/page.tsx) — there is no `?category=`
       * to link to. This lands the reader on the month the panel is
       * explaining, which is the most it can honestly promise.
       */}
      <Link
        href={`/transactions?y=${ledgerYear}&m=${ledgerMonth}`}
        className="text-sm font-medium text-foreground hover:underline"
      >
        {t("categoryScreen.seeInLedger")}
      </Link>

      <CategoryRead
        categoryId={history.categoryId}
        categoryName={history.name}
        read={read}
        readFacts={readFacts}
        readLocale={readLocale}
        thin={readThin}
        writesLeft={readWritesLeft}
        configured={readConfigured}
      />
    </section>
  );
}
