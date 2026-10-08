import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { affordAnswer, type AffordCadence } from "@finance/core/afford";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatDayMonth, formatShortDate } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { LeftToSpend } from "@finance/core/left-to-spend";

import { PrivateAmount } from "@/components/PrivateAmount";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { recordAffordAsked } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type T = ReturnType<typeof useT>;

/** "jusqu'au 28 oct." — or, for what is missing, "d'ici le 28 oct.". */
function untilLabel(
  t: T,
  locale: Locale,
  payDay: string | null,
  short: boolean,
): string {
  return payDay
    ? t(short ? "leftToSpend.byPayDay" : "leftToSpend.untilPayDay", {
        date: formatDayMonth(payDay, locale),
      })
    : t(short ? "leftToSpend.byMonthEnd" : "leftToSpend.untilMonthEnd");
}

/**
 * « Il vous reste », one line in the balance card, as on the web: what the
 * account can still give before the next pay day, with the charges due by
 * then and the marge already taken off (`@finance/core/left-to-spend`).
 *
 * Below zero it says what is missing, in the ordinary colour: the overdraft
 * warning is the alarm, and this is the arithmetic behind it. The line opens
 * « Puis-je me permettre ? », where « Comment c'est calculé ? » waits too.
 */
export function LeftToSpendLine({
  left,
  lowest,
  eachMonth,
}: {
  left: LeftToSpend;
  /** The balance's lowest point from today, for the question's answer. */
  lowest: { date: string; value: number } | null;
  /** « Reste chaque mois », for a monthly one; null without an income. */
  eachMonth: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const [howOpen, setHowOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const short = left.amount < 0;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t("afford.title")}
        onPress={() => {
          void hapticLight();
          setAsking(true);
          recordAffordAsked();
        }}
        className="flex-row items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5"
      >
        <Text variant="muted" className="min-w-0 flex-1 text-sm">
          {t(short ? "leftToSpend.missing" : "leftToSpend.title")}{" "}
          <PrivateAmount className="text-sm font-semibold text-foreground">
            {format(Math.abs(left.amount))}
          </PrivateAmount>{" "}
          {untilLabel(t, locale, left.payDay, short)}
          {left.perDay !== null ? " · " : null}
          {left.perDay !== null ? (
            <PrivateAmount className="text-sm text-muted-foreground">
              {t("leftToSpend.perDay", { amount: format(left.perDay) })}
            </PrivateAmount>
          ) : null}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={ICON.sm}
          color={colors.mutedForeground}
        />
      </Pressable>

      <Modal
        visible={asking}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setAsking(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable
            className="flex-1"
            accessibilityLabel={t("quickAdd.close")}
            onPress={() => setAsking(false)}
          />
          <View className="max-h-[80%] rounded-t-card border border-border bg-card">
            <View className="items-center pt-3">
              <SheetGrabber />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-1 pt-3">
              <Text
                accessibilityRole="header"
                className="font-semibold"
                style={{ fontSize: 18 }}
              >
                {t("afford.title")}
              </Text>
              <Pressable
                onPress={() => setAsking(false)}
                accessibilityLabel={t("quickAdd.close")}
                hitSlop={8}
              >
                <Text variant="muted">{t("quickAdd.close")}</Text>
              </Pressable>
            </View>
            <ScrollView
              className="px-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {asking ? (
                <AffordForm left={left} lowest={lowest} eachMonth={eachMonth} />
              ) : null}
              <View className="gap-1.5 pb-10">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: howOpen }}
                  hitSlop={8}
                  onPress={() => setHowOpen((open) => !open)}
                  className="self-start"
                >
                  <Text variant="muted" className="text-xs underline">
                    {t("leftToSpend.how.title")}
                  </Text>
                </Pressable>
                {howOpen ? (
                  <View className="gap-1.5">
                    <Text variant="muted" className="text-xs leading-relaxed">
                      {t("leftToSpend.how.body")}
                    </Text>
                    <Text variant="muted" className="text-xs leading-relaxed">
                      {t(left.payDay ? "leftToSpend.how.payDay" : "leftToSpend.how.monthEnd")}
                    </Text>
                    {left.marge > 0 ? (
                      <PrivateAmount className="text-xs leading-relaxed text-muted-foreground">
                        {t("leftToSpend.how.marge", {
                          count: left.days,
                          amount: format(left.marge),
                        })}
                      </PrivateAmount>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

/** An amount, how often, and what it would leave. Nothing is saved. */
function AffordForm({
  left,
  lowest,
  eachMonth,
}: {
  left: LeftToSpend;
  lowest: { date: string; value: number } | null;
  eachMonth: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [value, setValue] = useState("");
  const [cadence, setCadence] = useState<AffordCadence>("once");
  const amount = parseTypedAmount(value);
  const answer =
    amount !== null && amount > 0
      ? affordAnswer({ left, lowest, eachMonth, amount, cadence })
      : null;
  const short = answer !== null && answer.leftAfter < 0;

  return (
    <View className="gap-4 pb-5 pt-3">
      <View className="gap-1.5">
        <Text className="text-sm font-medium">{t("afford.amount")}</Text>
        <Input
          keyboardType="decimal-pad"
          placeholder={t("monthClose.balancePlaceholder")}
          value={value}
          onChangeText={setValue}
          accessibilityLabel={t("afford.amount")}
          autoFocus
        />
      </View>
      <ChoiceChips
        label={t("afford.cadence")}
        fill
        options={[
          { value: "once", label: t("afford.once") },
          { value: "monthly", label: t("afford.monthly") },
        ]}
        value={cadence}
        onChange={setCadence}
      />
      <View accessibilityLiveRegion="polite" className="gap-2">
        {answer ? (
          <>
            <PrivateAmount className="text-base font-semibold">
              {t(short ? "afford.missingAfter" : "afford.leftAfter", {
                amount: format(Math.abs(answer.leftAfter)),
                until: untilLabel(t, locale, left.payDay, short),
              })}
            </PrivateAmount>
            {answer.lowestAfter ? (
              <PrivateAmount
                className={
                  answer.lowestAfter.value < 0
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                {t("afford.lowestAfter", {
                  amount: format(answer.lowestAfter.value),
                  date: formatShortDate(answer.lowestAfter.date, locale),
                })}
              </PrivateAmount>
            ) : null}
            {answer.eachMonthAfter !== null ? (
              <PrivateAmount className="text-sm text-muted-foreground">
                {t("afford.eachMonthAfter", {
                  amount: format(answer.eachMonthAfter),
                })}
              </PrivateAmount>
            ) : null}
          </>
        ) : null}
      </View>
      <Text variant="muted" className="text-xs">
        {t("afford.nothingSaved")}
      </Text>
    </View>
  );
}
