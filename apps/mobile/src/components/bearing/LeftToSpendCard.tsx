import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { affordAnswer, type AffordCadence } from "@finance/core/afford";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatDayMonth, formatShortDate } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { LeftToSpend } from "@finance/core/left-to-spend";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";

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
 * « Il vous reste », as on the web: what the account can still give before
 * the next pay day, with the charges due by then and the marge already taken
 * off (`@finance/core/left-to-spend`).
 *
 * Below zero it says what is missing, in the ordinary colour: the overdraft
 * warning is the alarm, and this is the arithmetic behind it. The figure
 * opens « Puis-je me permettre ? ».
 */
export function LeftToSpendCard({
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
  const [howOpen, setHowOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const short = left.amount < 0;

  return (
    <View className="gap-1.5 rounded-card border border-border bg-card/70 p-card">
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t("afford.title")}
        onPress={() => {
          void hapticLight();
          setAsking(true);
        }}
        className="gap-1.5"
      >
        <Text className="text-sm font-medium text-muted-foreground">
          {t(short ? "leftToSpend.missing" : "leftToSpend.title")}
        </Text>
        <AnimatedAmount
          value={Math.abs(left.amount)}
          format={format}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text variant="muted" className="text-sm">
          {untilLabel(t, locale, left.payDay, short)}
        </Text>
        {left.perDay !== null ? (
          <PrivateAmount className="text-sm text-muted-foreground">
            {t("leftToSpend.perDay", { amount: format(left.perDay) })}
          </PrivateAmount>
        ) : null}
        <Text className="text-sm font-medium underline">
          {t("afford.title")}
        </Text>
      </Pressable>
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
    <View className="gap-4 pb-10 pt-3">
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
