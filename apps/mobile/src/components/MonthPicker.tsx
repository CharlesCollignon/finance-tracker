import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
} from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  /**
   * The month a whole screen is about — the Journal, the calendar: a larger
   * label, and the line under it that says "this month" or offers the way
   * back to it. A panel that only needs a month to read leaves this off.
   */
  prominent?: boolean;
}

/**
 * The month, compact and centred — the web's picker (`MonthPicker.tsx` on
 * the web), adapted to a phone.
 *
 * Round outlined arrows either side, and the month itself is a button: it
 * opens a year of months, so going back to January is one tap rather than
 * eight. The web floats its "this month" chip beside the label; a phone has
 * no room there without pushing the month off centre, so the line under the
 * label carries it instead — a quiet "Ce mois-ci" on this month, a way back
 * on any other — and the line is always there, so nothing jumps when the
 * month changes.
 */
export function MonthPicker({
  year,
  month,
  onChange,
  prominent = false,
}: MonthPickerProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const current = getCurrentMonth();
  const away = current.year !== year || current.month !== month;
  const [gridOpen, setGridOpen] = useState(false);

  function step(delta: number) {
    void hapticSelection();
    const next = shiftMonth(year, month, delta);
    onChange(next.year, next.month);
  }

  return (
    <View className="items-center">
      <View className="flex-row items-center justify-center gap-2">
        <ArrowButton
          icon="chevron-back"
          label={t("common.previousMonth")}
          onPress={() => step(-1)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.pickAMonth")}
          onPress={() => {
            void hapticLight();
            setGridOpen(true);
          }}
          hitSlop={6}
          className="min-h-11 min-w-36 flex-row items-center justify-center gap-1 rounded-control px-3"
        >
          <Text
            accessibilityRole={prominent ? "header" : undefined}
            numberOfLines={1}
            className="font-semibold"
            style={{ fontSize: prominent ? 18 : 16 }}
          >
            {formatMonthLabel(year, month, locale)}
          </Text>
          <Ionicons
            name="chevron-down"
            size={ICON.sm}
            color={colors.mutedForeground}
          />
        </Pressable>
        <ArrowButton
          icon="chevron-forward"
          label={t("common.nextMonth")}
          onPress={() => step(1)}
        />
      </View>

      {prominent ? (
        <View className="h-7 items-center justify-center">
          {away ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                void hapticLight();
                onChange(current.year, current.month);
              }}
              className="rounded-full border border-border px-2.5 py-0.5"
            >
              <Text className="text-xs font-medium text-muted-foreground">
                {t("common.backToThisMonth")}
              </Text>
            </Pressable>
          ) : (
            <Text variant="muted" className="text-xs">
              {t("common.thisMonth")}
            </Text>
          )}
        </View>
      ) : null}

      <MonthGrid
        open={gridOpen}
        year={year}
        month={month}
        onClose={() => setGridOpen(false)}
        onPick={(y, m) => {
          setGridOpen(false);
          onChange(y, m);
        }}
      />
    </View>
  );
}

function ArrowButton({
  icon,
  label,
  onPress,
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full border border-border"
    >
      <Ionicons name={icon} size={ICON.md} color={colors.foreground} />
    </Pressable>
  );
}

/** A year of months, opened from the label: one tap to any month. */
function MonthGrid({
  open,
  year,
  month,
  onClose,
  onPick,
}: {
  open: boolean;
  year: number;
  month: number;
  onClose: () => void;
  onPick: (year: number, month: number) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const current = getCurrentMonth();
  const [shownYear, setShownYear] = useState(year);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onShow={() => setShownYear(year)}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("common.cancel")}
          className="flex-1"
          onPress={onClose}
        />
        <View className="rounded-t-card border border-border bg-card p-card pb-10">
          <SheetGrabber />
          <View className="mb-4 flex-row items-center justify-between">
            <ArrowButton
              icon="chevron-back"
              label={t("common.previousYear")}
              onPress={() => setShownYear((value) => value - 1)}
            />
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {String(shownYear)}
            </Text>
            <ArrowButton
              icon="chevron-forward"
              label={t("common.nextYear")}
              onPress={() => setShownYear((value) => value + 1)}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => {
              const selected = shownYear === year && m === month;
              const isCurrent =
                shownYear === current.year && m === current.month;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={formatMonthLabel(shownYear, m, locale)}
                  onPress={() => {
                    void hapticSelection();
                    onPick(shownYear, m);
                  }}
                  className={cn(
                    "h-12 items-center justify-center rounded-control border",
                    selected
                      ? "border-foreground bg-foreground"
                      : "border-border",
                  )}
                  style={{ width: "23%" }}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      selected ? "text-background" : "text-foreground",
                    )}
                  >
                    {monthShort(m, locale)}
                  </Text>
                  {isCurrent && !selected ? (
                    <View
                      className="mt-0.5 h-1 w-1 rounded-full"
                      style={{ backgroundColor: colors.foreground }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
