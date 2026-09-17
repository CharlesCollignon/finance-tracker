"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Trophy } from "@phosphor-icons/react";
import type { AttentionItem } from "@finance/core/attention";
import type { Key } from "@finance/core/i18n/t";
import type { MonthStanding } from "@finance/core/month-pulse";
import type { SpineState } from "@finance/core/spine";
import { cssEasing, DURATION } from "@finance/core/motion";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { ICON } from "@/lib/icon-scale";
import { FIGURE_HERO, MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

interface SpineProps {
  state: SpineState;
  attention: AttentionItem[];
}

/**
 * The fixed spine above the bento: one figure, one ring, one flame, and — if
 * anything is waiting — the one thing most worth doing next.
 *
 * Deliberately not built like `Tile`. Twelve tiles are a set the arranger and
 * the reader both get to reorder; this is the thing they are arranged
 * beneath, so it carries no `GLASS_CARD`, no rounded card corners and no
 * drag handle — a hairline underneath is the only edge it draws, which is
 * what keeps it reading as chrome rather than as a thirteenth tile.
 *
 * Four ring renderings, chosen by `state.ring.kind` and nothing else: this
 * component does not re-derive the ladder, it only draws whichever rung
 * `resolveSpine` already settled on. `absent` renders no ring markup at all,
 * matching the core module's own point that a measurement with no target
 * must never be drawn as though it were one.
 */
export function Spine({ state, attention }: SpineProps) {
  const t = useT();
  const formatMoney = useFormatCurrency();

  const top = attention[0];
  const rest = attention.length - 1;

  return (
    <section
      aria-label={t("bearing.spine.regionLabel")}
      className="flex flex-col gap-3 border-b border-foreground/10 pb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-muted-foreground">
              {t(headlineLabelKey(state.headline))}
            </span>
            <AnimatedAmount
              value={state.headline.value}
              format={formatMoney}
              className={cn(
                FIGURE_HERO,
                state.headline.figure === "free" &&
                  state.headline.value < 0 &&
                  "text-destructive",
              )}
            />
          </div>

          <SpineRing ring={state.ring} />
        </div>

        {state.flame ? <FlameBadge flame={state.flame} /> : null}
      </div>

      {top ? (
        <Link
          href={top.href}
          className="group -mx-1 flex items-center gap-3 rounded-2xl px-1 py-1.5 transition-colors hover:bg-muted/40"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              top.tone === "wrong" ? "bg-destructive" : "bg-primary",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            {t(top.messageKey, top.params)}
          </span>
          {rest > 0 ? (
            <span className={cn(MICRO, "shrink-0 text-muted-foreground")}>
              {t("bearing.spine.moreWaiting", { count: rest })}
            </span>
          ) : null}
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary-ink">
            {t(top.actionKey)}
            <ArrowRight
              size={ICON.sm}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      ) : null}
    </section>
  );
}

/**
 * Which label the headline takes, mirroring `pulseHeadline` in
 * `month-pulse.ts` without needing the raw `MonthPulse` this component was
 * never handed: `figure` already carries the one thing that function reads
 * off `onHand`, and the sign of `value` already carries the one thing it
 * reads off `free`.
 */
function headlineLabelKey(headline: SpineState["headline"]): Key {
  if (headline.figure === "remaining") {
    return "pulse.headlineLeft";
  }
  return headline.value < 0 ? "pulse.headlineShort" : "pulse.headlineFree";
}

function FlameBadge({
  flame,
}: {
  flame: NonNullable<SpineState["flame"]>;
}) {
  const t = useT();
  const { streak, best } = flame;

  if (streak <= 1 && best <= 1) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {streak > 1 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
          <Flame size={ICON.xs} weight="fill" />
          {t("month.streakInARow", { count: streak })}
        </span>
      ) : null}
      {best > streak && best > 1 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          <Trophy size={ICON.xs} />
          {t("month.bestStreak", { count: best })}
        </span>
      ) : null}
    </div>
  );
}

/** The colour token a ring's tone draws in, once `over` has been ruled out. */
function toneStroke(tone: MonthStanding): string {
  switch (tone) {
    case "short":
      return "var(--destructive)";
    case "tight":
      return "var(--warning)";
    case "clear":
      return "var(--success)";
    // Structurally unreachable: `resolveSpine` only ever hands a `proportion`
    // ring a tone once `pulse.free` is readable, and `standingOf` only
    // returns `unknown` when it is not. Kept rather than asserted away, so an
    // exhaustiveness check stays a compile error instead of a runtime one.
    case "unknown":
      return "var(--success)";
  }
}

/** The sentence a `proportion` ring's tone reads out, once `over` is ruled out. */
function toneKey(tone: MonthStanding): Key {
  switch (tone) {
    case "short":
      return "bearing.spine.ringShort";
    case "tight":
      return "bearing.spine.ringTight";
    case "clear":
      return "bearing.spine.ringClear";
    case "unknown":
      return "bearing.spine.ringClear";
  }
}

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function SpineRing({ ring }: { ring: SpineState["ring"] }) {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  // Starts at "nothing drawn" and animates in on mount, unless the reader has
  // asked for less motion — the same next-frame trick `Panel`'s `Expand` uses
  // to give the browser a closed frame to animate away from.
  const [entered, setEntered] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  // No ring element at all, not an empty slot — the ladder's own point is
  // that a measurement with nothing left to say should be withdrawn rather
  // than repainted.
  if (ring.kind === "absent") {
    return null;
  }

  const transition = reducedMotion
    ? undefined
    : `stroke-dashoffset ${DURATION.enter}ms ${cssEasing()}`;

  if (ring.kind === "dark") {
    return (
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t("bearing.spine.ringUnmeasured")}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeWidth={STROKE}
        />
      </svg>
    );
  }

  if (ring.kind === "arc") {
    return (
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
        role="img"
        aria-label={t("bearing.spine.ringMeasuring")}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          // A complete, unproportioned arc, deliberately with no colour that
          // could read as a verdict — see `spine.ts`'s doc comment. Blue
          // reads as "measuring" everywhere else this app uses `--info`.
          stroke="var(--info)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={entered ? 0 : CIRCUMFERENCE}
          style={{ transition }}
        />
      </svg>
    );
  }

  const clamped = Math.min(1, Math.max(0, ring.ratio));
  const percent = Math.round(clamped * 100);
  const label = ring.over
    ? t("bearing.spine.ringOver", { percent })
    : t(toneKey(ring.tone), { percent });

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="-rotate-90"
      role="img"
      aria-label={label}
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--hairline-strong)"
        strokeWidth={STROKE}
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={ring.over ? "var(--destructive)" : toneStroke(ring.tone)}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={
          entered ? CIRCUMFERENCE * (1 - clamped) : CIRCUMFERENCE
        }
        style={{ transition }}
      />
    </svg>
  );
}
