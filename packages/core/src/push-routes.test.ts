import { describe, expect, it } from "vitest";

import { buildDueNotifications } from "./push-digest";
import { mobileRouteForPushUrl } from "./push-routes";
import { translator } from "./i18n/t";
import { bankAttention, bankAttentionNotification } from "./bank-attention";

describe("mobileRouteForPushUrl", () => {
  it("opens the review, not the Ledger it lives on", () => {
    expect(mobileRouteForPushUrl("/transactions?review=inbox")).toEqual({
      pathname: "/transactions",
      params: { review: "inbox" },
    });
  });

  it("renames the surfaces the two apps disagree about", () => {
    expect(mobileRouteForPushUrl("/bearing")).toEqual({
      pathname: "/",
      params: {},
    });
    expect(mobileRouteForPushUrl("/plan")).toEqual({
      pathname: "/planning",
      params: {},
    });
    expect(mobileRouteForPushUrl("/budgets")).toEqual({
      pathname: "/planning",
      params: {},
    });
  });

  it("passes through a path both apps agree on", () => {
    expect(mobileRouteForPushUrl("/recurring")).toEqual({
      pathname: "/recurring",
      params: {},
    });
  });

  it("keeps every param, not only the first", () => {
    expect(
      mobileRouteForPushUrl("/transactions?review=inbox&y=2026&m=9"),
    ).toEqual({
      pathname: "/transactions",
      params: { review: "inbox", y: "2026", m: "9" },
    });
  });

  it("decodes what was encoded", () => {
    expect(mobileRouteForPushUrl("/transactions?review=in%20box")).toEqual({
      pathname: "/transactions",
      params: { review: "in box" },
    });
  });

  it("declines a route this app has not got, rather than guessing", () => {
    // /history is a real web surface with no phone equivalent — the Ledger's
    // by-category view is not a route here.
    expect(mobileRouteForPushUrl("/history")).toBeNull();
    expect(mobileRouteForPushUrl("/nonsense")).toBeNull();
  });

  it("declines a notification with no usable url", () => {
    for (const url of [undefined, null, "", 7, {}, "elsewhere.example"]) {
      expect(mobileRouteForPushUrl(url)).toBeNull();
    }
  });

  it("distinguishes a real destination from having no answer", () => {
    // The whole reason this returns null. Both used to be `{pathname: "/"}`,
    // which made the contract test below unwritable.
    expect(mobileRouteForPushUrl("/bearing")).not.toBeNull();
    expect(mobileRouteForPushUrl("/history")).toBeNull();
  });

  /*
   * The reason both halves live in this package. A url the digest writes and
   * the phone cannot place opens the wrong screen, and nothing else in either
   * app would notice — so the digest's own output is the input here.
   */
  it("can place every url the digest actually writes", () => {
    const written = new Set<string>();

    for (const today of ["2026-09-01", "2026-09-14"]) {
      for (const arrivedCharges of [0, 2]) {
        const due = buildDueNotifications({
          today,
          alreadySent: new Set(),
          pendingRecurring: 3,
          arrivedCharges,
          t: translator("en"),
        });
        for (const notification of due) {
          written.add(notification.url);
        }
      }
    }

    // The bank sync's own push is written in the refresh route rather than by
    // the digest, so it is named here explicitly.
    written.add("/transactions?review=inbox");

    // So is the bank's renewal reminder, which the notify job adds ahead of
    // the digest: every kind it can take, built by the builder itself.
    for (const attention of [
      bankAttention(
        { status: "active", consent_valid_until: "2026-09-18T00:00:00Z" },
        "2026-09-14",
      ),
      { kind: "expired" } as const,
      { kind: "paused" } as const,
    ]) {
      const notification = bankAttentionNotification(attention, {
        since: "2026-09-10",
        formatDate: (iso) => iso,
        t: translator("en"),
      });
      if (notification) {
        written.add(notification.url);
      }
    }
    expect(written.has("/bank")).toBe(true);

    expect(written.size).toBeGreaterThan(0);
    for (const url of written) {
      expect(
        mobileRouteForPushUrl(url),
        `the digest writes ${url}, which the phone cannot place`,
      ).not.toBeNull();
    }
  });
});
