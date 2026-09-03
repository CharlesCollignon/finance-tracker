import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";

import { formatShortDate, relativeDayLabel } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import type { UpcomingCharge } from "@finance/core/still-to-come";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface StillToComeProps {
  /** What is still due to leave, soonest first. */
  outgoing: UpcomingCharge[];
  /** Their sum: the header figure, so the list adds up to what it says. */
  leaving: number;
  /** What is still due to arrive, summarised under the list. */
  incoming: UpcomingCharge[];
  arriving: number;
  /** How many get their own row before the rest are pooled. */
  rows?: number;
}

/**
 * What the rest of the month still owes.
 *
 * The month has always been able to say this as one number — the month-end
 * view is exactly this projection run to the last day — but a number cannot
 * answer the question people actually have, which is whether the next big one
 * lands before or after payday. So it lists them, soonest first.
 *
 * Deliberately short. Five rows and a remainder is a glance; the full shape of
 * the month is the calendar, which is a tap away and better at it.
 */
export function StillToCome({
  outgoing,
  leaving,
  incoming,
  arriving,
  rows = 5,
}: StillToComeProps) {
  const router = useRouter();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  if (outgoing.length === 0 && incoming.length === 0) {
    return null;
  }

  const head = outgoing.slice(0, rows);
  const rest = outgoing.slice(rows);
  const restTotal = rest.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm font-medium">Still to come</Text>
        <PrivateAmount>{formatEuro(leaving)}</PrivateAmount>
      </View>

      <View>
        {head.map((charge, index) => (
          <View
            key={charge.key}
            className={cn(
              "flex-row items-center justify-between gap-3 py-2",
              index > 0 && "border-t border-border",
            )}
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-3">
              <Text className="w-20 shrink-0 text-xs text-muted-foreground">
                {relativeDayLabel(charge.occurredOn, formatShortDate)}
              </Text>
              <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                {charge.description
                  ? `${charge.name} · ${charge.description}`
                  : charge.name}
              </Text>
            </View>
            <PrivateAmount
              className={cn("text-sm", TYPE_AMOUNT_CLASS[charge.type])}
            >
              {formatEuro(charge.amount)}
            </PrivateAmount>
          </View>
        ))}
        {rest.length > 0 ? (
          <View className="flex-row items-center justify-between gap-3 border-t border-border py-2">
            <Text variant="muted" className="text-sm">
              {`${rest.length} more`}
            </Text>
            <PrivateAmount className="text-sm text-muted-foreground">
              {formatEuro(restTotal)}
            </PrivateAmount>
          </View>
        ) : null}
      </View>

      {/* Money coming in is not "still to come" in the sense the figure above
          means, but knowing whether payday lands before the big debit is half
          the reason to look at this at all. */}
      {arriving > 0 ? (
        <Text variant="muted" className="text-sm">
          <PrivateAmount className="text-sm text-success">
            {`+${formatEuro(arriving)}`}
          </PrivateAmount>
          {incoming.length === 1 && incoming[0]
            ? ` still to arrive, ${incoming[0].name} on ${relativeDayLabel(incoming[0].occurredOn, formatShortDate)}`
            : " still to arrive"}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See the month on a calendar"
        onPress={() => {
          void hapticLight();
          router.push("/calendar" as Href);
        }}
        hitSlop={8}
        className="flex-row items-center gap-1 self-start"
      >
        <Text className="text-sm text-primary-ink">
          See the month on a calendar
        </Text>
        <Ionicons name="arrow-forward" size={13} color={colors.primaryInk} />
      </Pressable>
    </Card>
  );
}
