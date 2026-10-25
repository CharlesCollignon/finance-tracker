import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatPercentLabel } from "@finance/core/constants";
import type { WalletMix } from "@finance/core/history/mix";
import {
  TRAJECTORY_YEARS,
  type TrajectoryYears,
} from "@finance/core/history/plan-accounts";
import {
  historyMonthLabel,
  mixKeys,
  taxAtHorizon,
  trajectoryAccountKey,
} from "@finance/core/history/plan-figures";
import type {
  LossOdds,
  MixKey,
  ReplayAccount,
} from "@finance/core/history/replay";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { Key } from "@finance/core/i18n/t";
import type { YearAheadAccountId } from "@finance/core/year-ahead";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { ToggleRow } from "@/components/property/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { ExtraSlider } from "./ExtraSlider";
import { usePlanMoney } from "./format";
import { PlanCard, PlanCardHeader } from "./PlanCard";
import { TrajectoryChart } from "./TrajectoryChart";
import type { PlanReplay } from "./use-plan-replay";

const EXTRA_MAX = 500;
const EXTRA_STEP = 25;
const EXTRA_CHIPS = [50, 100, 200] as const;

/**
 * « Votre trajectoire »: the accounts replayed on every start since 1970,
 * as the web draws it.
 *
 * One figure — the middle start, in today's euros, counting to its new
 * value when the horizon moves — then the band eight starts in ten end in
 * and the worst start, named. A finger along the chart reads a month out.
 * « Et si… » adds so much a month to one account and says what it changes
 * by the horizon; the fold says where the figure comes from, account by
 * account, with how often each has ended below prices.
 */
export function TrajectoryCard({
  replay,
  years,
  onYears,
  extra,
  onExtra,
  target,
  onTarget,
  targets,
  hasProperty,
  withProperty,
  onWithProperty,
  year,
}: {
  replay: PlanReplay;
  years: TrajectoryYears;
  onYears: (years: TrajectoryYears) => void;
  /** Where the slider stands; the replay may still be on the last one. */
  extra: number;
  onExtra: (extra: number) => void;
  target: YearAheadAccountId;
  onTarget: (target: YearAheadAccountId) => void;
  /** Where « Et si… » can go. */
  targets: readonly YearAheadAccountId[];
  hasProperty: boolean;
  withProperty: boolean;
  onWithProperty: (on: boolean) => void;
  /** This year, for the year the horizon lands in. */
  year: number;
}) {
  const t = useT();
  const locale = useLocale();
  const { whole, shown } = usePlanMoney();
  const [active, setActive] = useState<number | null>(null);

  const result = replay.withExtra ?? replay.result;
  const property = replay.property;
  const plus = (values: readonly number[], offset: number) =>
    values.map((value, index) => value + (property?.[index + offset] ?? 0));
  const low = [replay.today, ...plus(result.band.p10, 1)];
  const middle = [replay.today, ...plus(result.band.p50, 1)];
  const high = [replay.today, ...plus(result.band.p90, 1)];
  const homes = property?.at(-1) ?? 0;

  const extraGain =
    replay.withExtra !== null
      ? replay.withExtra.end.p50 - replay.result.end.p50
      : 0;
  // What selling everything at the horizon would leave.
  const afterTax =
    result.end.p50 +
    homes -
    taxAtHorizon({
      result,
      accounts: replay.accounts,
      envelopes: replay.envelopes,
      extra: replay.withExtra ? { monthly: extra, to: target } : null,
    });

  const scrubWhen = (index: number) =>
    index % 12 === 0
      ? t("trajectory.scrubYears", { count: index / 12 })
      : t("trajectory.scrubMonths", { count: index });
  const endLine = t("trajectory.scrubPoint", {
    when: scrubWhen(middle.length - 1),
    median: shown(middle.at(-1) ?? 0),
    low: shown(low.at(-1) ?? 0),
    high: shown(high.at(-1) ?? 0),
  });

  return (
    <PlanCard bezel>
      <PlanCardHeader title={t("trajectory.title")} />
      <SegmentedControl
        label={t("trajectory.horizonLabel")}
        segments={TRAJECTORY_YEARS.map((each) => ({
          value: String(each),
          label: t("futurePlan.years", { count: each }),
        }))}
        value={String(years)}
        onChange={(value) => {
          setActive(null);
          onYears(Number(value) as TrajectoryYears);
        }}
      />

      <View className="gap-1">
        <Text variant="muted" className="text-sm">
          {t("futurePlan.inYearsTitle", { count: years })}
        </Text>
        <AnimatedAmount
          value={Math.round(result.end.p50 + homes)}
          format={whole}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text variant="muted" className="text-xs">
          {t("trajectory.medianCaption")}
        </Text>
      </View>

      <View className="min-h-16 gap-0.5" accessibilityLiveRegion="polite">
        {active !== null ? (
          <Text className="text-sm font-medium tabular-nums">
            {t("trajectory.scrubPoint", {
              when: scrubWhen(active),
              median: shown(middle[active] ?? 0),
              low: shown(low[active] ?? 0),
              high: shown(high[active] ?? 0),
            })}
          </Text>
        ) : (
          <>
            <Text className="text-sm tabular-nums">
              {t("trajectory.rangeLine", {
                low: shown(result.end.p10 + homes),
                high: shown(result.end.p90 + homes),
              })}
            </Text>
            <Text variant="muted" className="text-sm tabular-nums">
              {t("trajectory.afterTax", { amount: shown(afterTax) })}
            </Text>
            <Text variant="muted" className="text-sm tabular-nums">
              {t("trajectory.worstLine", {
                month: historyMonthLabel(result.worst.start, locale),
                amount: shown(result.worst.value + homes),
              })}
            </Text>
          </>
        )}
      </View>

      <View className="gap-1">
        <TrajectoryChart
          key={`${years}-${withProperty}`}
          low={low}
          middle={middle}
          high={high}
          active={active}
          onActive={setActive}
          label={`${t("trajectory.chartLabel")}. ${endLine}`}
          format={shown}
        />
        <Text variant="micro">{t("planPhone.scrubMonths")}</Text>
      </View>

      {hasProperty ? (
        <ToggleRow
          label={t("trajectory.withProperty")}
          hint={t("trajectory.withPropertyHint")}
          value={withProperty}
          onChange={onWithProperty}
        />
      ) : null}

      <WhatIf
        extra={extra}
        onExtra={onExtra}
        target={target}
        onTarget={onTarget}
        targets={targets}
        result={
          extra > 0 && replay.withExtra
            ? t("trajectory.whatIfResult", {
                amount: shown(extraGain),
                year: String(year + years),
              })
            : null
        }
      />

      <WhyFold replay={replay} years={years} />
    </PlanCard>
  );
}

/** « Et si… »: so much more a month, into the account picked under it. */
function WhatIf({
  extra,
  onExtra,
  target,
  onTarget,
  targets,
  result,
}: {
  extra: number;
  onExtra: (extra: number) => void;
  target: YearAheadAccountId;
  onTarget: (target: YearAheadAccountId) => void;
  targets: readonly YearAheadAccountId[];
  /** What the extra adds by the horizon, in a sentence. */
  result: string | null;
}) {
  const t = useT();
  const { whole } = usePlanMoney();

  return (
    <View className="gap-3 rounded-control border border-border p-3">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="min-w-0 flex-1 text-sm font-medium">
          {t("futurePlan.whatIfTitle")}
        </Text>
        <Text
          className={cn(
            "font-semibold tabular-nums",
            extra > 0 ? "text-primary" : "text-muted-foreground",
          )}
        >
          {t("futurePlan.whatIfPerMonth", { amount: whole(extra) })}
        </Text>
      </View>

      <ExtraSlider
        value={extra}
        max={EXTRA_MAX}
        step={EXTRA_STEP}
        onChange={onExtra}
        label={t("futurePlan.whatIfLabel")}
        valueText={t("futurePlan.whatIfPerMonth", { amount: whole(extra) })}
      />

      <View className="flex-row gap-2">
        {EXTRA_CHIPS.map((amount) => {
          const selected = extra === amount;
          return (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t("futurePlan.whatIfPerMonth", {
                amount: whole(amount),
              })}
              onPress={() => {
                void hapticSelection();
                onExtra(selected ? 0 : amount);
              }}
              className={cn(
                "min-h-12 flex-1 items-center justify-center rounded-full border",
                selected ? "border-foreground bg-foreground" : "border-border",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium tabular-nums",
                  selected ? "text-background" : "text-foreground",
                )}
              >
                {t("planPhone.chipExtra", { amount: whole(amount) })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("futurePlan.whatIfToLabel")}
        className="flex-row flex-wrap items-center gap-2"
      >
        <Text variant="muted" className="text-sm">
          {t("futurePlan.whatIfTo")}
        </Text>
        {targets.map((id) => {
          const on = id === target;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                void hapticSelection();
                onTarget(id);
              }}
              className={cn(
                "min-h-11 justify-center rounded-full border px-3.5",
                on ? "border-foreground/40 bg-muted" : "border-border",
              )}
            >
              <Text
                className={cn(
                  "text-sm",
                  on ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {t(trajectoryAccountKey(id))}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View accessibilityLiveRegion="polite" className="min-h-6">
        {result ? (
          <Text className="text-sm font-medium text-primary">{result}</Text>
        ) : (
          <Text variant="muted" className="text-sm">
            {t("futurePlan.whatIfNone")}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Where the figure comes from: each account today and at the horizon, what
 * its history is and how often it has ended below prices, the withdrawal
 * that has always lasted, and the caveat.
 */
function WhyFold({ replay, years }: { replay: PlanReplay; years: number }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const { shown } = usePlanMoney();
  const [open, setOpen] = useState(false);
  const medians = new Map(
    replay.result.accounts.map((account) => [account.id, account.median]),
  );
  // The withdrawal's rate is what the invested accounts' history held to.
  const investedEnd = replay.result.accounts
    .filter((account) => replay.investedIds.has(account.id))
    .reduce((sum, account) => sum + account.median, 0);

  return (
    <View className="border-t border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void hapticSelection();
          setOpen((value) => !value);
        }}
        className="min-h-12 flex-row items-center justify-between gap-3"
      >
        <Text variant="muted" className="text-sm font-medium">
          {t("trajectory.whyTitle")}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={ICON.md}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <View className="gap-3 pb-1">
          {replay.accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              median={medians.get(account.id) ?? account.value}
              wallet={replay.wallets[account.id as InvestmentWalletId]}
              odds={replay.odds.get(account.id) ?? null}
              years={years}
            />
          ))}
          {replay.withdrawal && investedEnd > 0 ? (
            <Text className="text-sm">
              {t("trajectory.incomeLine", {
                amount: shown((investedEnd * replay.withdrawal.always) / 12),
                rate: formatPercentLabel(
                  replay.withdrawal.always * 100,
                  locale,
                ),
                years: String(replay.withdrawal.years),
              })}
            </Text>
          ) : null}
          <Text variant="muted" className="text-xs">
            {t("trajectory.pastNotPromise")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function AccountRow({
  account,
  median,
  wallet,
  odds,
  years,
}: {
  account: ReplayAccount;
  median: number;
  wallet: WalletMix | undefined;
  odds: LossOdds | null;
  years: number;
}) {
  const t = useT();
  const locale = useLocale();
  const { shown } = usePlanMoney();
  const keys = mixKeys(account.mix);
  const seriesName = (key: MixKey) => t(`trajectory.series.${key}` as Key);
  const isCash = account.id === "current" || account.id === "elsewhere";

  const follows =
    account.fixedRate !== undefined
      ? t("trajectory.returnContract")
      : keys.length === 0
        ? t("trajectory.follows", { series: seriesName("cash") })
        : keys.length === 1
          ? t("trajectory.follows", { series: seriesName(keys[0]!) })
          : t("trajectory.followsMix", {
              first: seriesName(keys[0]!),
              rest: keys.slice(1).map(seriesName).join(", "),
            });
  const percent = (share: number) =>
    formatPercentLabel(Math.round(share * 100), locale);

  const notes: string[] = [];
  if (account.id === "current") {
    notes.push(t("trajectory.currentLine"));
  } else if (account.id === "elsewhere") {
    notes.push(t("trajectory.elsewhereLine"));
  }
  if ((account.mix.bitcoin ?? 0) > 0) {
    notes.push(t("trajectory.cryptoFlat"));
  }
  if (wallet && wallet.standInShare > 0.005) {
    notes.push(t("trajectory.standIn", { share: percent(wallet.standInShare) }));
  }
  if (wallet && wallet.unknownShare > 0.005 && keys[0]) {
    notes.push(
      t("trajectory.unknown", {
        share: percent(wallet.unknownShare),
        series: seriesName(keys[0]),
      }),
    );
  }

  // Bitcoin's history is too short to say how often it lost over years.
  const oddsLine =
    odds && odds.windows >= 120 && !isCash && (account.mix.bitcoin ?? 0) === 0
      ? odds.losses === 0
        ? t("trajectory.lossNever", { years: String(years), since: "1970" })
        : t("trajectory.lossLine", {
            years: String(years),
            count: String(
              Math.max(1, Math.round((odds.losses / odds.windows) * 100)),
            ),
            since: "1970",
          })
      : null;

  return (
    <View className="gap-1 rounded-control border border-border p-3">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="text-sm font-medium">
          {t(trajectoryAccountKey(account.id))}
        </Text>
        <Text className="text-sm tabular-nums">
          {t("trajectory.accountLine", {
            today: shown(account.value),
            then: shown(median),
          })}
        </Text>
      </View>
      <Text variant="muted" className="text-xs">
        {follows}
      </Text>
      {oddsLine ? (
        <Text variant="muted" className="text-xs">
          {oddsLine}
        </Text>
      ) : null}
      {notes.map((note) => (
        <Text key={note} variant="muted" className="text-xs">
          {note}
        </Text>
      ))}
    </View>
  );
}
