"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { INVESTMENT_WALLET_IDS } from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { SpendStrip } from "@/components/finance/charts";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";
import type { CategoryBreakdown } from "@finance/core/types/database";

interface MonthWalletsProps {
  portfolio: InvestmentPortfolioSummary;
}

const WALLET_LABELS: Record<string, string> = {
  pea: "PEA",
  cto: "CTO",
  crypto: "Crypto",
};

/**
 * What is invested, in one line and one bar.
 *
 * This used to be a charting-library donut, which meant Month pulled a
 * runtime for a three-slice split it could draw in markup. The full picture —
 * per-holding performance, price history, the things worth hovering — is a
 * click away on Wallets, where the runtime earns its weight. Here the
 * question is only "how much, and roughly where", and a strip answers that.
 */
export function MonthWallets({ portfolio }: MonthWalletsProps) {
  const formatMoney = useFormatCurrency();

  const rows: CategoryBreakdown[] = INVESTMENT_WALLET_IDS.map((walletId) => {
    const column = portfolio.columns.find((c) => c.walletId === walletId);
    return {
      categoryId: walletId,
      name: WALLET_LABELS[walletId] ?? walletId,
      type: "investment" as const,
      icon: null,
      // Market value where the wallet has been priced, otherwise what went in
      // — a wallet with no snapshot is not worth nothing.
      total: column?.hasMarketSnapshot
        ? column.totalMarketValue
        : (column?.totalInvested ?? 0),
    };
  }).filter((row) => row.total > 0);

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  if (total <= 0) {
    return null;
  }

  const pl = portfolio.totalGainLoss;
  const showPl = portfolio.hasMarketSnapshot && pl !== 0;

  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Invested</h2>
        <Link
          href="/investments"
          className="flex items-center gap-1 text-sm text-primary-ink"
        >
          Wallets
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <PrivateAmount className="font-head text-2xl tabular-nums">
          {formatMoney(total)}
        </PrivateAmount>
        {showPl ? (
          <PrivateAmount
            className={cn(
              "text-sm tabular-nums",
              pl > 0 ? "text-success" : "text-destructive",
            )}
          >
            {pl > 0 ? "+" : "−"}
            {formatMoney(Math.abs(pl))}
          </PrivateAmount>
        ) : null}
      </div>

      <SpendStrip rows={rows} total={total} bands={3} />
    </section>
  );
}
