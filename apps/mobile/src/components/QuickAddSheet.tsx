import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  amountInputToNumber,
  formatAmountInput,
  isAmountInputComplete,
  pressAmountKey,
  type AmountKey,
} from "@finance/core/amount-input";
import { todayIsoLocal } from "@finance/core/constants";
import {
  lookupMerchant,
  suggestMerchants,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { RecurringFormBody } from "@/components/RecurringFormModal";
import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { createTransaction } from "@/lib/mutations";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", USD: "$" };

/** How many recent categories sit above the picker as one-tap chips. */
const RECENT_CHIPS = 6;

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

/** The two things the Add sheet can add. */
export type AddKind = "transaction" | "charge";

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
  defaultDate?: string;
  /** Which kind the sheet opens on: the Charges screen opens it on a charge. */
  kind: AddKind;
  /** Increments on each open, so the fields remount with clean state. */
  openToken: number;
}

/**
 * The one sheet behind the "+" and every Add button: a transaction or a
 * charge, chosen at the top.
 *
 * There were three ways in that looked alike and were not — this sheet from
 * the "+", the Ledger's own form, and a charge form reachable only from the
 * Charges screen — and which one a person got depended on where they
 * happened to press. The web twin carries the same reasoning. Now the
 * question is asked inside the sheet, and the screen it was opened from only
 * picks the answer it starts on.
 */
export function QuickAddSheet(props: QuickAddSheetProps) {
  const t = useT();
  // The Modal stays mounted so its slide-out animation still plays on close;
  // the panel inside is keyed on the open token, so every open starts from
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
          accessibilityLabel={t("quickAdd.close")}
          onPress={props.onClose}
        />
        <AddPanel
          key={props.openToken}
          onClose={props.onClose}
          onSaved={props.onSaved}
          categories={props.categories}
          recentCategoryIds={props.recentCategoryIds}
          merchants={props.merchants}
          defaultDate={props.defaultDate}
          kind={props.kind}
        />
      </View>
    </Modal>
  );
}

function AddPanel({
  onClose,
  kind: initialKind,
  ...fields
}: Omit<QuickAddSheetProps, "open" | "openToken">) {
  const t = useT();
  const [kind, setKind] = useState<AddKind>(initialKind);

  return (
    <View className="max-h-[92%] rounded-t-card border border-border bg-card">
      <View className="items-center pt-3">
        <SheetGrabber />
      </View>

      <View className="flex-row items-center justify-between px-5 pb-1 pt-3">
        <Text
          accessibilityRole="header"
          className="font-semibold"
          style={{ fontSize: 18 }}
        >
          {t("add.title")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityLabel={t("quickAdd.close")}
          hitSlop={8}
        >
          <Text variant="muted">{t("quickAdd.close")}</Text>
        </Pressable>
      </View>

      <ScrollView
        className="px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- what is being added --------------------------------- */}
        <ChoiceChips
          label={t("add.kind")}
          fill
          className="mt-3"
          options={[
            { value: "transaction", label: t("add.transaction") },
            { value: "charge", label: t("add.charge") },
          ]}
          value={kind}
          onChange={setKind}
        />
        <Text variant="muted" className="mb-1 mt-2 text-sm">
          {kind === "transaction"
            ? t("add.transactionHint")
            : t("add.chargeHint")}
        </Text>

        {kind === "transaction" ? (
          <QuickAddFields {...fields} onDone={onClose} />
        ) : (
          <View className="mt-4">
            <RecurringFormBody
              categories={fields.categories}
              onSaved={fields.onSaved}
              onDone={onClose}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface QuickAddFieldsProps {
  onSaved: () => void;
  onDone: () => void;
  categories: Category[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
  defaultDate?: string;
}

/**
 * Amount-first transaction entry.
 *
 * The keypad is the opening state rather than something reached after
 * scrolling past a category list: the user always knows the amount and often
 * has to think about the category, so the number is captured while it is still
 * in working memory. The previous form asked in the opposite order and put the
 * amount field below the fold whenever a user had more than a few categories.
 */
function QuickAddFields({
  onDone,
  onSaved,
  categories,
  recentCategoryIds,
  merchants,
  defaultDate,
}: QuickAddFieldsProps) {
  const colors = useThemeColors();
  const { currency } = useCurrency();
  const symbol = CURRENCY_SYMBOL[currency] ?? "€";

  const today = todayIsoLocal();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultDate ?? today);
  const [note, setNote] = useState("");
  // Open from the start when the sheet arrives on a day that is neither
  // today nor yesterday — the first of another month, opened from there —
  // so the date it will save under is on screen rather than implied.
  const [showDatePicker, setShowDatePicker] = useState(
    defaultDate !== undefined &&
      defaultDate !== today &&
      defaultDate !== shiftDays(today, -1),
  );
  const [pending, setPending] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Before the memos below, which read it while this render runs.
  const locale = useLocale();
  const merchantIndex = useMemo(
    () => new Map(merchants.map((rule) => [rule.key, rule])),
    [merchants],
  );

  // A handful, not every category the month has used: the picker below has
  // the rest, and a dozen chips would push the note off the sheet.
  const recentCategories = useMemo(
    () =>
      recentCategoryIds
        .map((id) => categories.find((cat) => cat.id === id))
        .filter((cat): cat is Category => cat !== undefined)
        .slice(0, RECENT_CHIPS),
    [recentCategoryIds, categories],
  );

  const noteSuggestions = useMemo(() => {
    if (note.trim().length < 2) {
      return [];
    }
    return suggestMerchants(merchantIndex, note, 3);
  }, [merchantIndex, note]);

  const t = useT();
  const display = formatAmountInput(amount, locale);
  const canSave = isAmountInputComplete(amount) && categoryId !== "";
  const yesterday = shiftDays(today, -1);
  const dateChoice: "today" | "yesterday" | "other" = showDatePicker
    ? "other"
    : occurredOn === today
      ? "today"
      : occurredOn === yesterday
        ? "yesterday"
        : "other";

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

    setPending(false);
    void hapticSuccess();
    onSaved();

    if (!andAnother) {
      onDone();
      return;
    }

    // Keep the date and category: a catch-up session is usually several
    // entries from the same day, often the same shop.
    setSavedCount((count) => count + 1);
    setAmount("");
    setNote("");
  }

  return (
    <>
      {/* ---- amount --------------------------------------------- */}
      <View
        accessibilityRole="text"
        accessibilityLabel={t("formPickers.fieldValue", {
          label: t("quickAdd.amount"),
          value: `${display.integer}${display.fraction} ${symbol}`,
        })}
        className="flex-row items-baseline justify-center py-5"
      >
        <Text
          className="font-sans tabular-nums"
          style={{
            fontSize: 22,
            color: display.empty ? colors.mutedForeground : colors.foreground,
          }}
        >
          {symbol}
        </Text>
        <Text
          className="font-sans tabular-nums font-bold"
          style={{
            fontSize: 48,
            lineHeight: 56,
            color: display.empty ? colors.mutedForeground : colors.foreground,
          }}
        >
          {display.integer}
        </Text>
        <Text
          className="font-sans tabular-nums"
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
                  key === "backspace" ? t("quickAdd.deleteLastDigit") : key
                }
                onPress={() => handleKey(key)}
                onLongPress={
                  key === "backspace" ? () => setAmount("") : undefined
                }
                className={cn(
                  "h-14 flex-1 items-center justify-center rounded-control",
                  "border border-border bg-background active:bg-muted",
                )}
              >
                {key === "backspace" ? (
                  <Ionicons
                    name="backspace-outline"
                    size={ICON.xl}
                    color={colors.foreground}
                  />
                ) : (
                  <Text
                    className="font-sans tabular-nums"
                    style={{ fontSize: 22 }}
                  >
                    {key}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* ---- date ----------------------------------------------- */}
      <ChoiceChips
        label={t("quickAdd.date")}
        className="mb-4"
        options={[
          { value: "today", label: t("calendar.today") },
          { value: "yesterday", label: t("calendar.yesterday") },
          { value: "other", label: t("quickAdd.anotherDay") },
        ]}
        value={dateChoice}
        onChange={(choice) => {
          if (choice === "other") {
            setShowDatePicker(true);
            return;
          }
          setShowDatePicker(false);
          setOccurredOn(choice === "today" ? today : yesterday);
        }}
      />

      {dateChoice === "other" ? (
        <DateField
          value={occurredOn}
          onChange={setOccurredOn}
          className="mb-4"
        />
      ) : null}

      {/* ---- category ------------------------------------------- */}
      {/* The few categories used most stay one tap away; everything else is
          behind the picker, a kind at a time, rather than every category
          drawn under the keypad. */}
      <Text className="mb-2 text-sm font-medium">{t("quickAdd.category")}</Text>

      {recentCategories.length > 0 ? (
        <View className="mb-3 flex-row flex-wrap gap-2">
          {recentCategories.map((cat) => {
            const active = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={cat.name}
                onPress={() => {
                  void hapticLight();
                  setCategoryId(cat.id);
                }}
                className={cn(
                  "min-h-11 flex-row items-center gap-2 rounded-full border py-1 pl-1.5 pr-3",
                  active ? "border-foreground bg-secondary" : "border-border",
                )}
              >
                <CategoryIcon
                  icon={cat.icon}
                  className="h-7 w-7 border-0 bg-muted"
                />
                <Text
                  className={cn(
                    "text-sm",
                    active ? "font-medium text-foreground" : "text-foreground",
                  )}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <CategoryPicker
        label={t("quickAdd.category")}
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        className="mb-4"
      />

      {/* ---- note ----------------------------------------------- */}
      <Text className="mb-2 text-sm font-medium">{t("quickAdd.note")}</Text>
      <Input
        value={note}
        onChangeText={setNote}
        placeholder={t("quickAdd.notePlaceholder")}
        className={noteSuggestions.length > 0 ? "mb-2" : "mb-4"}
      />

      {noteSuggestions.length > 0 ? (
        <View className="mb-4 gap-1.5">
          {noteSuggestions.map((rule) => (
            <Pressable
              key={rule.key}
              accessibilityRole="button"
              accessibilityLabel={t("formPickers.useSuggestion", {
                label: rule.label,
                category: rule.categoryName,
              })}
              onPress={() => applyMerchant(rule)}
              className="min-h-11 flex-row items-center justify-between gap-3 rounded-control border border-border bg-background px-3 py-2"
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

      {error ? (
        <Text className="mb-3 text-sm text-destructive">
          {resolveMessage(t, error)}
        </Text>
      ) : null}

      {savedCount > 0 ? (
        <Text className="mb-3 text-sm text-success">
          {t("quickAdd.savedKeepGoing", { count: savedCount })}
        </Text>
      ) : null}

      <View className="gap-2 pb-2">
        <Button
          label={pending ? t("quickAdd.saving") : t("quickAdd.save")}
          size="lg"
          disabled={!canSave || pending}
          onPress={() => void save(false)}
        />
        <Button
          label={t("quickAdd.saveAndAnother")}
          variant="outline"
          size="lg"
          disabled={!canSave || pending}
          onPress={() => void save(true)}
        />
      </View>

      <View className="h-8" />
    </>
  );
}
