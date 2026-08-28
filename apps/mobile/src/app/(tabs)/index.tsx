import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import {
  budgetViewHint,
  budgetViewOptionLabel,
  parseMonthParams,
  type BudgetViewMode,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import type { MonthlySummary } from "@finance/core/types/database";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { IncomeSankeyCard } from "@/components/IncomeSankeyCard";
import { MonthPicker } from "@/components/MonthPicker";
import { PrivateAmount } from "@/components/PrivateAmount";
import { StatHero } from "@/components/StatHero";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { progressTone } from "@/lib/progress-tone";
import {
  getBudgets,
  getCategories,
  getMonthlySummary,
  getSavingsGoals,
  getWalletPortfolio,
} from "@/lib/queries";

function Breakdown({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: MonthlySummary["expenseBreakdown"];
}) {
  const formatEuro = useFormatCurrency();
  return (
    <Card bezel className="p-0" innerClassName="p-0">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <Text className="font-bold">{title}</Text>
        <PrivateAmount className="font-mono font-bold">
          {formatEuro(total)}
        </PrivateAmount>
      </View>
      {items.length === 0 ? (
        <Text variant="muted" className="p-4">
          Nothing this month.
        </Text>
      ) : (
        items.map((item) => (
          <View
            key={item.categoryId}
            className="flex-row items-center justify-between border-b border-border px-4 py-3"
          >
            <Text className="flex-1">{item.name}</Text>
            <PrivateAmount className="font-mono font-semibold">
              {formatEuro(item.total)}
            </PrivateAmount>
          </View>
        ))
      )}
    </Card>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [view, setView] = useState<BudgetViewMode>("current");

  const { data, loading, refreshing, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          summary: null as MonthlySummary | null,
          portfolio: null as InvestmentPortfolioSummary | null,
          budgetProgress: [] as ReturnType<typeof buildBudgetProgress>,
          goalProgress: [] as ReturnType<typeof buildSavingsGoalProgress>,
        };
      }
      const [summary, portfolio, budgets, goals, categories] =
        await Promise.all([
          getMonthlySummary(user.id, year, month, view),
          getWalletPortfolio(user.id, { includeHistory: false }),
          getBudgets(user.id),
          getSavingsGoals(user.id),
          getCategories(user.id),
        ]);
      const categoryNames = new Map(
        categories.map((c) => [c.id, c.name] as const),
      );
      return {
        summary,
        portfolio,
        budgetProgress: buildBudgetProgress(
          budgets,
          summary.expenseBreakdown,
          summary.expenses,
          categoryNames,
        ),
        goalProgress: buildSavingsGoalProgress(
          goals,
          summary.savingsBreakdown,
          summary.savings,
        ),
      };
    }, [user?.id, year, month, view]);

  const summary = data?.summary;
  const portfolio = data?.portfolio;
  const budgetProgress = data?.budgetProgress ?? [];
  const goalProgress = data?.goalProgress ?? [];
  const overBudget = (summary?.remaining ?? 0) < 0;
  const anyCapOver = budgetProgress.some((row) => row.over);

  return (
    <Screen title="Home">
      <MonthPicker
        year={year}
        month={month}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

      <View className="my-3 flex-row gap-2">
        {(["current", "month_end"] as const).map((mode) => {
          const selected = view === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setView(mode)}
              className={`flex-1 border px-3 py-2 ${
                selected
                  ? "border-foreground bg-primary"
                  : "border-border bg-background"
              }`}
            >
              <Text className="text-center text-xs font-semibold">
                {budgetViewOptionLabel(mode, year, month)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !summary ? (
        <ActivityIndicator />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : !summary ? (
        <EmptyState
          title="No budget data"
          description="Add income and expenses to see your overview."
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-3 pb-28"
        >
          <Card bezel className="items-center">
            <StatHero
              label="Remaining"
              amount={formatEuro(summary.remaining)}
              tone={overBudget ? "danger" : "default"}
              subtitle={
                <Text className="font-mono text-sm">
                  <Text className="font-mono text-sm text-success">
                    {formatEuro(summary.income)}
                  </Text>
                  {" earned · "}
                  <Text className="font-mono text-sm text-destructive">
                    {formatEuro(summary.expenses)}
                  </Text>
                  {" spent"}
                </Text>
              }
              status={
                <Text variant="muted" className="text-xs">
                  {budgetViewHint(summary.budgetView)}
                </Text>
              }
            />
          </Card>

          <IncomeSankeyCard summary={summary} />

          {portfolio ? (
            <Card bezel className="p-4">
              <Text className="font-bold">Wallets</Text>
              <PrivateAmount className="mt-1 font-mono text-2xl font-bold">
                {formatEuro(portfolio.totalMarketValue)}
              </PrivateAmount>
              <Text variant="muted" className="mt-1">
                Invested{" "}
                <PrivateAmount className="font-mono">
                  {formatEuro(portfolio.totalInvested)}
                </PrivateAmount>
                {portfolio.hasMarketSnapshot ? (
                  <>
                    {" · P/L "}
                    <PrivateAmount className="font-mono">
                      {formatEuro(portfolio.totalGainLoss)}
                    </PrivateAmount>
                  </>
                ) : null}
              </Text>
            </Card>
          ) : null}

          {(budgetProgress.length > 0 || goalProgress.length > 0) && (
            <Card bezel className="p-4">
              <Text className="font-bold">Budgets & goals</Text>
              {budgetProgress.map((row) => {
                const tone = progressTone(row.ratio, row.over);
                return (
                  <View key={row.budgetId} className="mt-3">
                    <View className="flex-row justify-between">
                      <Text>{row.label}</Text>
                      <PrivateAmount
                        className={
                          tone === "danger"
                            ? "font-mono font-semibold text-destructive"
                            : "font-mono"
                        }
                      >
                        {`${formatEuro(row.spent)} / ${formatEuro(row.limit)}`}
                      </PrivateAmount>
                    </View>
                    <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-hairline-strong">
                      <View
                        className={`h-full rounded-full ${
                          tone === "danger" ? "bg-destructive" : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.min(100, row.ratio * 100)}%`,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
              {goalProgress.map((row) => (
                <View key={row.goal.id} className="mt-3">
                  <View className="flex-row justify-between">
                    <Text>{row.goal.name}</Text>
                    <PrivateAmount className="font-mono">
                      {`${formatEuro(row.saved)} / ${formatEuro(Number(row.goal.target_amount))}`}
                    </PrivateAmount>
                  </View>
                  <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-hairline-strong">
                    <View
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, row.ratio * 100)}%`,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Card>
          )}

          <Breakdown
            title="Expenses"
            total={summary.expenses}
            items={summary.expenseBreakdown}
          />
          <Breakdown
            title="Broker transfers"
            total={summary.investments}
            items={summary.investmentBreakdown}
          />
          <Breakdown
            title="Savings"
            total={summary.savings}
            items={summary.savingsBreakdown}
          />

          {overBudget || anyCapOver ? (
            <View className="border border-destructive bg-destructive px-3 py-2">
              <Text className="text-center font-bold text-destructive-foreground">
                {anyCapOver
                  ? "A budget cap was exceeded this month"
                  : "Over budget this month"}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
