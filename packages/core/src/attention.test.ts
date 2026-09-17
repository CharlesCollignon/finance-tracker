import { describe, expect, it } from "vitest";
import { buildAttention } from "./attention";

const none = {
  swallowed: 0,
  pendingInbox: 0,
  recurringToApply: 0,
  readyToClose: null,
  proposals: 0,
};

describe("buildAttention", () => {
  it("says nothing when nothing is waiting", () => {
    expect(buildAttention(none)).toEqual([]);
  });

  it("puts what is wrong ahead of what is merely outstanding", () => {
    const items = buildAttention({
      ...none,
      swallowed: 2,
      pendingInbox: 3,
    });
    expect(items.map((item) => item.id)).toEqual(["swallowed", "inbox"]);
    expect(items[0]!.tone).toBe("wrong");
    expect(items[1]!.tone).toBe("waiting");
  });

  it("carries keys and params, never rendered text", () => {
    const [item] = buildAttention({ ...none, pendingInbox: 4 });
    expect(item).toEqual({
      id: "inbox",
      tone: "waiting",
      messageKey: "month.attentionInbox",
      params: { count: 4 },
      href: "/transactions?review=inbox",
      actionKey: "month.actionReview",
    });
    expect(item).not.toHaveProperty("text");
  });

  it("orders the full set the same way every time", () => {
    const items = buildAttention({
      swallowed: 1,
      pendingInbox: 1,
      recurringToApply: 1,
      readyToClose: { monthLabel: "August" },
      proposals: 1,
    });
    expect(items.map((item) => item.id)).toEqual([
      "swallowed",
      "close",
      "inbox",
      "apply",
      "proposals",
    ]);
    expect(items.map((item) => item.actionKey)).toEqual([
      "month.actionReopen",
      "month.actionClose",
      "month.actionReview",
      "month.actionApply",
      "month.actionReview",
    ]);
  });

  it("uses the baseline message and action when nothing has closed yet", () => {
    const items = buildAttention({
      ...none,
      readyToClose: { monthLabel: "August", isBaseline: true },
    });
    expect(items).toEqual([
      {
        id: "close",
        tone: "waiting",
        messageKey: "month.attentionBaseline",
        href: "/budgets",
        actionKey: "month.actionStart",
      },
    ]);
  });
});
