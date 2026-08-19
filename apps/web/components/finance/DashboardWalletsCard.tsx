"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  INVESTMENT_WALLET_LABELS,
  INVESTMENT_WALLET_IDS,
} from "@finance/core/investments";
import {
  portfolioHasActivity,
  type InvestmentPortfolioSummary,
} from "@finance/core/investment-positions";
import { StatHero } from "@/components/finance/StatHero";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import {
  chartMotion,
  chartTextStyle,
  CHART_PALETTE,
} from "@/lib/echarts-theme";
import { readCssVar } from "@/lib/css-var";
import { cn } from "@/lib/utils";
import { privateEuro, usePrivacyOn } from "@/lib/use-privacy";
import { useCurrency, useFormatCurrency } from "@/lib/use-currency";

interface DashboardWalletsCardProps {
  portfolio: InvestmentPortfolioSummary;
}

/** Module-level (not a hook), so it takes the caller's already-bound formatter. */
function formatSignedEuro(
  amount: number,
  format: (amount: number) => string,
): string {
  const formatted = format(Math.abs(amount));
  if (amount > 0) {
    return `+${formatted}`;
  }
  if (amount < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

const WALLET_COLOR_VARS = ["--chart-1", "--chart-2", "--chart-3"] as const;

export function DashboardWalletsCard({ portfolio }: DashboardWalletsCardProps) {
  const hasData = portfolioHasActivity(portfolio);
  const hidden = usePrivacyOn();
  const currency = useCurrency();
  const formatEuro = useFormatCurrency();
  const pl = portfolio.totalGainLoss;
  const showPl = portfolio.hasMarketSnapshot && pl !== 0;

  const slices = useMemo(
    () =>
      INVESTMENT_WALLET_IDS.map((walletId, index) => {
        const column = portfolio.columns.find(
          (entry) => entry.walletId === walletId,
        );
        return {
          id: walletId,
          label: INVESTMENT_WALLET_LABELS[walletId],
          value: column?.totalMarketValue ?? 0,
          colorVar: WALLET_COLOR_VARS[index] ?? "--chart-1",
        };
      }).filter((slice) => slice.value > 0),
    [portfolio.columns],
  );

  const [colors, setColors] = useState(() =>
    WALLET_COLOR_VARS.map((name, i) =>
      readCssVar(name, CHART_PALETTE[i] ?? "#a1a1aa"),
    ),
  );
  const [card, setCard] = useState(() => readCssVar("--card", "#141414"));
  const [border, setBorder] = useState(() => readCssVar("--border", "#27272a"));
  const [foreground, setForeground] = useState(() =>
    readCssVar("--foreground", "#fafafa"),
  );

  useEffect(() => {
    const sync = () => {
      const nextColors = WALLET_COLOR_VARS.map((name, i) =>
        readCssVar(name, CHART_PALETTE[i] ?? "#a1a1aa"),
      );
      const nextCard = readCssVar("--card", "#141414");
      const nextBorder = readCssVar("--border", "#27272a");
      const nextForeground = readCssVar("--foreground", "#fafafa");
      setColors((prev) =>
        prev.every((value, i) => value === nextColors[i]) ? prev : nextColors,
      );
      setCard((prev) => (prev === nextCard ? prev : nextCard));
      setBorder((prev) => (prev === nextBorder ? prev : nextBorder));
      setForeground((prev) =>
        prev === nextForeground ? prev : nextForeground,
      );
    };
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-privacy"],
    });
    return () => observer.disconnect();
  }, []);

  const option = useMemo<EChartsOption | null>(() => {
    if (slices.length === 0) {
      return null;
    }
    return {
      ...chartMotion(450),
      tooltip: {
        trigger: "item",
        backgroundColor: card,
        borderColor: border,
        textStyle: {
          ...chartTextStyle(),
          color: foreground,
        },
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number };
          return `${p.name}<br/><strong>${privateEuro(p.value, hidden, currency)}</strong>`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["58%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: slices.map((slice, index) => ({
            name: slice.label,
            value: slice.value,
            itemStyle: {
              color: colors[index % colors.length],
            },
          })),
        },
      ],
    };
  }, [border, card, colors, foreground, hidden, currency, slices]);

  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col items-center text-center">
      {hasData ? (
        <>
          <div className="flex shrink-0 items-center justify-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Wallets</p>
            <Link
              href="/investments"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Open wallets"
            >
              <ArrowRight size={14} />
            </Link>
          </div>
          <StatHero
            className="mt-1 shrink-0"
            label=""
            size="md"
            amount={formatEuro(portfolio.totalMarketValue)}
            subtitle={
              <p>
                <span className="privacy-amount">
                  {formatEuro(portfolio.totalInvested)} invested
                </span>
                {showPl ? (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        "privacy-amount font-medium",
                        pl > 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatSignedEuro(pl, formatEuro)}
                    </span>
                  </>
                ) : null}
              </p>
            }
          />
          {option ? (
            <div className="privacy-sensitive mt-2 min-h-[90px] w-full max-w-xs flex-1">
              <ReactECharts
                option={option}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "svg" }}
                notMerge
              />
            </div>
          ) : null}
          <ul className="mt-1 flex w-full max-w-xs shrink-0 flex-col gap-1">
            {slices.map((slice, index) => (
              <li
                key={slice.id}
                className="flex items-center justify-between gap-2 text-sm leading-tight"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: colors[index % colors.length],
                    }}
                    aria-hidden
                  />
                  <span className="truncate">{slice.label}</span>
                </span>
                <PrivateAmount className="shrink-0 font-mono font-medium tabular-nums">
                  {formatEuro(slice.value)}
                </PrivateAmount>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Wallets</p>
            <Link
              href="/investments"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Open wallets"
            >
              <ArrowRight size={14} />
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">No positions yet</p>
        </>
      )}
    </section>
  );
}
