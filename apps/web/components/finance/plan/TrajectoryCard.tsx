"use client";

import { useState } from "react";
import { CaretDown, ChartLineUp } from "@phosphor-icons/react";
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
import type { MixKey, ReplayAccount } from "@finance/core/history/replay";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { Key } from "@finance/core/i18n/t";
import type { YearAheadAccountId } from "@finance/core/year-ahead";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { PlanCard, Slider } from "./plan-controls";
import { TrajectoryChart } from "./TrajectoryChart";
import type { PlanReplay } from "./use-plan-replay";

const EXTRA_MAX = 500;
const EXTRA_STEP = 25;

/**
 * « Votre trajectoire »: the accounts replayed on every start since 1970.
 *
 * One figure — the middle start, in today's euros, counting to its new
 * value when the horizon moves — then the band eight starts in ten end in
 * and the worst start, named. The chart under it reads a month out to the
 * pointer. « Et si… » adds so much a month to one account and says what it
 * changes by the horizon; the fold says where the figure comes from,
 * account by account, with how often each has ended below prices.
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
}: {
  replay: PlanReplay;
  years: TrajectoryYears;
  onYears: (years: TrajectoryYears) => void;
  extra: number;
  onExtra: (extra: number) => void;
  target: YearAheadAccountId;
  onTarget: (target: YearAheadAccountId) => void;
  /** Where « Et si… » can go. */
  targets: readonly YearAheadAccountId[];
  hasProperty: boolean;
  withProperty: boolean;
  onWithProperty: (on: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  const [active, setActive] = useState<number | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const shown = replay.withExtra ?? replay.result;
  const property = replay.property;
  const plus = (values: readonly number[], offset: number) =>
    values.map((value, index) => value + (property?.[index + offset] ?? 0));
  const low = [replay.today, ...plus(shown.band.p10, 1)];
  const middle = [replay.today, ...plus(shown.band.p50, 1)];
  const high = [replay.today, ...plus(shown.band.p90, 1)];
  const homes = property?.at(-1) ?? 0;

  const endYear = new Date().getFullYear() + years;
  const extraGain =
    replay.withExtra !== null
      ? replay.withExtra.end.p50 - replay.result.end.p50
      : 0;

  // What selling everything at the horizon would leave.
  const afterTax =
    shown.end.p50 +
    homes -
    taxAtHorizon({
      result: shown,
      accounts: replay.accounts,
      envelopes: replay.envelopes,
      extra: replay.withExtra ? { monthly: extra, to: target } : null,
    });

  const scrubWhen = (index: number) =>
    index % 12 === 0
      ? t("trajectory.scrubYears", { count: index / 12 })
      : t("trajectory.scrubMonths", { count: index });

  return (
    <PlanCard
      icon={<ChartLineUp size={ICON.sm} weight="bold" />}
      title={t("trajectory.title")}
      aside={
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
          className="text-xs"
        />
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.inYearsTitle", { count: years })}
        </p>
        <AnimatedAmount
          value={Math.round(shown.end.p50 + homes)}
          format={money}
          className="font-head text-4xl tabular-nums sm:text-5xl"
        />
        <p className="text-xs text-muted-foreground">
          {t("trajectory.medianCaption")}
        </p>
      </div>

      <div className="privacy-sensitive flex min-h-10 flex-col gap-0.5 text-sm">
        {active !== null ? (
          <p className="font-medium tabular-nums">
            {t("trajectory.scrubPoint", {
              when: scrubWhen(active),
              median: money(middle[active]!),
              low: money(low[active]!),
              high: money(high[active]!),
            })}
          </p>
        ) : (
          <>
            <p className="tabular-nums">
              {t("trajectory.rangeLine", {
                low: money(shown.end.p10 + homes),
                high: money(shown.end.p90 + homes),
              })}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {t("trajectory.afterTax", { amount: money(afterTax) })}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {t("trajectory.worstLine", {
                month: historyMonthLabel(shown.worst.start, locale),
                amount: money(shown.worst.value + homes),
              })}
            </p>
          </>
        )}
      </div>

      <TrajectoryChart
        key={`${years}-${withProperty}`}
        low={low}
        middle={middle}
        high={high}
        active={active}
        onActive={setActive}
        label={t("trajectory.chartLabel")}
        format={money}
      />

      {hasProperty ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {t("trajectory.withProperty")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("trajectory.withPropertyHint")}
            </p>
          </div>
          <Switch
            checked={withProperty}
            onChange={onWithProperty}
            label={t("trajectory.withProperty")}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-control border border-border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{t("futurePlan.whatIfTitle")}</p>
          <p className="privacy-sensitive text-sm tabular-nums">
            {t("futurePlan.whatIfPerMonth", { amount: format(extra) })}
          </p>
        </div>
        <Slider
          value={extra}
          min={0}
          max={EXTRA_MAX}
          step={EXTRA_STEP}
          onChange={onExtra}
          label={t("futurePlan.whatIfLabel")}
          valueText={t("futurePlan.whatIfPerMonth", { amount: format(extra) })}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            {t("futurePlan.whatIfTo")}
            <select
              value={target}
              onChange={(event) =>
                onTarget(event.target.value as YearAheadAccountId)
              }
              aria-label={t("futurePlan.whatIfToLabel")}
              className="h-9 rounded-control border border-border bg-background px-2 text-foreground"
            >
              {targets.map((id) => (
                <option key={id} value={id}>
                  {t(trajectoryAccountKey(id))}
                </option>
              ))}
            </select>
          </label>
          <p
            className={cn(
              "privacy-sensitive tabular-nums",
              extra > 0 ? "text-primary-ink" : "text-muted-foreground",
            )}
          >
            {extra > 0
              ? t("trajectory.whatIfResult", {
                  amount: money(extraGain),
                  year: String(endYear),
                })
              : t("futurePlan.whatIfNone")}
          </p>
        </div>
      </div>

      <WhyFold
        open={whyOpen}
        onToggle={() => setWhyOpen((open) => !open)}
        replay={replay}
        years={years}
      />
    </PlanCard>
  );
}

/**
 * Where the figure comes from: each account today and at the horizon, what
 * its history is and how often it has ended below prices, the withdrawal
 * that has always lasted, and the caveat.
 */
function WhyFold({
  open,
  onToggle,
  replay,
  years,
}: {
  open: boolean;
  onToggle: () => void;
  replay: PlanReplay;
  years: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  const medians = new Map(
    replay.result.accounts.map((account) => [account.id, account.median]),
  );
  // The withdrawal's rate is what the invested accounts' history held to.
  const investedEnd = replay.result.accounts
    .filter((account) => replay.investedIds.has(account.id))
    .reduce((sum, account) => sum + account.median, 0);

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-muted-foreground transition-colors duration-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("trajectory.whyTitle")}
        <CaretDown
          size={ICON.sm}
          aria-hidden
          className={cn(
            "transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
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
          </ul>
          {replay.withdrawal && investedEnd > 0 ? (
            <p className="privacy-sensitive text-sm">
              {t("trajectory.incomeLine", {
                amount: money((investedEnd * replay.withdrawal.always) / 12),
                rate: formatPercentLabel(
                  replay.withdrawal.always * 100,
                  locale,
                ),
                years: String(replay.withdrawal.years),
              })}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("trajectory.pastNotPromise")}
          </p>
        </div>
      ) : null}
    </div>
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
  odds: { windows: number; losses: number } | null;
  years: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
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
    notes.push(
      t("trajectory.standIn", { share: percent(wallet.standInShare) }),
    );
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
    <li className="rounded-control border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {t(trajectoryAccountKey(account.id))}
        </p>
        <p className="privacy-sensitive text-sm tabular-nums">
          {t("trajectory.accountLine", {
            today: money(account.value),
            then: money(median),
          })}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{follows}</p>
      {oddsLine ? (
        <p className="text-xs text-muted-foreground">{oddsLine}</p>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="mt-1 text-xs text-muted-foreground">
          {note}
        </p>
      ))}
    </li>
  );
}
