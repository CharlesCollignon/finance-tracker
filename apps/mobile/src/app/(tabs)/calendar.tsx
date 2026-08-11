import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import {
  formatEuro,
  parseMonthParams,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  buildCalendarWeeks,
  computeDayTotals,
  defaultSelectedDate,
  groupTransactionsByDate,
} from "@finance/core/calendar";
import { computeMonthlyBudget } from "@finance/core/budget";
import type {
  Category,
  RecurringTemplateWithCategory,
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
  getCategories,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries";

export default function CalendarScreen() {
  const { user } = useAuth();
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [selectedDate, setSelectedDate] = useState(() => todayIsoLocal());
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, refreshing, onRefresh, reload, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          transactions: [] as TransactionWithCategory[],
          categories: [] as Category[],
          templates: [] as RecurringTemplateWithCategory[],
        };
      }
      const [transactions, categories, templates] = await Promise.all([
        getTransactions(user.id, year, month),
        getCategories(user.id),
        getRecurringTemplates(user.id),
      ]);
      return { transactions, categories, templates };
    }, [user?.id, year, month]);

  const transactions = data?.transactions ?? [];
  const categories = data?.categories ?? [];
  const templates = data?.templates ?? [];

  const byDate = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions],
  );
  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);
  const monthTotals = useMemo(
    () => computeMonthlyBudget(transactions, templates),
    [transactions, templates],
  );

  const monthKey = `${year}-${month}`;
  const [selectionKey, setSelectionKey] = useState(monthKey);
  const effectiveSelected =
    selectionKey === monthKey
      ? selectedDate
      : defaultSelectedDate(year, month, byDate);

  const dayTxs = byDate.get(effectiveSelected) ?? [];
  const dayTotals = computeDayTotals(dayTxs);

  return (
    <Screen title="Calendar">
      <MonthPicker
        year={year}
        month={month}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
          setSelectionKey(`${y}-${m}`);
        }}
      />

      <View className="my-3 flex-row gap-2">
        <Card className="flex-1 items-center p-2">
          <Text variant="muted">In</Text>
          <Text className="font-bold tabular-nums">
            {formatEuro(monthTotals.income)}
          </Text>
        </Card>
        <Card className="flex-1 items-center p-2">
          <Text variant="muted">Out</Text>
          <Text className="font-bold tabular-nums">
            {formatEuro(monthTotals.outflow)}
          </Text>
        </Card>
        <Card className="flex-1 items-center p-2">
          <Text variant="muted">Net</Text>
          <Text className="font-bold tabular-nums">
            {formatEuro(monthTotals.net)}
          </Text>
        </Card>
      </View>

      {loading && !data ? (
        <ActivityIndicator />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="pb-8"
        >
          <View className="mb-2 flex-row">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <Text
                key={`${d}-${i}`}
                className="flex-1 text-center text-xs font-semibold text-muted-foreground"
              >
                {d}
              </Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} className="mb-1 flex-row gap-1">
              {week.map((day) => {
                const selected = day.date === effectiveSelected;
                const hasTx = byDate.has(day.date);
                return (
                  <Pressable
                    key={day.date}
                    accessibilityLabel={day.date}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setSelectedDate(day.date);
                      setSelectionKey(monthKey);
                    }}
                    className={`min-h-12 flex-1 items-center justify-center border ${
                      selected
                        ? "border-foreground bg-primary"
                        : "border-border bg-card"
                    } ${day.isCurrentMonth ? "" : "opacity-40"}`}
                  >
                    <Text className="text-sm font-semibold">{day.day}</Text>
                    {hasTx ? (
                      <View className="mt-0.5 h-1.5 w-1.5 rounded-full bg-foreground" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View className="mt-4 flex-row items-center justify-between">
            <Text className="font-bold">{effectiveSelected}</Text>
            <Button label="Add" size="sm" onPress={() => setFormOpen(true)} />
          </View>
          <Text variant="muted" className="mb-2">
            In {formatEuro(dayTotals.income)} · Out{" "}
            {formatEuro(dayTotals.outflow)}
          </Text>

          {dayTxs.length === 0 ? (
            <EmptyState
              title="No entries this day"
              description="Add a transaction for the selected date."
            />
          ) : (
            dayTxs.map((tx) => (
              <Card key={tx.id} className="mb-2 flex-row justify-between p-3">
                <Text className="font-semibold">{tx.categories.name}</Text>
                <Text className="font-bold tabular-nums">
                  {formatEuro(Number(tx.amount))}
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {formOpen ? (
        <TransactionFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={reload}
          categories={categories}
          defaultDate={effectiveSelected}
        />
      ) : null}
    </Screen>
  );
}
