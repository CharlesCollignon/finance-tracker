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
    toast(response.message ?? "Saved", "success");
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
    toast(response.message ?? "Saved", "success");
    onChanged();
  }

  return (
    <Card className="gap-4 p-4">
      <View>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="font-semibold" style={{ fontSize: 16 }}>
            Closed months
          </Text>
          {summary.streak > 0 ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent px-2.5 py-1">
              <Ionicons name="flame" size={12} color={palette.foreground} />
              <Text className="text-xs font-medium">
                {summary.bestStreak > summary.streak
                  ? `${summary.streak} in a row · best ${summary.bestStreak}`
                  : `${summary.streak} in a row`}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="muted" className="mt-1 text-sm">
          {summary.baseline !== null
            ? `A normal month costs you about ${formatEuro(summary.baseline)} the app never sees.`
            : history.length > 0
              ? "One more close and there will be a normal month to compare against."
              : "Close a month from Home and it will appear here."}
        </Text>
      </View>

      <View className="gap-2 rounded-lg border border-border p-3">
        <Text className="text-sm font-medium">Reading day</Text>
        <Text variant="muted" className="text-xs">
          Which day of the following month you read the balance on. Later is
          safer with a deferred-debit card, because the month’s card spending
          has to have landed. What matters most is that it is always the same
          day.
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
        <View className="gap-2 rounded-lg border border-border p-3">
          <Text className="text-sm font-medium">Unrecorded allowance</Text>
          <Text variant="muted" className="text-xs">
            What you are willing to spend without recording it. Coming in under
            it is what keeps a run alive.
          </Text>
          <Input
            keyboardType="decimal-pad"
            placeholder="180"
            value={capDraft}
            onChangeText={setCapDraft}
            accessibilityLabel="Unrecorded allowance"
          />
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Button
              label="Save"
              size="sm"
              disabled={pending || !capIsUsable}
              onPress={() => void saveCap(parsedCap)}
            />
            {suggested !== null && suggested !== unrecordedCap ? (
              <Button
                label={`Use ${formatEuro(suggested)}`}
                size="sm"
                variant="outline"
                disabled={pending}
                onPress={() => void saveCap(suggested)}
              />
            ) : null}
            {unrecordedCap !== null ? (
              <Button
                label="Remove"
                size="sm"
                variant="ghost"
                disabled={pending}
                onPress={() => void saveCap(null)}
              />
            ) : null}
          </View>
          {suggested === null && summary.sample < MIN_CLOSES_FOR_CAP ? (
            <Text variant="muted" className="text-xs">
              Close one more month and the app can suggest a figure from your
              own spending.
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
                      ? "Starting point"
                      : row.status === "over-recorded"
                        ? "Needs a look — more in the account than the records allow"
                        : `${formatEuro(row.unrecorded ?? 0)} never recorded`}
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
                      {`${row.keptRate}% kept`}
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
