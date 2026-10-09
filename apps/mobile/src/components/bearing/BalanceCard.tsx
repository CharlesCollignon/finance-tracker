import { useState } from "react";
import { Pressable, View } from "react-native";
import { formatMonthLabel, formatShortDate } from "@finance/core/constants";
import { balanceExplanation } from "@finance/core/month-balance";
import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { BalanceCurve } from "@/components/bearing/BalanceCurve";
import { DcaStrip } from "@/components/bearing/DcaStrip";
import { LeftToSpendLine } from "@/components/bearing/LeftToSpendLine";
import { Text } from "@/components/ui/Text";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { DeltaChip, Pill } from "@/components/bearing/card-parts";

/* ------------------------------------------------------------ the balance */

export function BalanceCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const { balance, source, upcoming } = data;
  const net = balance.basis === "net";
  const monthLabel = formatMonthLabel(data.year, data.month, locale);
  const [howOpen, setHowOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);

  // The two figures, named by what they can claim.
  const figures = ((): {
    left: { label: string; value: number };
    right?: { label: string; value: number };
    delta?: number;
  } => {
    if (balance.period === "current") {
      return {
        left: {
          label: net ? t("bearingMonth.netSoFar") : t("bearingMonth.onAccount"),
          value: balance.today ?? 0,
        },
        right: {
          label: net
            ? t("bearingMonth.netByEnd")
            : t("bearingMonth.expectedEnd"),
          value: balance.end,
        },
        delta: balance.end - (balance.today ?? 0),
      };
    }
    if (balance.period === "past") {
      return net
        ? { left: { label: t("bearingMonth.netMonth"), value: balance.end } }
        : {
            left: {
              label: t("bearingMonth.startedWith"),
              value: balance.start,
            },
            right: { label: t("bearingMonth.endedWith"), value: balance.end },
            delta: balance.end - balance.start,
          };
    }
    return net
      ? { left: { label: t("bearingMonth.netByEnd"), value: balance.end } }
      : {
          left: {
            label: t("bearingMonth.expectedStart"),
            value: balance.start,
          },
          right: { label: t("bearingMonth.expectedEnd"), value: balance.end },
          delta: balance.end - balance.start,
        };
  })();

  const caption =
    balance.period === "future"
      ? t("bearingMonth.plannedOnly")
      : net
        ? t("bearingMonth.netCaption")
        : source === "bank"
          ? t("bearingMonth.fromBank")
          : source === "reading"
            ? t("bearingMonth.fromReading")
            : t("bearingMonth.fromClose");

  // Only for a balance. A month's running net dips below zero every month
  // before payday, and flagging that as the account's lowest point would be
  // an alarm about a figure that is not a balance at all.
  const lowest = balance.lowest;
  const showLowest =
    !net &&
    lowest !== null &&
    balance.period !== "past" &&
    lowest.value < Math.min(balance.end, balance.today ?? balance.start);
  // Red only where a balance is below zero — an overdrawn account. A net
  // below zero is spending before income, which is most of every month.
  const overdrawn = (value: number) => !net && value < 0;

  return (
    <View className="gap-5 rounded-card border border-border bg-card/70 p-card">
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-muted-foreground">
          {figures.left.label}
        </Text>
        <AnimatedAmount
          value={figures.left.value}
          format={format}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
          className={
            overdrawn(figures.left.value) ? "text-destructive" : undefined
          }
        />
        <Text variant="muted" className="text-xs">
          {caption}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: howOpen }}
          hitSlop={8}
          onPress={() => setHowOpen((open) => !open)}
          className="self-start"
        >
          <Text variant="muted" className="text-xs underline">
            {t("bearingMonth.how.title")}
          </Text>
        </Pressable>
        {howOpen ? (
          <Text variant="muted" className="text-xs leading-relaxed">
            {t(`bearingMonth.how.${balanceExplanation(balance, source)}`)}
          </Text>
        ) : null}
        {/* With several current accounts, the figure read from the bank
            taken apart: the day it was read, which is today or the
            month's last. */}
        {data.accounts && balance.period !== "future" ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: accountsOpen }}
              hitSlop={8}
              onPress={() => setAccountsOpen((open) => !open)}
              className="self-start"
            >
              <Text variant="muted" className="text-xs underline">
                {balance.period === "past"
                  ? t("bearingMonth.byAccountEnd")
                  : t("bearingMonth.byAccount")}
              </Text>
            </Pressable>
            {accountsOpen ? (
              <View className="gap-1">
                {data.accounts.map((account) => (
                  <View
                    key={account.name}
                    className="flex-row items-baseline justify-between gap-6"
                  >
                    <Text
                      variant="muted"
                      numberOfLines={1}
                      className="min-w-0 flex-1 text-xs"
                    >
                      {account.name}
                    </Text>
                    <PrivateAmount
                      className={
                        account.amount < 0
                          ? "text-xs text-destructive"
                          : "text-xs text-foreground"
                      }
                    >
                      {format(account.amount)}
                    </PrivateAmount>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {figures.right ? (
        <View className="flex-row items-end justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-sm font-medium text-muted-foreground">
              {figures.right.label}
            </Text>
            <AnimatedAmount
              value={figures.right.value}
              format={format}
              style={TYPE.figure}
              numberOfLines={1}
              adjustsFontSizeToFit
              className={
                overdrawn(figures.right.value) ? "text-destructive" : undefined
              }
            />
          </View>
          {figures.delta !== undefined ? (
            <DeltaChip
              value={figures.delta}
              label={t("bearingMonth.fromToday", {
                amount: format(figures.delta),
              })}
            />
          ) : null}
        </View>
      ) : null}

      {/* The question the screen is opened for at the till, in one line
          between the figures and the line they sit on. */}
      {data.left ? (
        <LeftToSpendLine
          left={data.left}
          lowest={balance.lowest}
          eachMonth={data.eachMonth}
        />
      ) : null}

      <BalanceCurve
        points={balance.points}
        outflows={data.outflows}
        today={balance.period === "current" ? data.today : null}
        format={format}
        label={t(
          net ? "bearingMonth.netChartLabel" : "bearingMonth.chartLabel",
          { month: monthLabel },
        )}
      />

      {showLowest ||
      (upcoming && (upcoming.arriving > 0 || upcoming.leaving > 0)) ? (
        <View className="flex-row flex-wrap gap-2">
          {showLowest && lowest ? (
            <Pill tone={lowest.value < 0 ? "danger" : "default"}>
              {t(
                balance.period === "current"
                  ? "bearingMonth.lowestAhead"
                  : "bearingMonth.lowest",
                {
                  amount: format(lowest.value),
                  date: formatShortDate(lowest.date, locale),
                },
              )}
            </Pill>
          ) : null}
          {upcoming && upcoming.arriving > 0 ? (
            <Pill dot={colors.success}>
              {t("bearingMonth.toComeIn", {
                amount: format(upcoming.arriving),
              })}
            </Pill>
          ) : null}
          {upcoming && upcoming.leaving > 0 ? (
            <Pill dot={colors.destructive}>
              {t("bearingMonth.toGoOut", { amount: format(upcoming.leaving) })}
            </Pill>
          ) : null}
        </View>
      ) : null}

      {/* The transfer to the broker the DCAs need, one line under the
          curve it takes money out of. */}
      {data.dca ? (
        <DcaStrip month={data.dca} proposal={data.dcaProposal} />
      ) : null}

    </View>
  );
}
