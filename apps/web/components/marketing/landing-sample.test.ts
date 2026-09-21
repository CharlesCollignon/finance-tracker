import { describe, expect, it } from "vitest";

import {
  buildMonthClose,
  recordedOutflow,
  type RecordedCashFlows,
} from "@finance/core/month-close";
import { landingSample } from "./landing-sample";

/**
 * The sample month's close, checked against the arithmetic the product does.
 *
 * This exists because it once did not. The close mock drew its two middle
 * rows from `landingSample.income` and `landingSample.spent` — March's flows,
 * nineteen days into March — under a February close, so the panel headed "How
 * it adds up" listed 4,180 + 3,200 − 1,953 and put 4,906 under it. Every
 * figure on it was individually plausible and the five of them together said
 * the app cannot add. Nothing caught it, because nothing here had ever been
 * asked to add up.
 *
 * So the test runs `buildMonthClose` — the same function the real close runs,
 * not a copy of its formula — over the sample's own inputs and asserts that
 * every figure the marketing site prints is what that function returns.
 * Restating the arithmetic here would only prove this file agrees with
 * itself.
 */

const { close } = landingSample;

/**
 * February's recorded movements, in the shape the domain takes them.
 *
 * `recordedOut` is what `recordedOutflow` returns — expenses at face value,
 * plus what was set aside, plus what left for a broker — and `setAside` is
 * the second and third of those three. Splitting the expense line out is the
 * only inference this file makes, and the assertion below pins it.
 */
const februaryFlows: RecordedCashFlows = {
  income: close.recordedIn,
  expenses: close.recordedOut - close.setAside,
  savings: 150,
  transfers: 200,
};

describe("the sample month's close", () => {
  it("states an outflow that is its own parts", () => {
    expect(februaryFlows.savings + februaryFlows.transfers).toBe(
      close.setAside,
    );
    expect(recordedOutflow(februaryFlows)).toBe(close.recordedOut);
  });

  it("closes: opening plus in, less out and what was never recorded", () => {
    // The identity the panel puts on screen, in the order it prints the rows.
    expect(
      close.openingBalance +
        close.recordedIn -
        close.recordedOut -
        close.unrecorded,
    ).toBe(close.closingBalance);
  });

  it("agrees with buildMonthClose on every figure it prints", () => {
    const result = buildMonthClose({
      openingBalance: close.openingBalance,
      closingBalance: close.closingBalance,
      flows: februaryFlows,
    });

    // A reconciled close and not a baseline: the section this feeds is about
    // the figure a baseline cannot produce yet.
    expect(result.status).toBe("reconciled");
    expect(result.unrecorded).toBe(close.unrecorded);
    expect(result.kept).toBe(close.kept);
    expect(result.keptRate).toBe(close.keptRate);
  });

  it("stays inside the allowance it claims to stay inside", () => {
    // The hero card, the close section's meter and the read's second
    // observation all say the month came in under its cap. The streak on the
    // same screens is only true while this is.
    expect(close.unrecorded).toBeLessThanOrEqual(close.unrecordedCap);
  });

  it("does not borrow March's flows for February", () => {
    // The original defect, stated as a test: March is nineteen days old and
    // February is a whole month, so the two cannot be the same outflow.
    expect(close.recordedOut).not.toBe(landingSample.spent);
    expect(close.monthLabel).not.toBe(landingSample.monthLabel);
  });
});
