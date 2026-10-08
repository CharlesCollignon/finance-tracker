"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import { searchNeedle, searchesEveryMonth } from "@finance/core/ledger-search";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { searchEveryMonth } from "@/lib/actions/search";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/** How many rows from other months are listed before « +N ». */
const SHOWN = 20;
/** How long the typing has to pause before every month is asked. */
const PAUSE_MS = 300;

/**
 * The Journal's search beyond the month on screen: the rows of every other
 * month the same words or amount find (`searchAllMonths`), newest first.
 * Each opens its month with the search kept, so it is found again there in
 * its place.
 */
export function EveryMonthResults({
  query,
  year,
  month,
}: {
  query: string;
  year: number;
  month: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [found, setFound] = useState<{
    query: string;
    rows: TransactionWithCategory[];
    more: boolean;
  } | null>(null);
  const wanted = searchesEveryMonth(searchNeedle(query));

  useEffect(() => {
    if (!wanted) {
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      void searchEveryMonth(query).then((result) => {
        if (current) {
          setFound({ query, ...result });
        }
      });
    }, PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, wanted]);

  if (!wanted || !found || found.query !== query) {
    return null;
  }
  const shownMonth = `${year}-${String(month).padStart(2, "0")}`;
  const others = found.rows.filter(
    (tx) => !tx.occurred_on.startsWith(shownMonth),
  );
  if (others.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("ledger.otherMonths", { count: others.length })}
        {found.more ? "+" : ""}
      </h3>
      <ul className="flex flex-col">
        {others.slice(0, SHOWN).map((tx) => {
          const at = {
            y: tx.occurred_on.slice(0, 4),
            m: String(Number(tx.occurred_on.slice(5, 7))),
          };
          return (
            <li key={tx.id}>
              <Link
                href={`/transactions?y=${at.y}&m=${at.m}&q=${encodeURIComponent(query)}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-control px-2 py-2 transition-colors duration-hover hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CategoryIcon
                    icon={tx.categories.icon}
                    className="h-8 w-8 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {tx.note || tx.categories.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatShortDate(tx.occurred_on, locale)} ·{" "}
                      {tx.categories.name}
                    </span>
                  </span>
                </span>
                <PrivateAmount
                  className={cn(
                    "shrink-0 text-sm font-medium tabular-nums",
                    TYPE_AMOUNT_CLASS[tx.categories.type],
                  )}
                >
                  {`${amountSign(tx.categories.type)}${format(Number(tx.amount))}`}
                </PrivateAmount>
              </Link>
            </li>
          );
        })}
      </ul>
      {others.length > SHOWN ? (
        <p className="text-xs text-muted-foreground">
          {t("ledger.otherMonthsMore", { count: others.length - SHOWN })}
        </p>
      ) : null}
    </section>
  );
}
