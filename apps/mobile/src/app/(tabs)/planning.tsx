import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  buildForwardProjection,
  buildRunway,
  type ProjectionPoint,
  type Runway,
} from "@finance/core/projection";
import {
  buildSavingsGoalProgress,
  computeGoalPacing,
  type GoalPacing,
} from "@finance/core/savings-goals";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import type {
  Budget,
  Category,
  SavingsGoal,
  Tag,
} from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { DateField } from "@/components/ui/DateField";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ProgressRing } from "@/components/charts";
import { PLAN_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { ProjectionCard } from "@/components/ProjectionCard";
import { MonthCloseHistoryCard } from "@/components/MonthCloseHistoryCard";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useChartSeries } from "@/theme/chart-series";
import {
  getBudgets,
  getCategories,
  getMonthCloseOverview,
  getMonthlySummary,
  getRecurringTemplates,
  getSavingsGoals,
  getSavingsReserve,
  getTags,
  type MonthCloseOverview,
} from "@/lib/queries";
import {
  deleteBudget,
  deleteSavingsGoal,
  upsertBudget,
  upsertSavingsGoal,
  upsertTag,
} from "@/lib/mutations";

/** Plain-language pacing line under a goal's progress bar — no jargon, just what to do. */
function pacingHint(
  pacing: GoalPacing,
  formatEuro: (amount: number) => string,
): { text: string; className: string } | null {
  switch (pacing.status) {
    case "reached":
      return { text: "Goal reached!", className: "text-success" };
    case "overdue":
      return {
        text: `Target date passed — ${formatEuro(pacing.monthlyAmount ?? 0)} still to save.`,
        className: "text-destructive",
      };
    case "on-schedule":
      return {
        text: `Save ${formatEuro(pacing.monthlyAmount ?? 0)}/month to reach this by ${pacing.targetLabel}.`,
        className: "text-muted-foreground",
      };
    case "no-date":
      return null;
  }
}

export default function PlanningScreen() {
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  // The third chart series, matching the web app's goal rings.
  const goalColor = useChartSeries()[2];
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<{
    kind: "budget" | "goal";
    id: string;
  } | null>(null);
  const current = getCurrentMonth();
  const [budgetAmount, setBudgetAmount] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [tagName, setTagName] = useState("");
  const [pending, setPending] = useState(false);

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          budgets: [] as Budget[],
          goals: [] as SavingsGoal[],
          tags: [] as Tag[],
          categories: [] as Category[],
          budgetProgress: [] as ReturnType<typeof buildBudgetProgress>,
          goalProgress: [] as ReturnType<typeof buildSavingsGoalProgress>,
          projection: [] as ProjectionPoint[],
          runway: null as Runway | null,
          closes: null as MonthCloseOverview | null,
        };
      }

      const [
        budgets,
        goals,
        tags,
        categories,
        summary,
        templates,
        reserve,
        closes,
      ] = await Promise.all([
        getBudgets(user.id),
        getSavingsGoals(user.id),
        getTags(user.id),
        getCategories(user.id),
        getMonthlySummary(user.id, current.year, current.month),
        getRecurringTemplates(user.id),
        getSavingsReserve(user.id),
        getMonthCloseOverview(user.id, todayIsoLocal()),
      ]);

      const categoryNames = new Map(
        categories.map((c) => [c.id, c.name] as const),
      );

      return {
        budgets,
        goals,
        tags,
        categories,
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
        projection: buildForwardProjection(
          templates,
          current.year,
          current.month,
          { months: 12 },
        ),
        runway: buildRunway(reserve, templates, current.year, current.month),
        closes,
      };
    }, [user?.id, current.year, current.month, dataVersion]);

  async function handleAddBudget() {
    setPending(true);
    const result = await upsertBudget({
      amount: Number(budgetAmount),
      categoryId: null,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setBudgetAmount("");
    await onRefresh();
  }

  async function handleAddGoal() {
    setPending(true);
    const result = await upsertSavingsGoal({
      name: goalName,
      targetAmount: Number(goalTarget),
      targetDate: goalTargetDate.trim() || undefined,
      categoryId: null,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setGoalName("");
    setGoalTarget("");
    setGoalTargetDate("");
    await onRefresh();
  }

  async function handleAddTag() {
    setPending(true);
    const result = await upsertTag(tagName);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setTagName("");
    await onRefresh();
  }

  async function handleConfirmDelete() {
    if (!confirming) {
      return;
    }
    const result =
      confirming.kind === "budget"
        ? await deleteBudget(confirming.id)
        : await deleteSavingsGoal(confirming.id);
    setConfirming(null);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    await onRefresh();
  }

  return (
    <Screen title="Plan">
      <SurfaceTabs tabs={PLAN_TABS} className="mb-3" />

      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-4 pb-28 pt-1"
        >
          <ProjectionCard
            points={data?.projection ?? []}
            runway={data?.runway ?? null}
          />

          {data?.closes ? (
            <MonthCloseHistoryCard
              history={data.closes.history}
              summary={data.closes.summary}
              unrecordedCap={data.closes.settings.unrecordedCap}
              closeDay={data.closes.settings.closeDay}
              onChanged={() => {
                notifyDataChanged();
                void onRefresh();
              }}
            />
          ) : null}

          <Card bezel innerClassName="gap-4 p-5">
            <Text className="text-sm font-medium">Spending caps</Text>

            {(data?.budgetProgress ?? []).length > 0 ? (
              <View className="flex-row flex-wrap items-start gap-2">
                {(data?.budgetProgress ?? []).map((row) => (
                  <Pressable
                    key={row.budgetId}
                    accessibilityRole="button"
                    accessibilityLabel={`Cap on ${row.label}`}
                    accessibilityHint="Long press to remove this cap"
                    onLongPress={() =>
                      setConfirming({ kind: "budget", id: row.budgetId })
                    }
                    className="rounded-lg p-1"
                  >
                    <ProgressRing
                      ratio={row.ratio}
                      label={row.label}
                      detail={`${formatEuro(row.spent)} of ${formatEuro(row.limit)}`}
                      over={row.over}
                      meaning="limit"
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text variant="muted" className="text-sm">
                A cap is a monthly ceiling — on one category, or on everything.
                Month shows how close you are to each.
              </Text>
            )}

            <View className="gap-2 border-t border-border pt-4">
              <Text variant="label">Global monthly limit (€)</Text>
              <Input
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="decimal-pad"
              />
              <Button
                label="Add cap"
                disabled={pending}
                onPress={handleAddBudget}
              />
            </View>
          </Card>

          <Card bezel innerClassName="gap-4 p-5">
            <Text className="text-sm font-medium">Savings goals</Text>

            {(data?.goalProgress ?? []).length > 0 ? (
              <View className="flex-row flex-wrap items-start gap-2">
                {(data?.goalProgress ?? []).map((row) => {
                  const hint = pacingHint(computeGoalPacing(row), formatEuro);
                  return (
                    <Pressable
                      key={row.goal.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Goal ${row.goal.name}`}
                      accessibilityHint="Long press to remove this goal"
                      onLongPress={() =>
                        setConfirming({ kind: "goal", id: row.goal.id })
                      }
                      className="items-center gap-1 rounded-lg p-1"
                    >
                      <ProgressRing
                        ratio={row.ratio}
                        label={row.goal.name}
                        detail={`${formatEuro(row.saved)} of ${formatEuro(Number(row.goal.target_amount))}`}
                        // A goal is a target, not a limit: filling it is the
                        // point, and a full ring in red says the opposite.
                        meaning="target"
                        color={goalColor}
                      />
                      {hint ? (
                        <Text
                          numberOfLines={2}
                          className={`w-32 text-center text-xs ${hint.className}`}
                        >
                          {hint.text}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text variant="muted" className="text-sm">
                A goal is an amount to reach — a deposit, a trip, a buffer. Set
                aside money in a savings category and it fills.
              </Text>
            )}

            <View className="gap-2 border-t border-border pt-4">
              <Text variant="label">Goal name</Text>
              <Input value={goalName} onChangeText={setGoalName} />
              <Text variant="label">Target (€)</Text>
              <Input
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="decimal-pad"
              />
              <Text variant="label">Target date (optional)</Text>
              <DateField
                value={goalTargetDate}
                onChange={setGoalTargetDate}
                placeholder="No target date"
                clearable
              />
              <Button
                label="Add goal"
                disabled={pending}
                onPress={handleAddGoal}
              />
            </View>
          </Card>

          <Card bezel>
            <Text className="text-base font-semibold">Tags</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(data?.tags ?? []).map((t) => (
                <View
                  key={t.id}
                  className="rounded-full border border-border bg-muted px-3 py-1"
                >
                  <Text className="text-xs font-semibold">{t.name}</Text>
                </View>
              ))}
            </View>
            <Text variant="label" className="mb-2 mt-4">
              New tag
            </Text>
            <Input value={tagName} onChangeText={setTagName} className="mb-3" />
            <Button label="Add tag" disabled={pending} onPress={handleAddTag} />
          </Card>
        </ScrollView>
      )}

      <ConfirmSheet
        open={confirming !== null}
        title={
          confirming?.kind === "goal"
            ? "Delete this goal?"
            : "Delete this budget?"
        }
        message="This cannot be undone. Your transactions are not affected."
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}
