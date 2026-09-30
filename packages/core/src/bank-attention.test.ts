import { describe, expect, it } from "vitest";

import {
  bankAttention,
  bankAttentionNotification,
  RENEW_PUSH_DAYS,
  RENEW_WINDOW_DAYS,
} from "./bank-attention";
import { translator } from "./i18n/t";

const TODAY = "2026-09-30";

function active(consent: string | null) {
  return { status: "active", consent_valid_until: consent };
}

function push(
  attention: ReturnType<typeof bankAttention>,
  locale: "en" | "fr" = "en",
) {
  return bankAttentionNotification(attention, {
    since: "2026-09-20T06:00:00Z",
    formatDate: (iso) => iso,
    t: translator(locale),
  });
}

describe("bankAttention", () => {
  it("asks nothing of no connection, a revoked one, or one without a consent date", () => {
    expect(bankAttention(null, TODAY)).toBeNull();
    expect(
      bankAttention(
        { status: "revoked", consent_valid_until: "2026-10-01T00:00:00Z" },
        TODAY,
      ),
    ).toBeNull();
    expect(bankAttention(active(null), TODAY)).toBeNull();
  });

  it("says nothing while the consent is further off than the window", () => {
    expect(bankAttention(active("2026-10-15T00:00:00Z"), TODAY)).toBeNull();
  });

  it("counts calendar days to the consent's date, whatever its hour", () => {
    expect(bankAttention(active("2026-10-14T23:59:00Z"), TODAY)).toEqual({
      kind: "renew",
      validUntil: "2026-10-14",
      daysLeft: RENEW_WINDOW_DAYS,
    });
    expect(bankAttention(active("2026-09-30T08:00:00Z"), TODAY)).toMatchObject({
      daysLeft: 0,
    });
  });

  it("keeps saying renew after the date has passed, until a sync marks it expired", () => {
    expect(bankAttention(active("2026-09-28T00:00:00Z"), TODAY)).toMatchObject({
      kind: "renew",
      daysLeft: -2,
    });
  });

  it("puts a broken feed ahead of the consent date", () => {
    expect(
      bankAttention(
        { status: "expired", consent_valid_until: "2027-01-01T00:00:00Z" },
        TODAY,
      ),
    ).toEqual({ kind: "expired" });
    expect(
      bankAttention({ status: "paused", consent_valid_until: null }, TODAY),
    ).toEqual({ kind: "paused" });
  });

  it("treats a failing sync as nothing to act on yet", () => {
    expect(
      bankAttention({ status: "error", consent_valid_until: null }, TODAY),
    ).toBeNull();
  });
});

describe("bankAttentionNotification", () => {
  it("waits until the push window, which is shorter than the in-app one", () => {
    const tenDays = bankAttention(active("2026-10-10T00:00:00Z"), TODAY);
    expect(tenDays).not.toBeNull();
    expect(push(tenDays)).toBeNull();

    const week = bankAttention(active(`2026-10-0${RENEW_PUSH_DAYS}`), TODAY);
    expect(push(week)).toMatchObject({
      key: "bank-consent:2026-10-07",
      url: "/bank",
      body: "Your bank consent ends in 7 days, on 2026-10-07. Renew it on open-banking.io — it takes a minute.",
    });
  });

  it("keys a reminder by the consent's date, so one date is said once", () => {
    const tomorrow = push(bankAttention(active("2026-10-01"), TODAY));
    const nextMorning = push(bankAttention(active("2026-10-01"), "2026-10-01"));
    expect(tomorrow?.key).toBe(nextMorning?.key);
    expect(tomorrow?.body).toContain("tomorrow");
    expect(nextMorning?.body).toContain("today");
  });

  it("keys a lapse by the last good sync, so it is said once per lapse", () => {
    expect(push({ kind: "expired" })?.key).toBe("bank-expired:2026-09-20");
    expect(push({ kind: "paused" })?.key).toBe("bank-paused:2026-09-20");
  });

  it("speaks French, singular up to one day as French does", () => {
    const fr = push(bankAttention(active("2026-10-01"), TODAY), "fr");
    expect(fr?.body).toContain("demain");
    expect(push({ kind: "expired" }, "fr")?.title).toBe(
      "Votre banque ne se synchronise plus",
    );
  });

  it("sends nothing when nothing needs attention", () => {
    expect(push(null)).toBeNull();
  });
});
