import { describe, expect, it } from "vitest";
import {
  bankAttentionItems,
  buildAttention,
  sortAttention,
} from "./attention";

const none = {
  swallowed: 0,
  pendingInbox: 0,
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
      readyToClose: { monthLabel: "August" },
      proposals: 1,
      arrived: 2,
      purchases: 1,
      statementDue: { month: "septembre" },
    });
    expect(items.map((item) => item.id)).toEqual([
      "swallowed",
      "close",
      "arrived",
      "purchases",
      "inbox",
      "statement",
      "proposals",
    ]);
    expect(items.map((item) => item.actionKey)).toEqual([
      "month.actionReopen",
      "month.actionClose",
      "month.actionConfirm",
      "month.actionConfirm",
      "month.actionReview",
      "month.actionImport",
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
        href: "/bearing?close=1",
        actionKey: "month.actionStart",
      },
    ]);
  });

  it("points the questions asked on Le point at their own cards", () => {
    const items = buildAttention({ ...none, arrived: 1, purchases: 2 });
    expect(items.map((item) => item.href)).toEqual([
      "/bearing#arrived",
      "/bearing#purchases",
    ]);
  });

  it("names the statement's month and sends to the import", () => {
    const [item] = buildAttention({
      ...none,
      statementDue: { month: "septembre" },
    });
    expect(item).toMatchObject({
      id: "statement",
      messageKey: "month.attentionStatement",
      params: { month: "septembre" },
      href: "/import",
    });
  });
});

describe("bankAttentionItems", () => {
  it("says nothing without a bank", () => {
    expect(bankAttentionItems({ bank: null, awaitingAccounts: 0 })).toEqual([]);
  });

  it("calls a feed that stopped wrong, and a consent ending merely waiting", () => {
    expect(
      bankAttentionItems({ bank: { kind: "expired" }, awaitingAccounts: 0 }),
    ).toEqual([
      {
        id: "bankStopped",
        tone: "wrong",
        messageKey: "bankConnect.expiredTitle",
        href: "/bank",
        actionKey: "bankConnect.reconnect",
      },
    ]);
    expect(
      bankAttentionItems({
        bank: { kind: "renew", validUntil: "2026-11-09", daysLeft: 14 },
        awaitingAccounts: 0,
      }),
    ).toEqual([
      {
        id: "bankRenew",
        tone: "waiting",
        messageKey: "bankConnect.consentSoon",
        date: "2026-11-09",
        href: "/bank",
        actionKey: "bankConnect.renew",
      },
    ]);
  });

  it("counts the accounts waiting to be filed", () => {
    const items = bankAttentionItems({ bank: null, awaitingAccounts: 2 });
    expect(items).toEqual([
      {
        id: "accounts",
        tone: "waiting",
        messageKey: "bankAccounts.bearingLine",
        params: { count: 2 },
        href: "/bank",
        actionKey: "bankAccounts.bearingCta",
      },
    ]);
  });
});

describe("sortAttention", () => {
  it("reads two lists as one, in the strip's order", () => {
    const merged = sortAttention([
      ...buildAttention({ ...none, pendingInbox: 1, proposals: 1 }),
      ...bankAttentionItems({ bank: { kind: "paused" }, awaitingAccounts: 1 }),
    ]);
    expect(merged.map((item) => item.id)).toEqual([
      "bankStopped",
      "inbox",
      "accounts",
      "proposals",
    ]);
  });
});
