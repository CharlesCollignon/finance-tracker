import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import {
  buildInvestmentReturns,
  returnUnavailableLabel,
} from "@finance/core/investment-returns";
import { formatAnnualRate } from "@finance/core/xirr";
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
import type {
  InvestmentPortfolioSummary,
  InvestmentPositionItem,
} from "@finance/core/investment-positions";
import type {
  RecurringTemplateWithCategory,
  TransactionWithCategory,
  WalletPlan,
  WalletTransfer,
} from "@finance/core/types/database";

import { InvestmentPositionRow } from "@/components/InvestmentPositionRow";
import { WalletPerformance } from "@/components/WalletPerformance";
import { InvestmentPositionSheet } from "@/components/InvestmentPositionSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { FundCostCard } from "@/components/FundCostCard";
import { StatHero } from "@/components/StatHero";
import { WalletPlanPanel } from "@/components/WalletPlanPanel";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { deleteWalletTransfer, upsertWalletTransfer } from "@/lib/mutations";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
  getWalletPortfolio,
  getWalletPlans,
  getWalletTransfers,
} from "@/lib/queries";

export default function InvestmentsScreen() {
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [confirmingTransfer, setConfirmingTransfer] = useState<string | null>(
    null,
  );
  const current = getCurrentMonth();
  const [toWallet, setToWallet] = useState<InvestmentWalletId>("pea");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [activeWallet, setActiveWallet] = useState<InvestmentWalletId>("pea");
  const [editingPosition, setEditingPosition] =
    useState<InvestmentPositionItem | null>(null);

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          portfolio: null as InvestmentPortfolioSummary | null,
          upcoming: [] as ReturnType<typeof buildUpcomingInvestments>,
          fundingNeeds: [] as WalletFundingNeed[],
          transfers: [] as WalletTransfer[],
          returns: null as ReturnType<typeof buildInvestmentReturns> | null,
          plans: [] as WalletPlan[],
        };
      }
      const [portfolio, templates, transactions, transfers, plans] =
        await Promise.all([
          // History powers the per-position charts.
          getWalletPortfolio(user.id, { includeHistory: true }),
          getRecurringTemplates(user.id),
          getInvestmentTransactions(user.id),
          getWalletTransfers(user.id, current.year, current.month),
          getWalletPlans(user.id),
        ]);
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
      const returns = buildInvestmentReturns(
        transactions as TransactionWithCategory[],
        portfolio,
        todayIsoLocal(),
      );
      return { portfolio, upcoming, fundingNeeds, transfers, returns, plans };
    }, [user?.id, current.year, current.month, dataVersion]);

  const portfolio = data?.portfolio;
  const returns = data?.returns ?? null;
  const plans = data?.plans ?? [];
  const upcoming = data?.upcoming ?? [];
  const transfers = data?.transfers ?? [];
  const nextByWallet = nextUpcomingByWallet(upcoming);
  const fundingNeeds = (data?.fundingNeeds ?? []).filter(
    (need) => need.monthlyTotal > 0,
  );
  const activeItems =
    portfolio?.columns.find((entry) => entry.walletId === activeWallet)
      ?.items ?? [];
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
      toast(result.error, "error");
      return;
    }
    setAmount("");
    await onRefresh();
  }

  return (
    <Screen title="Wallets">
      {loading && !portfolio ? (
        <ScreenSkeleton rows={3} />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : !portfolio ? (
        <EmptyState
          title="No wallets"
          description="PEA, CTO and crypto positions appear here once you have investment transactions or recurring contributions."
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-4 pb-28 pt-2"
        >
          <StatHero
            label="Market value"
            amount={formatEuro(portfolio.totalMarketValue)}
            animateValue={portfolio.totalMarketValue}
            format={formatEuro}
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

          {returns ? (
            <Card bezel innerClassName="p-4">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="muted" className="text-sm">
                  Money-weighted return
                </Text>
                <Text
                  className={cn(
                    "font-mono font-bold",
                    returns.total.rate === null
                      ? "text-muted-foreground"
                      : returns.total.rate >= 0
                        ? "text-success"
                        : "text-destructive",
                  )}
                  style={{ fontSize: 18 }}
                >
                  {formatAnnualRate(returns.total.rate) ??
                    returnUnavailableLabel(returns.total.unavailableReason)}
                </Text>
              </View>
              <Text variant="muted" className="mt-2 text-xs">
                Annualised across every dated contribution, so paying in monthly
                is measured fairly against a lump sum.
              </Text>
            </Card>
          ) : null}

          <FundCostCard portfolio={portfolio} />

          <WalletPlanPanel
            portfolio={portfolio}
            returns={returns}
            plans={plans}
            monthlyContribution={fundingNeeds.reduce(
              (sum, need) => sum + need.monthlyTotal,
              0,
            )}
            onSaved={onRefresh}
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
              description="Set up a recurring investment and it becomes a tracked position here automatically, with its own market value and P/L."
            />
          ) : null}

          <WalletPerformance
            portfolio={portfolio}
            activeWallet={activeWallet}
            onWalletChange={setActiveWallet}
            nextByWallet={nextByWallet}
          />

          <View>
            <Text className="mb-2 text-base">
              {`${INVESTMENT_WALLET_LABELS[activeWallet]} positions`}
            </Text>
            <Card bezel innerClassName="px-4 py-1">
              {activeItems.length === 0 ? (
                <Text variant="muted" className="py-4 text-sm">
                  No positions in this wallet yet.
                </Text>
              ) : (
                activeItems.map((item, index) => (
                  <View
                    key={item.id}
                    className={index > 0 ? "border-t border-border" : ""}
                  >
                    <InvestmentPositionRow
                      item={item}
                      onEdit={() => setEditingPosition(item)}
                    />
                  </View>
                ))
              )}
            </Card>
          </View>

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
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={INVESTMENT_WALLET_LABELS[id]}
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
                accessibilityRole="button"
                accessibilityHint="Long press to delete this transfer"
                className="mt-3 flex-row items-center justify-between border-t border-border pt-3"
                onLongPress={() => setConfirmingTransfer(t.id)}
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

      <ConfirmSheet
        open={confirmingTransfer !== null}
        title="Delete this transfer?"
        message="The transfer record is removed; your transactions are not affected."
        onConfirm={async () => {
          const id = confirmingTransfer;
          setConfirmingTransfer(null);
          if (!id) {
            return;
          }
          const result = await deleteWalletTransfer(id);
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          await onRefresh();
        }}
        onCancel={() => setConfirmingTransfer(null)}
      />

      <InvestmentPositionSheet
        item={editingPosition}
        onClose={() => setEditingPosition(null)}
        onSaved={onRefresh}
      />
    </Screen>
  );
}
