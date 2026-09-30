import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  groupPendingFeed,
  type FeedGroup,
} from "@finance/core/bank-inbox-groups";
import type { BankMerchantIndex } from "@finance/core/bank-merchant";
import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import { formatShortDate } from "@finance/core/constants";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import {
  fileFeedGroup,
  leaveOutFeedGroup,
  reopenFeedGroup,
  type GroupDecision,
} from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { getBankMerchantIndex, type PendingFeedRow } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { useLocale, useT } from "@/providers/LocaleProvider";

interface BankInboxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PendingFeedRow[];
  categories: Category[];
  /** Most-recently-used category ids, newest first. */
  recentCategoryIds?: string[];
  /** Called once the sheet closes, so the screen reloads its figures. */
  onDecided: () => void;
}

/** One question: a shop's rows, or one row of a shop filed more than one way. */
type Card = FeedGroup<PendingFeedRow>;

/** What became of a card answered in this sitting, so it can be taken back. */
interface Answered {
  card: Card;
  outcome: string;
  /** The rows the decision took — what an undo puts back. */
  decidedIds: string[];
}

interface Session {
  /** Which queue this state belongs to, so a new inbox reads as fresh. */
  queueKey: string;
  waiting: Card[];
  answered: Answered[];
  /** Passed over for now. Still pending in the database, so still in the inbox. */
  later: Card[];
}

/**
 * A shop the user has filed more than one way is asked about row by row —
 * the web opens such a group with a picker per entry; here each entry is
 * simply a card of its own, which is the same question in the phone's shape.
 */
function cardsFrom(groups: readonly Card[]): Card[] {
  return groups.flatMap((group) =>
    group.mixed
      ? group.rows.map((row) => ({
          ...group,
          key: `${group.key}:${row.id}`,
          name: row.counterparty?.trim() || row.note,
          rows: [row],
          count: 1,
          total: row.amount,
          firstOn: row.occurredOn,
          lastOn: row.occurredOn,
          suggestedCategoryId: null,
        }))
      : [group],
  );
}

/**
 * The review inbox, one shop at a time.
 *
 * What the bank reported that the app would not file on its own. A first
 * import can leave hundreds of those, and one answer per row was the chore
 * the inbox exists to shrink — so rows are grouped by shop the way the web's
 * review groups them (`groupPendingFeed`), and one answer files every row of
 * a shop and teaches the matcher that shop once. The biggest groups come
 * first, so the first few answers clear most of the pile.
 *
 * Still one card at a time rather than the web's list. A phone is better at
 * "this one — which is it?" asked a few times than at a list of groups each
 * with its own picker, and the count in the corner is what makes it feel
 * finite. Deciding a group goes through the web server (`/api/bank/feed`),
 * so its duplicate check is the web's own.
 */
export function BankInboxSheet({
  open,
  onOpenChange,
  items,
  categories,
  recentCategoryIds = [],
  onDecided,
}: BankInboxSheetProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [showRows, setShowRows] = useState(false);
  /*
   * Keyed by card, like the web inbox's `choices`: a missing key is an empty
   * selection rather than a comparison that can reach into null, and a card
   * undone comes back with the category it was filed under already picked.
   */
  const [choices, setChoices] = useState<Record<string, string>>({});

  // The history the suggestions come from, read on each opening: filing is
  // what teaches it, so the last sitting's answers belong in this one's.
  const [merchants, setMerchants] = useState<BankMerchantIndex | null>(null);
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!open || !userId) {
      return;
    }
    let cancelled = false;
    void getBankMerchantIndex(userId).then((index) => {
      if (!cancelled) {
        setMerchants(index);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const cards = useMemo(
    () =>
      merchants
        ? cardsFrom(
            groupPendingFeed(items, { bankMerchants: merchants, categories }),
          )
        : null,
    [items, merchants, categories],
  );

  // Seeded from the props on first sight and owned locally after that, so
  // the count does not renumber under the user's thumb mid-sitting. The
  // reload happens once, on close.
  const queueKey = items.map((item) => item.id).join("|");
  const [stored, setStored] = useState<Session | null>(null);
  const session: Session | null =
    stored?.queueKey === queueKey
      ? stored
      : cards
        ? { queueKey, waiting: cards, answered: [], later: [] }
        : null;

  /*
   * Null while the history is loading, when the queue is empty, and at the
   * end of a sitting — every read of `current` below must cope with that.
   * The compiler will not insist: without `noUncheckedIndexedAccess`,
   * `waiting[0]` is typed as always present.
   */
  const current = session?.waiting[0] ?? null;
  const remainingEntries = (session?.waiting ?? []).reduce(
    (sum, card) => sum + card.count,
    0,
  );

  const selected = current
    ? (choices[current.key] ?? current.suggestedCategoryId ?? "")
    : "";

  // Filtered before grouping, so empty groups disappear while searching.
  const visible = query.trim()
    ? categories.filter((category) =>
        category.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : categories;
  const categoryGroups = groupCategoriesByType(visible);

  // One tap instead of scrolling the grouped list, which is the common case:
  // the exceptions still land in the same handful of categories.
  const recent = recentCategoryIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is Category => category !== undefined)
    .slice(0, 4);

  function close() {
    onOpenChange(false);
    setQuery("");
    setShowRows(false);
    // Only when something actually happened: closing a sheet you opened by
    // accident should not cost the screen behind it a round trip.
    if (session && session.answered.length > 0) {
      onDecided();
    }
  }

  function pick(categoryId: string) {
    if (!current) {
      return;
    }
    void hapticLight();
    setChoices((previous) => ({ ...previous, [current.key]: categoryId }));
  }

  /** Records a decision locally once the write has stuck. */
  function settle(card: Card, outcome: string, decidedIds: string[]) {
    if (!session) {
      return;
    }
    setShowRows(false);
    setStored({
      queueKey,
      waiting: session.waiting.filter((other) => other.key !== card.key),
      answered: [{ card, outcome, decidedIds }, ...session.answered],
      later: session.later,
    });
  }

  function decide(
    card: Card,
    work: () => Promise<GroupDecision | { error: string }>,
    describe: (decision: GroupDecision) => string,
    good: boolean,
  ) {
    if (pending) {
      return;
    }
    setPending(true);

    void (async () => {
      const result = await work();
      setPending(false);

      if ("error" in result) {
        toast(result.error, "error");
        return;
      }

      void (good ? hapticSuccess() : hapticLight());
      settle(card, describe(result), result.decidedIds);
    })();
  }

  function file(card: Card) {
    if (!selected) {
      toast(t("inbox.pickCategoryFirst"), "error");
      return;
    }
    const categoryId = selected;
    const name =
      categories.find((category) => category.id === categoryId)?.name ?? "";
    decide(
      card,
      () =>
        fileFeedGroup(
          card.rows.map((row) => row.id),
          categoryId,
        ),
      (decision) =>
        [
          decision.imported > 0
            ? t("inboxGroups.filed", {
                count: decision.imported,
                category: name,
              })
            : null,
          decision.matched > 0
            ? t("inboxGroups.alreadyRecorded", { count: decision.matched })
            : null,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ") || t("inbox.done"),
      true,
    );
  }

  function leaveOut(card: Card) {
    decide(
      card,
      () => leaveOutFeedGroup(card.rows.map((row) => row.id)),
      (decision) => t("inboxGroups.leftOut", { count: decision.ignored }),
      false,
    );
  }

  function undo(answered: Answered) {
    if (pending || !session) {
      return;
    }
    setPending(true);

    void (async () => {
      const result =
        answered.decidedIds.length > 0
          ? await reopenFeedGroup(answered.decidedIds)
          : { reopened: 0 };
      setPending(false);

      if ("error" in result) {
        toast(result.error, "error");
        return;
      }

      toast(
        t("inboxGroups.putBack", {
          count: result.reopened || answered.card.count,
        }),
        "success",
      );
      // Back onto the front of the queue rather than silently gone: undoing
      // means the question is open again, and the question is what this
      // sheet is for.
      setStored({
        queueKey,
        waiting: [answered.card, ...session.waiting],
        answered: session.answered.filter(
          (row) => row.card.key !== answered.card.key,
        ),
        later: session.later,
      });
    })();
  }

  function laterFor(card: Card) {
    if (!session) {
      return;
    }
    void hapticLight();
    setShowRows(false);
    setStored({
      queueKey,
      waiting: session.waiting.slice(1),
      answered: session.answered,
      later: [...session.later, card],
    });
  }

  function signed(card: Card, amount: number): string {
    return `${card.direction === "in" ? "+" : "−"}${formatEuro(amount)}`;
  }

  const header = (
    <View className="mb-4 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-semibold" style={{ fontSize: 18 }}>
          {t("inbox.fromYourBank")}
        </Text>
        {current ? (
          <Text variant="muted" className="text-xs tabular-nums">
            {`${t("inboxGroups.groups", {
              count: session?.waiting.length ?? 0,
            })} · ${t("inboxGroups.entries", { count: remainingEntries })}`}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t("inbox.close")}
        className="min-h-11 justify-center px-2"
      >
        <Text variant="muted">{t("inbox.close")}</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("inbox.close")}
          className="flex-1"
          onPress={close}
        />
        <View className="max-h-[88%] rounded-t-card p-card border border-border bg-card">
          <SheetGrabber />
          {header}

          {!session ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.mutedForeground} />
            </View>
          ) : current ? (
            <>
              {/* The bank's own words, in full: here the string *is* the
                  decision, and "PRELEVEMENT Navi…" answers nothing. */}
              <View className="gap-1.5 rounded-card p-card border border-primary-rim bg-primary/5">
                <Text className="text-base font-medium">{current.name}</Text>
                <PrivateAmount
                  style={TYPE.figure}
                  className={
                    current.direction === "in"
                      ? "text-success"
                      : "text-destructive"
                  }
                >
                  {signed(current, current.total)}
                </PrivateAmount>
                <Text variant="muted" className="text-xs">
                  {current.count > 1
                    ? `${t("inboxGroups.entries", { count: current.count })} · ${formatShortDate(current.firstOn, locale)} – ${formatShortDate(current.lastOn, locale)}`
                    : `${formatShortDate(current.firstOn, locale)} · ${current.rows[0]!.why}`}
                </Text>
                {current.mixed ? (
                  <Text variant="muted" className="text-xs">
                    {t("inboxGroups.mixed")}
                  </Text>
                ) : null}
                {current.count > 1 ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showRows }}
                      onPress={() => {
                        void hapticLight();
                        setShowRows((shown) => !shown);
                      }}
                      className="min-h-11 flex-row items-center gap-1 self-start"
                    >
                      <Text className="text-sm font-medium text-primary-ink">
                        {showRows
                          ? t("inboxGroups.hideRows")
                          : t("inboxGroups.showRows")}
                      </Text>
                      <Ionicons
                        name={showRows ? "chevron-up" : "chevron-down"}
                        size={ICON.sm}
                        color={colors.primaryInk}
                      />
                    </Pressable>
                    {showRows ? (
                      <ScrollView
                        className="max-h-40"
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                      >
                        {current.rows.map((row, index) => (
                          <View
                            key={row.id}
                            className={cn(
                              "flex-row items-center gap-3 py-2",
                              index > 0 && "border-t border-border",
                            )}
                          >
                            <Text
                              variant="muted"
                              className="w-20 text-xs tabular-nums"
                            >
                              {formatShortDate(row.occurredOn, locale)}
                            </Text>
                            <Text
                              numberOfLines={1}
                              className="min-w-0 flex-1 text-xs"
                            >
                              {row.note}
                            </Text>
                            <PrivateAmount className="text-xs tabular-nums">
                              {signed(current, row.amount)}
                            </PrivateAmount>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}
                  </>
                ) : null}
              </View>

              <Text className="mb-2 mt-4 text-sm font-medium">
                {t("inboxGroups.whichCategory")}
              </Text>

              <ScrollView
                className="max-h-64"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {categories.length > 8 ? (
                  <View className="mb-3 flex-row items-center gap-2 rounded-full border border-border bg-background px-3">
                    <Ionicons
                      name="search-outline"
                      size={ICON.md}
                      color={colors.mutedForeground}
                    />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder={t("inbox.filterCategoriesPlaceholder")}
                      placeholderTextColor={colors.mutedForeground}
                      accessibilityLabel={t("inbox.filterCategories")}
                      className="h-10 flex-1 font-sans text-sm text-foreground"
                    />
                  </View>
                ) : null}

                {recent.length > 0 && !query.trim() ? (
                  <View className="mb-3">
                    <Text variant="muted" className="mb-2 text-xs">
                      {t("inboxGroups.recentCategories")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {recent.map((category) => {
                        const active = selected === category.id;
                        return (
                          <Pressable
                            key={category.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={category.name}
                            onPress={() => pick(category.id)}
                            className={cn(
                              "min-h-11 flex-row items-center gap-2 rounded-full border px-3 py-2",
                              active
                                ? "border-primary bg-primary/15"
                                : "border-border bg-background",
                            )}
                          >
                            <CategoryIcon
                              icon={category.icon}
                              className="h-6 w-6"
                            />
                            <Text className="text-sm">{category.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View className="gap-3">
                  {categoryGroups.map((group) => (
                    <View key={group.type} className="gap-1.5">
                      <Text variant="muted" className="text-xs">
                        {group.label}
                      </Text>
                      {group.categories.map((category) => {
                        const active = selected === category.id;
                        return (
                          <Pressable
                            key={category.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={category.name}
                            onPress={() => pick(category.id)}
                            className={cn(
                              "min-h-11 flex-row items-center gap-3 rounded-control border px-3 py-2",
                              active
                                ? "border-primary bg-primary/15"
                                : "border-border bg-background",
                            )}
                          >
                            <CategoryIcon icon={category.icon} />
                            <Text className="flex-1 text-sm">
                              {formatCategoryOptionLabel(category, locale)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Outside the scroller: the ways out of this card should not
                  depend on where the category list happens to be. */}
              <View className="mt-4 gap-1">
                <Button
                  label={
                    pending
                      ? t("inbox.adding")
                      : current.count > 1
                        ? t("inboxGroups.fileAll")
                        : t("inbox.add")
                  }
                  disabled={pending || !selected}
                  onPress={() => file(current)}
                />
                <View className="flex-row items-center justify-between gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${
                      current.count > 1
                        ? t("inboxGroups.leaveOutAll")
                        : t("inbox.leaveOut")
                    } — ${current.name}`}
                    accessibilityState={{ disabled: pending }}
                    disabled={pending}
                    onPress={() => leaveOut(current)}
                    className={cn(
                      "min-h-11 items-center justify-center rounded-full px-3",
                      pending && "opacity-60",
                    )}
                  >
                    <Text variant="muted" className="text-sm">
                      {current.count > 1
                        ? t("inboxGroups.leaveOutAll")
                        : t("inbox.leaveOut")}
                    </Text>
                  </Pressable>
                  {/* Sets it aside for this sitting only — the rows stay
                      pending, so they are in the inbox next time. Deciding
                      under pressure is how a card payment ends up in the
                      wrong category. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("inbox.later")}
                    accessibilityState={{ disabled: pending }}
                    disabled={pending}
                    onPress={() => laterFor(current)}
                    className={cn(
                      "min-h-11 items-center justify-center rounded-full px-3",
                      pending && "opacity-60",
                    )}
                  >
                    <Text variant="muted" className="text-sm">
                      {t("inboxGroups.later")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="items-center gap-2 py-6">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={ICON.hero}
                  color={colors.success}
                />
                <Text className="text-base font-medium">
                  {session.answered.length > 0
                    ? session.later.length > 0
                      ? t("inbox.thatsTheInbox")
                      : t("inboxGroups.allFiled")
                    : t("inbox.nothingWaiting")}
                </Text>
                <Text variant="muted" className="text-center text-sm">
                  {session.later.length > 0
                    ? t("inbox.leftForLater", {
                        count: session.later.reduce(
                          (sum, card) => sum + card.count,
                          0,
                        ),
                      })
                    : t("inbox.taughtIt")}
                </Text>
              </View>

              {session.answered.length > 0 ? (
                <View className="gap-2">
                  <Text variant="muted" className="text-xs">
                    {t("inboxGroups.decidedJustNow")}
                  </Text>
                  {session.answered.map((row) => (
                    <View
                      key={row.card.key}
                      className="flex-row items-center gap-3 border-b border-border py-2.5"
                    >
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-sm">
                          {row.card.name}
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {row.outcome}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t("inbox.undo")} — ${row.card.name}`}
                        accessibilityState={{ disabled: pending }}
                        disabled={pending}
                        onPress={() => undo(row)}
                        className="min-h-11 flex-row items-center gap-1 px-1"
                      >
                        <Ionicons
                          name="arrow-undo-outline"
                          size={ICON.sm}
                          color={colors.mutedForeground}
                        />
                        <Text variant="muted" className="text-sm">
                          {t("inbox.undo")}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Button
                label={t("inbox.done")}
                variant="outline"
                className="mt-4"
                onPress={close}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
