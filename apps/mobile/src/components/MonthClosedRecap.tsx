import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";

import type { ClosedMonthRow } from "@/lib/queries";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface MonthClosedRecapProps {
  row: ClosedMonthRow;
  streak: number;
  /** What counts as an acceptable amount of unrecorded spending. */
  cap: number | null;
}

/**
 * What last month came to, once nobody had to be asked.
 *
 * Closing a month used to mean reading a balance off a banking app and typing
 * it in — the only thing in Pluclair that asked for a number it could not
 * work out. Where a bank is connected it can work it out, so the close now
 * happens on its own and this reports it rather than requesting it.
 *
 * Deliberately read-only, and deliberately still here. The reconciliation is
 * the one place the app admits how much it does not know, and hiding that
 * because it is now automatic would turn a claim the user could check into
 * one they simply have to trust.
 */
export function MonthClosedRecap({ row, streak, cap }: MonthClosedRecapProps) {
  const router = useRouter();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  if (row.source !== "bank" || row.status === "baseline") {
    return null;
  }

  const unrecorded = row.unrecorded ?? 0;
  const withinCap = cap === null ? unrecorded < 0.01 : unrecorded <= cap;

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm font-medium">{`${row.label} closed`}</Text>
        {streak > 1 ? (
          <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-0.5">
            <Ionicons name="flame" size={11} color={colors.foreground} />
            <Text className="text-xs font-medium">{`${streak} in a row`}</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-2">
        {row.cashChange !== null ? (
          <Text variant="muted" className="text-sm">
            {"Your account moved "}
            <PrivateAmount className="text-sm text-foreground">
              {`${row.cashChange >= 0 ? "+" : "−"}${formatEuro(Math.abs(row.cashChange))}`}
            </PrivateAmount>
            {" over the month."}
          </Text>
        ) : null}

        <Text
          className={cn(
            "text-sm",
            withinCap ? "text-success" : "text-muted-foreground",
          )}
        >
          {row.status === "over-recorded"
            ? "The ledger recorded more than the account moved — something is counted twice."
            : unrecorded < 0.01
              ? "The ledger accounts for all of it."
              : `${formatEuro(unrecorded)} of it the ledger cannot account for.`}
        </Text>
      </View>

      {row.kept !== null ? (
        <View className="flex-row flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border pt-3">
          <Text variant="muted" className="text-sm">
            {`Kept in ${row.label.split(" ")[0]}`}
          </Text>
          <PrivateAmount
            className={cn(
              "text-xl font-semibold",
              row.kept < 0 && "text-destructive",
            )}
          >
            {formatEuro(row.kept)}
          </PrivateAmount>
          {row.keptRate !== null ? (
            <Text variant="muted" className="text-sm">
              {`${row.keptRate}% of what came in`}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Every month you have closed"
        onPress={() => {
          void hapticLight();
          router.push("/planning" as Href);
        }}
        hitSlop={8}
        className="flex-row items-center gap-1 self-start"
      >
        <Text className="text-sm text-primary-ink">
          Every month you have closed
        </Text>
        <Ionicons name="arrow-forward" size={13} color={colors.primaryInk} />
      </Pressable>
    </Card>
  );
}
