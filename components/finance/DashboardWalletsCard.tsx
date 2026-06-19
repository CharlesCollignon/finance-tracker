"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Card } from "@/components/retroui/Card";
import { formatEuro } from "@/lib/constants";
import {
  INVESTMENT_WALLET_COLORS,
  INVESTMENT_WALLET_LABELS,
  INVESTMENT_WALLET_IDS,
} from "@/lib/investments";
import {
  portfolioHasActivity,
  type InvestmentPortfolioSummary,
} from "@/lib/investment-positions";
import { cn } from "@/lib/utils";

interface DashboardWalletsCardProps {
  portfolio: InvestmentPortfolioSummary;
}

function formatSignedEuro(amount: number): string {
  const formatted = formatEuro(Math.abs(amount));
  if (amount > 0) {
    return `+${formatted}`;
  }
  if (amount < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

export function DashboardWalletsCard({
  portfolio,
}: DashboardWalletsCardProps) {
  const hasData = portfolioHasActivity(portfolio);

  return (
    <Card className="w-full md:col-span-2">
      <div className="flex items-start justify-between gap-3 p-4 md:p-5">
        <div>
          <h2 className="font-head text-base">Wallets</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PEA, CTO &amp; Crypto holdings · live market value
          </p>
        </div>
        <Link
          href="/investments"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-sm font-medium",
            "underline-offset-4 hover:underline",
          )}
        >
          Open
          <ArrowRight size={14} />
        </Link>
      </div>

      {hasData ? (
        <>
          <div className="border-t-2 border-border px-4 pb-4 md:px-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total portfolio
            </p>
            <p className="mt-1 font-head text-2xl tabular-nums font-semibold md:text-3xl">
              {formatEuro(portfolio.totalMarketValue)}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                Invested{" "}
                <span className="font-medium text-foreground">
                  {formatEuro(portfolio.totalInvested)}
                </span>
              </span>
              {portfolio.hasMarketSnapshot && portfolio.totalGainLoss !== 0 && (
                <span>
                  P/L{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      portfolio.totalGainLoss > 0
                        ? "text-[var(--chart-4)]"
                        : "text-destructive",
                    )}
                  >
                    {formatSignedEuro(portfolio.totalGainLoss)}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t-2 border-border px-4 py-4 md:px-5">
            {INVESTMENT_WALLET_IDS.map((walletId) => {
              const column = portfolio.columns.find(
                (entry) => entry.walletId === walletId,
              );
              const value = column?.totalMarketValue ?? 0;
              const accent = INVESTMENT_WALLET_COLORS[walletId];

              return (
                <div
                  key={walletId}
                  className="border-2 border-border px-2 py-2 text-center"
                  style={{ borderTopColor: accent, borderTopWidth: 3 }}
                >
                  <p className="text-xs text-muted-foreground">
                    {INVESTMENT_WALLET_LABELS[walletId]}
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums font-semibold">
                    {formatEuro(value)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="border-t-2 border-border px-4 py-4 text-sm text-muted-foreground md:px-5">
          No wallet positions yet. Add your PEA, CTO, or Bitstack holdings on
          the Wallets page.
        </p>
      )}
    </Card>
  );
}
