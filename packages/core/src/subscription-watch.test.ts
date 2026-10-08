import { describe, expect, it } from "vitest";

import {
  findingsBetween,
  subscriptionKind,
  subscriptionTotals,
  watchSubscriptions,
  type SubscriptionCharge,
} from "./subscription-watch";

function charge(
  occurredOn: string,
  amount: number,
  note: string,
  categoryType: SubscriptionCharge["categoryType"] = "expense",
): SubscriptionCharge {
  return { occurredOn, amount, note, categoryName: "Loisirs", categoryType };
}

const TODAY = "2026-10-08";

describe("subscriptionKind", () => {
  it("knows a service by its name, wherever the bank puts it", () => {
    expect(subscriptionKind("PRLV SEPA SPOTIFY AB")).toBe("music");
    expect(subscriptionKind("CB NETFLIX.COM 07/10")).toBe("video");
    expect(subscriptionKind("PRLV CANAL+ FRANCE")).toBe("video");
    expect(subscriptionKind("CB CARREFOUR")).toBeNull();
  });
});

describe("watchSubscriptions", () => {
  it("finds a monthly service and says its price went up", () => {
    const { subscriptions, findings } = watchSubscriptions(
      [
        charge("2026-07-05", 13.49, "NETFLIX.COM"),
        charge("2026-08-05", 13.49, "NETFLIX.COM"),
        charge("2026-09-05", 13.49, "NETFLIX.COM"),
        charge("2026-10-05", 15.99, "NETFLIX.COM"),
      ],
      TODAY,
    );
    expect(subscriptions).toMatchObject([
      {
        cadence: "monthly",
        amount: 15.99,
        previousAmount: 13.49,
        kind: "video",
        status: "active",
      },
    ]);
    expect(findings).toEqual([
      {
        type: "priceRise",
        key: subscriptions[0]!.key,
        label: "Netflix",
        from: 13.49,
        to: 15.99,
        on: "2026-10-05",
      },
    ]);
  });

  it("does not call a bill that moves every month a price rise", () => {
    const { findings } = watchSubscriptions(
      [
        charge("2026-07-10", 61, "PRLV EDF CLIENTS"),
        charge("2026-08-10", 66, "PRLV EDF CLIENTS"),
        charge("2026-09-10", 58, "PRLV EDF CLIENTS"),
        charge("2026-10-03", 64, "PRLV EDF CLIENTS"),
      ],
      TODAY,
    );
    expect(findings.filter((finding) => finding.type === "priceRise")).toEqual(
      [],
    );
  });

  it("says a known service is new from its second charge", () => {
    const { findings } = watchSubscriptions(
      [
        charge("2026-09-02", 10.99, "PRLV DEEZER"),
        charge("2026-10-02", 10.99, "PRLV DEEZER"),
      ],
      TODAY,
    );
    expect(findings).toMatchObject([{ type: "new", on: "2026-10-02" }]);
  });

  it("does not make two coffees a month apart a subscription", () => {
    const { subscriptions } = watchSubscriptions(
      [
        charge("2026-09-02", 2.5, "CAFE DES ARTS"),
        charge("2026-10-06", 3.1, "CAFE DES ARTS"),
      ],
      TODAY,
    );
    expect(subscriptions).toEqual([]);
  });

  it("says one stopped once it is well past its month", () => {
    const { subscriptions, findings } = watchSubscriptions(
      [
        charge("2026-05-12", 29.99, "BASIC FIT"),
        charge("2026-06-12", 29.99, "BASIC FIT"),
        charge("2026-07-12", 29.99, "BASIC FIT"),
      ],
      TODAY,
    );
    expect(subscriptions[0]?.status).toBe("stopped");
    expect(findings).toMatchObject([{ type: "stopped", on: "2026-08-27" }]);
  });

  it("notices two of a kind", () => {
    const { findings } = watchSubscriptions(
      [
        charge("2026-07-03", 11.12, "PRLV SPOTIFY"),
        charge("2026-08-03", 11.12, "PRLV SPOTIFY"),
        charge("2026-09-03", 11.12, "PRLV SPOTIFY"),
        charge("2026-10-03", 11.12, "PRLV SPOTIFY"),
        charge("2026-08-20", 10.99, "PRLV DEEZER"),
        charge("2026-09-20", 10.99, "PRLV DEEZER"),
      ],
      TODAY,
    );
    expect(findings).toContainEqual({
      type: "sameKind",
      kind: "music",
      labels: ["Spotify", "Deezer"],
      on: "2026-08-20",
    });
  });

  it("leaves out income, savings and money moved to a wallet", () => {
    const { subscriptions } = watchSubscriptions(
      [
        charge("2026-08-28", 2400, "VIR SALAIRE", "income"),
        charge("2026-09-28", 2400, "VIR SALAIRE", "income"),
        charge("2026-08-02", 200, "VIR LIVRET A", "savings"),
        charge("2026-09-02", 200, "VIR LIVRET A", "savings"),
        charge("2026-10-02", 200, "VIR LIVRET A", "savings"),
      ],
      TODAY,
    );
    expect(subscriptions).toEqual([]);
  });

  it("counts a yearly one as a twelfth a month", () => {
    const { subscriptions } = watchSubscriptions(
      [
        charge("2025-09-15", 120, "AMAZON PRIME VIDEO"),
        charge("2026-09-15", 120, "AMAZON PRIME VIDEO"),
      ],
      TODAY,
    );
    expect(subscriptions).toMatchObject([{ cadence: "yearly", monthly: 10 }]);
    expect(subscriptionTotals(subscriptions)).toEqual({
      monthly: 10,
      yearly: 120,
    });
  });
});

describe("findingsBetween", () => {
  it("keeps what happened in the span", () => {
    const { findings } = watchSubscriptions(
      [
        charge("2026-08-05", 13.49, "NETFLIX.COM"),
        charge("2026-09-05", 13.49, "NETFLIX.COM"),
        charge("2026-10-05", 15.99, "NETFLIX.COM"),
      ],
      TODAY,
    );
    expect(findingsBetween(findings, "2026-09-28", "2026-10-04")).toEqual([]);
    expect(findingsBetween(findings, "2026-10-05", "2026-10-11")).toHaveLength(
      1,
    );
  });
});
