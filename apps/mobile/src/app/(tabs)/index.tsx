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
  formatEuro,
  parseMonthParams,
  type BudgetViewMode,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import type { MonthlySummary } from "@finance/core/types/database";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { MonthPicker } from "@/components/MonthPicker";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import {
  getBudgets,
  getCategories,
  getMonthlySummary,
  getSavingsGoals,
  getWalletPortfolio,
} from "@/lib/queries";

function SummaryTile({
  label,
  amount,
  highlight,
  warning,
  hint,
}: {
  label: string;
  amount: number;
  highlight?: boolean;
  warning?: boolean;
  hint?: string;
}) {
  return (
    <Card
      className={`flex-1 p-4 ${
        warning
          ? "border-destructive bg-destructive/10"
          : highlight
            ? "bg-primary/20"
            : ""
      }`}
    >
      <Text variant="muted">{label}</Text>
      <Text className="mt-1 text-2xl font-bold tabular-nums">
        {formatEuro(amount)}
      </Text>
      {hint ? (
        <Text variant="muted" className="mt-1 text-xs">
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

function Breakdown({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: MonthlySummary["expenseBreakdown"];
}) {
  return (
    <Card className="p-0">
      <View className="flex-row items-center justify-between border-b-2 border-border p-4">
        <Text className="font-bold">{title}</Text>
        <Text className="font-bold tabular-nums">{formatEuro(total)}</Text>
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
            <Text className="tabular-nums font-semibold">
              {formatEuro(item.total)}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [view, setView] = useState<BudgetViewMode>("current");

  const { data, loading, refreshing, onRefresh, error } = useRefreshable(
    async () => {
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
          getWalletPortfolio(user.id),
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
    },
    [user?.id, year, month, view],
  );

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
              className={`flex-1 border-2 px-3 py-2 ${
                selected
                  ? "border-foreground bg-primary"
                  : "border-border bg-background"
              }`}
            >
              <Text className="text-center text-xs font-semibold">
                {mode === "current" ? "Through today" : "End of month"}
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
          contentContainerClassName="gap-3 pb-8"
        >
          <View className="flex-row gap-3">
            <SummaryTile label="Income" amount={summary.income} />
            <SummaryTile
              label="Remaining"
              amount={summary.remaining}
              highlight
              warning={overBudget}
              hint={budgetViewHint(summary.budgetView)}
            />
          </View>

          {portfolio ? (
            <Card className="p-4">
              <Text className="font-bold">Wallets</Text>
              <Text className="mt-1 text-2xl font-bold tabular-nums">
                {formatEuro(portfolio.totalMarketValue)}
              </Text>
              <Text variant="muted" className="mt-1">
                Invested {formatEuro(portfolio.totalInvested)}
                {portfolio.hasMarketSnapshot
                  ? ` · P/L ${formatEuro(portfolio.totalGainLoss)}`
                  : ""}
              </Text>
            </Card>
          ) : null}

          {(budgetProgress.length > 0 || goalProgress.length > 0) && (
            <Card className="p-4">
              <Text className="font-bold">Budgets & goals</Text>
              {budgetProgress.map((row) => (
                <View key={row.budgetId} className="mt-3">
                  <View className="flex-row justify-between">
                    <Text>{row.label}</Text>
                    <Text
                      className={
                        row.over ? "font-semibold text-destructive" : ""
                      }
                    >
                      {formatEuro(row.spent)} / {formatEuro(row.limit)}
                    </Text>
                  </View>
                  <View className="mt-1.5 h-2 overflow-hidden rounded bg-muted">
                    <View
                      className={`h-full ${
                        row.over ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min(100, row.ratio * 100)}%`,
                      }}
                    />
                  </View>
                </View>
              ))}
              {goalProgress.map((row) => (
                <View key={row.goal.id} className="mt-3">
                  <View className="flex-row justify-between">
                    <Text>{row.goal.name}</Text>
                    <Text>
                      {formatEuro(row.saved)} /{" "}
                      {formatEuro(Number(row.goal.target_amount))}
                    </Text>
                  </View>
                  <View className="mt-1.5 h-2 overflow-hidden rounded bg-muted">
                    <View
                      className="h-full bg-primary"
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
            <View className="border-2 border-destructive bg-destructive px-3 py-2">
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
