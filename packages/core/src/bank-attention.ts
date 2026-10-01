/**
 * Whether a bank connection needs the user to do something.
 *
 * A connected bank stops on its own in three ways, and none of them is
 * visible from the figures: the numbers simply stop moving. The bank's
 * consent runs out (PSD2 caps it, usually at 180 days), open-banking.io
 * pauses syncing when its prepaid wallet is empty, or the API key in the
 * user's credentials file is deleted on their side. Every surface that says so — the push, the banner on
 * the Bearing, the status on the Bank page — asks this one question, so they
 * cannot disagree about whether there is something to do.
 */
import type { PendingNotification } from "./push-digest";
import type { Translate } from "./i18n/t";

export type BankAttention =
  /** Consent ends soon, or ended already on one of the banks. */
  | { kind: "renew"; validUntil: string; daysLeft: number }
  /** The key no longer works: only a new consent brings the feed back. */
  | { kind: "expired" }
  /** open-banking.io stopped syncing, which is settled on their side. */
  | { kind: "paused" };

export interface BankConnectionHealth {
  status: string;
  /** ISO timestamp; the earliest consent among the user's banks. */
  consent_valid_until: string | null;
}

/** How early the app starts saying a consent is ending. */
export const RENEW_WINDOW_DAYS = 14;

/**
 * How early the push says it. Later than the in-app notice on purpose: the
 * app can mention it quietly for two weeks, but a notification is an
 * interruption and one is enough.
 */
export const RENEW_PUSH_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((to - from) / DAY_MS);
}

/**
 * What, if anything, the connection asks of its owner today.
 *
 * `today` is the app's calendar date (ISO); a consent is compared by its date
 * alone, because "ends in 3 days" is read as calendar days, not as 72 hours.
 * A revoked connection, or none, asks for nothing: there is no feed to keep
 * alive, and inviting to connect is a different card with its own rules.
 */
export function bankAttention(
  connection: BankConnectionHealth | null,
  today: string,
  windowDays: number = RENEW_WINDOW_DAYS,
): BankAttention | null {
  if (!connection) {
    return null;
  }
  if (connection.status === "expired") {
    return { kind: "expired" };
  }
  if (connection.status === "paused") {
    return { kind: "paused" };
  }
  if (connection.status === "revoked" || !connection.consent_valid_until) {
    return null;
  }
  const validUntil = connection.consent_valid_until.slice(0, 10);
  const daysLeft = daysBetween(today, validUntil);
  return daysLeft <= windowDays
    ? { kind: "renew", validUntil, daysLeft }
    : null;
}

/**
 * The push for it, if one is due.
 *
 * Each key names the event rather than the day, so the notification log says
 * it once: a consent ending on a given date is one reminder however many
 * mornings it stays true, and a new consent (a new date) earns its own.
 * `since` separates one lapse from the next — the last good sync is the same
 * every morning the feed stays broken, and different once it has recovered
 * and broken again.
 */
export function bankAttentionNotification(
  attention: BankAttention | null,
  {
    since,
    formatDate,
    t,
  }: {
    /** ISO date of the last good sync, or of the connection itself. */
    since: string;
    formatDate: (isoDate: string) => string;
    t: Translate;
  },
): PendingNotification | null {
  if (!attention) {
    return null;
  }
  switch (attention.kind) {
    case "renew":
      if (attention.daysLeft > RENEW_PUSH_DAYS) {
        return null;
      }
      return {
        kind: "bank",
        key: `bank-consent:${attention.validUntil}`,
        title: t("push.bankRenew.title"),
        body:
          attention.daysLeft > 0
            ? t("push.bankRenew.body", {
                count: attention.daysLeft,
                date: formatDate(attention.validUntil),
              })
            : attention.daysLeft === 0
              ? t("push.bankRenew.today")
              : t("push.bankRenew.ended"),
        url: "/bank",
      };
    case "expired":
      return {
        kind: "bank",
        key: `bank-expired:${since.slice(0, 10)}`,
        title: t("push.bankExpired.title"),
        body: t("push.bankExpired.body"),
        url: "/bank",
      };
    case "paused":
      return {
        kind: "bank",
        key: `bank-paused:${since.slice(0, 10)}`,
        title: t("push.bankPaused.title"),
        body: t("push.bankPaused.body"),
        url: "/bank",
      };
  }
}
