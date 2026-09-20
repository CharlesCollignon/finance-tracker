/**
 * Which rung of the ignition ladder the Bearing's spine is standing on.
 *
 * The spine is one figure, one ring and one flame, always visible at the top
 * of the home screen. What it can honestly say grows as the month's data
 * grows: a reader with no bank connected cannot be shown a figure that
 * implies one, a reader whose bank has never closed a month cannot be shown
 * a ring that implies a history, and a reader with no cap cannot be shown a
 * ring with a colour, because colour on this ring means "measured against
 * what you chose to allow" and nothing has been chosen yet. Each step is
 * strictly a superset of what the step before it could show, which is why
 * this is a ladder rather than a set of unrelated cases.
 *
 * Two rulings are load-bearing enough to restate here rather than leave to
 * the tests:
 *
 * The `arc` ring — drawn once something has closed but before a cap exists —
 * carries no `tone` field at all. That is not an omission; it is the point.
 * A tone reads as a verdict, "you are doing fine" or "you are not", and a
 * verdict needs a target to be measured against. Without a cap there is no
 * target, so giving the arc a colour would be a claim this module has no
 * grounds to make. The union expresses this structurally: `arc` has no
 * `tone` field to accidentally populate, rather than relying on every caller
 * to remember to leave one blank.
 *
 * `pulse.overRecorded` collapses the ring to `absent`, never to a darker or
 * redder version of whatever it would otherwise be. `month-pulse.ts` is
 * emphatic that overRecorded and overspending are different findings: an
 * account that holds more than the ledger says it should is missing a
 * transaction, not carrying a debt. A ring in that state has nothing true
 * left to draw — the unrecorded-spending figure it would be built from is
 * null precisely because the records cannot be trusted — so it is withdrawn
 * rather than repurposed to mean something it was never measuring.
 */

import type { MonthPulse, MonthStanding } from "./month-pulse";

export type SpineRing =
  | { kind: "absent" }
  | { kind: "dark" }
  | { kind: "arc" }
  | {
      kind: "proportion";
      ratio: number;
      tone: MonthStanding;
      /**
       * Past the cap, which is not the same claim as `ratio >= 1` and not
       * the same claim as `tone`. See `drawSpineRing` for the channel it is
       * drawn in and why the ring's own fill cannot be that channel.
       */
      over: boolean;
    };

export interface SpineInput {
  pulse: MonthPulse;
  /**
   * Whether any close has ever happened, a baseline included.
   *
   * This, and only this, is the rung 2 → 3 boundary the ladder's doc comment
   * names: a baseline close is what sets `openingBalance`, which is what
   * lets `pulse.unrecordedSoFar` exist at all, which is what "measuring" is
   * about. It is deliberately not inferred from `closes` below — a baseline
   * close measures nothing, so it contributes nothing to a streak, and the
   * month between a user's first close and their second would otherwise be
   * indistinguishable from a user who has never closed anything.
   */
  everClosed: boolean;
  /**
   * The current and best streak, for the flame — null once nothing has ever
   * closed. No longer doubles as the dark/arc boundary; see `everClosed`.
   */
  closes: { streak: number; bestStreak: number } | null;
  /** The plain-ledger "left this month" figure, for when there is no balance to read at all. */
  remaining: number;
}

export interface SpineState {
  step: "no-balance" | "no-close" | "measuring" | "lit";
  headline: { figure: "free" | "remaining"; value: number };
  /**
   * What the accounts hold, for the headline's first line. Null exactly when
   * no balance is readable — which is the same condition that sends
   * `headline` to `remaining`, and is why this is a separate nullable field
   * rather than a second entry in `headline`: one of the two figures can be
   * absent while the other is not.
   */
  onHand: number | null;
  ring: SpineRing;
  flame: { streak: number; best: number } | null;
}

/**
 * Resolves the spine to exactly one rung of the ladder.
 *
 * The order below is the ladder: each check only runs once the one above it
 * has ruled itself out, and `overRecorded` is applied last because it is not
 * a rung of its own — it is a correction that can strike the ring at any
 * rung once a balance is readable.
 */
export function resolveSpine(input: SpineInput): SpineState {
  const { pulse, closes, everClosed, remaining } = input;

  const flame =
    closes === null ? null : { streak: closes.streak, best: closes.bestStreak };

  const { step, headline, ring } = ladderStep(pulse, everClosed, remaining);

  return {
    step,
    headline,
    onHand: pulse.onHand,
    ring: pulse.overRecorded ? { kind: "absent" } : ring,
    flame,
  };
}

/**
 * The shortest overshoot lap still worth drawing.
 *
 * `overCap` is true from a hundredth of a euro past the cap, and `capRatio`
 * is rounded to two places, so a genuinely-over month can arrive here with
 * `ratio - 1` equal to zero. A zero-length arc draws nothing, which would
 * put the two states this field exists to separate back on the same pixels.
 * So the lap has a floor: its *presence* says "past the cap", its *length*
 * says how far past.
 */
const MIN_OVERSHOOT = 0.06;

export interface SpineRingDraw {
  /** How much of the ring itself is drawn, 0–1. */
  fill: number;
  /**
   * How much of the second, inner lap is drawn, 0–1, and 0 exactly when the
   * cap has not been passed.
   *
   * This is `over`'s own channel. The ring's colour is `tone`'s and stays
   * `tone`'s — they are separate rows in the spec and separate findings —
   * but the fill alone cannot carry `over`, because a clamped ratio of 2.50
   * draws the same complete circle as a ratio of exactly 1.00. A reader has
   * to be able to tell a month that has just reached its allowance from one
   * that has spent half as much again, and one full circle cannot say both.
   */
  overshoot: number;
  /**
   * The percentage the ring's sentence states.
   *
   * Off the true ratio, not the clamped one: a screen reader hearing "100%
   * of your allowance used" for a month at 250% is being told the fill's
   * limitation as though it were the measurement.
   */
  percent: number;
}

/**
 * What a `proportion` ring draws, decided once for both clients.
 *
 * Neither client re-derives any of this. They were each clamping the ratio
 * and rounding their own percentage, which is judgement — where the ring
 * stops, what the sentence claims — living twice in two languages.
 */
export function drawSpineRing(
  ring: Extract<SpineRing, { kind: "proportion" }>,
): SpineRingDraw {
  const ratio = Number.isFinite(ring.ratio) ? ring.ratio : 0;
  return {
    fill: Math.min(1, Math.max(0, ratio)),
    percent: Math.max(0, Math.round(ratio * 100)),
    overshoot: ring.over ? Math.min(1, Math.max(MIN_OVERSHOOT, ratio - 1)) : 0,
  };
}

function ladderStep(
  pulse: MonthPulse,
  everClosed: boolean,
  remaining: number,
): Pick<SpineState, "step" | "headline" | "ring"> {
  if (pulse.free === null) {
    return {
      step: "no-balance",
      headline: { figure: "remaining", value: remaining },
      ring: { kind: "dark" },
    };
  }

  const headline: SpineState["headline"] = {
    figure: "free",
    value: pulse.free,
  };

  if (!everClosed) {
    return { step: "no-close", headline, ring: { kind: "dark" } };
  }

  if (pulse.capRatio === null) {
    return { step: "measuring", headline, ring: { kind: "arc" } };
  }

  return {
    step: "lit",
    headline,
    ring: {
      kind: "proportion",
      ratio: pulse.capRatio,
      tone: pulse.standing,
      over: pulse.overCap,
    },
  };
}
