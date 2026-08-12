import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";

import {
  formatEuro,
  parseMonthParams,
  todayIsoLocal,
} from "@finance/core/constants";
import { applyRecurringPlanCounts } from "@finance/core/apply-recurring";
import { CATEGORY_TYPE_LABELS } from "@finance/core/category-styles";
import type {
  Category,
  CategoryType,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { MonthPicker } from "@/components/MonthPicker";
import { TransactionFormModal } from "@/components/TransactionFormModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import {
  applyRecurringForMonth,
  deleteTransaction,
  previewApplyRecurringForMonth,
} from "@/lib/mutations";
import { getCategories, getTransactions } from "@/lib/queries";

type FilterType = "all" | CategoryType;

const FILTERS: FilterType[] = [
  "all",
  "income",
  "expense",
  "savings",
  "investment",
];

export default function TransactionsScreen() {
  const { user } = useAuth();
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [filter, setFilter] = useState<FilterType>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  const [pending, setPending] = useState(false);
  const [applyPending, setApplyPending] = useState(false);

  const { data, loading, refreshing, onRefresh, reload, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          transactions: [] as TransactionWithCategory[],
          categories: [] as Category[],
        };
      }
      const [transactions, categories] = await Promise.all([
        getTransactions(user.id, year, month),
        getCategories(user.id),
      ]);
      return { transactions, categories };
    }, [user?.id, year, month]);

  const transactions = data?.transactions ?? [];
  const categories = data?.categories ?? [];

  const refreshApplyPending = useCallback(async () => {
    const result = await previewApplyRecurringForMonth(year, month);
    if (result.error || !result.plan) {
      return;
    }
    const counts = applyRecurringPlanCounts(result.plan);
    setApplyPending(counts.creates + counts.updates > 0);
  }, [month, year]);

  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, transactions]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return transactions;
    }
    return transactions.filter((tx) => tx.categories.type === filter);
  }, [transactions, filter]);

  async function handleApplyRecurring() {
    setPending(true);
    const preview = await previewApplyRecurringForMonth(year, month);
    setPending(false);
    if (preview.error) {
      Alert.alert("Error", preview.error);
      return;
    }
    const plan = preview.plan ?? { toCreate: [], toUpdate: [] };
    if (plan.toCreate.length === 0 && plan.toUpdate.length === 0) {
      setApplyPending(false);
      Alert.alert("Done", "All recurring entries already applied");
      return;
    }
    Alert.alert(
      "Apply recurring",
      `${plan.toCreate.length} to add, ${plan.toUpdate.length} to update.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add only",
          onPress: async () => {
            const result = await applyRecurringForMonth(year, month, false);
            if (result.error) {
              Alert.alert("Error", result.error);
            } else {
              Alert.alert("Applied", `${result.created ?? 0} added`);
              setApplyPending(false);
              await reload();
              await refreshApplyPending();
            }
          },
        },
        {
          text: "Add + update",
          onPress: async () => {
            const result = await applyRecurringForMonth(year, month, true);
            if (result.error) {
              Alert.alert("Error", result.error);
            } else {
              Alert.alert(
                "Applied",
                `${result.created ?? 0} added, ${result.updated ?? 0} updated`,
              );
              setApplyPending(false);
              await reload();
              await refreshApplyPending();
            }
          },
        },
      ],
    );
  }

  function handleDelete(tx: TransactionWithCategory) {
    Alert.alert("Delete transaction", tx.categories.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deleteTransaction(tx.id);
          if (result.error) {
            Alert.alert("Error", result.error);
          } else {
            await reload();
          }
        },
      },
    ]);
  }

  return (
    <Screen title="Transaction">
      <MonthPicker
        year={year}
        month={month}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

      {applyPending ? (
        <Text variant="muted" className="mb-2 text-center text-sm">
          Recurring changed — apply to update this month.
        </Text>
      ) : null}

      <View className="my-3 flex-row gap-2">
        <Button
          label={pending ? "…" : "Apply recurring"}
          variant={applyPending ? "default" : "outline"}
          size="sm"
          className="flex-1"
          disabled={pending}
          onPress={handleApplyRecurring}
        />
        <Button
          label="Add"
          size="sm"
          className="flex-1"
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </View>

      <View className="mb-3 flex-row flex-wrap gap-2">
        {FILTERS.map((value) => {
          const selected = filter === value;
          return (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              className={`border px-3 py-1.5 ${
                selected
                  ? "border-foreground bg-primary"
                  : "border-border bg-background"
              }`}
            >
              <Text className="text-xs font-semibold">
                {value === "all" ? "All" : CATEGORY_TYPE_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !data ? (
        <ActivityIndicator />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No transactions yet"
              description="Add a manual entry or apply your recurring items for this month."
            />
          }
          contentContainerClassName="pb-8 gap-2"
          renderItem={({ item }) => (
            <Card className="flex-row items-center gap-3 p-3">
              <View className="min-w-0 flex-1">
                <Text className="font-semibold">{item.categories.name}</Text>
                <Text variant="muted">
                  {item.occurred_on}
                  {item.note ? ` · ${item.note}` : ""}
                </Text>
              </View>
              <Text className="font-bold tabular-nums">
                {formatEuro(Number(item.amount))}
              </Text>
              <Pressable
                onPress={() => {
                  setEditing(item);
                  setFormOpen(true);
                }}
                className="border border-border px-2 py-1"
              >
                <Text className="text-xs">Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item)}
                className="border border-destructive px-2 py-1"
              >
                <Text className="text-xs text-destructive">Del</Text>
              </Pressable>
            </Card>
          )}
        />
      )}

      {formOpen ? (
        <TransactionFormModal
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={reload}
          categories={categories}
          transaction={editing}
          defaultDate={todayIsoLocal()}
        />
      ) : null}
    </Screen>
  );
}
