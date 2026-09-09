import { describe, expect, it } from "vitest";

import {
  FULFILMENT_DOT_CLASS,
  indexFulfilmentStates,
} from "./fulfilment-state";

describe("indexFulfilmentStates", () => {
  it("says nothing about a row that is neither", () => {
    const states = indexFulfilmentStates([], []);

    expect(states.size).toBe(0);
    expect(states.get("tx-1")).toBeUndefined();
  });

  it("marks a proposed movement as proposed", () => {
    const states = indexFulfilmentStates(["tx-1"], []);

    expect(states.get("tx-1")).toBe("proposed");
  });

  it("marks a confirmed movement as confirmed", () => {
    const states = indexFulfilmentStates([], ["tx-1"]);

    expect(states.get("tx-1")).toBe("confirmed");
  });

  /**
   * The case the two-source split exists for.
   *
   * The confirmed set comes from its own query rather than from the fulfilment
   * report, because the report returns early — before it ever reads
   * `recurring_fulfilments` — when the month generates no occurrences. If the
   * two ever came from one call, deactivating a template would retroactively
   * unmark every row it had ever fulfilled.
   */
  it("keeps confirmed marks that no proposal accompanies", () => {
    const states = indexFulfilmentStates(["tx-2"], ["tx-1"]);

    expect(states.get("tx-1")).toBe("confirmed");
    expect(states.get("tx-2")).toBe("proposed");
  });

  /**
   * Defensive only: `proposeFulfilments` is handed `claimedTransactionIds` and
   * so never offers a movement that is already confirmed. Asserted anyway, so
   * that a change upstream shows up here rather than as two dots on one row.
   */
  it("prefers confirmed when a transaction somehow carries both", () => {
    const states = indexFulfilmentStates(["tx-1"], ["tx-1"]);

    expect(states.get("tx-1")).toBe("confirmed");
  });

  it("indexes every proposed id, not only the first", () => {
    const states = indexFulfilmentStates(["tx-1", "tx-2"], []);

    expect(states.get("tx-1")).toBe("proposed");
    expect(states.get("tx-2")).toBe("proposed");
  });
});

describe("FULFILMENT_DOT_CLASS", () => {
  /**
   * The amount in the same row already spends green on income and red on
   * expense (`TYPE_AMOUNT_CLASS`), so the dot must not reach for red — that
   * would put two meanings in one colour on one row.
   */
  it("spends no red", () => {
    expect(Object.values(FULFILMENT_DOT_CLASS)).not.toContain("bg-destructive");
  });

  it("covers every state exactly once", () => {
    const classes = Object.values(FULFILMENT_DOT_CLASS);

    expect(classes).toHaveLength(2);
    expect(new Set(classes).size).toBe(2);
  });
});
