import { Pressable, View } from "react-native";

import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import {
  computeDayTotals,
  formatShortAmount,
  plannedTotals,
  type CalendarDay,
} from "@finance/core/calendar";
import { formatLongDate } from "@finance/core/constants";
import { weekdayShortMondayFirst } from "@finance/core/i18n/calendar-names";
import type { TransactionWithCategory } from "@finance/core/types/database";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface CalendarGridProps {
  weeks: CalendarDay[][];
  byDate: Map<string, TransactionWithCategory[]>;
  plannedByDate: Map<string, PlannedOccurrence[]>;
  selectedDate: string;
  /** The day a finger is on in the strip above, lit as it would be here. */
  litDate?: string | null;
  /**
   * The wallets the bank debits from the account (Bitstack): their buys are
   * money out, where a DCA bought at the broker's is not.
   */
  debited?: ReadonlySet<string>;
  onSelect: (date: string) => void;
}

/** Small enough for seven to a row; shrinks rather than wraps or clips. */
const CELL_AMOUNT = { fontSize: 10, lineHeight: 12 } as const;

function CellAmount({
  sign,
  amount,
  className,
}: {
  sign: "+" | "−";
  amount: number;
  className: string;
}) {
  const locale = useLocale();
  return (
    <PrivateAmount
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      className={cn("font-medium", className)}
      style={CELL_AMOUNT}
    >
      {`${sign}${formatShortAmount(amount, locale)}`}
    </PrivateAmount>
  );
}

/**
 * The month as a grid of days, each saying what came in and went out — the
 * web's calendar at phone width.
 *
 * It used to mark a day with a dot, which said that something happened and
 * nothing about what: the day of the rent and the day of a coffee looked the
 * same. The amounts are the web's short form ("+1,2 k", "−84"), without the
 * currency symbol: seven columns leave about forty points a day, and the
 * selected day's detail below carries the full figures. A day with nothing
 * recorded shows what is planned for it, muted — what the day is expected to
 * hold, not what it did.
 *
 * Today is an inset hairline and the day being read is a raised ground, so
 * both can be true at once and neither spends the accent on a grid that
 * repeats it forty-two times.
 */
export function CalendarGrid({
  weeks,
  byDate,
  plannedByDate,
  selectedDate,
  litDate = null,
  debited,
  onSelect,
}: CalendarGridProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();

  return (
    // Flat and edge to edge, as the web draws it at phone width: no card,
    // no corners, the days divided by hairlines and the selection a raised
    // ground.
    <View className="-mx-4">
      <View className="flex-row border-b border-border/40">
        {weekdayShortMondayFirst(locale).map((name, index) => (
          <Text
            key={`${name}-${index}`}
            numberOfLines={1}
            className="flex-1 py-2.5 text-center font-medium uppercase tracking-wide text-muted-foreground"
            style={{ fontSize: 11 }}
          >
            {/* The initial, as the web's grid shows at this width. */}
            {name.charAt(0)}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View
          key={weekIndex}
          className={cn(
            "flex-row",
            weekIndex < weeks.length - 1 && "border-b border-border/40",
          )}
        >
          {week.map((day, dayIndex) => {
            const totals = computeDayTotals(
              byDate.get(day.date) ?? [],
              debited,
            );
            const planned =
              totals.count === 0 && day.isCurrentMonth
                ? plannedTotals(plannedByDate.get(day.date) ?? [], debited)
                : null;
            const selected = day.date === selectedDate;

            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t("calendarView.dayLabel", {
                  day: formatLongDate(day.date, locale),
                  entries:
                    totals.count > 0
                      ? t("ledger.entryCount", { count: totals.count })
                      : planned
                        ? t("ledger.planned")
                        : t("calendarView.noTransactions"),
                })}
                onPress={() => {
                  void hapticLight();
                  onSelect(day.date);
                }}
                className={cn(
                  "min-h-16 flex-1 p-1.5",
                  dayIndex < week.length - 1 && "border-r border-border/40",
                  selected && "bg-muted",
                  // Lit from the strip above, as the finger would.
                  !selected && day.date === litDate && "bg-muted/30",
                )}
              >
                {day.isToday ? (
                  <View
                    pointerEvents="none"
                    className="absolute inset-0 border"
                    style={{ borderColor: colors.hairlineStrong }}
                  />
                ) : null}
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    !day.isCurrentMonth && "text-muted-foreground",
                  )}
                >
                  {String(day.day)}
                </Text>
                <View className="mt-auto">
                  {totals.income > 0 ? (
                    <CellAmount
                      sign="+"
                      amount={totals.income}
                      className="text-success"
                    />
                  ) : null}
                  {totals.outflow > 0 ? (
                    <CellAmount
                      sign="−"
                      amount={totals.outflow}
                      className="text-destructive"
                    />
                  ) : null}
                  {planned && planned.income > 0 ? (
                    <CellAmount
                      sign="+"
                      amount={planned.income}
                      className="text-muted-foreground"
                    />
                  ) : null}
                  {planned && planned.outflow > 0 ? (
                    <CellAmount
                      sign="−"
                      amount={planned.outflow}
                      className="text-muted-foreground"
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
