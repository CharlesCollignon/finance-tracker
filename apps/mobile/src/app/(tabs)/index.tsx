import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import {
  budgetViewOptionLabel,
  formatMonthLabel,
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
import { ProgressRing } from "@/components/charts/ProgressRing";
import { StatHero } from "@/components/StatHero";
import { WalletsCard } from "@/components/WalletsCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  getBudgets,
  getCategories,
  getMonthlySummary,
  getSavingsGoals,
  getWalletPortfolio,
} from "@/lib/queries";

const VIEW_OPTIONS: BudgetViewMode[] = ["current", "month_end"];

function remainingLabel(view: BudgetViewMode, monthLabel: string): string {
  return view === "month_end"
    ? `At end of ${monthLabel}`
    : `Left in ${monthLabel}`;
}

/** Compact segmented control, matching the web BudgetViewToggle. */
function BudgetViewToggle({
  view,
  year,
  month,
  onChange,
}: {
  view: BudgetViewMode;
  year: number;
  month: number;
  onChange: (next: BudgetViewMode) => void;
}) {
  return (
    <View className="flex-row self-center rounded-md border border-border p-0.5">
      {VIEW_OPTIONS.map((value) => {
        const active = view === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            onPress={() => onChange(value)}
            className={cn("rounded-md px-3 py-1.5", active && "bg-primary")}
          >
            <Text
              className={cn(
                "text-xs font-medium",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {budgetViewOptionLabel(value, year, month)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  const router = useRouter();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
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
  const showRings = budgetProgress.length > 0 || goalProgress.length > 0;
  const monthLabel = formatMonthLabel(year, month);

  const statusLabel = anyCapOver
    ? "A budget cap was exceeded"
    : overBudget
      ? "You are over budget"
      : "You are on track";
  const statusDanger = anyCapOver || overBudget;

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

      {loading && !summary ? (
        <ActivityIndicator className="mt-6" />
      ) : error ? (
        <Text className="mt-6 text-destructive">{error}</Text>
      ) : !summary ? (
        <EmptyState
          className="mt-6"
          title="No budget data"
          description="Add income and expenses to see your overview."
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-4 pb-6 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <BudgetViewToggle
            view={view}
            year={year}
            month={month}
            onChange={setView}
          />

          <Card bezel innerClassName="p-6">
            <StatHero
              label={remainingLabel(view, monthLabel)}
              amount={formatEuro(summary.remaining)}
              amountClassName={
                overBudget ? "text-destructive" : "text-primary-ink"
              }
              subtitle={
                <>
                  <Text className="text-sm text-success">
                    {formatEuro(summary.income)}
                  </Text>
                  {" earned · "}
                  <Text className="text-sm text-destructive">
                    {formatEuro(summary.expenses)}
                  </Text>
                  {" spent"}
                </>
              }
              status={
                <Text
                  className={cn(
                    "text-sm font-medium",
                    statusDanger ? "text-destructive" : "text-success",
                  )}
                >
                  {statusLabel}
                </Text>
              }
            />

            {showRings ? (
              <View className="mt-6 w-full items-center border-t border-border pt-6">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-medium text-muted-foreground">
                    Budgets & goals
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Manage budgets and goals"
                    onPress={() => router.push("/planning")}
                    hitSlop={8}
                  >
                    <Text className="text-sm font-medium text-primary-ink">
                      Manage
                    </Text>
                  </Pressable>
                </View>
                <View className="mt-4 flex-row flex-wrap items-start justify-center gap-6">
                  {budgetProgress.map((row) => (
                    <ProgressRing
                      key={row.budgetId}
                      ratio={row.ratio}
                      label={row.label}
                      detail={`${formatEuro(row.spent)} / ${formatEuro(row.limit)}`}
                      over={row.over}
                    />
                  ))}
                  {goalProgress.map((row) => (
                    <ProgressRing
                      key={row.goal.id}
                      ratio={row.ratio}
                      label={row.goal.name}
                      detail={`${formatEuro(row.saved)} / ${formatEuro(Number(row.goal.target_amount))}`}
                      color={colors.info}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>

          {portfolio ? (
            <Card bezel innerClassName="p-5">
              <WalletsCard portfolio={portfolio} />
            </Card>
          ) : null}

          <IncomeSankeyCard summary={summary} />

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
        </ScrollView>
      )}
    </Screen>
  );
}
