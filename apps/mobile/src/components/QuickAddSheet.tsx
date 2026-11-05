import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import {
  amountInputToNumber,
  isAmountInputComplete,
  parseTypedAmount,
  pressAmountKey,
  type AmountKey,
} from "@finance/core/amount-input";
import { amountSign } from "@finance/core/amount-sign";
import { scheduleDatesBefore } from "@finance/core/apply-recurring";
import {
  formatDayMonth,
  getCurrentMonth,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  categoriesOfKind,
  entryGap,
  initialEntryKind,
  merchantsOfKind,
  offersAdvance,
  scheduleOfEntry,
  schedulePayload,
} from "@finance/core/entry-draft";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  lookupMerchant,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import type { Category, CategoryType } from "@finance/core/types/database";

import { AmountFigure } from "@/components/add/AmountFigure";
import { CategoryGrid } from "@/components/add/CategoryGrid";
import { KIND_INK, withAlpha } from "@/components/add/kind-ink";
import { KindSwitch } from "@/components/add/KindSwitch";
import { Keypad } from "@/components/add/Keypad";
import { NotePanel } from "@/components/add/NotePanel";
import { WhenPanel, type WhenState } from "@/components/add/WhenPanel";
import { FADE_IN } from "@/components/motion/fade";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import {
  hapticLight,
  hapticSelection,
  hapticSuccess,
} from "@/lib/haptics";
import { createTransaction, upsertRecurringTemplate } from "@/lib/mutations";
import {
  enableReminders,
  markRemindersAsked,
  shouldOfferReminders,
} from "@/lib/notifications";
import { useCurrency, useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", USD: "$" };

/** How long the button says « Enregistrée » before the sheet goes. */
const SAVED_BEAT_MS = 420;

/** The two ways into the sheet: something that happened, or that repeats. */
export type AddKind = "transaction" | "charge";

type Tray = "keypad" | "category" | "note" | "when";

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
  defaultDate?: string;
  /** « charge » opens on « Régulièrement »: the Récurrents screen's « + ». */
  kind: AddKind;
  /** The kind of money to open on — a kind's « + » on Récurrents. */
  categoryType?: CategoryType;
  /** Increments on each open, so the fields remount with clean state. */
  openToken: number;
}

/**
 * The one sheet behind the « + » and every Add button.
 *
 * Rebuilt in November 2026 around the order a person knows things in: the
 * kind of money (Dépense · Revenu · Épargne · Placement), then the amount,
 * set large in the money serif and in that kind's colour; then three tiles —
 * Catégorie, Commerce, Quand — under it. The bottom of the sheet is one
 * panel that becomes whatever is being answered: the keypad, the kind's
 * categories, the remembered shops, the calendar or the schedule. So the
 * whole entry fits on one screen and nothing scrolls past the amount.
 *
 * A recurring entry is no longer a separate form: it is « Régulièrement »
 * under Quand, and it saves the template Récurrents edits. The full form is
 * still what Récurrents opens to change one.
 */
export function QuickAddSheet(props: QuickAddSheetProps) {
  const t = useT();
  // The Modal stays mounted so its fade-out still plays on close; the panel
  // is keyed on the open token, so every open starts from clean state and a
  // half-typed abandoned entry never comes back attached to a later one.
  return (
    <Modal
      visible={props.open}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.7)",
        }}
      >
        <Pressable
          className="flex-1"
          accessibilityLabel={t("quickAdd.close")}
          onPress={props.onClose}
        />
        <AddPanel
          key={props.openToken}
          onClose={props.onClose}
          categories={props.categories}
          recentCategoryIds={props.recentCategoryIds}
          merchants={props.merchants}
          defaultDate={props.defaultDate}
          kind={props.kind}
          categoryType={props.categoryType}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function freshWhen(
  recurring: boolean,
  occurredOn: string,
): WhenState {
  const today = todayIsoLocal();
  const [, month, day] = today.split("-").map(Number);
  const weekday = new Date().getDay();
  return {
    recurring,
    occurredOn,
    rhythm: "monthly",
    // A recurring entry is usually set up on the day it lands: payday,
    // the rent going out.
    dayOfMonth: day!,
    dayOfWeek: weekday === 0 ? 7 : weekday,
    month: month!,
    amountVaries: false,
    withAdvance: false,
    advanceDay: 15,
    advanceAmount: "",
    startThisMonth: false,
    startsOn: "",
    endsOn: "",
  };
}

function AddPanel({
  onClose,
  categories,
  recentCategoryIds,
  merchants,
  defaultDate,
  kind: openedAs,
  categoryType,
}: Omit<QuickAddSheetProps, "open" | "openToken">) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const { currency } = useCurrency();
  const { toast } = useToast();
  const symbol = CURRENCY_SYMBOL[currency] ?? "€";
  const today = todayIsoLocal();

  const [kind, setKind] = useState<CategoryType>(() =>
    initialEntryKind(categoryType),
  );
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<WhenState>(() =>
    freshWhen(openedAs === "charge", defaultDate ?? today),
  );
  const [tray, setTray] = useState<Tray>("keypad");
  const [refusals, setRefusals] = useState(0);
  const [presses, setPresses] = useState(0);
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closing.current) {
        clearTimeout(closing.current);
      }
    },
    [],
  );

  const ink = colors[KIND_INK[kind]];

  const kindCategories = useMemo(
    () => categoriesOfKind(categories, kind, recentCategoryIds),
    [categories, kind, recentCategoryIds],
  );
  const kindMerchants = useMemo(
    () =>
      new Map(
        merchantsOfKind(merchants, kind).map((rule) => [rule.key, rule]),
      ),
    [merchants, kind],
  );

  // A shop already filed under this kind is enough without a category
  // picked: it says where it goes.
  const knownShop = lookupMerchant(kindMerchants, note);
  const resolvedCategoryId = categoryId || knownShop?.categoryId || "";
  const category =
    categories.find((candidate) => candidate.id === resolvedCategoryId) ?? null;
  const gap = entryGap({
    amountComplete: isAmountInputComplete(amount),
    hasCategory: resolvedCategoryId !== "",
  });

  const schedule = scheduleOfEntry(when);
  // The days this schedule has already passed this month: what « Inclure ce
  // mois-ci » would record. Only asked when there are some.
  const pastThisMonth = useMemo(() => {
    if (!when.recurring) {
      return [];
    }
    const { year, month } = getCurrentMonth();
    return scheduleDatesBefore(
      {
        ...scheduleOfEntry(when),
        starts_on: when.startsOn || null,
        ends_on: when.endsOn || null,
      },
      year,
      month,
      today,
    );
  }, [when, today]);

  const whenLabel = when.recurring
    ? formatRecurrenceSchedule(schedule, locale)
    : relativeDayLabel(when.occurredOn, formatDayMonth, locale);
  const signedAmount = `${amountSign(kind)}${formatEuro(amountInputToNumber(amount))}`;

  function changeKind(next: CategoryType) {
    setKind(next);
    setError(null);
    // A category of another kind no longer belongs to this entry.
    if (category && category.type !== next) {
      setCategoryId("");
    }
  }

  function openTray(next: Tray) {
    void hapticSelection();
    if (next !== "note") {
      Keyboard.dismiss();
    }
    setTray((current) =>
      current === next && next !== "keypad" ? "keypad" : next,
    );
  }

  function handleKey(key: AmountKey) {
    const next = pressAmountKey(amount, key);
    if (next === amount && key !== "backspace" && key !== "clear") {
      void hapticSelection();
      setRefusals((count) => count + 1);
      return;
    }
    void hapticLight();
    setAmount(next);
    if (key !== "backspace" && key !== "clear") {
      setPresses((count) => count + 1);
    }
  }

  function pickCategory(id: string) {
    setCategoryId(id);
    setError(null);
    // Nothing typed yet: back to the keypad, which is the next thing to do.
    // With an amount, the grid stays so a wrong tap is one tap to undo.
    if (!isAmountInputComplete(amount)) {
      setTray("keypad");
    }
  }

  function pickMerchant(rule: MerchantRule) {
    void hapticSelection();
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
    Keyboard.dismiss();
    setTray("keypad");
  }

  async function save(andAnother: boolean) {
    if (gap || pending || justSaved) {
      return;
    }
    setPending(true);
    setError(null);

    const result = when.recurring
      ? await upsertRecurringTemplate({
          categoryId: resolvedCategoryId,
          description: note.trim() || undefined,
          active: true,
          pricingType: "fixed",
          amount: amountInputToNumber(amount),
          amountVaries: when.amountVaries,
          ...schedulePayload(when),
          ...(offersAdvance(kind, when.rhythm) &&
          when.withAdvance &&
          when.advanceAmount.trim()
            ? {
                advance: {
                  day: when.advanceDay,
                  amount: parseTypedAmount(when.advanceAmount) ?? 0,
                  description: t("recurring.advanceWord"),
                },
              }
            : {}),
          ...(when.startsOn ? { startsOn: when.startsOn } : {}),
          ...(when.endsOn ? { endsOn: when.endsOn } : {}),
          // Only when the question was on screen.
          ...(pastThisMonth.length > 0
            ? { startThisMonth: when.startThisMonth }
            : {}),
        })
      : await createTransaction({
          categoryId: resolvedCategoryId,
          amount: amountInputToNumber(amount),
          occurredOn: when.occurredOn,
          note: note.trim() || undefined,
        });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticSuccess();
    setSavedCount((count) => count + 1);

    if (andAnother) {
      // Keep the kind, the category, the day and the schedule: a catch-up is
      // usually several entries from the same day, often the same shop.
      setAmount("");
      setNote("");
      setTray("keypad");
      return;
    }

    setJustSaved(true);
    const message = when.recurring
      ? t("recurring.savedHint")
      : t("quickAdd.saved");
    closing.current = setTimeout(() => {
      toast(message, "success");
      onClose();
      if (!when.recurring) {
        offerReminders();
      }
    }, SAVED_BEAT_MS);
  }

  // The first save is when reminders are offered: in context, once, on a
  // toast (`shouldOfferReminders`).
  function offerReminders() {
    void shouldOfferReminders().then((offer) => {
      if (!offer) {
        return;
      }
      void markRemindersAsked();
      toast(t("notifyAsk.question"), "default", {
        actionLabel: t("notifyAsk.enable"),
        onAction: () => {
          void enableReminders(locale).then(({ granted }) => {
            toast(
              granted
                ? t("profile.notificationsOn")
                : t("charges.remindNeedsPermission"),
              granted ? "success" : "error",
            );
          });
        },
      });
    });
  }

  const noteLabel = kind === "expense" ? t("entry.shop") : t("entry.label");
  const notePlaceholder =
    kind === "expense"
      ? t("quickAdd.notePlaceholder")
      : t(
          kind === "income"
            ? "entry.labelPlaceholder.income"
            : kind === "savings"
              ? "entry.labelPlaceholder.savings"
              : "entry.labelPlaceholder.investment",
        );

  return (
    <View
      style={{ height: "92%" }}
      className="overflow-hidden rounded-t-[24px] border border-b-0 border-border bg-card"
    >
      <KindGlow color={ink} />

      <View className="items-center pt-2.5">
        <View className="h-1 w-9 rounded-full bg-hairline-strong" />
      </View>

      {/* ---- title, what has been saved, close --------------------- */}
      <View className="flex-row items-center justify-between pl-5 pr-2 pt-1.5">
        <View className="flex-row items-center gap-2">
          <Text
            accessibilityRole="header"
            className="font-semibold"
            style={{ fontSize: 17 }}
          >
            {t("add.title")}
          </Text>
          {savedCount > 0 ? (
            <Animated.View
              entering={FADE_IN}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
                backgroundColor: withAlpha(colors.success, 0.12),
              }}
            >
              <Ionicons name="checkmark" size={ICON.sm} color={colors.success} />
              <Text className="text-xs font-medium text-success">
                {t("entry.savedCount", { count: savedCount })}
              </Text>
            </Animated.View>
          ) : null}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("quickAdd.close")}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <Ionicons name="close" size={ICON.xl} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View className="px-4 pt-1">
        <KindSwitch value={kind} onChange={changeKind} />
      </View>

      {/* ---- the figure, and the entry said back --------------------- */}
      <AmountFigure
        amount={amount}
        kind={kind}
        symbol={symbol}
        refusals={refusals}
        presses={presses}
        onPress={() => openTray("keypad")}
      />
      <Text
        variant="muted"
        numberOfLines={1}
        className="px-6 text-center text-[13px]"
        accessibilityLiveRegion="polite"
      >
        {[category?.name, note.trim(), whenLabel].filter(Boolean).join(" · ")}
      </Text>

      {/* ---- three tiles ------------------------------------------- */}
      <View className="flex-row gap-2 px-4 pt-3.5">
        <Tile
          icon="pricetag-outline"
          label={t("entry.category")}
          value={category?.name ?? t("entry.choose")}
          empty={!category}
          needed={gap === "category"}
          active={tray === "category"}
          ink={ink}
          onPress={() => openTray("category")}
        />
        <Tile
          icon={kind === "expense" ? "storefront-outline" : "text-outline"}
          label={noteLabel}
          value={note.trim() || t("entry.optional")}
          empty={!note.trim()}
          active={tray === "note"}
          ink={ink}
          onPress={() => openTray("note")}
        />
        <Tile
          icon={when.recurring ? "repeat" : "calendar-outline"}
          label={t("entry.when")}
          value={whenLabel}
          active={tray === "when"}
          ink={ink}
          onPress={() => openTray("when")}
        />
      </View>

      {/* ---- the panel that answers the tile ------------------------- */}
      <View className="mt-3.5 flex-1 border-t border-border px-4 pt-3.5">
        <Animated.View key={tray} entering={FADE_IN} style={{ flex: 1 }}>
          {tray === "keypad" ? (
            <Keypad onKey={handleKey} />
          ) : tray === "category" ? (
            <CategoryGrid
              kind={kind}
              categories={kindCategories}
              value={categoryId}
              onChange={pickCategory}
              onLeave={onClose}
            />
          ) : tray === "note" ? (
            <NotePanel
              value={note}
              onChange={setNote}
              merchants={kindMerchants}
              categories={categories}
              label={noteLabel}
              placeholder={notePlaceholder}
              onPick={pickMerchant}
              onSubmit={() => {
                if (knownShop && categoryId === "") {
                  setCategoryId(knownShop.categoryId);
                }
                setTray("keypad");
              }}
            />
          ) : (
            <WhenPanel
              kind={kind}
              value={when}
              onChange={(patch) => setWhen((current) => ({ ...current, ...patch }))}
              pastThisMonth={pastThisMonth}
            />
          )}
        </Animated.View>
      </View>

      {error ? (
        <Text className="px-5 pt-2 text-sm text-destructive">
          {resolveMessage(t, error)}
        </Text>
      ) : null}

      {/* ---- save, or save and keep going --------------------------- */}
      <View className="flex-row gap-2 border-t border-border px-4 pb-6 pt-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("entry.saveAnother")}
          accessibilityState={{ disabled: Boolean(gap) || pending }}
          disabled={Boolean(gap) || pending || justSaved}
          onPress={() => void save(true)}
          style={{ opacity: gap ? 0.4 : 1 }}
          className="h-[52px] w-[52px] items-center justify-center rounded-2xl border border-hairline-strong active:bg-secondary"
        >
          <Ionicons name="add" size={ICON.xl + 2} color={colors.foreground} />
        </Pressable>
        <SaveButton
          gap={gap}
          pending={pending}
          justSaved={justSaved}
          amount={signedAmount}
          onPress={() => void save(false)}
        />
      </View>
    </View>
  );
}

/** The kind's colour, faint, behind the figure: the light the sheet is lit by. */
function KindGlow({ color }: { color: string }) {
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 h-64">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="kind-glow" cx="50%" cy="38%" rx="62%" ry="62%">
            <Stop offset="0" stopColor={color} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#kind-glow)" />
      </Svg>
    </View>
  );
}

function Tile({
  icon,
  label,
  value,
  empty = false,
  needed = false,
  active,
  ink,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  empty?: boolean;
  /** The one thing still missing: a dot in the kind's colour. */
  needed?: boolean;
  active: boolean;
  ink: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={{
        borderColor: active ? withAlpha(ink, 0.7) : colors.border,
        backgroundColor: active
          ? withAlpha(ink, 0.07)
          : "rgba(236,236,241,0.04)",
      }}
      className="flex-1 gap-1 rounded-2xl border px-2.5 pb-2.5 pt-2 active:opacity-70"
    >
      <View className="flex-row items-center gap-1">
        <Ionicons name={icon} size={ICON.sm} color={colors.mutedForeground} />
        <Text
          numberOfLines={1}
          className="flex-1 text-[11px] font-semibold text-muted-foreground"
        >
          {label}
        </Text>
        {needed ? (
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        className={cn(
          "text-sm",
          empty ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {value}
      </Text>
    </Pressable>
  );
}

/**
 * Says what it will do, or what it still needs: « Saisissez un montant »,
 * « Choisissez une catégorie », then « Enregistrer −42,50 € », and for a
 * beat after the tap, « Enregistrée » with a check.
 */
function SaveButton({
  gap,
  pending,
  justSaved,
  amount,
  onPress,
}: {
  gap: ReturnType<typeof entryGap>;
  pending: boolean;
  justSaved: boolean;
  amount: string;
  onPress: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const disabled = Boolean(gap) || pending;
  const state = justSaved
    ? "saved"
    : pending
      ? "pending"
      : gap
        ? `gap-${gap}`
        : "ready";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: pending }}
      disabled={disabled || justSaved}
      onPress={onPress}
      style={{
        backgroundColor: disabled ? colors.secondary : colors.primary,
      }}
      className="h-[52px] flex-1 items-center justify-center rounded-2xl px-3 active:opacity-80"
    >
      <Animated.View
        key={state}
        entering={FADE_IN}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        {justSaved ? (
          <Ionicons
            name="checkmark-circle"
            size={ICON.xl}
            color={colors.primaryForeground}
          />
        ) : null}
        <Text
          numberOfLines={1}
          className="font-semibold"
          style={{
            fontSize: 15.5,
            color: disabled ? colors.mutedForeground : colors.primaryForeground,
          }}
        >
          {justSaved
            ? t("entry.saved")
            : pending
              ? t("quickAdd.saving")
              : gap === "amount"
                ? t("entry.gap.amount")
                : gap === "category"
                  ? t("entry.gap.category")
                  : t("quickAdd.save")}
          {!gap && !pending && !justSaved ? (
            <Text
              style={{
                fontFamily: "Fraunces-SemiBold",
                fontSize: 16,
                color: colors.primaryForeground,
                fontVariant: ["tabular-nums"],
              }}
            >
              {` ${amount}`}
            </Text>
          ) : null}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
