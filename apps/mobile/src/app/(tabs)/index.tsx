import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  budgetViewOptionLabel,
  formatMonthLabel,
  getCurrentMonth,
  parseMonthParams,
  savingsRatePercent,
  todayIsoLocal,
  type BudgetViewMode,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildStillToCome } from "@finance/core/still-to-come";
import { buildMonthComparison } from "@finance/core/month-comparison";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import { buildRunway } from "@finance/core/projection";
import {
  applyRecurringPlanCounts,
  type ApplyRecurringPlan,
} from "@finance/core/apply-recurring";
import type { MonthlySummary } from "@finance/core/types/database";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { ApplyRecurringSheet } from "@/components/ApplyRecurringSheet";
import {
  MonthAttention,
  type AttentionItem,
} from "@/components/MonthAttention";
import { MonthCloseSheet } from "@/components/MonthCloseSheet";
import { MonthFirstRun } from "@/components/MonthFirstRun";
import { MonthPicker } from "@/components/MonthPicker";
import { MonthStanding } from "@/components/MonthStanding";
import { StillToCome } from "@/components/StillToCome";
import { MonthWallets } from "@/components/MonthWallets";
import { ProgressRing, SpendStrip } from "@/components/charts";
import { TrendCard } from "@/components/TrendCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import {
  applyRecurringForMonth,
  previewApplyRecurringForMonth,
} from "@/lib/mutations";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/cn";
import { hapticSuccess } from "@/lib/haptics";
import { useChartSeries } from "@/theme/chart-series";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  getBudgets,
  getCategories,
  getMonthCloseOverview,
  getMonthlySummary,
  getMonthlyTrend,
  getRecurringTemplates,
  getSavingsGoals,
  getSkippedOccurrences,
  getTransactions,
  getWalletPortfolio,
  type MonthCloseOverview,
  type MonthlyTrendPoint,
} from "@/lib/queries";

const VIEW_OPTIONS: BudgetViewMode[] = ["current", "month_end"];

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

/**
 * A card that both links onward and shows the thing it links to.
 *
 * Home is a summary screen; every block on it is a preview of a surface that
 * holds the full version, and saying so in the heading is cheaper than making
 * someone find out by tapping.
 */
function SummaryCard({
  title,
  linkLabel,
  onPress,
  children,
}: {
  title: string;
  linkLabel: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm font-medium">{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={linkLabel}
          onPress={onPress}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm text-primary-ink">{linkLabel}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primaryInk} />
        </Pressable>
      </View>
      {children}
    </Card>
  );
}

export default function MonthScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  // The third chart series, matching the web app's goal rings. Read here
  // rather than in the map below, where it would be a hook inside a loop.
  const goalColor = useChartSeries()[2];
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [view, setView] = useState<BudgetViewMode>("current");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyPending, setApplyPending] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

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
          closes: null as MonthCloseOverview | null,
          templateCount: 0,
          upcoming: null as ReturnType<typeof buildStillToCome> | null,
          monthlyCommitted: 0,
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
        templates,
        closes,
        skipped,
      ] = await Promise.all([
        getMonthlySummary(user.id, year, month, view),
        getWalletPortfolio(user.id, { includeHistory: false }),
        getBudgets(user.id),
        getSavingsGoals(user.id),
        getCategories(user.id),
        getMonthlyTrend(user.id),
        getTransactions(user.id, year, month),
        getTransactions(user.id, previousYear, previousMonth),
        // Quoting share-priced templates can fail; the month must still
        // render, so a failed preview simply means no row.
        previewApplyRecurringForMonth(year, month),
        getRecurringTemplates(user.id),
        getMonthCloseOverview(user.id, todayIsoLocal()),
        getSkippedOccurrences(user.id, year, month),
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
        closes,
        templateCount: templates.length,
        upcoming: buildStillToCome(
          currentTx,
          templates,
          year,
          month,
          todayIsoLocal(),
          new Set(
            skipped.map((entry) => `${entry.templateId}:${entry.occurredOn}`),
          ),
        ),
        // Committed outgoings, for turning a month's saving into days of
        // runway. Always the month in progress: closing an older month does
        // not change what this one costs to live through.
        monthlyCommitted: buildRunway(0, templates, year, month)
          .monthlyCommitted,
      };
    }, [user?.id, year, month, view, dataVersion]);

  const summary = data?.summary;
  const portfolio = data?.portfolio;
  const trend = data?.trend ?? [];
  const comparison = data?.comparison ?? null;
  const plan = data?.plan ?? null;
  const budgetProgress = data?.budgetProgress ?? [];
  const goalProgress = data?.goalProgress ?? [];
  const closes = data?.closes ?? null;
  const upcoming = data?.upcoming ?? null;
  const monthLabel = formatMonthLabel(year, month);

  // Nothing set up and nothing recorded: the standing card would report "0 €
  // left" over two more zeros, which is a correct answer to a question nobody
  // asked. Show the way in instead.
  const firstRun =
    (data?.templateCount ?? 0) === 0 &&
    budgetProgress.length === 0 &&
    goalProgress.length === 0 &&
    (summary?.income ?? 0) === 0 &&
    (summary?.expenses ?? 0) === 0;

  const savingsRate = summary
    ? savingsRatePercent(
        summary.savings,
        summary.investments,
        summary.investmentDeployments,
        summary.income,
      )
    : null;

  // Only a month in progress has an "of it gone" to report.
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;
  const elapsed = isCurrentMonth
    ? Number(todayIsoLocal().slice(8, 10)) / new Date(year, month, 0).getDate()
    : null;

  const planCounts = plan ? applyRecurringPlanCounts(plan) : null;
  const attention: AttentionItem[] = [];

  if (planCounts && planCounts.creates > 0) {
    attention.push({
      id: "apply",
      text: `${planCounts.creates} recurring ${
        planCounts.creates === 1 ? "item is" : "items are"
      } ready to add`,
      action: "Apply",
      onPress: () => setApplyOpen(true),
    });
  }

  if (closes?.next) {
    attention.push({
      id: "close",
      text: closes.next.isBaseline
        ? "Set a starting balance to begin closing months"
        : `${closes.next.label} is ready to close`,
      action: "Close",
      onPress: () => setCloseOpen(true),
    });
  }

  async function confirmApply(includeUpdates: boolean, keys: Set<string>) {
    setApplyPending(true);
    const result = await applyRecurringForMonth(
      year,
      month,
      includeUpdates,
      keys,
    );
    setApplyPending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    void hapticSuccess();
    setApplyOpen(false);
    toast(
      result.created
        ? `${result.created} added to ${monthLabel}`
        : "Nothing to apply",
      "success",
    );
    notifyDataChanged();
    void onRefresh();
  }

  return (
    <Screen title="Month">
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
            label="Set up charges"
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
          <MonthAttention items={attention} />

          {firstRun ? (
            <MonthFirstRun />
          ) : (
            <MonthStanding
              monthLabel={monthLabel}
              income={summary.income}
              expenses={summary.expenses}
              remaining={summary.remaining}
              budgetView={view}
              elapsed={elapsed}
              comparison={comparison}
              savingsRate={savingsRate}
              asOf={
                isCurrentMonth && view === "current" ? todayIsoLocal() : null
              }
            />
          )}

          {/* Only in the as-of-today view: the month-end view has already
              counted these into the headline, so listing them again would
              invite the reader to subtract them twice. */}
          {!firstRun && view === "current" && upcoming ? (
            <StillToCome
              outgoing={upcoming.outgoing}
              leaving={upcoming.leaving}
              incoming={upcoming.incoming}
              arriving={upcoming.arriving}
            />
          ) : null}

          {summary.expenses > 0 ? (
            <SummaryCard
              title="Where it went"
              linkLabel="Ledger"
              onPress={() => router.push("/transactions")}
            >
              <SpendStrip
                rows={summary.expenseBreakdown}
                total={summary.expenses}
              />
            </SummaryCard>
          ) : null}

          {budgetProgress.length > 0 || goalProgress.length > 0 ? (
            <SummaryCard
              title="Caps and goals"
              linkLabel="Plan"
              onPress={() => router.push("/planning")}
            >
              <View className="flex-row flex-wrap items-start gap-4">
                {budgetProgress.slice(0, 2).map((row) => (
                  <ProgressRing
                    key={row.budgetId}
                    ratio={row.ratio}
                    label={row.label}
                    detail={`${Math.round(row.ratio * 100)}% of cap`}
                    over={row.over}
                    meaning="limit"
                  />
                ))}
                {goalProgress.slice(0, 2).map((row) => (
                  <ProgressRing
                    key={row.goal.id}
                    ratio={row.ratio}
                    label={row.goal.name}
                    detail={
                      row.complete
                        ? "reached"
                        : `${Math.round(row.ratio * 100)}% saved`
                    }
                    // A goal is a target, not a limit: filling it is the point.
                    meaning="target"
                    color={goalColor}
                  />
                ))}
              </View>
            </SummaryCard>
          ) : null}

          {portfolio ? <MonthWallets portfolio={portfolio} /> : null}

          <TrendCard points={trend} />
        </ScrollView>
      )}

      <ApplyRecurringSheet
        open={applyOpen}
        onOpenChange={setApplyOpen}
        plan={plan}
        pending={applyPending}
        onConfirm={confirmApply}
      />

      {closes?.next ? (
        <MonthCloseSheet
          open={closeOpen}
          onOpenChange={setCloseOpen}
          year={closes.next.year}
          month={closes.next.month}
          monthLabel={closes.next.label}
          observeOn={closes.next.observeOn}
          isBaseline={closes.next.isBaseline}
          monthlyCommitted={data?.monthlyCommitted ?? 0}
          unrecordedCap={closes.settings.unrecordedCap}
          baseline={closes.summary.baseline}
          onClosed={() => {
            notifyDataChanged();
            void onRefresh();
          }}
        />
      ) : null}
    </Screen>
  );
}
