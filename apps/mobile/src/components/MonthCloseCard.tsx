import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { MonthCloseSheet } from "@/components/MonthCloseSheet";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface MonthCloseCardProps {
  year: number;
  month: number;
  monthLabel: string;
  observeOn: string;
  isBaseline: boolean;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
  streak: number;
  onClosed: () => void;
}

/**
 * The month's closing moment, opposite MonthReadyCard.
 *
 * That card opens a month by filling it in from the standing instructions;
 * this one shuts it, and is the only place the app asks for something it
 * cannot work out for itself. One number, once a month, in exchange for the
 * only honest answer to "did I actually save anything" — so it leads the
 * screen rather than hiding in settings.
 */
export function MonthCloseCard({
  year,
  month,
  monthLabel,
  observeOn,
  isBaseline,
  monthlyCommitted,
  unrecordedCap,
  baseline,
  streak,
  onClosed,
}: MonthCloseCardProps) {
  const formatEuro = useFormatCurrency();
  const palette = useThemeColors();
  const [open, setOpen] = useState(false);

  const detail = isBaseline
    ? "One balance sets the starting point. From next month the app can tell you what it never saw."
    : unrecordedCap !== null
      ? `Stay under ${formatEuro(unrecordedCap)} of unrecorded spending to keep the run going.`
      : baseline !== null
        ? `A normal month for you is around ${formatEuro(baseline)} the app never sees.`
        : "One balance, and the app can work out what it never saw.";

  return (
    <>
      <Card bezel innerClassName="gap-4 p-5">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className="font-bold" style={{ fontSize: 17 }}>
              {`${monthLabel} is ready to close`}
            </Text>
            {streak > 1 ? (
              <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-0.5">
                <Ionicons name="flame" size={11} color={palette.foreground} />
                <Text className="text-xs font-medium">{String(streak)}</Text>
              </View>
            ) : null}
          </View>
          <Text variant="muted" className="mt-1 text-sm">
            {detail}
          </Text>
        </View>

        <Button
          label="Close the month"
          variant="pill"
          icon="arrow-forward"
          onPress={() => setOpen(true)}
        />
      </Card>

      <MonthCloseSheet
        open={open}
        onOpenChange={setOpen}
        year={year}
        month={month}
        monthLabel={monthLabel}
        observeOn={observeOn}
        isBaseline={isBaseline}
        monthlyCommitted={monthlyCommitted}
        unrecordedCap={unrecordedCap}
        baseline={baseline}
        onClosed={onClosed}
      />
    </>
  );
}
