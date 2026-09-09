import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
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
import { buildStillToCome } from "@finance/core/still-to-come";
import {
  FULFILMENT_STATE_KEY,
  indexFulfilmentStates,
} from "@finance/core/fulfilment-state";
import type { FulfilmentProposal } from "@finance/core/recurring-fulfilment";
import {
  applyRecurringPlanCounts,
  type ApplyRecurringPlan,
} from "@finance/core/apply-recurring";
import {
  categoryTypeLabels,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import type {
  Category,
  CategoryType,
  Tag,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { MonthPicker } from "@/components/MonthPicker";
import { StaggerItem } from "@/components/motion/Stagger";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { FulfilmentDot } from "@/components/FulfilmentDot";
import { ApplyRecurringSheet } from "@/components/ApplyRecurringSheet";
import { BankInboxSheet } from "@/components/BankInboxSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { TransactionFormModal } from "@/components/TransactionFormModal";
import { RowCheckbox, SelectionBar } from "@/components/SelectionBar";
import {
  pruneSelection,
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
  moveTransactions,
  previewApplyRecurringForMonth,
  unskipRecurringOccurrence,
} from "@/lib/mutations";
import {
  getCategories,
  getConfirmedTransactionIds,
  getFulfilmentProposals,
  getPendingFeedItems,
  getRecurringTemplates,
  getSkippedOccurrences,
  getTags,
  getTransactions,
  type PendingFeedRow,
  type SkippedOccurrence,
} from "@/lib/queries";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { useTabBarClearance } from "@/theme/chrome";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

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
  const locale = useLocale();
  const t = useT();
  const tabBarClearance = useTabBarClearance();
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
  /*
   * `?review=inbox` is the address of the review, not of this screen.
   * Everything that says "you have entries to categorise" — the Needs you
   * block on Month, the statement card, a push tapped from the lock screen —
   * navigates here with it, and the sheet opens on arrival. Read once into
   * state rather than consulted every render, so closing the sheet closes it:
   * the param is still in the address until the next navigation.
   */
  const params = useLocalSearchParams<{ review?: string }>();
  const wantsInbox = params.review === "inbox";
  /*
   * Null until somebody says otherwise, then whatever they said. Derived
   * rather than seeded into state at mount, because at mount the inbox has
   * not loaded: opening on the param alone showed "Nothing waiting" for the
   * length of one round trip before the six entries arrived. This way the
   * sheet opens the moment there is something to open it onto, and a close
   * still means closed — the param stays in the address until the next
   * navigation, so consulting it every render would reopen the sheet.
   */
  const [inboxChoice, setInboxChoice] = useState<boolean | null>(null);
  const dataVersion = useDataVersion();
  const [selectMode, setSelectMode] = useState(false);
  const [storedSelection, setSelected] =
    useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const [deletePending, setDeletePending] = useState(false);
  const { data, loading, refreshing, onRefresh, onRefreshAll, reload, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          transactions: [] as TransactionWithCategory[],
          categories: [] as Category[],
          skipped: [] as SkippedOccurrence[],
          tags: [] as Tag[],
          templates: [] as RecurringTemplateWithCategory[],
          inbox: [] as PendingFeedRow[],
          confirmed: new Set<string>(),
          proposals: [] as FulfilmentProposal[],
        };
      }
      const [
        transactions,
        categories,
        skipped,
        tags,
        templates,
        inbox,
        confirmed,
      ] = await Promise.all([
        getTransactions(user.id, year, month),
        getCategories(user.id),
        getSkippedOccurrences(user.id, year, month),
        getTags(user.id),
        // For "left at month end": what the rest of the month still owes.
        getRecurringTemplates(user.id),
        // Not scoped to the month on screen. The inbox is a queue of
        // decisions, not a view of a month: a coffee from the 29th of last
        // month needs a category whichever month you happen to be reading.
        getPendingFeedItems(user.id),
        // Which rows settle a charge. Needs nothing else the batch fetches,
        // so it rides along rather than costing a second hop.
        getConfirmedTransactionIds(user.id),
      ]);
      // Asked after the batch, because it needs the templates and categories
      // the batch fetched. Only the proposals: an absence is a question for
      // the Month screen, which has room to explain it.
      const proposals = await getFulfilmentProposals(
        user.id,
        templates,
        categories,
        year,
        month,
      );
      return {
        transactions,
        categories,
        skipped,
        tags,
        templates,
        inbox,
        confirmed,
        proposals,
      };
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

  /**
   * What each row can say about itself, by transaction id.
   *
   * Absent from the map is the ordinary case — a movement no template is
   * involved with — and the dot renders nothing for it.
   */
  const fulfilmentStates = useMemo(
    () =>
      indexFulfilmentStates(
        (data?.proposals ?? []).map((proposal) => proposal.transactionId),
        data?.confirmed ?? EMPTY_SELECTION,
      ),
    [data?.proposals, data?.confirmed],
  );
  const inbox = useMemo(() => data?.inbox ?? [], [data?.inbox]);
  const inboxOpen = inboxChoice ?? (wantsInbox && inbox.length > 0);

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

  // What the month ends at, which is a fact about the whole month and does
  // not move with the filters beside it — hence its own label rather than a
  // third figure in the In / Out pair.
  const monthEnd = useMemo(() => {
    const all = computeTypeTotals(transactions);
    const upcoming = buildStillToCome(
      transactions,
      data?.templates ?? [],
      year,
      month,
      todayIsoLocal(),
      new Set(
        (data?.skipped ?? []).map(
          (entry) => `${entry.templateId}:${entry.occurredOn}`,
        ),
      ),
    );
    return (
      all.income +
      upcoming.arriving -
      (all.expense + all.savings + all.investment + upcoming.budgetedOutflow)
    );
  }, [transactions, data?.templates, data?.skipped, year, month]);

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
    toast(t("ledger.deleted", { count: result.deleted ?? 0 }), "success");
    leaveSelectMode();
    void onRefresh();
  }

  function planMove(categoryId: string) {
    const target = categories.find((category) => category.id === categoryId);
    // The whole list, not the visible one: whether a merchant keeps being
    // filed the old way turns on rows this screen may not be showing.
    return target
      ? planSelectionMove(transactions, selected, {
          id: target.id,
          type: target.type,
        })
      : null;
  }

  async function handleBulkMove(categoryId: string) {
    setDeletePending(true);
    const result = await moveTransactions([...selected], categoryId);
    setDeletePending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    void hapticSuccess();
    notifyDataChanged();
    const name =
      categories.find((category) => category.id === categoryId)?.name ??
      "the new category";
    toast(t("ledger.moved", { count: result.moved ?? 0, name }), "success");
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
      toast(t("ledger.applyAllDone"));
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
    <Screen title={t("nav.ledger")}>
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
            label={pending ? "…" : t("ledger.applyRecurring")}
            variant={applyPending ? "default" : "outline"}
            size="sm"
            disabled={pending}
            onPress={handleApplyRecurring}
          />
          {applyPending && !pending ? (
            <View
              accessibilityRole="alert"
              accessibilityLabel={t("ledger.applyWaiting")}
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive"
            />
          ) : null}
        </View>
        <Button
          label={t("ledger.add")}
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
              label={
                allState === "all"
                  ? t("ledger.clearAll")
                  : t("ledger.selectAll")
              }
              variant="ghost"
              size="sm"
              onPress={() =>
                setSelected((current) => toggleSelectAll(visibleIds, current))
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
          <>
            <Button
              label={t("ledger.select")}
              variant="ghost"
              size="sm"
              icon="checkbox-outline"
              onPress={() => setSelectMode(true)}
            />
            <Button
              label={t("ledger.importCsvShort")}
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
          size={ICON.md}
          color={colors.mutedForeground}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("ledger.searchPlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={t("ledger.searchLabel")}
          returnKeyType="search"
          className="h-11 flex-1 font-sans text-sm text-foreground"
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("ledger.clearSearch")}
            onPress={() => setSearch("")}
          >
            <Ionicons
              name="close-circle"
              size={ICON.md}
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
                value === "all"
                  ? t("ledger.allTypes")
                  : categoryTypeLabels(locale)[value]
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
                {value === "all" ? "All" : categoryTypeLabels()[value]}
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
            {[
              { id: "all", name: t("ledger.allCategories") },
              ...usedCategories,
            ].map((option) => {
              const selected = categoryFilter === option.id;
              return (
                <Pressable
                  hitSlop={8}
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
            })}
          </ScrollView>
        </View>
      ) : null}

      {skipped.length > 0 ? (
        <Card bezel className="mb-4" innerClassName="gap-2 p-5">
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
                label={t("ledger.restore")}
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
            ? t("ledger.entryCount", { count: transactions.length })
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

      {/* The one row on this screen that wants a decision, and the phone's
          counterpart to the web inbox bar. Rimmed and dotted like the Needs
          you block on Month, because it is the same errand seen from its
          other end — and without it the only way to the review was a link
          from another screen. */}
      {inbox.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ledger.needsCategoryAction", {
            count: inbox.length,
          })}
          onPress={() => {
            void hapticLight();
            setInboxChoice(true);
          }}
          className="mb-3 min-h-14 flex-row items-center gap-2.5 rounded-2xl border bg-primary/5 px-4 py-3"
          style={{ borderColor: colors.primaryRim }}
        >
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
          <Text className="min-w-0 flex-1 text-sm">
            {t("ledger.needsCategory", { count: inbox.length })}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-medium text-primary-ink">
              {t("ledger.review")}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={ICON.sm}
              color={colors.primaryInk}
            />
          </View>
        </Pressable>
      ) : null}

      <View className="mb-2 flex-row items-baseline justify-between gap-3">
        <Text variant="muted" className="text-sm">
          Left at month end
        </Text>
        <PrivateAmount
          className={cn("text-sm", monthEnd < 0 && "text-destructive")}
        >
          {formatEuro(monthEnd)}
        </PrivateAmount>
      </View>

      {loading && !data ? (
        <ScreenSkeleton rows={5} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : (
        <View className="flex-1 rounded-shell border border-border bg-foreground/[0.04] p-1.5">
          <View className="flex-1 rounded-card bg-card">
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
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefreshAll}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  title={t("ledger.fillThisMonth")}
                  description={t("ledger.emptyBody")}
                >
                  <Button
                    label={t("ledger.addTransaction")}
                    variant="pill"
                    icon="add"
                    onPress={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  />
                </EmptyState>
              }
              contentContainerClassName="px-3 py-1"
              contentContainerStyle={{ paddingBottom: tabBarClearance }}
              ListFooterComponent={
                filtered.length > 0 ? (
                  <Text variant="muted" className="py-3 text-center text-xs">
                    {selectMode ? t("ledger.selectHint") : t("ledger.editHint")}
                  </Text>
                ) : null
              }
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
              SectionSeparatorComponent={null}
              renderItem={({ item, index }) => {
                const fulfilment = fulfilmentStates.get(item.id);
                // The state leads the subtitle, ahead of the note, using the
                // same " · " join the Calendar row already uses. The colour is
                // the glance; this is what makes it mean something.
                const subtitle = [
                  fulfilment ? t(FULFILMENT_STATE_KEY[fulfilment]) : null,
                  item.note,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
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
                      // A hint rather than part of the label: the label is the
                      // action this row performs, and the row's standing is not
                      // part of the name of a button.
                      accessibilityHint={
                        fulfilment
                          ? t(FULFILMENT_STATE_KEY[fulfilment])
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
                        <View className="flex-row items-center gap-1.5">
                          {/* `shrink` because Yoga defaults flexShrink to 0 and
                            overflow to visible: without it a long name does
                            not clip, it draws over the amount. */}
                          <Text
                            numberOfLines={1}
                            className="shrink text-sm font-medium"
                          >
                            {item.categories.name}
                          </Text>
                          <FulfilmentDot state={fulfilment} />
                        </View>
                        {subtitle ? (
                          <Text
                            variant="muted"
                            numberOfLines={1}
                            className="text-xs"
                          >
                            {subtitle}
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
                );
              }}
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
        title={t("ledger.repeatTitle")}
        message={
          duplicating
            ? t("ledger.repeatBody", {
                category: duplicating.categories.name,
                amount: formatEuro(Number(duplicating.amount)),
              })
            : undefined
        }
        confirmLabel={t("ledger.repeatConfirm")}
        destructive={false}
        onConfirm={handleDuplicate}
        onCancel={() => setDuplicating(null)}
      />

      <SelectionBar
        summary={selectionSummary}
        pending={deletePending}
        onCancel={leaveSelectMode}
        onDelete={() => void handleBulkDelete()}
        categories={categories}
        planMove={planMove}
        onMove={(categoryId) => void handleBulkMove(categoryId)}
      />

      <BankInboxSheet
        open={inboxOpen}
        onOpenChange={setInboxChoice}
        items={inbox}
        categories={categories}
        recentCategoryIds={recentCategoryIds}
        onDecided={() => {
          // Every surface, not just this one: a categorised entry moves the
          // month's totals, the statement card and the tab bar's dot.
          notifyDataChanged();
          void reload();
        }}
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
