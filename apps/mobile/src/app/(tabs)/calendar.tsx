import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import {
  formatMonthLabel,
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
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import type {
  Category,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { MonthPicker } from "@/components/MonthPicker";
import { PrivateAmount } from "@/components/PrivateAmount";
import { deleteTransactions } from "@/lib/mutations";
import { TransactionFormModal } from "@/components/TransactionFormModal";
import {
  RowCheckbox,
  SelectionBar,
} from "@/components/SelectionBar";
import {
  selectAllState,
  summarizeSelection,
  toggleSelectAll,
  toggleSelected,
} from "@finance/core/selection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { StatHero } from "@/components/StatHero";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import {
  getCategories,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries";

/** Stable identity, so the derived selection keeps a steady reference. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export default function CalendarScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [selectedDate, setSelectedDate] = useState(() => todayIsoLocal());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  // Row selection is keyed by day, so changing day empties it by
  // derivation rather than through a state-syncing effect.
  const [rowSelection, setRowSelection] = useState<{
    date: string;
    mode: boolean;
    ids: ReadonlySet<string>;
  }>({ date: "", mode: false, ids: EMPTY_SELECTION });
  const [deletePending, setDeletePending] = useState(false);

  const dataVersion = useDataVersion();
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
    }, [user?.id, year, month, dataVersion]);

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

  const visibleIds = dayTxs.map((tx) => tx.id);
  const onThisDay = rowSelection.date === effectiveSelected;
  const selectedIds = onThisDay ? rowSelection.ids : EMPTY_SELECTION;
  const selectMode = onThisDay && rowSelection.mode;
  const selectionSummary = summarizeSelection(dayTxs, selectedIds);
  const allState = selectAllState(visibleIds, selectedIds);

  function setSelected(next: (current: ReadonlySet<string>) => Set<string>) {
    setRowSelection((current) => {
      const base =
        current.date === effectiveSelected ? current.ids : EMPTY_SELECTION;
      return { date: effectiveSelected, mode: true, ids: next(base) };
    });
  }

  function leaveSelectMode() {
    setRowSelection({
      date: effectiveSelected,
      mode: false,
      ids: EMPTY_SELECTION,
    });
  }

  async function handleBulkDelete() {
    setDeletePending(true);
    const result = await deleteTransactions([...selectedIds]);
    setDeletePending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    void hapticSuccess();
    notifyDataChanged();
    toast(
      `${result.deleted} ${result.deleted === 1 ? "transaction" : "transactions"} deleted`,
      "success",
    );
    leaveSelectMode();
    void onRefresh();
  }

  return (
    <Screen title="Calendar">
      <MonthPicker
        year={year}
        month={month}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

      <Card bezel className="my-5" innerClassName="p-6">
        <StatHero
          label={formatMonthLabel(year, month)}
          amount={`${monthTotals.net >= 0 ? "+" : "−"}${formatEuro(Math.abs(monthTotals.net))}`}
          amountClassName={
            monthTotals.net < 0 ? "text-destructive" : "text-success"
          }
          subtitle={
            <>
              <Text className="font-mono text-sm text-success">
                {formatEuro(monthTotals.income)}
              </Text>
              {" in · "}
              <Text className="font-mono text-sm text-destructive">
                {formatEuro(monthTotals.outflow)}
              </Text>
              {" out"}
            </>
          }
        />
      </Card>

      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="pb-28"
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
                      void hapticLight();
                      setSelectedDate(day.date);
                      setSelectionKey(monthKey);
                    }}
                    className={`min-h-12 flex-1 items-center justify-center rounded-2xl border ${
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
            In{" "}
            <PrivateAmount className="font-mono">
              {formatEuro(dayTotals.income)}
            </PrivateAmount>
            {" · Out "}
            <PrivateAmount className="font-mono">
              {formatEuro(dayTotals.outflow)}
            </PrivateAmount>
          </Text>

          {dayTxs.length > 0 ? (
            <View className="mb-2 flex-row items-center justify-end gap-2">
              {selectMode ? (
                <>
                  <Button
                    label={allState === "all" ? "Clear all" : "Select all"}
                    variant="ghost"
                    size="sm"
                    onPress={() =>
                      setSelected((current) =>
                        toggleSelectAll(visibleIds, current),
                      )
                    }
                  />
                  <Button
                    label="Done"
                    variant="ghost"
                    size="sm"
                    onPress={leaveSelectMode}
                  />
                </>
              ) : (
                <Button
                  label="Select"
                  variant="ghost"
                  size="sm"
                  icon="checkbox-outline"
                  onPress={() =>
                    setRowSelection({
                      date: effectiveSelected,
                      mode: true,
                      ids: EMPTY_SELECTION,
                    })
                  }
                />
              )}
            </View>
          ) : null}

          {dayTxs.length === 0 ? (
            <EmptyState
              title="Nothing on this day"
              description="Pick another day, or add what happened on this one."
            >
              <Button
                label="Add transaction"
                variant="pill"
                icon="add"
                onPress={() => setFormOpen(true)}
              />
            </EmptyState>
          ) : (
            <Card bezel innerClassName="px-2 py-1">
              {dayTxs.map((tx, index) => (
                <Pressable
                  key={tx.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectMode
                      ? `Select ${tx.categories.name}`
                      : `Edit ${tx.categories.name}`
                  }
                  accessibilityState={
                    selectMode ? { selected: selectedIds.has(tx.id) } : undefined
                  }
                  onPress={() => {
                    void hapticLight();
                    if (selectMode) {
                      setSelected((current) => toggleSelected(current, tx.id));
                      return;
                    }
                    setEditing(tx);
                  }}
                  onLongPress={() => {
                    void hapticLight();
                    if (!selectMode) {
                      setRowSelection({
                        date: effectiveSelected,
                        mode: true,
                        ids: new Set([tx.id]),
                      });
                    }
                  }}
                  className={cn(
                    "flex-row items-start gap-3 px-2 py-3.5",
                    index > 0 && "border-t border-border",
                    selectMode && selectedIds.has(tx.id) && "bg-primary/5",
                  )}
                >
                  {selectMode ? (
                    <RowCheckbox
                      checked={selectedIds.has(tx.id)}
                      label={`Select ${tx.categories.name}`}
                      onPress={() =>
                        setSelected((current) => toggleSelected(current, tx.id))
                      }
                    />
                  ) : null}
                  <CategoryIcon icon={tx.categories.icon} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-medium">
                      {tx.categories.name}
                    </Text>
                    <Text
                      variant="muted"
                      numberOfLines={1}
                      className="mt-0.5 text-xs"
                    >
                      {[tx.recurring_template_id ? "Recurring" : null, tx.note]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Text>
                  </View>
                  <PrivateAmount
                    className={cn(
                      "font-mono text-sm font-semibold",
                      TYPE_AMOUNT_CLASS[tx.categories.type],
                    )}
                  >
                    {`${tx.categories.type === "income" ? "+" : "−"}${formatEuro(Number(tx.amount))}`}
                  </PrivateAmount>
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      <SelectionBar
        summary={selectionSummary}
        pending={deletePending}
        onCancel={leaveSelectMode}
        onDelete={() => void handleBulkDelete()}
      />

      {formOpen ? (
        <TransactionFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={reload}
          categories={categories}
          defaultDate={effectiveSelected}
        />
      ) : null}

      {editing ? (
        <TransactionFormModal
          open
          onClose={() => setEditing(null)}
          onSaved={reload}
          onDeleted={reload}
          categories={categories}
          transaction={editing}
          defaultDate={effectiveSelected}
        />
      ) : null}
    </Screen>
  );
}
