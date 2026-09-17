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
  | { kind: "proportion"; ratio: number; tone: MonthStanding; over: boolean };

export interface SpineInput {
  pulse: MonthPulse;
  /**
   * The three figures a close history contributes to the spine, or null
   * before anything has ever closed. Mirrors `summarizeCloseHistory`'s
   * `streak`, `bestStreak` and `sample` rather than taking the whole
   * summary, so this module cannot reach for a field the spine has no rung
   * for.
   */
  closes: { streak: number; bestStreak: number; sample: number } | null;
  /** The plain-ledger "left this month" figure, for when there is no balance to read at all. */
  remaining: number;
}

export interface SpineState {
  step: "no-balance" | "no-close" | "measuring" | "lit";
  headline: { figure: "free" | "remaining"; value: number };
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
  const { pulse, closes, remaining } = input;

  const flame =
    closes === null ? null : { streak: closes.streak, best: closes.bestStreak };

  const { step, headline, ring } = ladderStep(pulse, closes, remaining);

  return {
    step,
    headline,
    ring: pulse.overRecorded ? { kind: "absent" } : ring,
    flame,
  };
}

function ladderStep(
  pulse: MonthPulse,
  closes: SpineInput["closes"],
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

  if (closes === null) {
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
