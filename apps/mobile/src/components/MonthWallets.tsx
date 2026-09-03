import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { INVESTMENT_WALLET_IDS } from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import type { CategoryBreakdown } from "@finance/core/types/database";

import { SpendStrip } from "@/components/charts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

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
 * This was a charting-library donut, which meant the first screen of the app
 * mounted a chart runtime to draw a three-slice split. The full picture —
 * per-holding performance, price history, the things worth scrubbing — is one
 * tap away on Wallets, where the runtime earns its weight. Here the question
 * is only "how much, and roughly where", and a strip answers that.
 */
export function MonthWallets({ portfolio }: MonthWalletsProps) {
  const router = useRouter();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

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
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm font-medium">Invested</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open wallets"
          onPress={() => router.push("/investments")}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm text-primary-ink">Wallets</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primaryInk} />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
        <PrivateAmount className="text-2xl font-semibold">
          {formatEuro(total)}
        </PrivateAmount>
        {showPl ? (
          <PrivateAmount
            className={cn(
              "text-sm",
              pl > 0 ? "text-success" : "text-destructive",
            )}
          >
            {`${pl > 0 ? "+" : "−"}${formatEuro(Math.abs(pl))}`}
          </PrivateAmount>
        ) : null}
      </View>

      <SpendStrip rows={rows} total={total} bands={3} />
    </Card>
  );
}
