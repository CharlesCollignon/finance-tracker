import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { formatShortDate, relativeDayLabel } from "@finance/core/constants";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import type { BankMovement } from "@/lib/queries";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface RecentOnAccountProps {
  movements: BankMovement[];
}

/**
 * The last things that actually happened to the account.
 *
 * Every other block on this screen is derived — a sum, a projection, a
 * reconciliation — and a derived figure is exactly what someone doubts when
 * they are wondering whether the app has noticed the card payment they made
 * an hour ago. This is the statement itself, newest first.
 *
 * Which is why the pending rows are here too: the coffee from this morning,
 * still waiting for a category, is the evidence that the refresh worked. It
 * is marked rather than dressed up as filed.
 */
export function RecentOnAccount({ movements }: RecentOnAccountProps) {
  const formatEuro = useFormatCurrency();
  const router = useRouter();
  const colors = useThemeColors();

  if (movements.length === 0) {
    return null;
  }

  const pending = movements.filter((movement) => movement.pending).length;

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm font-medium">Last on your account</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pending > 0 ? `${pending} to review` : "Ledger"}
          onPress={() => router.push("/transactions")}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm text-primary-ink">
            {pending > 0 ? `${pending} to review` : "Ledger"}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primaryInk} />
        </Pressable>
      </View>

      <View>
        {movements.map((movement, index) => (
          <View
            key={movement.id}
            className={cn(
              "flex-row items-baseline justify-between gap-3 py-2",
              index < movements.length - 1 && "border-b border-foreground/10",
            )}
          >
            <View className="min-w-0 flex-1 flex-row items-baseline gap-3">
              <Text className="w-20 text-xs text-muted-foreground">
                {relativeDayLabel(movement.occurredOn, formatShortDate)}
              </Text>
              <View className="min-w-0 flex-1">
                {/* Truncated, unlike the review inbox where the whole bank
                    string is the decision. Here the row is a receipt: the
                    reader already knows what they bought. */}
                <Text numberOfLines={1} className="text-sm">
                  {movement.label}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-xs text-muted-foreground"
                >
                  {movement.pending
                    ? "waiting for a category"
                    : movement.ignored
                      ? "left out"
                      : (movement.categoryName ?? "in your ledger")}
                </Text>
              </View>
            </View>
            <PrivateAmount
              className={cn(
                "text-sm",
                movement.direction === "in"
                  ? "text-success"
                  : "text-destructive",
                // A row nobody has filed is not yet part of the month's
                // figures, and the amount should not read as though it were.
                movement.pending && "opacity-70",
              )}
            >
              {`${movement.direction === "in" ? "+" : "−"}${formatEuro(
                movement.amount,
              )}`}
            </PrivateAmount>
          </View>
        ))}
      </View>
    </Card>
  );
}
