import { View } from "react-native";

import {
  ENVELOPE_SHORT_KEYS,
  breakdownAccounts,
  breakdownParts,
  type EnvelopeId,
  type EnvelopeShare,
} from "@finance/core/future-plan";

import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";
import { CHART_COLORS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Never the gold: that is for what a page wants decided, or celebrated. In
 * the web's order (`SHARE_COLORS` in `LongViewCard.tsx`, chart-4, -2, -3,
 * -5), so an account wears the same colour on both, and in the year ahead.
 */
export const SHARE_COLORS = [
  CHART_COLORS[3],
  CHART_COLORS[1],
  CHART_COLORS[2],
  CHART_COLORS[4],
] as const;

/** Past four, the rest are one "Others", so the line stays one line. */
const MAX_SHOWN = SHARE_COLORS.length;

interface Slice {
  key: EnvelopeId | "others";
  label: string;
  value: number;
  color: string;
}

/**
 * Which account the future money is in, said quietly under the figure: a
 * thin bar split by account, and one muted line naming them. It follows the
 * year under the finger on the chart, else the horizon.
 *
 * The accounts shown are the four biggest at the horizon, in the long
 * view's order, and keep their colour while the finger moves — a colour
 * follows an account, never its rank.
 */
export function AccountsBreakdown({
  shares,
  horizon,
  money,
}: {
  /** The year being read. */
  shares: readonly EnvelopeShare[];
  /** The horizon, which decides the accounts shown and their colours. */
  horizon: readonly EnvelopeShare[];
  /** Already masked when amounts are hidden. */
  money: (value: number) => string;
}) {
  const t = useT();
  const colors = useThemeColors();

  if (horizon.filter((share) => share.netValue > 0).length < 2) {
    return null;
  }
  // Named, and placed, from the horizon; then held while the finger moves,
  // so a colour stays with its account (`breakdownAccounts`).
  const named = breakdownAccounts(horizon, MAX_SHOWN);
  const slices: Slice[] = breakdownParts(shares, named).map((part) => ({
    key: part.id,
    label:
      part.id === "others"
        ? t("placementsPhone.breakdownOthers")
        : t(ENVELOPE_SHORT_KEYS[part.id]),
    value: part.netValue,
    color:
      part.slot === null
        ? colors.mutedForeground
        : SHARE_COLORS[part.slot % SHARE_COLORS.length],
  }));

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return null;
  }
  const visible = slices.filter((slice) => slice.value > 0);

  return (
    <View
      accessible
      accessibilityLabel={`${t("accounts.breakdown")}. ${visible
        .map((slice) => `${slice.label} ${money(slice.value)}`)
        .join(", ")}`}
      className="mt-1 gap-1.5"
    >
      <View className="h-1.5 flex-row overflow-hidden rounded-full">
        {visible.map((slice, index) => (
          <View
            key={slice.key}
            style={{
              flex: slice.value / total,
              backgroundColor: slice.color,
              marginLeft: index === 0 ? 0 : 2,
            }}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
        {visible.map((slice) => (
          <View key={slice.key} className="flex-row items-center gap-1">
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <Text variant="muted" className="text-xs tabular-nums">
              {slice.label} {money(slice.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
