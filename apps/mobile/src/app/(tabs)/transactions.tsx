import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  SectionList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native";

import {
  formatShortDate,
  parseMonthParams,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import { leftAtMonthEnd } from "@finance/core/month-balance";
import { buildStillToCome } from "@finance/core/still-to-come";
import {
  FULFILMENT_STATE_KEY,
  indexFulfilmentStates,
} from "@finance/core/fulfilment-state";
import type { FulfilmentProposal } from "@finance/core/recurring-fulfilment";
import {
  plannedOccurrences,
  recurringOccurrenceKey,
  type PlannedOccurrence,
} from "@finance/core/apply-recurring";
import { amountSign } from "@finance/core/amount-sign";
import {
  categoryTypeLabels,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { MonthPicker } from "@/components/MonthPicker";
import { StaggerItem } from "@/components/motion/Stagger";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { FulfilmentDot } from "@/components/FulfilmentDot";
import { BankInboxSheet } from "@/components/BankInboxSheet";
import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { useBankState } from "@/hooks/useBankState";
import { PlannedOccurrenceSheet } from "@/components/PlannedOccurrenceSheet";
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
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useQuickAdd } from "@/providers/QuickAddProvider";
import { useScreenMonth } from "@/providers/MonthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import {
  createTransaction,
  deleteTransactions,
  moveTransactions,
  unskipRecurringOccurrence,
} from "@/lib/mutations";
import {
  getCategories,
  getConfirmedTransactionIds,
  getFulfilledKeys,
  getFulfilmentProposals,
  getPendingFeedItems,
  getRecurringTemplates,
  getSkippedOccurrences,
  getTransactions,
  type PendingFeedRow,
  type SkippedOccurrence,
} from "@/lib/queries";
import { cn } from "@/lib/cn";
import { useDeletedToast } from "@/hooks/useDeletedToast";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { useTabBarClearance } from "@/theme/chrome";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";
import { bringsMoneyIn, isMovedRow } from "@finance/core/cash-date";

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

/**
 * One row of the day list: a transaction, or a charge's occurrence still to
 * come. Planned rows are drawn from the templates rather than stored, so they
 * are carried alongside the transactions instead of pretending to be one.
 */
type LedgerItem =
  | { kind: "tx"; tx: TransactionWithCategory }
  | { kind: "planned"; occurrence: PlannedOccurrence };

export default function TransactionsScreen() {
  const locale = useLocale();
  const t = useT();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const toastDeleted = useDeletedToast();
  const colors = useThemeColors();
  // Shared with the calendar and Le point, so switching view keeps the month.
  const { year, month, setMonth } = useScreenMonth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  const [duplicating, setDuplicating] =
    useState<TransactionWithCategory | null>(null);
  const [openPlanned, setOpenPlanned] = useState<PlannedOccurrence | null>(
    null,
  );
  const quickAdd = useQuickAdd();

  const router = useRouter();
  /*
   * `?review=inbox` is the address of the review, not of this screen.
   * Everything that says "you have entries to categorise" — the Needs you
   * block on Month, the statement card, a push tapped from the lock screen —
   * navigates here with it, and the sheet opens on arrival. Read once into
   * state rather than consulted every render, so closing the sheet closes it:
   * the param is still in the address until the next navigation.
   */
  const params = useLocalSearchParams<{ review?: string; at?: string }>();
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
  /*
   * Every way in stamps its ask with `at` — a tapped notification, the
   * Bearing's row, the end of a bank import — and a new stamp is a new
   * question. Without it, a review closed once stayed closed: the Journal is
   * a tab, it stays mounted, and the second "6 entries need a category"
   * landed on the same address the first had, onto an answer of "closed".
   */
  const [askedAt, setAskedAt] = useState(params.at);
  if (askedAt !== params.at) {
    setAskedAt(params.at);
    setInboxChoice(null);
  }
  const [selectMode, setSelectMode] = useState(false);
  const [storedSelection, setSelected] =
    useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const [deletePending, setDeletePending] = useState(false);
  const { data, loading, refreshing, onRefreshAll, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          transactions: [] as TransactionWithCategory[],
          categories: [] as Category[],
          skipped: [] as SkippedOccurrence[],
          templates: [] as RecurringTemplateWithCategory[],
          inbox: [] as PendingFeedRow[],
          confirmed: new Set<string>(),
          fulfilled: new Set<string>(),
          proposals: [] as FulfilmentProposal[],
        };
      }
      const [
        transactions,
        categories,
        skipped,
        templates,
        inbox,
        confirmed,
        fulfilled,
      ] = await Promise.all([
        getTransactions(user.id, year, month),
        getCategories(user.id),
        getSkippedOccurrences(user.id, year, month),
        // For "left at month end": what the rest of the month still owes.
        getRecurringTemplates(user.id),
        // Not scoped to the month on screen. The inbox is a queue of
        // decisions, not a view of a month: a coffee from the 29th of last
        // month needs a category whichever month you happen to be reading.
        getPendingFeedItems(user.id, locale),
        // Which rows settle a charge. Needs nothing else the batch fetches,
        // so it rides along rather than costing a second hop.
        getConfirmedTransactionIds(user.id),
        // Occurrences another row already stands for, which are therefore
        // not planned: the salary the bank delivered is not still to come.
        getFulfilledKeys(user.id),
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
        templates,
        inbox,
        confirmed,
        fulfilled,
        proposals,
      };
    }, [user?.id, year, month], {
      reads: ["transactions", "templates", "categories", "bank"],
    });

  // Memoised because every derived memo below depends on it; a fresh array
  // each render would recompute the whole screen's derivations.
  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions],
  );
  const categories = data?.categories ?? [];

  const skipped = data?.skipped ?? [];

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
  // Without a feed, the place the inbox bar would take invites one instead:
  // this screen is where typing every line in is felt most.
  const { bank } = useBankState();
  const inboxOpen = inboxChoice ?? (wantsInbox && inbox.length > 0);

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

  /**
   * What the month's charges still have to bring, drawn from the templates.
   *
   * Every occurrence dated after today that is not written, skipped or
   * fulfilled by another row. Nothing here is stored, which is why a future
   * month shows its charges and why editing a charge changes all of them at
   * once. Each becomes a transaction on its day.
   */
  const planned = useMemo(() => {
    if (!data) {
      return [];
    }
    const written = new Set(
      transactions.flatMap((tx) =>
        tx.recurring_template_id
          ? [recurringOccurrenceKey(tx.recurring_template_id, tx.occurred_on)]
          : [],
      ),
    );
    const notPlanned = new Set([
      ...data.skipped.map((entry) =>
        recurringOccurrenceKey(entry.templateId, entry.occurredOn),
      ),
      ...data.fulfilled,
    ]);
    return plannedOccurrences(
      data.templates,
      written,
      year,
      month,
      notPlanned,
      todayIsoLocal(),
    );
  }, [data, transactions, year, month]);

  const usedCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tx of transactions) {
      if (!seen.has(tx.category_id)) {
        seen.set(tx.category_id, tx.categories.name);
      }
    }
    // A future month has only planned rows, and filtering them by category
    // should work the same as filtering the rows that have happened.
    for (const occurrence of planned) {
      if (!seen.has(occurrence.categoryId)) {
        seen.set(occurrence.categoryId, occurrence.categoryName);
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions, planned]);

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

  // The same filters over the planned rows, so choosing "Expense" or a
  // category narrows what is to come as well as what has happened.
  const filteredPlanned = useMemo(() => {
    const query = search.trim().toLowerCase();
    return planned.filter((occurrence) => {
      if (filter !== "all" && occurrence.categoryType !== filter) {
        return false;
      }
      if (
        categoryFilter !== "all" &&
        occurrence.categoryId !== categoryFilter
      ) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        occurrence.categoryName.toLowerCase().includes(query) ||
        occurrence.name.toLowerCase().includes(query) ||
        (occurrence.note ?? "").toLowerCase().includes(query)
      );
    });
  }, [planned, filter, categoryFilter, search]);
  // The figures describe what is on screen, which is the whole reason they
  // are here: the month's own totals are Month's job, and repeating them
  // under a filter would state something the list below contradicts.
  const shown = useMemo(() => computeTypeTotals(filtered), [filtered]);
  const shownOut = shown.expense + shown.savings + shown.investment;

  // What the month ends at, which is a fact about the whole month and does
  // not move with the filters beside it — hence its own label rather than a
  // third figure in the In / Out pair. By the account's own rule: a purchase
  // inside a wallet moves nothing (the transfer that paid for it did), and a
  // savings withdrawal comes back.
  const monthEnd = useMemo(() => {
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
      // Settled by a bank movement already, so not still to come: without
      // this a salary the bank had paid counted twice in the month's end.
      data?.fulfilled,
    );
    return leftAtMonthEnd(transactions, upcoming);
  }, [
    transactions,
    data?.templates,
    data?.skipped,
    data?.fulfilled,
    year,
    month,
  ]);

  // A ledger is read a day at a time, not as one unbroken column. Grouping
  // here keeps a heading and its rows in the same object, so the list can
  // never draw a date with nothing under it.
  //
  // Planned rows go into the same days, newest first like the rest. A day's
  // net counts only what has happened, and a day with nothing but planned
  // rows has no net at all — a figure there would be a forecast set in the
  // same type as the record.
  const days = useMemo(() => {
    const items: { date: string; item: LedgerItem }[] = [
      ...filtered.map((tx) => ({
        date: tx.occurred_on,
        item: { kind: "tx" as const, tx },
      })),
      ...filteredPlanned.map((occurrence) => ({
        date: occurrence.occurredOn,
        item: { kind: "planned" as const, occurrence },
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const out: {
      date: string;
      net: number;
      recorded: number;
      data: LedgerItem[];
    }[] = [];

    for (const { date, item } of items) {
      let signed = 0;
      if (item.kind === "tx") {
        const amount = Number(item.tx.amount);
        signed = item.tx.categories.type === "income" ? amount : -amount;
      }
      const last = out[out.length - 1];

      if (last && last.date === date) {
        last.data.push(item);
        last.net += signed;
        last.recorded += item.kind === "tx" ? 1 : 0;
      } else {
        out.push({
          date,
          net: signed,
          recorded: item.kind === "tx" ? 1 : 0,
          data: [item],
        });
      }
    }

    return out;
  }, [filtered, filteredPlanned]);

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
    const name =
      categories.find((category) => category.id === categoryId)?.name ??
      t("ledger.theNewCategory");
    toast(t("ledger.moved", { count: result.moved ?? 0, name }), "success");
    leaveSelectMode();
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
    toast(
      t("ledger.addedForToday", { name: source.categories.name }),
      "success",
    );
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
    // Written straight back by the restore itself, so every screen moves.
    toast(
      t("ledger.restored", { name: entry.name || t("ledger.recurringEntry") }),
      "success",
    );
  }

  // Today while reading this month; the month's first day while reading
  // another, so an entry added from there lands in the month on screen.
  function openAdd() {
    const current = parseMonthParams();
    quickAdd?.open({
      date:
        current.year === year && current.month === month
          ? undefined
          : `${year}-${String(month).padStart(2, "0")}-01`,
    });
  }

  function clearFilters() {
    setFilter("all");
    setCategoryFilter("all");
    setSearch("");
  }

  const typeOptions = useMemo(() => {
    const labels = categoryTypeLabels(locale);
    return FILTERS.map((value) => ({
      value,
      label: value === "all" ? t("ledger.allTypes") : labels[value],
    }));
  }, [locale, t]);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: t("ledger.allCategories") },
      ...usedCategories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [usedCategories, t],
  );

  // The category is the one filter tucked behind the button, so it is the
  // one the button has to own up to.
  const hiddenFilters = categoryFilter === "all" ? 0 : 1;
  const nothingAtAll = transactions.length === 0 && planned.length === 0;

  /*
   * Everything above the first day scrolls with the list rather than staying
   * pinned over it. Pinned, the tabs, the month, the search, three rows of
   * filters and two lines of figures took half the screen before a single
   * entry — the web's phone layout had already cut the same stack down to
   * this, in this order.
   */
  const header = (
    <View className="pb-1">
      <SurfaceTabs tabs={LEDGER_TABS} className="mb-3" />

      {/* Under the tabs, not above them: the By category view has no month,
          and a month bar above the tabs would make them jump when switching
          views. Prominent, because the month is what everything below is
          about. No Add beside it: the "+" in the tab bar opens the same
          sheet, on this month. */}
      <MonthPicker prominent year={year} month={month} onChange={setMonth} />

      {/* The one row on this screen that wants a decision, and the phone's
          counterpart to the web inbox bar. Rimmed and dotted like the Needs
          you block on Month, because it is the same errand seen from its
          other end — and without it the only way to the review was a link
          from another screen. Above the search, where the web puts its bank
          strip: it is about the month, not about the filters. */}
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
          className="mt-3 min-h-14 flex-row items-center gap-2.5 rounded-control border bg-primary/5 px-4 py-3"
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
      ) : (
        <ConnectBankInvite surface="ledger" bank={bank} className="mt-3" />
      )}

      {nothingAtAll ? null : (
        <>
          <View className="mt-3 flex-row items-center gap-2">
            <View className="h-11 min-w-0 flex-1 flex-row items-center gap-2 rounded-full border border-border bg-background px-3.5">
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
                  hitSlop={8}
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

            {/* One button for everything that is not the search or the type
                chips: the category, selection and import. They were three
                rows of their own above the first entry. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ledger.optionsToggle")}
              accessibilityHint={
                hiddenFilters > 0
                  ? t("ledger.filtersOn", { count: hiddenFilters })
                  : undefined
              }
              accessibilityState={{ expanded: optionsOpen }}
              onPress={() => {
                void hapticLight();
                setOptionsOpen((open) => !open);
              }}
              className={cn(
                "h-11 w-11 items-center justify-center rounded-full border",
                optionsOpen || hiddenFilters > 0
                  ? "border-foreground"
                  : "border-border",
              )}
            >
              <Ionicons
                name="options-outline"
                size={ICON.md}
                color={
                  optionsOpen || hiddenFilters > 0
                    ? colors.foreground
                    : colors.mutedForeground
                }
              />
              {hiddenFilters > 0 ? (
                <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1">
                  <Text variant="micro" className="text-background">
                    {String(hiddenFilters)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View className="mt-2 flex-row items-center gap-1">
            <View className="min-w-0 flex-1">
              <ChipRow
                label={t("ledger.filterTransactions")}
                options={typeOptions}
                value={filter}
                onChange={setFilter}
              />
            </View>
            {/* In selection mode Done and Select all stay here, where the
                thumb already is. */}
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
            ) : null}
          </View>

          {optionsOpen ? (
            <View className="mt-3 gap-3 rounded-card border border-border p-3">
              {usedCategories.length > 1 ? (
                <ChipRow
                  label={t("ledger.filterByCategory")}
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
              ) : null}
              <View className="flex-row flex-wrap gap-2">
                {selectMode ? null : (
                  <Button
                    label={t("ledger.select")}
                    variant="outline"
                    size="sm"
                    icon="checkbox-outline"
                    onPress={() => {
                      setSelectMode(true);
                      setOptionsOpen(false);
                    }}
                  />
                )}
                <Button
                  label={t("ledger.importCsvShort")}
                  variant="outline"
                  size="sm"
                  icon="document-outline"
                  onPress={() => router.push("/import" as Href)}
                />
              </View>
            </View>
          ) : null}

          {skipped.length > 0 ? (
            <SkippedLine
              skipped={skipped}
              onRestore={(entry) => void handleRestore(entry)}
            />
          ) : null}

          {/* The figures describe what is on screen; the month's end is a
              fact about the whole month and does not move with the filters,
              hence the rule before it. The count only earns its line when a
              filter is hiding something. */}
          <View className="mt-3 border-t border-border pt-3">
            {filtered.length !== transactions.length ? (
              <Text variant="muted" className="mb-2 text-xs">
                {t("ledger.shownOfTotal", {
                  count: filtered.length,
                  total: transactions.length,
                })}
              </Text>
            ) : null}
            <View className="flex-row items-stretch gap-3">
              <SummaryFigure
                label={t("ledger.in")}
                value={formatEuro(shown.income)}
                className="text-success"
              />
              <SummaryFigure
                label={t("ledger.out")}
                value={formatEuro(shownOut)}
                className="text-destructive"
              />
              <View className="w-px bg-border" />
              <SummaryFigure
                label={t("ledger.leftAtMonthEnd")}
                value={formatEuro(monthEnd)}
                className={monthEnd < 0 ? "text-destructive" : undefined}
                wide
              />
            </View>
          </View>
        </>
      )}
    </View>
  );

  return (
    <Screen title={t("nav.ledger")} className="pb-0">
      {/* No card around the list, as on the web's phone layout: the days run
          the full width and start right under the figures. */}
      <SectionList
        sections={loading && !data ? [] : days}
        keyExtractor={(item) =>
          item.kind === "tx" ? item.tx.id : `planned:${item.occurrence.key}`
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-baseline justify-between gap-3 pb-1 pt-5">
            <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {relativeDayLabel(section.date, formatShortDate, locale)}
            </Text>
            {section.recorded > 0 ? (
              <PrivateAmount className="text-xs text-muted-foreground">
                {`${section.net >= 0 ? "+" : "−"}${formatEuro(Math.abs(section.net))}`}
              </PrivateAmount>
            ) : null}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
        }
        ListEmptyComponent={
          loading && !data ? (
            <View className="pt-4">
              <ScreenSkeleton rows={5} />
            </View>
          ) : error ? (
            <Text className="pt-4 text-destructive">
              {resolveMessage(t, error)}
            </Text>
          ) : nothingAtAll ? (
            <EmptyState
              title={t("ledger.fillThisMonth")}
              description={t("ledger.emptyBody")}
              className="mt-4"
            >
              <Button
                label={t("ledger.addTransaction")}
                variant="pill"
                icon="add"
                onPress={openAdd}
              />
            </EmptyState>
          ) : (
            <EmptyState
              title={t("ledger.noMatchTitle")}
              description={t("ledger.noMatchBody")}
              className="mt-4"
            >
              <Button
                label={t("ledger.clearFilters")}
                variant="outline"
                size="sm"
                onPress={clearFilters}
              />
            </EmptyState>
          )
        }
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text variant="muted" className="py-4 text-center text-xs">
              {selectMode ? t("ledger.selectHint") : t("ledger.editHint")}
            </Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        SectionSeparatorComponent={null}
        renderItem={({ item: row, index }) => {
          if (row.kind === "planned") {
            const occurrence = row.occurrence;
            return (
              <StaggerItem index={index}>
                {/* Muted, and the word says why: the dimming alone does not
                    tell a reader which of the row's meanings it carries. Not
                    selectable — there is nothing stored to delete or move. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${occurrence.categoryName}, ${t("ledger.planned")}`}
                  accessibilityHint={occurrence.name}
                  disabled={selectMode}
                  className="min-h-14 flex-row items-center gap-3 py-3"
                  style={selectMode ? { opacity: 0.4 } : undefined}
                  onPress={() => {
                    void hapticLight();
                    setOpenPlanned(occurrence);
                  }}
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
                    <Text variant="muted" numberOfLines={1} className="text-xs">
                      {[t("ledger.planned"), occurrence.note]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <PrivateAmount className="text-sm font-semibold text-muted-foreground">
                    {`${amountSign(occurrence.categoryType)}${formatEuro(occurrence.amount)}`}
                  </PrivateAmount>
                </Pressable>
              </StaggerItem>
            );
          }

          const item = row.tx;
          const fulfilment = fulfilmentStates.get(item.id);
          // The state leads the subtitle, ahead of the note, using the same
          // " · " join the Calendar row already uses. The colour is the
          // glance; this is what makes it mean something.
          const subtitle = [
            fulfilment ? t(FULFILMENT_STATE_KEY[fulfilment]) : null,
            // An income counted for this month whose money came in the last
            // one says when it arrived: the date above it is the day it counts.
            isMovedRow(item)
              ? t(
                  bringsMoneyIn(item.categories)
                    ? "ledger.receivedOn"
                    : "ledger.paidOn",
                  { date: formatShortDate(item.cash_on!, locale) },
                )
              : null,
            item.note,
          ]
            .filter(Boolean)
            .join(" · ");
          const rowName = { name: item.categories.name };
          return (
            <StaggerItem index={index}>
              {/* Whole row opens the edit sheet; delete lives inside it, as
                  on web. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  selectMode
                    ? t("ledger.selectRow", rowName)
                    : t("ledger.editRow", rowName)
                }
                accessibilityState={
                  selectMode ? { selected: selected.has(item.id) } : undefined
                }
                // A hint rather than part of the label: the label is the
                // action this row performs, and the row's standing is not
                // part of the name of a button.
                accessibilityHint={
                  fulfilment ? t(FULFILMENT_STATE_KEY[fulfilment]) : undefined
                }
                className={cn(
                  "min-h-14 flex-row items-center gap-3 py-3",
                  selectMode && selected.has(item.id) && "bg-primary/5",
                )}
                onPress={() => {
                  void hapticLight();
                  if (selectMode) {
                    setSelected((current) => toggleSelected(current, item.id));
                    return;
                  }
                  setEditing(item);
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
                    label={t("ledger.selectRow", rowName)}
                    onPress={() =>
                      setSelected((current) => toggleSelected(current, item.id))
                    }
                  />
                ) : null}
                <CategoryIcon icon={item.categories.icon} />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    {/* `shrink` because Yoga defaults flexShrink to 0 and
                        overflow to visible: without it a long name does not
                        clip, it draws over the amount. */}
                    <Text
                      numberOfLines={1}
                      className="shrink text-sm font-medium"
                    >
                      {item.categories.name}
                    </Text>
                    <FulfilmentDot state={fulfilment} />
                  </View>
                  {subtitle ? (
                    <Text variant="muted" numberOfLines={1} className="text-xs">
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {/* The colour says what kind of money this is; the sign says
                    which way it went — colour alone is not a channel. */}
                <PrivateAmount
                  className={cn(
                    "text-sm font-semibold",
                    TYPE_AMOUNT_CLASS[item.categories.type],
                  )}
                >
                  {`${amountSign(item.categories.type)}${formatEuro(Number(item.amount))}`}
                </PrivateAmount>
              </Pressable>
            </StaggerItem>
          );
        }}
      />

      {editing ? (
        <TransactionFormModal
          open
          onClose={() => setEditing(null)}
          categories={categories}
          transaction={editing}
          recentCategoryIds={recentCategoryIds}
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

      <PlannedOccurrenceSheet
        occurrence={openPlanned}
        onClose={() => setOpenPlanned(null)}
      />

      <BankInboxSheet
        open={inboxOpen}
        onOpenChange={setInboxChoice}
        items={inbox}
        categories={categories}
        recentCategoryIds={recentCategoryIds}
      />
    </Screen>
  );
}

/**
 * Charges taken out of this month, folded to one line until asked.
 *
 * It was a card of its own above the figures, open on every visit, for a
 * decision made once and rarely revisited.
 */
function SkippedLine({
  skipped,
  onRestore,
}: {
  skipped: SkippedOccurrence[];
  onRestore: (entry: SkippedOccurrence) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <View className="mt-3 rounded-control border border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void hapticLight();
          setOpen((value) => !value);
        }}
        className="min-h-11 flex-row items-center gap-2 px-3 py-2.5"
      >
        <Ionicons
          name="play-skip-forward-outline"
          size={ICON.sm}
          color={colors.mutedForeground}
        />
        <Text className="min-w-0 flex-1 text-sm text-muted-foreground">
          {t("ledger.skippedCount", { count: skipped.length })}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={ICON.sm}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <View className="gap-2 border-t border-border px-3 pb-3 pt-2.5">
          <Text variant="muted" className="text-xs">
            {t("ledger.skippedBody")}
          </Text>
          {skipped.map((entry) => (
            <View
              key={`${entry.templateId}:${entry.occurredOn}`}
              className="flex-row items-center justify-between gap-3"
            >
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm">
                  {entry.name || t("ledger.recurringEntry")}
                </Text>
                <Text variant="muted" className="text-xs">
                  {formatShortDate(entry.occurredOn, locale)}
                </Text>
              </View>
              <Button
                label={t("ledger.restore")}
                variant="outline"
                size="sm"
                onPress={() => onRestore(entry)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One of the three figures over the list: a small label, then the amount. */
function SummaryFigure({
  label,
  value,
  className,
  wide = false,
}: {
  label: string;
  value: string;
  className?: string;
  /** The month-end label is the long one; it gets the room. */
  wide?: boolean;
}) {
  return (
    <View className="min-w-0 gap-0.5" style={{ flex: wide ? 1.5 : 1 }}>
      <Text
        variant="muted"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        className="text-xs"
      >
        {label}
      </Text>
      <PrivateAmount
        numberOfLines={1}
        adjustsFontSizeToFit
        className={cn("text-sm font-semibold", className)}
      >
        {value}
      </PrivateAmount>
    </View>
  );
}
