import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  amountInputToNumber,
  formatAmountInput,
  isAmountInputComplete,
  pressAmountKey,
  type AmountKey,
} from "@finance/core/amount-input";
import { groupCategoriesByType } from "@finance/core/categories";
import { todayIsoLocal } from "@finance/core/constants";
import {
  lookupMerchant,
  suggestMerchants,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type { Category, Tag } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { createTransaction, setTransactionTags } from "@/lib/mutations";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", USD: "$" };

/** Once the list is longer than this, searching beats scrolling. */
const SEARCH_THRESHOLD = 8;

const KEYPAD_ROWS: AmountKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
];

function shiftDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year!, month! - 1, day! + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  tags: Tag[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
  defaultDate?: string;
  /** Increments on each open, so the fields remount with clean state. */
  openToken: number;
}

/**
 * Amount-first transaction entry, reachable from every screen.
 *
 * The keypad is the sheet's opening state rather than something reached after
 * scrolling past a category list: the user always knows the amount and often
 * has to think about the category, so the number is captured while it is still
 * in working memory. The previous form asked in the opposite order and put the
 * amount field below the fold whenever a user had more than a few categories.
 */
export function QuickAddSheet(props: QuickAddSheetProps) {
  // The Modal stays mounted so its slide-out animation still plays on close;
  // the fields inside are keyed on the open token, so every open starts from
  // clean state. Resetting in an effect instead would cascade a second render
  // on every open, and a half-typed abandoned entry must never come back
  // attached to a later one.
  return (
    <Modal
      visible={props.open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel="Close"
          onPress={props.onClose}
        />
        <QuickAddFields key={props.openToken} {...props} />
      </View>
    </Modal>
  );
}

function QuickAddFields({
  onClose,
  onSaved,
  categories,
  tags,
  recentCategoryIds,
  merchants,
  defaultDate,
}: QuickAddSheetProps) {
  const colors = useThemeColors();
  const { currency } = useCurrency();
  const symbol = CURRENCY_SYMBOL[currency] ?? "€";

  const today = todayIsoLocal();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultDate ?? today);
  const [note, setNote] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pending, setPending] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const merchantIndex = useMemo(
    () => new Map(merchants.map((rule) => [rule.key, rule])),
    [merchants],
  );

  const recentCategories = useMemo(
    () =>
      recentCategoryIds
        .map((id) => categories.find((cat) => cat.id === id))
        .filter((cat): cat is Category => cat !== undefined),
    [recentCategoryIds, categories],
  );

  const groups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const visible = trimmed
      ? categories.filter((cat) => cat.name.toLowerCase().includes(trimmed))
      : categories;
    return groupCategoriesByType(visible);
  }, [categories, query]);

  const selected = categories.find((cat) => cat.id === categoryId) ?? null;

  const noteSuggestions = useMemo(() => {
    if (note.trim().length < 2) {
      return [];
    }
    return suggestMerchants(merchantIndex, note, 3);
  }, [merchantIndex, note]);

  const display = formatAmountInput(amount, "fr-FR");
  const canSave = isAmountInputComplete(amount) && categoryId !== "";
  const categoryListOpen =
    showAllCategories || query.trim() !== "" || recentCategories.length === 0;

  function handleKey(key: AmountKey) {
    void hapticLight();
    setAmount((current) => pressAmountKey(current, key));
  }

  function applyMerchant(rule: MerchantRule) {
    setNote(rule.label);
    if (categoryId === "") {
      setCategoryId(rule.categoryId);
    }
    if (!isAmountInputComplete(amount)) {
      setAmount(
        Number.isInteger(rule.lastAmount)
          ? String(rule.lastAmount)
          : rule.lastAmount.toFixed(2),
      );
    }
  }

  async function save(andAnother: boolean) {
    if (!canSave || pending) {
      return;
    }

    setPending(true);
    setError(null);

    // A category the user never picked but the app knows for this note.
    const resolvedCategory =
      categoryId || lookupMerchant(merchantIndex, note)?.categoryId || "";

    const result = await createTransaction({
      categoryId: resolvedCategory,
      amount: amountInputToNumber(amount),
      occurredOn,
      note: note.trim() || undefined,
    });

    if (result.error) {
      setPending(false);
      setError(result.error);
      return;
    }

    if (result.id && tagIds.length > 0) {
      await setTransactionTags(result.id, tagIds);
    }

    setPending(false);
    void hapticSuccess();
    onSaved();

    if (!andAnother) {
      onClose();
      return;
    }

    // Keep the date and category: a catch-up session is usually several
    // entries from the same day, often the same shop.
    setSavedCount((count) => count + 1);
    setAmount("");
    setNote("");
    setTagIds([]);
  }

  return (
    <View className="max-h-[92%] rounded-t-3xl border border-border bg-card">
      <View className="items-center pt-3">
        <View className="h-1 w-10 rounded-full bg-hairline-strong" />
      </View>

      <View className="flex-row items-center justify-between px-5 pb-1 pt-3">
        <Text className="font-semibold" style={{ fontSize: 18 }}>
          Add transaction
        </Text>
        <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
          <Text variant="muted">Close</Text>
        </Pressable>
      </View>

      <ScrollView
        className="px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- amount --------------------------------------------- */}
        <View
          accessibilityRole="text"
          accessibilityLabel={`Amount ${display.integer}${display.fraction}`}
          className="flex-row items-baseline justify-center py-5"
        >
          <Text
            className="font-mono"
            style={{
              fontSize: 22,
              color: display.empty ? colors.mutedForeground : colors.foreground,
            }}
          >
            {symbol}
          </Text>
          <Text
            className="font-mono font-bold"
            style={{
              fontSize: 48,
              lineHeight: 56,
              color: display.empty ? colors.mutedForeground : colors.foreground,
            }}
          >
            {display.integer}
          </Text>
          <Text
            className="font-mono"
            style={{
              fontSize: 22,
              color: display.empty ? colors.mutedForeground : colors.foreground,
            }}
          >
            {display.fraction}
          </Text>
        </View>

        {/* ---- keypad --------------------------------------------- */}
        <View className="mb-4 gap-2">
          {KEYPAD_ROWS.map((row) => (
            <View key={row.join("")} className="flex-row gap-2">
              {row.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={
                    key === "backspace" ? "Delete last digit" : key
                  }
                  onPress={() => handleKey(key)}
                  onLongPress={
                    key === "backspace" ? () => setAmount("") : undefined
                  }
                  className={cn(
                    "h-14 flex-1 items-center justify-center rounded-xl",
                    "border border-border bg-background active:bg-muted",
                  )}
                >
                  {key === "backspace" ? (
                    <Ionicons
                      name="backspace-outline"
                      size={22}
                      color={colors.foreground}
                    />
                  ) : (
                    <Text className="font-mono" style={{ fontSize: 22 }}>
                      {key}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* ---- date ----------------------------------------------- */}
        <View className="mb-4 flex-row flex-wrap gap-2">
          {[
            { label: "Today", value: today },
            { label: "Yesterday", value: shiftDays(today, -1) },
          ].map((option) => {
            const active = occurredOn === option.value && !showDatePicker;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void hapticLight();
                  setShowDatePicker(false);
                  setOccurredOn(option.value);
                }}
                className={cn(
                  "rounded-full border px-4 py-2",
                  active
                    ? "border-primary bg-primary/15"
                    : "border-border bg-background",
                )}
              >
                <Text className={cn("text-sm", active && "text-primary-ink")}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showDatePicker }}
            onPress={() => setShowDatePicker((value) => !value)}
            className={cn(
              "rounded-full border px-4 py-2",
              showDatePicker
                ? "border-primary bg-primary/15"
                : "border-border bg-background",
            )}
          >
            <Text
              className={cn("text-sm", showDatePicker && "text-primary-ink")}
            >
              Another day
            </Text>
          </Pressable>
        </View>

        {showDatePicker ? (
          <DateField
            value={occurredOn}
            onChange={setOccurredOn}
            className="mb-4"
          />
        ) : null}

        {/* ---- category ------------------------------------------- */}
        <Text className="mb-2 text-sm font-medium">Category</Text>

        {recentCategories.length > 0 && !query.trim() ? (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {recentCategories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void hapticLight();
                    setCategoryId(cat.id);
                  }}
                  className={cn(
                    "flex-row items-center gap-2 rounded-full border px-3 py-2",
                    active
                      ? "border-primary bg-primary/15"
                      : "border-border bg-background",
                  )}
                >
                  <CategoryIcon icon={cat.icon} className="h-6 w-6" />
                  <Text className="text-sm">{cat.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {categories.length > SEARCH_THRESHOLD && categoryListOpen ? (
          <View className="mb-3 flex-row items-center gap-2 rounded-full border border-border bg-background px-3">
            <Ionicons
              name="search-outline"
              size={16}
              color={colors.mutedForeground}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Filter categories…"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="Filter categories"
              className="h-10 flex-1 font-sans text-sm text-foreground"
            />
          </View>
        ) : null}

        {categoryListOpen ? (
          <View className="mb-4 gap-3">
            {groups.map((group) => (
              <View key={group.type} className="gap-1.5">
                <Text variant="muted" className="text-xs">
                  {group.label}
                </Text>
                {group.categories.map((cat) => {
                  const active = categoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={cat.name}
                      onPress={() => {
                        void hapticLight();
                        setCategoryId(cat.id);
                        setShowAllCategories(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex-row items-center gap-3 rounded-lg border px-3 py-2",
                        active
                          ? "border-primary bg-primary/15"
                          : "border-border bg-background",
                      )}
                    >
                      <CategoryIcon icon={cat.icon} />
                      <Text className="flex-1 text-sm">{cat.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAllCategories(true)}
            className="mb-4 self-start"
          >
            <Text variant="muted" className="text-sm underline">
              {selected ? `${selected.name} — change` : "All categories"}
            </Text>
          </Pressable>
        )}

        {/* ---- note ----------------------------------------------- */}
        <Text className="mb-2 text-sm font-medium">Note</Text>
        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Where did it go?"
          className={noteSuggestions.length > 0 ? "mb-2" : "mb-4"}
        />

        {noteSuggestions.length > 0 ? (
          <View className="mb-4 gap-1.5">
            {noteSuggestions.map((rule) => (
              <Pressable
                key={rule.key}
                accessibilityRole="button"
                accessibilityLabel={`Use ${rule.label}, ${rule.categoryName}`}
                onPress={() => applyMerchant(rule)}
                className="flex-row items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <Text className="flex-1 text-sm" numberOfLines={1}>
                  {rule.label}
                </Text>
                <Text variant="muted" className="text-xs">
                  {rule.categoryName}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ---- tags ----------------------------------------------- */}
        {tags.length > 0 ? (
          <>
            <Text className="mb-2 text-sm font-medium">Tags</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {tags.map((tag) => {
                const on = tagIds.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={tag.name}
                    onPress={() =>
                      setTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((id) => id !== tag.id)
                          : [...current, tag.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-2",
                      on
                        ? "border-primary bg-primary/15"
                        : "border-border bg-background",
                    )}
                  >
                    <Text className={cn("text-sm", on && "text-primary-ink")}>
                      {tag.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {error ? (
          <Text className="mb-3 text-sm text-destructive">{error}</Text>
        ) : null}

        {savedCount > 0 ? (
          <Text className="mb-3 text-sm text-success">
            {savedCount === 1
              ? "1 saved — keep going."
              : `${savedCount} saved — keep going.`}
          </Text>
        ) : null}

        <View className="gap-2 pb-2">
          <Button
            label={pending ? "Saving…" : "Save"}
            size="lg"
            disabled={!canSave || pending}
            onPress={() => void save(false)}
          />
          <Button
            label="Save & add another"
            variant="outline"
            size="lg"
            disabled={!canSave || pending}
            onPress={() => void save(true)}
          />
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
