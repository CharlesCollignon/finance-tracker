"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { formatPercentLabel } from "@finance/core/constants";
import {
  CRASH_EPISODES,
  lossOdds,
  type CrashEpisodeId,
  type CrashTest,
} from "@finance/core/history/replay";
import type { Key } from "@finance/core/i18n/t";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { PlanCard } from "./plan-controls";
import styles from "./plan.module.css";
import { accountNameKey } from "./TrajectoryCard";
import { historyMonthLabel } from "./trajectory-data";

const EPISODES = Object.keys(CRASH_EPISODES) as CrashEpisodeId[];
const FACT_KEYS: Record<CrashEpisodeId, Key> = {
  "2000": "trajectory.fact2000",
  "2008": "trajectory.fact2008",
  "2020": "trajectory.fact2020",
  "2022": "trajectory.fact2022",
};
/** Months shown after the peak: through the recovery, a year past it. */
const SHOWN_AFTER_RECOVERY = 12;
const SHOWN_MAX = 180;

/**
 * « Face à l'histoire »: today's investments put through one of the great
 * falls since 2000, from its peak, payments carrying on — the worst month,
 * in the euros of the day, and how long until the money was worth what had
 * gone in, with and without them. Facts, said as such: nothing here says
 * what to do about them.
 *
 * With nothing invested, it says what history does to savings instead: how
 * often the Livret A has paid less than prices rose.
 */
export function HistoryCard({
  crashes,
}: {
  /** One test per fall, or null with nothing invested. */
  crashes: Record<CrashEpisodeId, CrashTest> | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  const [episode, setEpisode] = useState<CrashEpisodeId>("2008");

  const livret = useMemo(
    () => (crashes ? null : lossOdds({ mix: { "livret-a": 1 } }, 1)),
    [crashes],
  );

  const header = (
    <SegmentedControl
      label={t("trajectory.episodeLabel")}
      segments={EPISODES.map((id) => ({ value: id, label: id }))}
      value={episode}
      onChange={setEpisode}
      className="text-xs"
    />
  );

  if (!crashes) {
    return (
      <PlanCard
        icon={<ClockCounterClockwise size={ICON.sm} weight="bold" />}
        title={t("trajectory.historyTitle")}
      >
        <p className="text-sm">
          {t("trajectory.noShares", {
            count: String(
              livret ? Math.round((livret.losses / livret.windows) * 100) : 0,
            ),
          })}
        </p>
        <Link
          href="/investments"
          className="self-start text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
        >
          {t("trajectory.noSharesLink")}
        </Link>
      </PlanCard>
    );
  }

  const test = crashes[episode];
  const peak = CRASH_EPISODES[episode].peak;
  const shownMonths = Math.min(
    test.path.length,
    SHOWN_MAX,
    Math.max(
      24,
      (test.recoveredAfter ?? test.path.length) + SHOWN_AFTER_RECOVERY,
    ),
  );

  return (
    <PlanCard
      icon={<ClockCounterClockwise size={ICON.sm} weight="bold" />}
      title={t("trajectory.historyTitle")}
      aside={header}
    >
      <p className="text-sm text-muted-foreground">{t(FACT_KEYS[episode])}</p>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {t("trajectory.replayedFrom", {
            month: historyMonthLabel(peak, locale),
          })}
        </p>
        {test.low.loss < 0 ? (
          <p className="privacy-sensitive font-head text-2xl tabular-nums">
            {t("trajectory.lowLine", {
              loss: money(test.low.loss),
              share: formatPercentLabel(
                Math.round(test.low.lossShare * 100),
                locale,
              ),
              month: historyMonthLabel(test.low.month, locale),
            })}
          </p>
        ) : (
          <p className="text-sm">{t("trajectory.neverBelow")}</p>
        )}
        {test.low.loss < 0 ? (
          <p className="text-sm">
            {test.recoveredAfter !== null
              ? t("trajectory.recovered", { count: test.recoveredAfter })
              : t("trajectory.notRecovered", {
                  month: historyMonthLabel(test.path.at(-1)!.month, locale),
                })}
            {test.recoveredAfter !== null &&
            test.recoveredAfterAlone !== null &&
            test.recoveredAfterAlone !== test.recoveredAfter
              ? ` ${t("trajectory.recoveredAlone", {
                  count: test.recoveredAfterAlone,
                })}`
              : ""}
          </p>
        ) : null}
      </div>

      <CrashChart
        key={episode}
        test={test}
        months={shownMonths}
        valueLabel={t("trajectory.chartValue")}
        investedLabel={t("trajectory.chartInvested")}
      />

      {test.absent.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("trajectory.absent", {
            names: test.absent.map((id) => t(accountNameKey(id))).join(", "),
          })}
        </p>
      ) : null}
    </PlanCard>
  );
}

const WIDTH = 1000;
const HEIGHT = 160;

/** What the accounts were worth against what had gone in, month by month. */
function CrashChart({
  test,
  months,
  valueLabel,
  investedLabel,
}: {
  test: CrashTest;
  months: number;
  valueLabel: string;
  investedLabel: string;
}) {
  const start = test.path[0]!;
  const points = [
    { value: start.invested, invested: start.invested },
    ...test.path.slice(0, months),
  ];
  const all = points.flatMap((point) => [point.value, point.invested]);
  const low = Math.min(...all);
  const high = Math.max(...all);
  const span = high - low || 1;
  const x = (index: number) => (index / (points.length - 1)) * WIDTH;
  const y = (value: number) => 8 + (1 - (value - low) / span) * (HEIGHT - 16);
  const line = (pick: (point: (typeof points)[number]) => number) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(index)},${y(pick(point))}`,
      )
      .join(" ");

  return (
    <div className={cn(styles.rise, "flex flex-col gap-2")}>
      <svg
        role="img"
        aria-label={`${valueLabel}, ${investedLabel}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full overflow-visible"
      >
        <path
          d={line((point) => point.invested)}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="6 6"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line((point) => point.value)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
          {valueLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0 w-4 border-t border-dashed border-muted-foreground"
          />
          {investedLabel}
        </span>
      </div>
    </div>
  );
}
