"use client";

import type { CSSProperties } from "react";
import { ShieldCheck, Sparkle, Trophy } from "@phosphor-icons/react";
import {
  CUSHION_TARGETS,
  type Cushion,
  type Milestone,
} from "@finance/core/future-plan";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import type { Translate } from "@finance/core/i18n/t";
import { Orb } from "@/components/brand/Orb";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { monthLabelAhead, PlanCard } from "./plan-controls";
import styles from "./plan.module.css";

/**
 * Round amounts on the way: the two just passed, and the next three with
 * when the projection reaches each.
 *
 * Passed ones are the page's celebration — the orb, lit in the brand's warm
 * light, popping in one after the other — and the ones ahead are plain, with
 * a bar for how far along they are, so gold here always means done. The one
 * crossed since the reader last looked carries a "new" badge, once.
 */
export function MilestonesCard({
  milestones,
  current,
  horizonYears,
  year,
  month,
  isNew,
}: {
  milestones: Milestone[];
  /** What the savings and investments hold today. */
  current: number;
  /** How far the projection looks, for a milestone beyond it. */
  horizonYears: number;
  year: number;
  month: number;
  /** The highest milestone passed was not passed the last time. */
  isNew: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();

  const reached = milestones.filter((milestone) => milestone.reached);
  const ahead = milestones.filter((milestone) => !milestone.reached);
  const newest = reached[reached.length - 1];

  return (
    <PlanCard
      icon={<Trophy size={ICON.sm} weight="fill" />}
      title={t("futurePlan.milestonesTitle")}
      aside={
        isNew ? (
          <span
            className={cn(
              styles.pop,
              "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground",
            )}
            style={{ "--delay": "400ms" } as CSSProperties}
          >
            {t("futurePlan.milestoneNew")}
          </span>
        ) : null
      }
    >
      <p className="-mt-2 text-xs text-muted-foreground">
        {t("futurePlan.milestonesBasis")}
      </p>

      {reached.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {reached.map((milestone, index) => (
            <li
              key={milestone.amount}
              className={styles.pop}
              style={{ "--delay": `${index * 140}ms` } as CSSProperties}
            >
              <div className="flex items-center gap-3 rounded-full border border-primary/25 bg-accent py-1.5 pl-1.5 pr-4">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center",
                    milestone === newest && styles.glow,
                  )}
                >
                  <Orb size="28px" tone="mark" />
                </span>
                <span className="flex flex-col">
                  <span className="privacy-amount font-serif text-base font-semibold leading-tight tabular-nums">
                    {format(milestone.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("futurePlan.milestoneReached")}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="flex flex-col">
        {ahead.map((milestone) => {
          const progress = Math.min(
            100,
            Math.max(0, (current / milestone.amount) * 100),
          );
          const when =
            milestone.monthsAway === null
              ? t("futurePlan.milestoneBeyond", { count: horizonYears })
              : `${t("futurePlan.milestoneIn", { count: milestone.monthsAway })} · ${t(
                  "futurePlan.milestoneOn",
                  {
                    month: monthLabelAhead(
                      year,
                      month,
                      milestone.monthsAway,
                      locale,
                    ),
                  },
                )}`;
          return (
            <li
              key={milestone.amount}
              className="border-b border-border py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="privacy-amount font-serif text-lg font-semibold tabular-nums">
                  {format(milestone.amount)}
                </span>
                <span className="text-sm text-muted-foreground">{when}</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label={format(milestone.amount)}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10"
              >
                <div
                  className="grow-in h-full rounded-full bg-foreground/60"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </PlanCard>
  );
}

/**
 * "4,2 mois", or "3 mois" when whole — the phone's wording
 * (`cushionMonthsText` in its `CushionCard`). Floored to a tenth, because a
 * cushion that covers 2.96 months does not cover three.
 */
function cushionMonthsText(
  months: number,
  t: Translate,
  locale: Locale,
): string {
  const tenths = Math.floor(months * 10) / 10;
  return Number.isInteger(tenths)
    ? t("futurePlan.cushionMonths", { count: tenths })
    : t("units.months", {
        value: new Intl.NumberFormat(INTL_LOCALES[locale], {
          maximumFractionDigits: 1,
        }).format(tenths),
      });
}

/**
 * How many months of fixed costs the savings would carry, against the usual
 * rungs of one, three and six. A rung lights in the brand's gold as it is
 * reached, which is the whole of the encouragement: the card says what the
 * cushion is for and never what to do about it.
 */
export function CushionCard({ cushion }: { cushion: Cushion }) {
  const t = useT();
  const locale = useLocale();
  const last = CUSHION_TARGETS[CUSHION_TARGETS.length - 1]!;
  const monthsText = (count: number) =>
    t("futurePlan.cushionMonths", { count });

  return (
    <PlanCard
      icon={<ShieldCheck size={ICON.sm} weight="fill" />}
      title={t("futurePlan.cushionTitle")}
    >
      {cushion.months === null ? (
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.cushionNoFixed")}
        </p>
      ) : (
        <>
          <p className="privacy-sensitive font-head text-lg">
            {t("futurePlan.cushionBody", {
              months: cushionMonthsText(cushion.months, t, locale),
            })}
          </p>

          <div className="px-2 pb-6 pt-2">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(cushion.ratio * 100)}
              aria-label={t("futurePlan.cushionTitle")}
              className="relative h-2 rounded-full bg-foreground/10"
            >
              <div
                className="grow-in h-full rounded-full bg-foreground/60"
                style={{ width: `${cushion.ratio * 100}%` }}
              />
              {CUSHION_TARGETS.map((target, index) => {
                const lit = cushion.level > index;
                const left = `${(target / last) * 100}%`;
                return (
                  <span
                    key={target}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left }}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "block size-4 rounded-full",
                        lit
                          ? cn("bg-primary", styles.pop, styles.glow)
                          : "bg-card ring-2 ring-hairline-strong",
                      )}
                      style={
                        lit
                          ? ({
                              "--delay": `${500 + index * 160}ms`,
                            } as CSSProperties)
                          : undefined
                      }
                    />
                    <span
                      className={cn(
                        "absolute top-6 whitespace-nowrap text-xs",
                        index === CUSHION_TARGETS.length - 1
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                        lit ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {monthsText(target)}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {cushion.nextTarget === null ? (
            <p className="flex items-center gap-1.5 text-sm text-primary-ink">
              <Sparkle size={ICON.sm} weight="fill" aria-hidden />
              {t("futurePlan.cushionFull")}
            </p>
          ) : (
            <p className="text-sm">
              {t("futurePlan.cushionNext", {
                months: monthsText(cushion.nextTarget),
              })}
            </p>
          )}
        </>
      )}

      <p className="mt-auto text-xs text-muted-foreground">
        {t("futurePlan.cushionWhy")}
      </p>
    </PlanCard>
  );
}
