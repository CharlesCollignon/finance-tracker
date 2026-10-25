import { useState } from "react";
import { TextInput, View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import { INTL_LOCALES } from "@finance/core/i18n/locale";

import { Text } from "@/components/ui/Text";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useLocale } from "@/providers/LocaleProvider";
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
