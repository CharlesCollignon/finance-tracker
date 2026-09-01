import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import {
  budgetViewOptionLabel,
  formatMonthLabel,
  parseMonthParams,
  type BudgetViewMode,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  buildMonthComparison,
  formatMonthComparison,
} from "@finance/core/month-comparison";
import { savingsRatePercent, todayIsoLocal } from "@finance/core/constants";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import type { ApplyRecurringPlan } from "@finance/core/apply-recurring";
import type { MonthlySummary } from "@finance/core/types/database";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { IncomeSankeyCard } from "@/components/IncomeSankeyCard";
import { MonthPicker } from "@/components/MonthPicker";
import { MonthReadyCard } from "@/components/MonthReadyCard";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ProgressRing } from "@/components/charts/ProgressRing";
import { StatHero } from "@/components/StatHero";
import { TrendCard } from "@/components/TrendCard";
import { WalletsCard } from "@/components/WalletsCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { previewApplyRecurringForMonth } from "@/lib/mutations";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  getBudgets,
  getCategories,
  getMonthlySummary,
  getMonthlyTrend,
  getSavingsGoals,
  getTransactions,
  getWalletPortfolio,
  type MonthlyTrendPoint,
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
  const colors = useThemeColors();
  // Collapsed by default: the sankey legend above already reports these
  // totals, so the per-category detail is opt-in rather than a long scroll.
  const [open, setOpen] = useState(false);

  return (
    <Card bezel className="p-0" innerClassName="p-0">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${open ? "collapse" : "expand"}`}
        onPress={() => {
          void hapticLight();
          setOpen((value) => !value);
        }}
        className="min-h-14 flex-row items-center justify-between gap-3 p-4"
      >
        <Text className="flex-1 font-bold">{title}</Text>
        <PrivateAmount className="font-mono font-bold">
          {formatEuro(total)}
        </PrivateAmount>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open ? (
        <View className="border-t border-border">
          {items.length === 0 ? (
            <Text variant="muted" className="p-4">
              Nothing this month.
            </Text>
          ) : (
            items.map((item, index) => (
              <View
                key={item.categoryId}
                className={cn(
                  "flex-row items-center justify-between px-4 py-3",
                  index > 0 && "border-t border-border",
                )}
              >
                <Text className="flex-1">{item.name}</Text>
                <PrivateAmount className="font-mono font-semibold">
                  {formatEuro(item.total)}
                </PrivateAmount>
              </View>
            ))
          )}
        </View>
      ) : null}
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

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          summary: null as MonthlySummary | null,
          portfolio: null as InvestmentPortfolioSummary | null,
          comparison: null as ReturnType<typeof buildMonthComparison> | null,
          plan: null as ApplyRecurringPlan | null,
          budgetProgress: [] as ReturnType<typeof buildBudgetProgress>,
          goalProgress: [] as ReturnType<typeof buildSavingsGoalProgress>,
          trend: [] as MonthlyTrendPoint[],
        };
      }
      const [previousYear, previousMonth] =
        month === 1 ? [year - 1, 12] : [year, month - 1];

      const [
        summary,
        portfolio,
        budgets,
        goals,
        categories,
        trend,
        currentTx,
        previousTx,
        preview,
      ] = await Promise.all([
        getMonthlySummary(user.id, year, month, view),
        getWalletPortfolio(user.id, { includeHistory: false }),
        getBudgets(user.id),
        getSavingsGoals(user.id),
        getCategories(user.id),
        getMonthlyTrend(user.id),
        getTransactions(user.id, year, month),
        getTransactions(user.id, previousYear, previousMonth),
        // Quoting share-priced templates can fail; Home must still render,
        // so a failed preview simply means no card.
        previewApplyRecurringForMonth(year, month),
      ]);
      const categoryNames = new Map(
        categories.map((c) => [c.id, c.name] as const),
      );
      return {
        summary,
        portfolio,
        trend,
        plan: preview.plan ?? null,
        // Actuals only: comparing two projections would move whenever a
        // template changed, which is not a claim worth making.
        comparison: buildMonthComparison({
          current: currentTx,
          previous: previousTx,
          year,
          month,
          today: todayIsoLocal(),
        }),
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
    }, [user?.id, year, month, view, dataVersion]);

  const summary = data?.summary;
  const portfolio = data?.portfolio;
  const trend = data?.trend ?? [];
  const comparison = data?.comparison ?? null;
  const plan = data?.plan ?? null;
  const budgetProgress = data?.budgetProgress ?? [];
  const goalProgress = data?.goalProgress ?? [];
  const overBudget = (summary?.remaining ?? 0) < 0;
  const anyCapOver = budgetProgress.some((row) => row.over);
  const showRings = budgetProgress.length > 0 || goalProgress.length > 0;
  const monthLabel = formatMonthLabel(year, month);
  const comparisonLine = comparison
    ? formatMonthComparison(comparison, formatEuro)
    : null;
  const savingsRate = summary
    ? savingsRatePercent(
        summary.savings,
        summary.investments,
        summary.investmentDeployments,
        summary.income,
      )
    : null;

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

      {/* The current / month-end distinction is a real one, but it is not the
          first decision to put in front of someone opening the app, so it sits
          under the month rather than above the figures. */}
      {summary ? (
        <View className="mb-1 items-center">
          <BudgetViewToggle
            view={view}
            year={year}
            month={month}
            onChange={setView}
          />
        </View>
      ) : null}

      {loading && !summary ? (
        <ScreenSkeleton rows={3} />
      ) : error ? (
        <Text className="mt-6 text-destructive">{error}</Text>
      ) : !summary ? (
        <EmptyState
          className="mt-6"
          title="Nothing to show for this month yet"
          description="Pluclair works from what repeats: add your income and your fixed costs once, and every month is forecast for you."
        >
          <Button
            label="Set up recurring"
            variant="pill"
            icon="arrow-forward"
            onPress={() => router.push("/recurring")}
          />
        </EmptyState>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-4 pb-28 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {plan ? (
            <MonthReadyCard
              monthLabel={monthLabel}
              year={year}
              month={month}
              plan={plan}
              onApplied={() => {
                notifyDataChanged();
                void onRefresh();
              }}
            />
          ) : null}

          <Card bezel innerClassName="p-6">
            <StatHero
              label={remainingLabel(view, monthLabel)}
              amount={formatEuro(summary.remaining)}
              animateValue={summary.remaining}
              format={formatEuro}
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

            {comparisonLine || savingsRate !== null ? (
              <View className="mt-4 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1">
                {comparisonLine ? (
                  <Text
                    className={cn(
                      "text-sm",
                      // Spending less is good news; spending more is not an
                      // error, just information.
                      comparison?.direction === "down"
                        ? "text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {comparisonLine}
                  </Text>
                ) : null}
                {savingsRate !== null ? (
                  <Text className="text-sm text-muted-foreground">
                    <Text className="font-mono font-semibold text-foreground">
                      {`${savingsRate}%`}
                    </Text>
                    {" saved"}
                  </Text>
                ) : null}
              </View>
            ) : null}

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

          <TrendCard points={trend} />

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
