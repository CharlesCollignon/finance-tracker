import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  MIN_CLOSES_FOR_CAP,
  monthWasWon,
  suggestUnrecordedCap,
  type CloseHistorySummary,
} from "@finance/core/month-close";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { updateCloseDay, updateUnrecordedCap } from "@/lib/mutations";
import type { ClosedMonthRow } from "@/lib/queries";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useT } from "@/providers/LocaleProvider";

interface MonthCloseHistoryCardProps {
  history: ClosedMonthRow[];
  summary: CloseHistorySummary;
  unrecordedCap: number | null;
  closeDay: number;
  onChanged: () => void;
}

const READING_DAYS = [1, 3, 5, 10, 15];

/**
 * What closing months has added up to, and the two settings that only mean
 * anything next to it. The allowance in particular: a cap picked out of the
 * air is a number to fail against, while one shown beside the user's own last
 * few months is a decision.
 */
export function MonthCloseHistoryCard({
  history,
  summary,
  unrecordedCap,
  closeDay,
  onChanged,
}: MonthCloseHistoryCardProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const palette = useThemeColors();
  const { toast } = useToast();
  const [capDraft, setCapDraft] = useState(
    unrecordedCap === null ? "" : String(unrecordedCap),
  );
  const [pending, setPending] = useState(false);

  const suggested = suggestUnrecordedCap(summary);
  const parsedCap = Number(capDraft.replace(",", "."));
  const capIsUsable = capDraft.trim() !== "" && Number.isFinite(parsedCap);

  async function saveCap(value: number | null) {
    setPending(true);
    const response = await updateUnrecordedCap(value);
    setPending(false);
    if (response.error) {
      toast(response.error, "error");
      return;
    }
    setCapDraft(value === null ? "" : String(value));
    toast(response.message ?? t("monthCloseHistory.saved"), "success");
    onChanged();
  }

  async function saveCloseDay(day: number) {
    setPending(true);
    const response = await updateCloseDay(day);
    setPending(false);
    if (response.error) {
      toast(response.error, "error");
      return;
    }
    toast(response.message ?? t("monthCloseHistory.saved"), "success");
    onChanged();
  }

  return (
    <Card className="gap-4 p-5">
      <View>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="font-semibold" style={{ fontSize: 16 }}>
            {t("monthCloseHistory.title")}
          </Text>
          {summary.streak > 0 ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent px-2.5 py-1">
              <Ionicons
                name="flame"
                size={ICON.xs}
                color={palette.foreground}
              />
              <Text className="text-xs font-medium">
                {summary.bestStreak > summary.streak
                  ? `${t("month.streakInARow", { count: summary.streak })} · ${t(
                      "month.bestStreak",
                      { count: summary.bestStreak },
                    )}`
                  : t("month.streakInARow", { count: summary.streak })}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="muted" className="mt-1 text-sm">
          {summary.baseline !== null
            ? t("monthCloseHistory.normalMonthCost", {
                amount: formatEuro(summary.baseline),
              })
            : history.length > 0
              ? t("monthCloseHistory.oneMoreForBaseline")
              : t("monthCloseHistory.closeFromSurface", {
                  surface: t("nav.plan"),
                })}
        </Text>
      </View>

      <View className="gap-2 rounded-control border border-border p-3">
        <Text className="text-sm font-medium">
          {t("monthCloseHistory.readingDayHeading")}
        </Text>
        <Text variant="muted" className="text-xs">
          {t("monthCloseHistory.readingDayHint")}
        </Text>
        <View className="flex-row flex-wrap items-center gap-1.5">
          {READING_DAYS.map((day) => (
            <Button
              key={day}
              label={String(day)}
              size="sm"
              variant={day === closeDay ? "default" : "outline"}
              disabled={pending}
              onPress={() => void saveCloseDay(day)}
            />
          ))}
        </View>
      </View>

      {history.length > 0 || unrecordedCap !== null ? (
        <View className="gap-2 rounded-control border border-border p-3">
          <Text className="text-sm font-medium">
            {t("common.unrecordedAllowance")}
          </Text>
          <Text variant="muted" className="text-xs">
            {t("monthCloseHistory.allowanceHint")}
          </Text>
          <Input
            keyboardType="decimal-pad"
            placeholder="180"
            value={capDraft}
            onChangeText={setCapDraft}
            accessibilityLabel={t("common.unrecordedAllowance")}
          />
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Button
              label={t("common.save")}
              size="sm"
              disabled={pending || !capIsUsable}
              onPress={() => void saveCap(parsedCap)}
            />
            {suggested !== null && suggested !== unrecordedCap ? (
              <Button
                label={t("monthCloseHistory.useSuggested", {
                  amount: formatEuro(suggested),
                })}
                size="sm"
                variant="outline"
                disabled={pending}
                onPress={() => void saveCap(suggested)}
              />
            ) : null}
            {unrecordedCap !== null ? (
              <Button
                label={t("common.remove")}
                size="sm"
                variant="ghost"
                disabled={pending}
                onPress={() => void saveCap(null)}
              />
            ) : null}
          </View>
          {suggested === null && summary.sample < MIN_CLOSES_FOR_CAP ? (
            <Text variant="muted" className="text-xs">
              {t("monthCloseHistory.needMoreForSuggestion")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {history.length > 0 ? (
        <View>
          {history.map((row) => {
            const won = monthWasWon(row, unrecordedCap);
            return (
              <View
                key={row.monthKey}
                className="flex-row items-baseline justify-between gap-3 border-b border-border py-2"
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium">{row.label}</Text>
                  <Text variant="muted" className="text-xs">
                    {row.status === "baseline"
                      ? t("monthCloseHistory.startingPoint")
                      : row.status === "over-recorded"
                        ? t("monthCloseHistory.needsLook")
                        : t("monthCloseHistory.neverRecordedAmount", {
                            amount: formatEuro(row.unrecorded ?? 0),
                          })}
                  </Text>
                </View>
                <View className="shrink-0 items-end">
                  {row.kept !== null ? (
                    <PrivateAmount
                      className={
                        won
                          ? "text-sm font-semibold text-success"
                          : "text-sm font-semibold"
                      }
                    >
                      {formatEuro(row.kept)}
                    </PrivateAmount>
                  ) : null}
                  {row.keptRate !== null ? (
                    <Text variant="muted" className="text-xs">
                      {t("monthCloseHistory.keptPercent", {
                        rate: row.keptRate,
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
