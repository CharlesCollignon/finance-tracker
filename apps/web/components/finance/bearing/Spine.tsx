"use client";

import { useEffect, useState } from "react";
import type { Key } from "@finance/core/i18n/t";
import type { MonthStanding } from "@finance/core/month-pulse";
import { drawSpineRing, type SpineState } from "@finance/core/spine";
import { cssEasing, DURATION } from "@finance/core/motion";
import { useT } from "@/lib/locale-context";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * The ring, inside the card about your run.
 *
 * It was the fixed spine above the bento and it is neither fixed nor above
 * anything now. Its headline went to `Headline`, which states the two
 * figures the screen is opened for at the top of the page; its action row
 * went to `AttentionRow`, which the page renders itself because the reader
 * who needs it most — a brand-new account — never reaches this component at
 * all. What is left is the one mark that is genuinely about the run: how much
 * of the month's allowance has gone. It lives in "Your run" because that is
 * the card it describes.
 *
 * So it draws no surface of its own: no `GLASS_CARD`, no rounded-control corners and
 * no hairline underneath. The card it sits in supplies all three, and a
 * second edge inside that one would be the only divider on the screen. It
 * names nothing either — it used to be a landmark region called "Where you
 * stand", which was right for a band across the top of the page and is wrong
 * for a ring inside a card that already says "Your run" above it, twice over:
 * the name is a worse name than the card's, and a landmark nested inside a
 * collapsed card is a landmark pointing at nothing.
 *
 * It drew a `FlameBadge` beside the ring until nothing handed it one.
 * `BearingCards` is this component's only caller on either client and it
 * spreads `flame: null` deliberately — `streak` and `best-streak` are figures
 * in the pack, so the run card lists them as rows like every other figure on
 * the surface rather than saying them a second time as a badge. A branch
 * whose condition is a literal `null` is not a capability held in reserve, it
 * is unreachable markup that no gate in this repo can see: knip reads the
 * import graph, not a dead `if`. So the badge went, and the two keys it drew
 * stayed — `month.streakInARow` and `month.bestStreak` are `MonthScore`'s and
 * `MonthCloseHistory`'s too.
 *
 * Four ring renderings, chosen by `state.ring.kind` and nothing else: this
 * component does not re-derive the ladder, it only draws whichever rung
 * `resolveSpine` already settled on. `absent` renders no ring markup at all,
 * matching the core module's own point that a measurement with no target
 * must never be drawn as though it were one. The `proportion` rung can
 * carry a second, inner lap — see `drawSpineRing` for what it says and why
 * the ring's own fill cannot say it.
 */
export function Spine({ state }: { state: SpineState }) {
  // A flex row for one child, which is not an oversight: an `<svg>` is inline
  // by default and would otherwise sit on a text baseline with a descender's
  // worth of space under it. `justify-between` went with the badge that used
  // to be pushed to the far end.
  return (
    <div className="flex items-center">
      <SpineRing ring={state.ring} />
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

/** The clause a `proportion` ring's *colour* reads out — the standing, alone. */
function standingKey(tone: MonthStanding): Key {
  switch (tone) {
    case "short":
      return "bearing.spine.ringStandingShort";
    case "tight":
      return "bearing.spine.ringStandingTight";
    case "clear":
      return "bearing.spine.ringStandingClear";
    case "unknown":
      return "bearing.spine.ringStandingClear";
  }
}

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The overshoot lap: thinner, and inside the ring it has gone past.
 *
 * Inside rather than outside because the ring already reaches the edge of
 * its own box — an outer lap would need a bigger box, which would move the
 * headline beside it. Thinner so the two can never be mistaken for one
 * stroke at a glance, and one gap (`STROKE / 2`) of dark between them so the
 * inner one reads as a second pass rather than as a thick edge.
 */
const OVER_STROKE = 3;
const OVER_RADIUS = RADIUS - STROKE / 2 - OVER_STROKE / 2 - 1.5;
const OVER_CIRCUMFERENCE = 2 * Math.PI * OVER_RADIUS;

function SpineRing({ ring }: { ring: SpineState["ring"] }) {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  // Starts at "nothing drawn" and animates in on mount, unless the reader has
  // asked for less motion — a next frame, so the browser has painted the
  // undrawn state there is something to animate away from.
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

  // Three signals, three channels, none of them re-derived here: `fill`,
  // `overshoot` and `percent` all come from `drawSpineRing`.
  //
  // `Ring colour` reads off `tone` alone, always — an over-cap month is not
  // redrawn in a different colour depending on how the month otherwise
  // stands, which is the collapse that would make a `clear`-but-over month
  // indistinguishable from a genuinely `short` one.
  //
  // `over` no longer rides on the fill. It used to, on the reasoning that a
  // clamped ratio already draws a complete circle — but a complete circle is
  // also exactly what 100% looks like, so a month that had spent half its
  // allowance again over drew as a full green ring, pixel for pixel
  // identical to one that had only just reached it. `over` gets the inner
  // lap instead: a second, thinner stroke that exists at all only once the
  // cap has been passed, and grows with how far past it is.
  const { fill, overshoot, percent } = drawSpineRing(ring);
  // Two clauses, each stating its own basis — see `en.ts`'s note on these
  // keys for the contradiction the single sentence could produce.
  const label = [
    t(overshoot > 0 ? "bearing.spine.ringUsedOver" : "bearing.spine.ringUsed", {
      percent,
    }),
    t(standingKey(ring.tone)),
  ].join(" · ");

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
        stroke={toneStroke(ring.tone)}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={entered ? CIRCUMFERENCE * (1 - fill) : CIRCUMFERENCE}
        style={{ transition }}
      />
      {overshoot > 0 ? (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={OVER_RADIUS}
          fill="none"
          // The tone's colour, not a colour of its own: `over` is a second
          // signal about the same month, not a second verdict on it.
          stroke={toneStroke(ring.tone)}
          strokeWidth={OVER_STROKE}
          strokeLinecap="round"
          strokeDasharray={OVER_CIRCUMFERENCE}
          strokeDashoffset={
            entered ? OVER_CIRCUMFERENCE * (1 - overshoot) : OVER_CIRCUMFERENCE
          }
          style={{ transition }}
        />
      ) : null}
    </svg>
  );
}
