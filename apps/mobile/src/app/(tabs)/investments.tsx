import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_LABELS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import {
  buildUpcomingInvestments,
  buildWalletFundingNeeds,
  nextUpcomingByWallet,
  sumUpcomingAmount,
  type WalletFundingNeed,
} from "@finance/core/investment-upcoming";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import type {
  RecurringTemplateWithCategory,
  TransactionWithCategory,
  WalletTransfer,
} from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Screen } from "@/components/ui/Screen";
import { StatHero } from "@/components/StatHero";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { deleteWalletTransfer, upsertWalletTransfer } from "@/lib/mutations";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
  getWalletPortfolio,
  getWalletTransfers,
} from "@/lib/queries";

export default function InvestmentsScreen() {
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const current = getCurrentMonth();
  const [toWallet, setToWallet] = useState<InvestmentWalletId>("pea");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  const { data, loading, refreshing, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          portfolio: null as InvestmentPortfolioSummary | null,
          upcoming: [] as ReturnType<typeof buildUpcomingInvestments>,
          fundingNeeds: [] as WalletFundingNeed[],
          transfers: [] as WalletTransfer[],
        };
      }
      const [portfolio, templates, transactions, transfers] = await Promise.all(
        [
          getWalletPortfolio(user.id, { includeHistory: false }),
          getRecurringTemplates(user.id),
          getInvestmentTransactions(user.id),
          getWalletTransfers(user.id, current.year, current.month),
        ],
      );
      const investmentTemplates = (
        templates as RecurringTemplateWithCategory[]
      ).filter((template) => template.categories.type === "investment");
      const upcoming = buildUpcomingInvestments(
        investmentTemplates,
        transactions as TransactionWithCategory[],
        todayIsoLocal(),
      );
      const fundingNeeds = buildWalletFundingNeeds(
        investmentTemplates,
        current.year,
        current.month,
      );
      return { portfolio, upcoming, fundingNeeds, transfers };
    }, [user?.id, current.year, current.month]);

  const portfolio = data?.portfolio;
  const upcoming = data?.upcoming ?? [];
  const transfers = data?.transfers ?? [];
  const nextByWallet = nextUpcomingByWallet(upcoming);
  const fundingNeeds = (data?.fundingNeeds ?? []).filter(
    (need) => need.monthlyTotal > 0,
  );
  const hasData =
    portfolio &&
    portfolio.columns.some(
      (column) => column.items.length > 0 || column.totalInvested > 0,
    );

  async function handleAddTransfer() {
    setPending(true);
    const result = await upsertWalletTransfer({
      toWallet,
      amount: Number(amount),
      occurredOn: todayIsoLocal(),
    });
    setPending(false);
    if (result.error) {
      Alert.alert("Error", result.error);
      return;
    }
    setAmount("");
    await onRefresh();
  }

  return (
    <Screen title="Wallets">
      {loading && !portfolio ? (
        <ActivityIndicator />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : !portfolio ? (
        <EmptyState
          title="No wallets"
          description="Sign in to track PEA, CTO, and crypto positions."
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-8 pb-28 pt-2"
        >
          <StatHero
            label="Market value"
            amount={formatEuro(portfolio.totalMarketValue)}
            subtitle={
              <>
                {`${formatEuro(portfolio.totalInvested)} invested`}
                {portfolio.hasMarketSnapshot ? (
                  <Text
                    className={
                      portfolio.totalGainLoss > 0
                        ? "font-mono text-sm font-medium text-success"
                        : "font-mono text-sm font-medium text-destructive"
                    }
                  >
                    {` · ${formatEuro(portfolio.totalGainLoss)}`}
                  </Text>
                ) : null}
                {upcoming.length > 0
                  ? ` · upcoming DCA ${formatEuro(sumUpcomingAmount(upcoming))}`
                  : ""}
              </>
            }
          />

          {fundingNeeds.map((need) => (
            <Card key={need.walletId} bezel>
              <Text variant="muted">
                Send to {INVESTMENT_WALLET_LABELS[need.walletId]}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-1">
                <PrivateAmount className="font-mono text-2xl font-bold">
                  {formatEuro(need.monthlyTotal)}
                </PrivateAmount>
                <Text variant="muted" className="text-sm">
                  / month
                </Text>
              </View>
            </Card>
          ))}

          {!hasData ? (
            <EmptyState
              title="No investments tracked yet"
              description="Add positions on web, or link recurring DCA templates — they sync into wallets automatically."
            />
          ) : null}

          {INVESTMENT_WALLET_IDS.map((walletId) => {
            const column =
              portfolio.columns.find((entry) => entry.walletId === walletId) ??
              null;
            const next = nextByWallet[walletId];
            return (
              <Card key={walletId} bezel>
                <Text className="font-bold">
                  {INVESTMENT_WALLET_LABELS[walletId]}
                </Text>
                <PrivateAmount className="mt-1 font-mono text-xl font-bold">
                  {formatEuro(column?.totalMarketValue ?? 0)}
                </PrivateAmount>
                <Text variant="muted">
                  Invested{" "}
                  <PrivateAmount className="font-mono">
                    {formatEuro(column?.totalInvested ?? 0)}
                  </PrivateAmount>
                </Text>
                {next ? (
                  <Text variant="muted" className="mt-1">
                    Next: {next.name} · {next.dateLabel} ·{" "}
                    <PrivateAmount className="font-mono">
                      {formatEuro(next.amount)}
                    </PrivateAmount>
                  </Text>
                ) : null}
                <View className="mt-3 gap-2">
                  {(column?.items ?? []).map((item) => (
                    <View key={item.id} className="rounded-2xl bg-muted/60 p-3">
                      <Text className="font-semibold">{item.name}</Text>
                      <Text variant="muted">
                        <PrivateAmount className="font-mono">
                          {formatEuro(item.marketValue)}
                        </PrivateAmount>
                        {item.gainLoss !== 0 ? (
                          <>
                            {" · "}
                            <PrivateAmount className="font-mono">
                              {formatEuro(item.gainLoss)}
                            </PrivateAmount>
                          </>
                        ) : null}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}

          <Card bezel>
            <Text className="font-bold">Cash → wallet transfers</Text>
            <Text variant="muted" className="mt-1 mb-3">
              This month
            </Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {INVESTMENT_WALLET_IDS.map((id) => {
                const selected = toWallet === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setToWallet(id)}
                    className={`rounded-full border px-4 py-1.5 ${
                      selected
                        ? "border-foreground bg-foreground"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text
                      className={`text-center text-xs font-semibold ${
                        selected ? "text-background" : ""
                      }`}
                    >
                      {INVESTMENT_WALLET_LABELS[id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Amount (€)"
              className="mb-3"
            />
            <Button
              label="Add transfer"
              disabled={pending}
              onPress={handleAddTransfer}
            />
            {transfers.map((t) => (
              <Pressable
                key={t.id}
                className="mt-3 flex-row items-center justify-between border-t border-border pt-3"
                onLongPress={() =>
                  Alert.alert("Delete transfer?", undefined, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        await deleteWalletTransfer(t.id);
                        await onRefresh();
                      },
                    },
                  ])
                }
              >
                <Text>
                  {INVESTMENT_WALLET_LABELS[t.to_wallet]} · {t.occurred_on}
                </Text>
                <PrivateAmount className="font-mono font-semibold">
                  {formatEuro(Number(t.amount))}
                </PrivateAmount>
              </Pressable>
            ))}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}
