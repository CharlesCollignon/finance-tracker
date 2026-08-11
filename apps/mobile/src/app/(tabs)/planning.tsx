import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import { formatEuro, getCurrentMonth } from "@finance/core/constants";
import type {
  Budget,
  Category,
  SavingsGoal,
  Tag,
} from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
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

export default function PlanningScreen() {
  const { user } = useAuth();
  const current = getCurrentMonth();
  const [budgetAmount, setBudgetAmount] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
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
      Alert.alert("Error", result.error);
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
      categoryId: null,
    });
    setPending(false);
    if (result.error) {
      Alert.alert("Error", result.error);
      return;
    }
    setGoalName("");
    setGoalTarget("");
    await onRefresh();
  }

  async function handleAddTag() {
    setPending(true);
    const result = await upsertTag(tagName);
    setPending(false);
    if (result.error) {
      Alert.alert("Error", result.error);
      return;
    }
    setTagName("");
    await onRefresh();
  }

  return (
    <Screen title="Planning">
      {loading && !data ? (
        <ActivityIndicator />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-3 pb-10"
        >
          <Card className="p-4">
            <Text className="font-bold">Monthly budgets</Text>
            {(data?.budgetProgress ?? []).map((row) => (
              <View key={row.budgetId} className="mt-3">
                <View className="flex-row justify-between">
                  <Text>{row.label}</Text>
                  <Text
                    className={row.over ? "font-semibold text-destructive" : ""}
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
            <Text variant="label" className="mb-2 mt-4">
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
                onLongPress={() =>
                  Alert.alert("Delete budget?", undefined, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        await deleteBudget(b.id);
                        await onRefresh();
                      },
                    },
                  ])
                }
              >
                <Text>
                  {b.category_id
                    ? (data?.categories.find((c) => c.id === b.category_id)
                        ?.name ?? "Category")
                    : "All expenses"}
                </Text>
                <Text className="font-semibold">
                  {formatEuro(Number(b.amount))}
                </Text>
              </Pressable>
            ))}
          </Card>

          <Card className="p-4">
            <Text className="font-bold">Savings goals</Text>
            {(data?.goalProgress ?? []).map((row) => (
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
            <Button
              label="Add goal"
              disabled={pending}
              onPress={handleAddGoal}
            />
            {(data?.goals ?? []).map((g) => (
              <Pressable
                key={g.id}
                className="mt-3 flex-row items-center justify-between border-t border-border pt-3"
                onLongPress={() =>
                  Alert.alert("Delete goal?", undefined, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        await deleteSavingsGoal(g.id);
                        await onRefresh();
                      },
                    },
                  ])
                }
              >
                <Text>{g.name}</Text>
                <Text className="font-semibold">
                  {formatEuro(Number(g.target_amount))}
                </Text>
              </Pressable>
            ))}
          </Card>

          <Card className="p-4">
            <Text className="font-bold">Tags</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(data?.tags ?? []).map((t) => (
                <View
                  key={t.id}
                  className="border border-border bg-muted px-3 py-1"
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
    </Screen>
  );
}
