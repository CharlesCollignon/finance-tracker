import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { parseTypedAmount } from "@finance/core/amount-input";
import { INTL_LOCALES } from "@finance/core/i18n/locale";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { percentDigits } from "./format";

/** The display currency's symbol, for the end of an amount field. */
function useCurrencySymbol(): string {
  const { currency } = useCurrency();
  const locale = useLocale();
  return (
    new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: "currency",
      currency,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? ""
  );
}

/**
 * A number typed in either language's shape — "7,5" or "7.5", "12 500" —
 * with its unit at the end. The figure follows the value until the field is
 * focused, then the typing; it commits on every keystroke that reads as a
 * number, so the projection above moves as the user types.
 */
export function NumberField({
  label,
  value,
  kind,
  onChange,
  onDone,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  decimals = 1,
}: {
  label: string;
  /** Decimals a percentage shows: two for a fee. */
  decimals?: number;
  /** Euros, or a fraction for a percentage. */
  value: number;
  kind: "money" | "percent";
  onChange: (value: number) => void;
  /** When the field is left: for a figure kept once typed, not per key. */
  onDone?: () => void;
  min?: number;
  max?: number;
}) {
  const locale = useLocale();
  const colors = useThemeColors();
  const symbol = useCurrencySymbol();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  const formatted =
    kind === "percent"
      ? percentDigits(value, locale, decimals)
      : new Intl.NumberFormat(INTL_LOCALES[locale], {
          maximumFractionDigits: 0,
        }).format(value);

  return (
    <View className="min-w-0 flex-1 gap-1">
      <Text variant="muted" numberOfLines={1} className="text-xs">
        {label}
      </Text>
      <View className="min-h-12 flex-row items-center rounded-control border border-border bg-background px-3">
        <TextInput
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          inputMode="decimal"
          selectTextOnFocus
          value={focused ? text : formatted}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => {
            setText(formatted);
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            onDone?.();
          }}
          onChangeText={(next) => {
            setText(next);
            const parsed = parseTypedAmount(next);
            if (parsed === null) {
              return;
            }
            const scaled = kind === "percent" ? parsed / 100 : parsed;
            onChange(Math.min(max, Math.max(min, scaled)));
          }}
          className="min-w-0 flex-1 py-2.5 font-sans text-base text-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        />
        <Text variant="muted" className="pl-1 text-sm">
          {kind === "percent" ? "%" : symbol}
        </Text>
      </View>
    </View>
  );
}

/**
 * A value moved in steps by a minus and a plus: the horizon, inflation, the
 * withdrawal rate. A screen reader adjusts it with the system's swipe, like
 * a native slider; the two buttons are there for everyone else.
 */
export function Stepper({
  label,
  valueText,
  hint,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  valueText: string;
  hint?: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();

  const step = (go: () => void) => () => {
    void hapticSelection();
    go();
  };

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: valueText }}
          accessibilityHint={hint}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment" && canIncrease) {
              onIncrease();
            }
            if (event.nativeEvent.actionName === "decrement" && canDecrease) {
              onDecrease();
            }
          }}
          className="min-w-0 flex-1"
        >
          <Text className="text-sm font-medium">{label}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("planPhone.stepDown")}
            accessibilityHint={label}
            disabled={!canDecrease}
            onPress={step(onDecrease)}
            className="h-12 w-12 items-center justify-center rounded-full border border-border"
            style={{ opacity: canDecrease ? 1 : 0.4 }}
          >
            <Ionicons name="remove" size={ICON.lg} color={colors.foreground} />
          </Pressable>
          <Text
            className="min-w-[68px] text-center text-base font-semibold tabular-nums"
            numberOfLines={1}
          >
            {valueText}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("planPhone.stepUp")}
            accessibilityHint={label}
            disabled={!canIncrease}
            onPress={step(onIncrease)}
            className="h-12 w-12 items-center justify-center rounded-full border border-border"
            style={{ opacity: canIncrease ? 1 : 0.4 }}
          >
            <Ionicons name="add" size={ICON.lg} color={colors.foreground} />
          </Pressable>
        </View>
      </View>
      {hint ? (
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
