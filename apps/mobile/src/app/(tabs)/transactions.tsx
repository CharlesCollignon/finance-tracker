import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import {
  SectionList,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import {
  formatShortDate,
  parseMonthParams,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  applyRecurringPlanCounts,
  type ApplyRecurringPlan,
} from "@finance/core/apply-recurring";
import {
  CATEGORY_TYPE_LABELS,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import type {
  Category,
  CategoryType,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { MonthPicker } from "@/components/MonthPicker";
import { StaggerItem } from "@/components/motion/Stagger";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ApplyRecurringSheet } from "@/components/ApplyRecurringSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { TransactionFormModal } from "@/components/TransactionFormModal";
import {
  RowCheckbox,
  SelectionBar,
} from "@/components/SelectionBar";
import {
  pruneSelection,
  selectAllState,
  summarizeSelection,
  toggleSelectAll,
  toggleSelected,
} from "@finance/core/selection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import {
  applyRecurringForMonth,
  createTransaction,
  deleteTransactions,
  previewApplyRecurringForMonth,
  unskipRecurringOccurrence,
} from "@/lib/mutations";
import {
  getCategories,
  getSkippedOccurrences,
  getTags,
  getTransactions,
  type SkippedOccurrence,
} from "@/lib/queries";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

type FilterType = "all" | CategoryType;

/** Same shape the web transactions view computes for its hero figure. */
function computeTypeTotals(transactions: TransactionWithCategory[]) {
  const totals = { income: 0, expense: 0, savings: 0, investment: 0 };
  for (const tx of transactions) {
    totals[tx.categories.type] += Number(tx.amount);
  }
  return totals;
}

const FILTERS: FilterType[] = [
  "all",
  "income",
  "expense",
  "savings",
  "investment",
];

/** Stable identity, so the derived selection keeps a steady reference. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export default function TransactionsScreen() {
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const colors = useThemeColors();
  const now = parseMonthParams();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  const [duplicating, setDuplicating] =
    useState<TransactionWithCategory | null>(null);
  const [pending, setPending] = useState(false);
  const [applyPlan, setApplyPlan] = useState<ApplyRecurringPlan | null>(null);
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [applyPending, setApplyPending] = useState(false);

  const router = useRouter();
  const dataVersion = useDataVersion();
  const [selectMode, setSelectMode] = useState(false);
  const [storedSelection, setSelected] =
    useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const [deletePending, setDeletePending] = useState(false);
  const { data, loading, refreshing, onRefresh, reload, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          transactions: [] as TransactionWithCategory[],
          categories: [] as Category[],
          skipped: [] as SkippedOccurrence[],
          tags: [] as Tag[],
        };
      }
      const [transactions, categories, skipped, tags] = await Promise.all([
        getTransactions(user.id, year, month),
        getCategories(user.id),
        getSkippedOccurrences(user.id, year, month),
        getTags(user.id),
      ]);
      return { transactions, categories, skipped, tags };
    }, [user?.id, year, month, dataVersion]);

  // Memoised because every derived memo below depends on it; a fresh array
  // each render would recompute the whole screen's derivations.
  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions],
  );
  const categories = data?.categories ?? [];

  const skipped = data?.skipped ?? [];
  const tags = data?.tags ?? [];

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

  const recentCategoryIds = useMemo(() => {
    const seen: string[] = [];
    // transactions arrive newest-first from the query
    for (const tx of transactions) {
      if (!seen.includes(tx.category_id)) {
        seen.push(tx.category_id);
      }
    }
    return seen;
  }, [transactions]);

  const usedCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tx of transactions) {
      if (!seen.has(tx.category_id)) {
        seen.set(tx.category_id, tx.categories.name);
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (filter !== "all" && tx.categories.type !== filter) {
        return false;
      }
      if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      // Same fields the web view searches: category name and note.
      return (
        tx.categories.name.toLowerCase().includes(query) ||
        (tx.note ?? "").toLowerCase().includes(query)
      );
    });
  }, [transactions, filter, categoryFilter, search]);
  // The figures describe what is on screen, which is the whole reason they
  // are here: the month's own totals are Month's job, and repeating them
  // under a filter would state something the list below contradicts.
  const shown = useMemo(() => computeTypeTotals(filtered), [filtered]);
  const shownOut = shown.expense + shown.savings + shown.investment;

  // A ledger is read a day at a time, not as one unbroken column. Grouping
  // here keeps a heading and its rows in the same object, so the list can
  // never draw a date with nothing under it.
  const days = useMemo(() => {
    const out: {
      date: string;
      net: number;
      data: TransactionWithCategory[];
    }[] = [];

    for (const tx of filtered) {
      const amount = Number(tx.amount);
      const signed = tx.categories.type === "income" ? amount : -amount;
      const last = out[out.length - 1];

      if (last && last.date === tx.occurred_on) {
        last.data.push(tx);
        last.net += signed;
      } else {
        out.push({ date: tx.occurred_on, net: signed, data: [tx] });
      }
    }

    return out;
  }, [filtered]);

  const visibleIds = useMemo(() => filtered.map((tx) => tx.id), [filtered]);
  // A filter can hide rows still held in the stored set; pruning here rather
  // than in an effect means the hidden ones can never be acted on.
  const selected = useMemo(
    () => pruneSelection(storedSelection, visibleIds),
    [storedSelection, visibleIds],
  );
  const selectionSummary = useMemo(
    () => summarizeSelection(transactions, selected),
    [transactions, selected],
  );
  const allState = selectAllState(visibleIds, selected);

  function leaveSelectMode() {
    setSelectMode(false);
    setSelected(EMPTY_SELECTION);
  }

  async function handleBulkDelete() {
    setDeletePending(true);
    const result = await deleteTransactions([...selected]);
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

  async function handleDuplicate() {
    const source = duplicating;
    setDuplicating(null);
    if (!source) {
      return;
    }
    const result = await createTransaction({
      categoryId: source.category_id,
      amount: String(Number(source.amount)),
      occurredOn: todayIsoLocal(),
      note: source.note ?? undefined,
    });
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(`${source.categories.name} added for today`, "success");
    await reload();
  }

  async function handleRestore(entry: SkippedOccurrence) {
    const result = await unskipRecurringOccurrence(
      entry.templateId,
      entry.occurredOn,
    );
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(`${entry.name} restored — apply recurring to recreate it`, "success");
    await reload();
    await refreshApplyPending();
  }

  async function handleApplyRecurring() {
    setPending(true);
    const preview = await previewApplyRecurringForMonth(year, month);
    setPending(false);
    if (preview.error) {
      toast(preview.error, "error");
      return;
    }
    const plan = preview.plan ?? {
      toCreate: [],
      toUpdate: [],
      toReprice: [],
    };
    if (plan.toCreate.length === 0 && plan.toUpdate.length === 0) {
      setApplyPending(false);
      toast("All recurring entries already applied");
      return;
    }
    setApplyPlan(plan);
    setApplySheetOpen(true);
  }

  async function confirmApplyRecurring(
    includeUpdates: boolean,
    selectedKeys: Set<string>,
  ) {
    setPending(true);
    const result = await applyRecurringForMonth(
      year,
      month,
      includeUpdates,
      selectedKeys,
    );
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setApplySheetOpen(false);
    setApplyPlan(null);
    setApplyPending(false);
    await reload();
    await refreshApplyPending();
  }

  return (
    <Screen title="Ledger">
      <SurfaceTabs tabs={LEDGER_TABS} className="mb-3" />

      <MonthPicker
        year={year}
        month={month}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

      <View className="mb-3 mt-4 flex-row items-center gap-2">
        <View className="flex-1">
          <Button
            label={pending ? "…" : "Apply recurring"}
            variant={applyPending ? "default" : "outline"}
            size="sm"
            disabled={pending}
            onPress={handleApplyRecurring}
          />
          {applyPending && !pending ? (
            <View
              accessibilityRole="alert"
              accessibilityLabel="Recurring changes are waiting to be applied"
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive"
            />
          ) : null}
        </View>
        <Button
          label="Add"
          size="sm"
          className="flex-1"
          icon="add"
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </View>

      {/* Housekeeping, not the main action: right-aligned and quiet, where a
          centred row of full-width buttons used to read as the point of the
          screen. */}
      <View className="mb-3 flex-row items-center justify-end gap-1">
        {selectMode ? (
          <>
            <Button
              label={allState === "all" ? "Clear all" : "Select all"}
              variant="ghost"
              size="sm"
              onPress={() =>
                setSelected((current) => toggleSelectAll(visibleIds, current))
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
          <>
            <Button
              label="Select"
              variant="ghost"
              size="sm"
              icon="checkbox-outline"
              onPress={() => setSelectMode(true)}
            />
            <Button
              label="Import CSV"
              variant="ghost"
              size="sm"
              icon="document-outline"
              onPress={() => router.push("/import" as Href)}
            />
          </>
        )}
      </View>

      <View className="mb-3 flex-row items-center gap-2 rounded-full border border-border bg-card px-3">
        <Ionicons
          name="search-outline"
          size={16}
          color={colors.mutedForeground}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search category or note…"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Search transactions"
          returnKeyType="search"
          className="h-11 flex-1 font-sans text-sm text-foreground"
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={() => setSearch("")}
          >
            <Ionicons
              name="close-circle"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="mb-3 flex-row flex-wrap gap-1.5">
        {FILTERS.map((value) => {
          const selected = filter === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={
                value === "all" ? "All types" : CATEGORY_TYPE_LABELS[value]
              }
              onPress={() => setFilter(value)}
              className={`rounded-full border px-3 py-1 ${
                selected
                  ? "border-foreground bg-foreground"
                  : "border-border bg-background"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  selected ? "text-background" : "text-muted-foreground"
                }`}
              >
                {value === "all" ? "All" : CATEGORY_TYPE_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {usedCategories.length > 1 ? (
        <View className="mb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-4 px-0.5"
          >
            {[{ id: "all", name: "All categories" }, ...usedCategories].map(
              (option) => {
                const selected = categoryFilter === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCategoryFilter(option.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5",
                      selected
                        ? "border-primary bg-primary/15"
                        : "border-border bg-background",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-xs font-medium",
                        selected ? "text-primary-ink" : "text-muted-foreground",
                      )}
                    >
                      {option.name}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>
        </View>
      ) : null}

      {skipped.length > 0 ? (
        <Card bezel className="mb-4" innerClassName="gap-2 p-4">
          <Text className="text-sm font-medium">
            {`Skipped this month (${skipped.length})`}
          </Text>
          <Text variant="muted" className="text-xs">
            Apply will leave these alone. Restore one to bring it back.
          </Text>
          {skipped.map((entry) => (
            <View
              key={`${entry.templateId}:${entry.occurredOn}`}
              className="flex-row items-center justify-between gap-3"
            >
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm">
                  {entry.name}
                </Text>
                <Text variant="muted" className="text-xs">
                  {entry.occurredOn}
                </Text>
              </View>
              <Button
                label="Restore"
                variant="outline"
                size="sm"
                onPress={() => {
                  void handleRestore(entry);
                }}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <View className="mb-2 flex-row items-baseline justify-between gap-3">
        <Text variant="muted" className="text-sm">
          {filtered.length === transactions.length
            ? `${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`
            : `${filtered.length} of ${transactions.length} entries`}
        </Text>
        <View className="flex-row gap-4">
          <Text className="text-sm text-muted-foreground">
            {"In "}
            <PrivateAmount className="text-sm text-success">
              {formatEuro(shown.income)}
            </PrivateAmount>
          </Text>
          <Text className="text-sm text-muted-foreground">
            {"Out "}
            <PrivateAmount className="text-sm text-destructive">
              {formatEuro(shownOut)}
            </PrivateAmount>
          </Text>
        </View>
      </View>

      {loading && !data ? (
        <ScreenSkeleton rows={5} />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <View className="flex-1 rounded-[28px] border border-border bg-foreground/[0.04] p-1.5">
          <View className="flex-1 rounded-[22px] bg-card">
            <SectionList
              sections={days}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <View className="flex-row items-baseline justify-between gap-3 pb-1 pt-4">
                  <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {relativeDayLabel(section.date, formatShortDate)}
                  </Text>
                  <PrivateAmount className="text-xs text-muted-foreground">
                    {`${section.net >= 0 ? "+" : "−"}${formatEuro(Math.abs(section.net))}`}
                  </PrivateAmount>
                </View>
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <EmptyState
                  title="No transactions this month"
                  description="Apply your recurring items to fill the month in one tap, or add a one-off entry."
                >
                  <Button
                    label="Add transaction"
                    variant="pill"
                    icon="add"
                    onPress={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  />
                </EmptyState>
              }
              contentContainerClassName="px-3 py-1 pb-28"
              ListFooterComponent={
                filtered.length > 0 ? (
                  <Text variant="muted" className="py-3 text-center text-xs">
                    {selectMode
                      ? "Tap to select · Done to leave"
                      : "Tap to edit · long-press to select"}
                  </Text>
                ) : null
              }
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
              SectionSeparatorComponent={null}
              renderItem={({ item, index }) => (
                <StaggerItem index={index}>
                  {/* Whole row opens the edit sheet; delete lives inside it,
                      as on web. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectMode
                        ? `Select ${item.categories.name}`
                        : `Edit ${item.categories.name}`
                    }
                    accessibilityState={
                      selectMode
                        ? { selected: selected.has(item.id) }
                        : undefined
                    }
                    className={cn(
                      "min-h-14 flex-row items-center gap-3 py-3",
                      selectMode && selected.has(item.id) && "bg-primary/5",
                    )}
                    onPress={() => {
                      void hapticLight();
                      if (selectMode) {
                        setSelected((current) =>
                          toggleSelected(current, item.id),
                        );
                        return;
                      }
                      setEditing(item);
                      setFormOpen(true);
                    }}
                    onLongPress={() => {
                      void hapticLight();
                      // Long-press enters selection when it is not already on,
                      // which is the gesture people expect from a list.
                      if (!selectMode) {
                        setSelectMode(true);
                        setSelected(() => new Set([item.id]));
                        return;
                      }
                      setDuplicating(item);
                    }}
                  >
                    {selectMode ? (
                      <RowCheckbox
                        checked={selected.has(item.id)}
                        label={`Select ${item.categories.name}`}
                        onPress={() =>
                          setSelected((current) =>
                            toggleSelected(current, item.id),
                          )
                        }
                      />
                    ) : null}
                    <CategoryIcon icon={item.categories.icon} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-sm font-medium">
                        {item.categories.name}
                      </Text>
                      {item.note ? (
                        <Text
                          variant="muted"
                          numberOfLines={1}
                          className="text-xs"
                        >
                          {item.note}
                        </Text>
                      ) : null}
                    </View>
                    <PrivateAmount
                      className={cn(
                        "font-mono text-sm font-semibold",
                        TYPE_AMOUNT_CLASS[item.categories.type],
                      )}
                    >
                      {formatEuro(Number(item.amount))}
                    </PrivateAmount>
                  </Pressable>
                </StaggerItem>
              )}
            />
          </View>
        </View>
      )}

      {formOpen ? (
        <TransactionFormModal
          open={formOpen}
          onDeleted={reload}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={reload}
          categories={categories}
          transaction={editing}
          recentCategoryIds={recentCategoryIds}
          tags={tags}
          defaultDate={todayIsoLocal()}
        />
      ) : null}

      <ConfirmSheet
        open={duplicating !== null}
        title="Repeat this today?"
        message={
          duplicating
            ? `Adds another ${duplicating.categories.name} of ${formatEuro(Number(duplicating.amount))} dated today.`
            : undefined
        }
        confirmLabel="Add for today"
        destructive={false}
        onConfirm={handleDuplicate}
        onCancel={() => setDuplicating(null)}
      />

      <SelectionBar
        summary={selectionSummary}
        pending={deletePending}
        onCancel={leaveSelectMode}
        onDelete={() => void handleBulkDelete()}
      />

      <ApplyRecurringSheet
        open={applySheetOpen}
        onOpenChange={setApplySheetOpen}
        plan={applyPlan}
        pending={pending}
        onConfirm={confirmApplyRecurring}
      />
    </Screen>
  );
}
