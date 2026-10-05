import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import {
  formatLongDate,
  formatMonthLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  buildCalendarWeeks,
  buildPulseDays,
  computeDayTotals,
  defaultSelectedDate,
  groupTransactionsByDate,
} from "@finance/core/calendar";
import { computeMonthlyBudget } from "@finance/core/budget";
import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import {
  FULFILMENT_STATE_KEY,
  indexFulfilmentStates,
} from "@finance/core/fulfilment-state";
import type {
  BankForecast,
  FulfilmentProposal,
} from "@finance/core/recurring-fulfilment";
import {
  plannedOccurrences,
  recurringOccurrenceKey,
  type PlannedOccurrence,
} from "@finance/core/apply-recurring";
import type {
  Category,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarPulse } from "@/components/calendar/CalendarPulse";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FulfilmentDot } from "@/components/FulfilmentDot";
import { MonthPicker } from "@/components/MonthPicker";
import { PlannedOccurrenceSheet } from "@/components/PlannedOccurrenceSheet";
import { PrivateAmount } from "@/components/PrivateAmount";
import { deleteTransactions, moveTransactions } from "@/lib/mutations";
import { TransactionFormModal } from "@/components/TransactionFormModal";
import { RowCheckbox, SelectionBar } from "@/components/SelectionBar";
import {
  selectAllState,
  planSelectionMove,
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
import { ScreenError } from "@/components/ScreenError";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useDeletedToast } from "@/hooks/useDeletedToast";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useQuickAdd } from "@/providers/QuickAddProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useTabBarClearance } from "@/theme/chrome";
import { useLocale, useT } from "@/providers/LocaleProvider";
import {
  getBankForecast,
  getCategories,
  getConfirmedTransactionIds,
  getFulfilledKeys,
  getFulfilmentProposals,
  getRecurringTemplates,
  getSkippedOccurrences,
  getTransactions,
  hasBankFeed,
} from "@/lib/queries";
import { useScreenMonth } from "@/providers/MonthProvider";

/** Stable identity, so the derived selection keeps a steady reference. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export default function CalendarScreen() {
  const t = useT();
  const locale = useLocale();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const { toast } = useToast();
  const toastDeleted = useDeletedToast();
  const formatEuro = useFormatCurrency();
  // Shared with the list and Le point, so switching view keeps the month.
  const { year, month, setMonth } = useScreenMonth();
  const quickAdd = useQuickAdd();
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  // Row selection is keyed by day, so changing day empties it by
  // derivation rather than through a state-syncing effect.
  const [rowSelection, setRowSelection] = useState<{
    date: string;
    mode: boolean;
    ids: ReadonlySet<string>;
  }>({ date: "", mode: false, ids: EMPTY_SELECTION });
  const [deletePending, setDeletePending] = useState(false);
  const [openPlanned, setOpenPlanned] = useState<PlannedOccurrence | null>(
    null,
  );

  const { data, loading, refreshing, onRefreshAll, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          transactions: [] as TransactionWithCategory[],
          categories: [] as Category[],
          templates: [] as RecurringTemplateWithCategory[],
          confirmed: new Set<string>(),
          proposals: [] as FulfilmentProposal[],
          notPlanned: new Set<string>(),
          bank: null as BankForecast | null,
        };
      }
      const [
        transactions,
        categories,
        templates,
        confirmed,
        skipped,
        fulfilled,
        bankFed,
      ] = await Promise.all([
        getTransactions(user.id, year, month),
        getCategories(user.id),
        getRecurringTemplates(user.id),
        // Which rows settle a charge. Needs nothing else the batch fetches,
        // so it rides along rather than costing a second hop.
        getConfirmedTransactionIds(user.id),
        // What is not planned although a charge calls for it: taken out of
        // the month, or already stood for by another row.
        getSkippedOccurrences(user.id, year, month),
        getFulfilledKeys(user.id),
        hasBankFeed(user.id),
      ]);
      // Asked after the batch, because they need the templates and
      // categories the batch fetched.
      const [proposals, bank] = await Promise.all([
        getFulfilmentProposals(user.id, templates, categories, year, month),
        getBankForecast(user.id, templates, bankFed, todayIsoLocal()),
      ]);
      return {
        transactions,
        categories,
        templates,
        confirmed,
        proposals,
        notPlanned: new Set([
          ...skipped.map((entry) =>
            recurringOccurrenceKey(entry.templateId, entry.occurredOn),
          ),
          ...fulfilled,
        ]),
        bank,
      };
    }, [user?.id, year, month], {
      reads: ["transactions", "templates", "categories", "bank"],
    });

  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions],
  );
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);

  /** What each row can say about itself, by transaction id. */
  const fulfilmentStates = useMemo(
    () =>
      indexFulfilmentStates(
        (data?.proposals ?? []).map((proposal) => proposal.transactionId),
        data?.confirmed ?? EMPTY_SELECTION,
      ),
    [data?.proposals, data?.confirmed],
  );

  const byDate = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions],
  );
  /**
   * The month's charges still to come, by day — drawn from the templates, not
   * stored. Each becomes a transaction on its day; until then the calendar
   * shows it muted, under the day's rows, and marks its day with a ring
   * rather than a dot so the grid says which days have only a plan.
   */
  const plannedByDate = useMemo(() => {
    const out = new Map<string, PlannedOccurrence[]>();
    if (!data) {
      return out;
    }
    const written = new Set(
      transactions.flatMap((tx) =>
        tx.recurring_template_id
          ? [recurringOccurrenceKey(tx.recurring_template_id, tx.occurred_on)]
          : [],
      ),
    );
    for (const occurrence of plannedOccurrences(
      templates,
      written,
      year,
      month,
      data.notPlanned,
      todayIsoLocal(),
      data.bank,
    )) {
      const day = out.get(occurrence.occurredOn) ?? [];
      day.push(occurrence);
      out.set(occurrence.occurredOn, day);
    }
    return out;
  }, [data, transactions, templates, year, month]);
  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);
  const monthTotals = useMemo(
    () => computeMonthlyBudget(transactions, templates),
    [transactions, templates],
  );

  // Selection is keyed by month, so a month other than the one picked in
  // — on opening too, the month being shared with the list and Le point —
  // starts on its default day. The web reads it the same way.
  const monthKey = `${year}-${month}`;
  const [selection, setSelection] = useState<{
    monthKey: string;
    date: string;
  } | null>(null);
  const effectiveSelected =
    selection && selection.monthKey === monthKey
      ? selection.date
      : defaultSelectedDate(year, month, byDate);

  // The day a finger is on in the strip, lit in the grid as well.
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const pulseDays = useMemo(
    () => buildPulseDays(weeks, byDate, plannedByDate),
    [weeks, byDate, plannedByDate],
  );

  const dayTxs = byDate.get(effectiveSelected) ?? [];
  const dayPlanned = plannedByDate.get(effectiveSelected) ?? [];
  // What has happened only: a planned row is not money in or out yet.
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

    if (!result.success) {
      toast(result.error, "error");
      return;
    }

    void hapticWarning();
    toastDeleted(t("ledger.deleted", { count: result.deleted }), result.undo);
    leaveSelectMode();
  }

  function planMove(categoryId: string) {
    const target = categories.find((category) => category.id === categoryId);
    // The whole list, not the visible one: whether a merchant keeps being
    // filed the old way turns on rows this screen may not be showing.
    return target
      ? planSelectionMove(transactions, selectedIds, {
          id: target.id,
          type: target.type,
        })
      : null;
  }

  async function handleBulkMove(categoryId: string) {
    setDeletePending(true);
    const result = await moveTransactions([...selectedIds], categoryId);
    setDeletePending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    void hapticSuccess();
    const name =
      categories.find((category) => category.id === categoryId)?.name ??
      t("ledger.theNewCategory");
    toast(t("ledger.moved", { count: result.moved ?? 0, name }), "success");
    leaveSelectMode();
  }

  return (
    <Screen title={t("nav.ledger")}>
      <SurfaceTabs tabs={LEDGER_TABS} className="mb-3" />

      {/* Under the tabs, as on the list: the By category view has no month,
          and a bar above the tabs would make them jump between views. */}
      <MonthPicker prominent year={year} month={month} onChange={setMonth} />
      <View className="h-5" />


      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          // Out to the screen's edges, with the margin back inside: a scroll
          // view clips what overflows it, and the grid runs edge to edge.
          className="-mx-4"
          contentContainerClassName="px-4"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          <View className="mb-5">
            <CalendarPulse
              key={monthKey}
              label={formatMonthLabel(year, month, locale)}
              days={pulseDays}
              totals={monthTotals}
              selectedDate={effectiveSelected}
              focusDate={focusDate}
              onFocus={setFocusDate}
              onSelect={(date) => setSelection({ monthKey, date })}
            />
          </View>

          <CalendarGrid
            weeks={weeks}
            byDate={byDate}
            plannedByDate={plannedByDate}
            selectedDate={effectiveSelected}
            litDate={focusDate}
            onSelect={(date) => {
              setSelection({ monthKey, date });
            }}
          />

          <View className="mt-4 flex-row items-center justify-between">
            <Text className="font-bold">
              {formatLongDate(effectiveSelected, locale)}
            </Text>
            <Button
              label={t("ledger.add")}
              size="sm"
              onPress={() => quickAdd?.open({ date: effectiveSelected })}
            />
          </View>
          {/* The web's line: how many, then what came in and went out. */}
          <Text variant="muted" className="mb-2 text-sm">
            {dayTotals.count === 0
              ? t("calendarView.noTransactions")
              : t("ledger.entryCount", { count: dayTotals.count })}
            {dayTotals.count > 0 ? (
              <PrivateAmount className="text-sm text-muted-foreground">
                {` · ${t("calendarView.inAndOut", {
                  income: formatEuro(dayTotals.income),
                  outflow: formatEuro(dayTotals.outflow),
                })}`}
              </PrivateAmount>
            ) : null}
          </Text>

          {dayTxs.length > 0 ? (
            <View className="mb-2 flex-row items-center justify-end gap-2">
              {selectMode ? (
                <>
                  <Button
                    label={
                      allState === "all"
                        ? t("ledger.clearAll")
                        : t("ledger.selectAll")
                    }
                    variant="ghost"
                    size="sm"
                    onPress={() =>
                      setSelected((current) =>
                        toggleSelectAll(visibleIds, current),
                      )
                    }
                  />
                  <Button
                    label={t("ledger.selectDone")}
                    variant="ghost"
                    size="sm"
                    onPress={leaveSelectMode}
                  />
                </>
              ) : (
                <Button
                  label={t("ledger.select")}
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

          {dayTxs.length === 0 && dayPlanned.length === 0 ? (
            <EmptyState
              title={t("calendarView.emptyTitle")}
              description={t("calendarView.emptyBodyMobile")}
            >
              <Button
                label={t("ledger.addTransaction")}
                variant="pill"
                icon="add"
                onPress={() => quickAdd?.open({ date: effectiveSelected })}
              />
            </EmptyState>
          ) : (
            <Card bezel innerClassName="px-2 py-1">
              {dayTxs.map((tx, index) => {
                const fulfilment = fulfilmentStates.get(tx.id);
                return (
                  <Pressable
                    key={tx.id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectMode
                        ? t("ledger.selectRow", { name: tx.categories.name })
                        : t("ledger.editRow", { name: tx.categories.name })
                    }
                    accessibilityState={
                      selectMode
                        ? { selected: selectedIds.has(tx.id) }
                        : undefined
                    }
                    // A hint rather than part of the label: the label is the
                    // action this row performs, and the row's standing is not
                    // part of the name of a button.
                    accessibilityHint={
                      fulfilment
                        ? t(FULFILMENT_STATE_KEY[fulfilment])
                        : undefined
                    }
                    onPress={() => {
                      void hapticLight();
                      if (selectMode) {
                        setSelected((current) =>
                          toggleSelected(current, tx.id),
                        );
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
                        label={t("ledger.selectRow", {
                          name: tx.categories.name,
                        })}
                        onPress={() =>
                          setSelected((current) =>
                            toggleSelected(current, tx.id),
                          )
                        }
                      />
                    ) : null}
                    <CategoryIcon icon={tx.categories.icon} />
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center gap-1.5">
                        {/* `shrink` because Yoga defaults flexShrink to 0 and
                          overflow to visible: without it a long name does not
                          clip, it draws over the amount. */}
                        <Text
                          numberOfLines={1}
                          className="shrink text-sm font-medium"
                        >
                          {tx.categories.name}
                        </Text>
                        <FulfilmentDot state={fulfilment} />
                      </View>
                      <Text
                        variant="muted"
                        numberOfLines={1}
                        className="mt-0.5 text-xs"
                      >
                        {[
                          // Ahead of "recurring": this is the newer and more
                          // specific fact about the row, and it is the one the
                          // dot beside the name is pointing at.
                          fulfilment
                            ? t(FULFILMENT_STATE_KEY[fulfilment])
                            : null,
                          tx.recurring_template_id
                            ? t("calendarView.recurring")
                            : null,
                          tx.note,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                    </View>
                    <PrivateAmount
                      className={cn(
                        "font-sans tabular-nums text-sm font-semibold",
                        TYPE_AMOUNT_CLASS[tx.categories.type],
                      )}
                    >
                      {`${amountSign(tx.categories.type)}${formatEuro(Number(tx.amount))}`}
                    </PrivateAmount>
                  </Pressable>
                );
              })}
              {dayPlanned.map((occurrence, index) => (
                <Pressable
                  key={occurrence.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${occurrence.categoryName}, ${t(occurrence.awaited ? "ledger.awaited" : "ledger.planned")}`}
                  accessibilityHint={occurrence.name}
                  disabled={selectMode}
                  onPress={() => {
                    void hapticLight();
                    setOpenPlanned(occurrence);
                  }}
                  className={cn(
                    "flex-row items-start gap-3 px-2 py-3.5",
                    (dayTxs.length > 0 || index > 0) &&
                      "border-t border-border",
                  )}
                  style={selectMode ? { opacity: 0.4 } : undefined}
                >
                  <View style={{ opacity: 0.5 }}>
                    <CategoryIcon icon={occurrence.categoryIcon} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={1}
                      className="shrink text-sm font-medium text-muted-foreground"
                    >
                      {occurrence.categoryName}
                    </Text>
                    <Text
                      variant="muted"
                      numberOfLines={1}
                      className="mt-0.5 text-xs"
                    >
                      {[
                        t(
                          occurrence.awaited
                            ? "ledger.awaited"
                            : "ledger.planned",
                        ),
                        occurrence.note,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <PrivateAmount className="font-sans tabular-nums text-sm font-semibold text-muted-foreground">
                    {`${amountSign(occurrence.categoryType)}${formatEuro(occurrence.amount)}`}
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
        categories={categories}
        planMove={planMove}
        onMove={(categoryId) => void handleBulkMove(categoryId)}
      />

      <PlannedOccurrenceSheet
        occurrence={openPlanned}
        onClose={() => setOpenPlanned(null)}
      />

      {editing ? (
        <TransactionFormModal
          open
          onClose={() => setEditing(null)}
          categories={categories}
          transaction={editing}
        />
      ) : null}
    </Screen>
  );
}
