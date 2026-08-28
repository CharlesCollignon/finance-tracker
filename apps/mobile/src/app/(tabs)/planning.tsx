import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  buildSavingsGoalProgress,
  computeGoalPacing,
  type GoalPacing,
} from "@finance/core/savings-goals";
import { getCurrentMonth } from "@finance/core/constants";
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
import { PrivateAmount } from "@/components/PrivateAmount";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { progressTone } from "@/lib/progress-tone";
import {
  getBudgets,
  getCategories,
  getMonthlySummary,
  getSavingsGoals,
  getTags,
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
        };
      }

      const [budgets, goals, tags, categories, summary] = await Promise.all([
        getBudgets(user.id),
        getSavingsGoals(user.id),
        getTags(user.id),
        getCategories(user.id),
        getMonthlySummary(user.id, current.year, current.month),
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
      };
    }, [user?.id, current.year, current.month]);

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
    <Screen title="Planning">
      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-3 pb-6 pt-1"
        >
          <Text className="text-base">Monthly budgets</Text>

          {(data?.budgetProgress ?? []).map((row) => {
            const tone = progressTone(row.ratio, row.over);
            return (
              <Card key={row.budgetId} bezel innerClassName="p-4">
                <View className="flex-row justify-between">
                  <Text className="text-sm font-medium">{row.label}</Text>
                  <PrivateAmount
                    className={
                      tone === "danger"
                        ? "font-mono text-sm font-medium text-destructive"
                        : "font-mono text-sm font-medium"
                    }
                  >
                    {`${formatEuro(row.spent)} / ${formatEuro(row.limit)}`}
                  </PrivateAmount>
                </View>
                <View className="mt-2 h-2 overflow-hidden rounded-full bg-hairline-strong">
                  <View
                    className={`h-full rounded-full ${
                      tone === "danger" ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, row.ratio * 100)}%`,
                    }}
                  />
                </View>
              </Card>
            );
          })}

          <Card bezel>
            <Text variant="label" className="mb-2">
              Global monthly limit (€)
            </Text>
            <Input
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="decimal-pad"
              className="mb-3"
            />
            <Button
              label="Add budget"
              disabled={pending}
              onPress={handleAddBudget}
            />
            {(data?.budgets ?? []).map((b) => (
              <Pressable
                key={b.id}
                className="mt-3 flex-row items-center justify-between border-t border-border pt-3"
                onLongPress={() => setConfirming({ kind: "budget", id: b.id })}
              >
                <Text>
                  {b.category_id
                    ? (data?.categories.find((c) => c.id === b.category_id)
                        ?.name ?? "Category")
                    : "All expenses"}
                </Text>
                <PrivateAmount className="font-mono font-semibold">
                  {formatEuro(Number(b.amount))}
                </PrivateAmount>
              </Pressable>
            ))}
          </Card>

          <Card bezel>
            <Text className="text-base font-semibold">Savings goals</Text>
            {(data?.goalProgress ?? []).map((row) => {
              const hint = pacingHint(computeGoalPacing(row), formatEuro);
              return (
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
                  {hint ? (
                    <Text className={`mt-1.5 text-xs ${hint.className}`}>
                      {hint.text}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            <Text variant="label" className="mb-2 mt-4">
              Goal name
            </Text>
            <Input
              value={goalName}
              onChangeText={setGoalName}
              className="mb-3"
            />
            <Text variant="label" className="mb-2">
              Target (€)
            </Text>
            <Input
              value={goalTarget}
              onChangeText={setGoalTarget}
              keyboardType="decimal-pad"
              className="mb-3"
            />
            <Text variant="label" className="mb-2">
              Target date (optional)
            </Text>
            <DateField
              value={goalTargetDate}
              onChange={setGoalTargetDate}
              placeholder="No target date"
              clearable
              className="mb-3"
            />
            <Button
              label="Add goal"
              disabled={pending}
              onPress={handleAddGoal}
            />
            {(data?.goals ?? []).map((g) => (
              <Pressable
                key={g.id}
                className="mt-3 flex-row items-center justify-between border-t border-border pt-3"
                onLongPress={() => setConfirming({ kind: "goal", id: g.id })}
              >
                <Text>{g.name}</Text>
                <PrivateAmount className="font-mono font-semibold">
                  {formatEuro(Number(g.target_amount))}
                </PrivateAmount>
              </Pressable>
            ))}
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
