import { bankMerchantKey } from "./bank-merchant";
import { shiftIsoDate } from "./constants";
import { normalizeMerchant } from "./merchant-memory";
import { proposalDisplayName } from "./recurring-detection";
import type { CategoryType } from "./types/database";

/**
 * The subscription watch (docs/plans/EVERYDAY_PLAN.md, phase 4): the
 * services a statement shows being paid every month or every year, and four
 * facts about them — a price that went up, one that is new, one that stopped,
 * two of a kind.
 *
 * Read off what the ledger already holds, never asked of the user, and never
 * a verdict: « Netflix est passé de 13,49 € à 15,99 € » is said, « vous
 * devriez résilier » never is. A shop is one subscription however its bank
 * spells it (`bankMerchantKey`).
 */

export interface SubscriptionCharge {
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryName: string;
  categoryType: CategoryType;
}

/** What a known service is, for « two of a kind ». */
export type SubscriptionKind = "music" | "video" | "cloud" | "phone" | "gym";

/** Words that name a kind of service, matched in the charge's own words. */
const KINDS: Record<SubscriptionKind, readonly string[]> = {
  music: [
    "spotify",
    "deezer",
    "apple music",
    "youtube music",
    "qobuz",
    "tidal",
    "amazon music",
  ],
  video: [
    "netflix",
    "disney",
    "prime video",
    "primevideo",
    "canal",
    "paramount",
    "apple tv",
    "hbo",
    "ocs",
    "crunchyroll",
    "dazn",
    "molotov",
  ],
  cloud: ["icloud", "google one", "dropbox", "onedrive", "microsoft 365"],
  phone: [
    "free mobile",
    "sosh",
    "red by sfr",
    "b you",
    "bouygues telecom",
    "prixtel",
    "lebara",
    "la poste mobile",
  ],
  gym: ["basic fit", "fitness park", "keepcool", "neoness", "on air"],
};

export function subscriptionKind(
  note: string | null | undefined,
): SubscriptionKind | null {
  const words = ` ${normalizeMerchant(note ?? "")} `;
  for (const [kind, names] of Object.entries(KINDS) as [
    SubscriptionKind,
    readonly string[],
  ][]) {
    // At the start of a word: « canal » for « Canal+ » and « CanalPlus ».
    if (names.some((name) => words.includes(` ${name}`))) {
      return kind;
    }
  }
  return null;
}

export interface Subscription {
  key: string;
  /** The shop's name for showing: « Spotify », not « PRLV SEPA SPOTIFY AB ». */
  label: string;
  categoryName: string;
  cadence: "monthly" | "yearly";
  /** The latest charge. */
  amount: number;
  /** The charge before it, or null for the first. */
  previousAmount: number | null;
  /** What it costs a month: a yearly one over twelve. */
  monthly: number;
  firstSeenOn: string;
  lastSeenOn: string;
  kind: SubscriptionKind | null;
  /** Still charged, or overdue past its cadence. */
  status: "active" | "stopped";
}

export type SubscriptionFinding =
  | {
      type: "priceRise";
      key: string;
      label: string;
      from: number;
      to: number;
      /** The day of the dearer charge. */
      on: string;
    }
  | {
      type: "new" | "stopped";
      key: string;
      label: string;
      amount: number;
      cadence: Subscription["cadence"];
      on: string;
    }
  | {
      type: "sameKind";
      kind: SubscriptionKind;
      labels: string[];
      /** The day the second of them first appeared. */
      on: string;
    };

/** Days a monthly one may be late before it reads as stopped. */
const MONTHLY_GRACE = 45;
/** Days a yearly one may be late before it reads as stopped. */
const YEARLY_GRACE = 400;
/** How long after its last charge a stopped one is still worth listing. */
const STOPPED_LISTED = 120;
/** How long a new one is new. */
const NEW_FOR = 70;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Monthly when every gap is about a month, yearly when about a year. */
function cadenceOf(gaps: readonly number[]): Subscription["cadence"] | null {
  if (gaps.length === 0) {
    return null;
  }
  if (gaps.every((gap) => gap >= 20 && gap <= 40)) {
    return "monthly";
  }
  if (gaps.every((gap) => gap >= 350 && gap <= 380)) {
    return "yearly";
  }
  return null;
}

/**
 * The subscriptions in a run of charges, and what changed about them.
 *
 * A shop charged about every month (or every year) at about the same price
 * is one. Two charges are enough for a service the watch knows by name, or
 * for the same amount on about the same day; anything else needs three, so
 * two coffees a month apart do not become a subscription. Spending, only:
 * money moved to savings or a wallet is not a service.
 */
export function watchSubscriptions(
  charges: readonly SubscriptionCharge[],
  today: string,
): { subscriptions: Subscription[]; findings: SubscriptionFinding[] } {
  const groups = new Map<string, SubscriptionCharge[]>();
  for (const charge of charges) {
    if (charge.categoryType !== "expense" || charge.amount <= 0) {
      continue;
    }
    const key = bankMerchantKey(charge.note);
    if (key === "") {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), charge]);
  }

  const subscriptions: Subscription[] = [];
  const findings: SubscriptionFinding[] = [];

  for (const [key, rows] of groups) {
    const ordered = [...rows].sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn),
    );
    if (ordered.length < 2) {
      continue;
    }
    const gaps = ordered
      .slice(1)
      .map((row, index) =>
        daysBetween(ordered[index]!.occurredOn, row.occurredOn),
      );
    const cadence = cadenceOf(gaps);
    if (!cadence) {
      continue;
    }
    const amounts = ordered.map((row) => row.amount);
    const typical = median(amounts);
    if ((Math.max(...amounts) - Math.min(...amounts)) / typical > 0.25) {
      continue;
    }
    const latest = ordered[ordered.length - 1]!;
    const kind = subscriptionKind(latest.note);
    if (ordered.length === 2 && kind === null) {
      const [first, second] = ordered as [
        SubscriptionCharge,
        SubscriptionCharge,
      ];
      const sameAmount = Math.abs(first.amount - second.amount) < 0.005;
      const sameDay =
        Math.abs(
          Number(first.occurredOn.slice(8, 10)) -
            Number(second.occurredOn.slice(8, 10)),
        ) <= 3;
      if (!sameAmount || !sameDay) {
        continue;
      }
    }

    const late = daysBetween(latest.occurredOn, today);
    const grace = cadence === "monthly" ? MONTHLY_GRACE : YEARLY_GRACE;
    if (late > grace + STOPPED_LISTED) {
      continue;
    }
    const previous = ordered[ordered.length - 2]!;
    const subscription: Subscription = {
      key,
      label: proposalDisplayName(key),
      categoryName: latest.categoryName,
      cadence,
      amount: roundMoney(latest.amount),
      previousAmount: roundMoney(previous.amount),
      monthly: roundMoney(
        cadence === "monthly" ? latest.amount : latest.amount / 12,
      ),
      firstSeenOn: ordered[0]!.occurredOn,
      lastSeenOn: latest.occurredOn,
      kind,
      status: late > grace ? "stopped" : "active",
    };
    subscriptions.push(subscription);

    if (subscription.status === "stopped") {
      findings.push({
        type: "stopped",
        key,
        label: subscription.label,
        amount: subscription.amount,
        cadence,
        on: shiftIsoDate(latest.occurredOn, grace + 1),
      });
      continue;
    }

    // A price that went up: the earlier charges agreeing on one price, and
    // the latest dearer. A bill that moves every month — electricity — is
    // not a price that rose.
    const earlier = ordered.slice(0, -1).map((row) => row.amount);
    const steady =
      (Math.max(...earlier) - Math.min(...earlier)) / median(earlier) <= 0.01;
    const rise = latest.amount - previous.amount;
    if (steady && rise >= 0.1 && rise / previous.amount >= 0.01) {
      findings.push({
        type: "priceRise",
        key,
        label: subscription.label,
        from: roundMoney(previous.amount),
        to: subscription.amount,
        on: latest.occurredOn,
      });
    }

    if (daysBetween(subscription.firstSeenOn, today) <= NEW_FOR) {
      findings.push({
        type: "new",
        key,
        label: subscription.label,
        amount: subscription.amount,
        cadence,
        // The day it could be told for one: its second charge.
        on: ordered[1]!.occurredOn,
      });
    }
  }

  const byKind = new Map<SubscriptionKind, Subscription[]>();
  for (const subscription of subscriptions) {
    if (subscription.kind && subscription.status === "active") {
      byKind.set(subscription.kind, [
        ...(byKind.get(subscription.kind) ?? []),
        subscription,
      ]);
    }
  }
  for (const [kind, alike] of byKind) {
    if (alike.length < 2) {
      continue;
    }
    const firsts = alike.map((subscription) => subscription.firstSeenOn).sort();
    findings.push({
      type: "sameKind",
      kind,
      labels: alike.map((subscription) => subscription.label),
      on: firsts[1]!,
    });
  }

  // Dearest first; what stopped after what runs.
  subscriptions.sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === "active" ? -1 : 1) ||
      b.monthly - a.monthly,
  );
  findings.sort((a, b) => b.on.localeCompare(a.on));
  return { subscriptions, findings };
}

/** What the active ones cost, a month and a year. */
export function subscriptionTotals(subscriptions: readonly Subscription[]): {
  monthly: number;
  yearly: number;
} {
  const monthly = subscriptions
    .filter((subscription) => subscription.status === "active")
    .reduce((sum, subscription) => sum + subscription.monthly, 0);
  return { monthly: roundMoney(monthly), yearly: roundMoney(monthly * 12) };
}

/** The findings dated within a span: what is news for a week's recap. */
export function findingsBetween(
  findings: readonly SubscriptionFinding[],
  from: string,
  to: string,
): SubscriptionFinding[] {
  return findings.filter((finding) => finding.on >= from && finding.on <= to);
}
