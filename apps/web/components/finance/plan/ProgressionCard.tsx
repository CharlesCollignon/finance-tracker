"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Fire, Sparkle, Trophy } from "@phosphor-icons/react";
import {
  CUSHION_TARGETS,
  type Cushion,
  type Milestone,
} from "@finance/core/future-plan";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import { markMilestoneSeen } from "@/lib/actions/plan";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { monthLabelAhead, PlanCard } from "./plan-controls";
import styles from "./plan.module.css";

/**
 * « Progression »: the milestones, the cushion and the run in one card —
 * what the reader has done, said back, never a score.
 *
 * The next milestone has a date, from the middle start of the replay on the
 * reader's own figures, and « Et si… » moves it. A milestone crossed since
 * the last visit is celebrated once, on whichever device sees it first.
 * The run is told here and kept on Le point, where the month is closed.
 */
export function ProgressionCard({
  milestones,
  withExtra,
  wealth,
  cushion,
  run,
  seen,
  year,
  month,
}: {
  milestones: readonly Milestone[];
  /** Months away with « Et si… », by amount; null without it. */
  withExtra: Map<number, number | null> | null;
  /** Savings and investments today. */
  wealth: number;
  cushion: Cushion;
  run: { streak: number; best: number } | null;
  /** The highest milestone celebrated before this visit. */
  seen: number | null;
  year: number;
  month: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));

  const reached = milestones.filter((each) => each.reached);
  const next = milestones.find((each) => !each.reached) ?? null;
  const topReached = reached.at(-1)?.amount ?? null;

  // Celebrated once: held as the page loaded it, so writing the new one
  // does not take the badge away again.
  const [heldSeen] = useState(seen);
  const isNew =
    heldSeen !== null && topReached !== null && topReached > heldSeen;
  useEffect(() => {
    if (topReached !== null && (heldSeen === null || topReached > heldSeen)) {
      void markMilestoneSeen(topReached);
    }
  }, [heldSeen, topReached]);

  const sooner =
    next && withExtra
      ? (() => {
          const after = withExtra.get(next.amount) ?? null;
          if (after === null) {
            return null;
          }
          if (next.monthsAway === null) {
            return t("futurePlan.whatIfNowReached", {
              milestone: money(next.amount),
              month: monthLabelAhead(year, month, after, locale),
            });
          }
          return after < next.monthsAway
            ? t("futurePlan.whatIfSooner", {
                milestone: money(next.amount),
                count: next.monthsAway - after,
              })
            : null;
        })()
      : null;

  const months = (count: number) => t("futurePlan.cushionMonths", { count });
  const last = CUSHION_TARGETS[CUSHION_TARGETS.length - 1]!;

  return (
    <PlanCard
      icon={<Trophy size={ICON.sm} weight="fill" />}
      title={t("trajectory.progressionTitle")}
    >
      {reached.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("trajectory.milestonesReached")}
          </span>
          {reached.map((each) => (
            <span
              key={each.amount}
              className={cn(
                "privacy-sensitive rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground tabular-nums",
                isNew && each.amount === topReached && styles.pop,
              )}
            >
              {money(each.amount)}
            </span>
          ))}
          {isNew ? (
            <span className="flex items-center gap-1 text-xs text-primary-ink">
              <Sparkle size={ICON.xs} weight="fill" aria-hidden />
              {t("futurePlan.milestoneNew")}
            </span>
          ) : null}
        </div>
      ) : null}

      {next ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="privacy-sensitive text-sm font-medium">
              {t("trajectory.nextMilestone", { amount: money(next.amount) })}
            </p>
            <p className="text-xs text-muted-foreground">
              {next.monthsAway === null
                ? t("futurePlan.milestoneBeyond", { count: 30 })
                : t("trajectory.milestoneWhen", {
                    month: monthLabelAhead(
                      year,
                      month,
                      next.monthsAway,
                      locale,
                    ),
                  })}
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, wealth / next.amount) * 100)}
            aria-label={t("trajectory.nextMilestone", {
              amount: money(next.amount),
            })}
            className="h-2 rounded-full bg-foreground/10"
          >
            <div
              className="fade-in h-full rounded-full bg-foreground/60"
              style={{ width: `${Math.min(1, wealth / next.amount) * 100}%` }}
            />
          </div>
          {sooner ? (
            <p className="flex items-center gap-1.5 text-sm text-primary-ink">
              <Sparkle size={ICON.sm} weight="fill" aria-hidden />
              {sooner}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{t("trajectory.cushionLabel")}</p>
          {cushion.months !== null ? (
            <p className="privacy-sensitive text-sm tabular-nums">
              {new Intl.NumberFormat(INTL_LOCALES[locale], {
                maximumFractionDigits: 1,
              }).format(Math.floor(cushion.months * 10) / 10)}{" "}
              / {months(last)}
            </p>
          ) : null}
        </div>
        {cushion.months === null ? (
          <p className="text-xs text-muted-foreground">
            {t("futurePlan.cushionNoFixed")}
          </p>
        ) : (
          <>
            <div className="flex gap-1.5" aria-hidden>
              {CUSHION_TARGETS.map((target, index) => (
                <span
                  key={target}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    cushion.level > index ? "bg-primary" : "bg-foreground/10",
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {cushion.nextTarget === null
                ? t("futurePlan.cushionFull")
                : t("futurePlan.cushionNext", {
                    months: months(cushion.nextTarget),
                  })}
            </p>
          </>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="flex items-center gap-2 text-sm">
          <Fire
            size={ICON.md}
            weight={run && run.streak > 0 ? "fill" : "regular"}
            className={
              run && run.streak > 0 ? "text-primary" : "text-muted-foreground"
            }
            aria-hidden
          />
          {run && run.streak > 0
            ? t("bearingMonth.run", { count: run.streak })
            : t("bearingMonth.noRunYet")}
          {run && run.best > run.streak ? (
            <span className="text-muted-foreground">
              {" · "}
              {t("bearingMonth.bestRun", { count: run.best })}
            </span>
          ) : null}
        </p>
        <Link
          href="/bearing"
          className="flex items-center gap-1 text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
        >
          {t("trajectory.runLink")}
          <ArrowRight size={ICON.sm} aria-hidden />
        </Link>
      </div>
    </PlanCard>
  );
}
