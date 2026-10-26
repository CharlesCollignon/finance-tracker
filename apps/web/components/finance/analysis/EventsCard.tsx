"use client";

import { useMemo } from "react";
import {
  summariseEvents,
  type InvestmentEvent,
} from "@finance/core/investment-events";
import { formatSigned } from "@finance/core/amount-sign";
import { accountShortName } from "@/components/finance/accounts/account-format";
import { Card } from "@/components/ui/Card";
import { useFormatCurrency } from "@/lib/use-currency";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

interface EventsCardProps {
  events: InvestmentEvent[];
}

/**
 * « Dividendes et plus-values réalisées »: what the wallets' operations
 * add up to, by year and wrapper — each sale against the oldest purchases
 * of the same line still held (first in, first out, as the tax office
 * reads a PEA or a CTO), the dividends received, the fees taken. Figures
 * from the person's own entries and files: a sale whose purchases are
 * not all recorded says so rather than passing its proceeds off as gain.
 */
export function EventsCard({ events }: EventsCardProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const summary = useMemo(() => summariseEvents(events), [events]);

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex flex-col gap-4 p-5 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-head text-base">{t("events.cardTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {summary.years.length === 0
            ? t("events.cardEmpty")
            : t("events.cardBody")}
        </p>
      </div>

      {summary.years.map((year) => {
        const gains = summary.gains.filter((row) => row.year === year);
        const dividends = summary.dividends.filter((row) => row.year === year);
        const fees = summary.fees.filter((row) => row.year === year);
        const uncovered = gains.reduce(
          (sum, row) => sum + row.uncoveredSells,
          0,
        );
        return (
          <section
            key={year}
            className="flex flex-col gap-2 border-t border-border pt-3"
          >
            <h3 className="text-sm font-medium">{year}</h3>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              {gains.map((row) => (
                <div key={`gain-${row.wallet}`} className="contents">
                  <dt className="text-muted-foreground">
                    {t("events.gains")} · {accountShortName(row.wallet, locale)}
                    <span className="ml-2 text-xs">
                      {t("events.proceeds")} {formatEuro(row.proceeds)} ·{" "}
                      {t("events.basis")} {formatEuro(row.basis)}
                    </span>
                  </dt>
                  <dd
                    className={cn(
                      "text-right font-sans tabular-nums",
                      row.gain > 0
                        ? "text-success"
                        : row.gain < 0
                          ? "text-destructive"
                          : "text-foreground",
                    )}
                  >
                    {formatSigned(row.gain, formatEuro)}
                  </dd>
                </div>
              ))}
              {dividends.map((row) => (
                <div key={`dividend-${row.wallet}`} className="contents">
                  <dt className="text-muted-foreground">
                    {t("events.dividends")} ·{" "}
                    {accountShortName(row.wallet, locale)}
                  </dt>
                  <dd className="text-right font-sans tabular-nums text-success">
                    {formatSigned(row.amount, formatEuro)}
                  </dd>
                </div>
              ))}
              {fees.map((row) => (
                <div key={`fee-${row.wallet}`} className="contents">
                  <dt className="text-muted-foreground">
                    {t("events.fees")} · {accountShortName(row.wallet, locale)}
                  </dt>
                  <dd className="text-right font-sans tabular-nums text-destructive">
                    {formatSigned(-row.amount, formatEuro)}
                  </dd>
                </div>
              ))}
            </dl>
            {uncovered > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("events.uncovered", { count: uncovered })}
              </p>
            ) : null}
          </section>
        );
      })}
    </Card.Bezel>
  );
}
