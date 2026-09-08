import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  ignoreFeedItem,
  importFeedItem,
  undoFeedDecision,
} from "@/lib/mutations";
import type { PendingFeedRow } from "@/lib/queries";
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

/** What became of a row answered in this sitting, so it can be taken back. */
interface Answered {
  item: PendingFeedRow;
  outcome: string;
}

interface Session {
  /** Which queue this state belongs to, so a new inbox reads as fresh. */
  queueKey: string;
  waiting: PendingFeedRow[];
  answered: Answered[];
  /** Passed over for now. Still pending in the database, so still in the inbox. */
  later: PendingFeedRow[];
}

/**
 * The review inbox, one decision at a time.
 *
 * What the bank reported that the app would not file on its own. Everything
 * the user's own history already answered for is in the ledger by the time
 * they get here, so this is the exceptions — a first visit somewhere, money
 * arriving, a cash withdrawal — and answering one teaches the matcher, which
 * is why the list gets shorter every month rather than being a permanent
 * chore.
 *
 * None of this existed on the phone. The count was fetched on the Month
 * screen and spent only on the month read's fact pack; the statement card
 * offered "6 to review" and pushed to a Ledger that said nothing about the
 * bank. So a feed the cron filled overnight could only be answered on the web
 * app, and the phone quietly showed figures that were short by six entries.
 *
 * One card at a time rather than the web's list of rows. The web sheet can
 * put a category dropdown on every row because it has a desktop's width to
 * spend; here the same list would be six collapsed rows to tap open before
 * any deciding started. A phone is better at "this one — which is it?" asked
 * six times, and the count in the corner is what makes that feel finite.
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
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  /*
   * Keyed by item id, like the web inbox's `choices`, rather than a single
   * {itemId, categoryId} for the card in front of you.
   *
   * The pair was a null-dereference waiting to happen, and it happened: the
   * read was `choice?.itemId === current?.id ? choice.categoryId : ""`, and
   * with an empty queue both sides are undefined, so the comparison is true
   * and it reaches into null. An empty queue is the first render of this
   * screen, every time, because the inbox has not loaded yet — so the Ledger
   * crashed on mount and a tapped notification opened onto a red screen.
   *
   * A map has no such state. There is nothing to compare, and a missing key
   * is an empty selection. It also means a decision undone comes back with
   * the category it was filed under already picked, which is what someone
   * correcting a mistake wants to see.
   */
  const [choices, setChoices] = useState<Record<string, string>>({});

  // Seeded from the props on first sight and owned locally after that. The
  // alternative — reloading the screen behind each decision and re-deriving
  // the queue — renumbers "3 of 6" under the user's thumb mid-sitting. The
  // reload happens once, on close.
  const queueKey = items.map((item) => item.id).join("|");
  const [stored, setStored] = useState<Session | null>(null);
  const session: Session =
    stored?.queueKey === queueKey
      ? stored
      : { queueKey, waiting: items, answered: [], later: [] };

  /*
   * Null when the queue is empty, which is the first render of this screen
   * every time — the inbox has not loaded yet — as well as the end of a
   * sitting. Every read of `current` below must cope with that.
   *
   * Do not expect the compiler to enforce it. Without
   * `noUncheckedIndexedAccess`, `waiting[0]` is typed as always present, so
   * `?? null` narrows to non-null and stays that way; annotating the
   * declaration does not help, because narrowing follows the initializer
   * rather than the declared type. That is how the dereference this replaced
   * shipped: it type-checked, and crashed on mount.
   */
  const current = session.waiting[0] ?? null;
  const total = items.length;
  const position = session.answered.length + session.later.length + 1;

  const selected = current ? (choices[current.id] ?? "") : "";

  // Filtered before grouping, so empty groups disappear while searching.
  const visible = query.trim()
    ? categories.filter((category) =>
        category.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : categories;
  const groups = groupCategoriesByType(visible);

  // One tap instead of scrolling the grouped list, which is the common case:
  // the exceptions still land in the same handful of categories.
  const recent = recentCategoryIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is Category => category !== undefined)
    .slice(0, 4);

  function close() {
    onOpenChange(false);
    setQuery("");
    // Only when something actually happened: closing a sheet you opened by
    // accident should not cost the screen behind it a round trip.
    if (session.answered.length > 0) {
      onDecided();
    }
  }

  /** Records a decision locally once the write has stuck. */
  function settle(item: PendingFeedRow, outcome: string) {
    setStored({
      queueKey,
      waiting: session.waiting.filter((row) => row.id !== item.id),
      answered: [{ item, outcome }, ...session.answered],
      later: session.later,
    });
  }

  function decide(
    item: PendingFeedRow,
    work: () => Promise<{ error?: string; message?: string }>,
    outcome: string,
    good: boolean,
  ) {
    if (pending) {
      return;
    }
    setPending(true);

    void (async () => {
      const result = await work();
      setPending(false);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      if (good) {
        void hapticSuccess();
      }
      settle(item, outcome);
    })();
  }

  function add(item: PendingFeedRow) {
    if (!selected) {
      toast(t("inbox.pickCategoryFirst"), "error");
      return;
    }
    const name =
      categories.find((category) => category.id === selected)?.name ??
      "your ledger";
    decide(item, () => importFeedItem(item.id, selected), name, true);
  }

  function undo(answered: Answered) {
    if (pending) {
      return;
    }
    setPending(true);

    void (async () => {
      const result = await undoFeedDecision(answered.item.id);
      setPending(false);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      // Back onto the front of the queue rather than silently gone: undoing
      // means the question is open again, and the question is what this
      // sheet is for.
      setStored({
        queueKey,
        waiting: [answered.item, ...session.waiting],
        answered: session.answered.filter(
          (row) => row.item.id !== answered.item.id,
        ),
        later: session.later,
      });
    })();
  }

  const header = (
    <View className="mb-4 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
        <Text className="font-semibold" style={{ fontSize: 18 }}>
          From your bank
        </Text>
        {current ? (
          <Text variant="muted" className="text-xs tabular-nums">
            {`${position} of ${total}`}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={close}
        accessibilityLabel={t("inbox.close")}
        hitSlop={8}
      >
        <Text variant="muted">Close</Text>
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
        <View className="max-h-[88%] rounded-t-3xl border border-border bg-card p-5">
          <SheetGrabber />
          {header}

          {current ? (
            <>
              {/* The bank's own words, in full. Truncating is what the
                  statement card does, where the row is a receipt someone
                  already recognises; here the string *is* the decision, and
                  "PRELEVEMENT Navi…" answers nothing. */}
              <View className="gap-1.5 rounded-2xl border border-primary-rim bg-primary/5 p-4">
                <Text className="text-base font-medium">
                  {current.counterparty ?? current.note}
                </Text>
                <PrivateAmount
                  style={TYPE.figure}
                  className={
                    current.direction === "in"
                      ? "text-success"
                      : "text-destructive"
                  }
                >
                  {`${current.direction === "in" ? "+" : "−"}${formatEuro(
                    current.amount,
                  )}`}
                </PrivateAmount>
                <Text variant="muted" className="text-xs">
                  {`${formatShortDate(current.occurredOn)} · ${current.why}`}
                </Text>
              </View>

              <Text className="mb-2 mt-4 text-sm font-medium">
                Which category?
              </Text>

              <ScrollView
                className="max-h-72"
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
                      Recent
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
                            onPress={() => {
                              void hapticLight();
                              setChoices((current$) => ({
                                ...current$,
                                [current.id]: category.id,
                              }));
                            }}
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
                  {groups.map((group) => (
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
                            onPress={() => {
                              void hapticLight();
                              setChoices((current$) => ({
                                ...current$,
                                [current.id]: category.id,
                              }));
                            }}
                            className={cn(
                              "min-h-11 flex-row items-center gap-3 rounded-lg border px-3 py-2",
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

              {/* Outside the scroller: the three ways out of this card should
                  not depend on where the category list happens to be. */}
              <View className="mt-4 flex-row items-center gap-2">
                <Button
                  label={pending ? t("inbox.adding") : t("inbox.add")}
                  className="flex-1"
                  disabled={pending || !selected}
                  onPress={() => add(current)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Leave ${
                    current.counterparty ?? current.note
                  } out of your ledger`}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  onPress={() =>
                    decide(
                      current,
                      () => ignoreFeedItem(current.id),
                      "left out",
                      false,
                    )
                  }
                  className={cn(
                    "min-h-11 items-center justify-center rounded-full px-3",
                    pending && "opacity-60",
                  )}
                >
                  <Text variant="muted" className="text-sm">
                    Leave out
                  </Text>
                </Pressable>
                {/* Sets it aside for this sitting only — the row stays
                    pending, so it is in the inbox next time. Deciding under
                    pressure is how a card payment ends up in the wrong
                    category, and the fix for that is a worse chore than the
                    original one. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("inbox.later")}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  onPress={() => {
                    void hapticLight();
                    setStored({
                      queueKey,
                      waiting: session.waiting.slice(1),
                      answered: session.answered,
                      later: [...session.later, current],
                    });
                  }}
                  className={cn(
                    "min-h-11 items-center justify-center rounded-full px-3",
                    pending && "opacity-60",
                  )}
                >
                  <Text variant="muted" className="text-sm">
                    Later
                  </Text>
                </Pressable>
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
                    ? t("inbox.thatsTheInbox")
                    : t("inbox.nothingWaiting")}
                </Text>
                <Text variant="muted" className="text-center text-sm">
                  {session.later.length > 0
                    ? t("inbox.leftForLater", {
                        count: session.later.length,
                      })
                    : t("inbox.taughtIt")}
                </Text>
              </View>

              {session.answered.length > 0 ? (
                <View className="gap-2">
                  <Text variant="muted" className="text-xs">
                    Decided just now
                  </Text>
                  {session.answered.map((row) => (
                    <View
                      key={row.item.id}
                      className="flex-row items-center gap-3 border-b border-border py-2.5"
                    >
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-sm">
                          {row.item.counterparty ?? row.item.note}
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {`${formatShortDate(row.item.occurredOn)} · ${
                            row.outcome
                          }`}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Undo ${
                          row.item.counterparty ?? row.item.note
                        }`}
                        accessibilityState={{ disabled: pending }}
                        disabled={pending}
                        onPress={() => undo(row)}
                        hitSlop={8}
                        className="flex-row items-center gap-1"
                      >
                        <Ionicons
                          name="arrow-undo-outline"
                          size={ICON.sm}
                          color={colors.mutedForeground}
                        />
                        <Text variant="muted" className="text-sm">
                          Undo
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
