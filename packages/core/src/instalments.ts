/**
 * Paying in several times — « paiement en 3 ou 4 fois » with Alma, Oney,
 * Klarna, PayPal, Floa, Scalapay, Cofidis — found in the lines brought.
 *
 * One purchase becomes a debit a month for three or four months. Seen one at
 * a time, each is an expense like any other, and the ones still to come are
 * nowhere: « Il vous reste » does not keep them back, « Encore à venir » does
 * not list them. Said once as a recurring entry with an end date (`ends_on`),
 * they are — matched to the bank's lines like any charge, and gone after the
 * last one. This proposes that entry from the first instalment seen; the
 * person says in how many times, once.
 *
 * Nothing here was checked against real lines; the names are what French
 * banks are known to print for these providers.
 */

import type { DetectionInput, RecurringProposal } from "./recurring-detection";

/** Upper case without accents, for matching what banks print. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** The providers, by the names their lines carry. */
const PROVIDERS: readonly { name: string; pattern: RegExp }[] = [
  { name: "Alma", pattern: /\bALMA\b/ },
  { name: "Oney", pattern: /\bONEY\b/ },
  { name: "Klarna", pattern: /\bKLARNA\b/ },
  { name: "Floa", pattern: /\bFLOA\b/ },
  { name: "Scalapay", pattern: /\bSCALAPAY\b/ },
  { name: "Younited", pattern: /\bYOUNITED\b/ },
  {
    name: "PayPal",
    pattern: /\bPAYPAL\b.*(\b[234] ?X\b|PAY IN [34]|PAIEMENT EN [234])/,
  },
  { name: "Cofidis", pattern: /\bCOFIDIS\b.*\b[34] ?X/ },
];

/** « 3X », « 4X CB », « PAIEMENT EN 4 FOIS », « PAY IN 3 ». */
const COUNT =
  /\b([2-9]|1[0-2]) ?X\b|\bEN ([2-9]|1[0-2]) FOIS\b|\bPAY IN ([2-9])\b/;

/** The provider a line pays in several times with, or null. */
export function instalmentProviderOf(
  text: string | null | undefined,
): string | null {
  if (!text) {
    return null;
  }
  const line = plain(text);
  for (const provider of PROVIDERS) {
    if (provider.pattern.test(line)) {
      return provider.name;
    }
  }
  // A line that says « en 3 fois » or « 4X CB » without a known provider.
  return /\bEN [234] FOIS\b|\b[34] ?X ?(CB|SANS FRAIS)\b/.test(line)
    ? "plusieurs-fois"
    : null;
}

/** In how many times the line says it is paid, or null when it does not. */
export function instalmentCountOf(
  text: string | null | undefined,
): number | null {
  if (!text) {
    return null;
  }
  const found = plain(text).match(COUNT);
  const count = Number(found?.[1] ?? found?.[2] ?? found?.[3] ?? NaN);
  return Number.isInteger(count) ? count : null;
}

/** What an instalment proposal says beyond an ordinary one. */
export interface InstalmentPlan {
  /** « Alma », or `plusieurs-fois` for a provider not named. */
  provider: string;
  /** Instalments seen so far. */
  paid: number;
  /** In how many times, when a line said; else the person is asked. */
  count: number | null;
  /** The day the first one seen was paid. */
  firstOn: string;
}

function daysBetween(earlier: string, later: string): number {
  return (
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
    86_400_000
  );
}

/** How long after its last instalment a plan is over or forgotten. */
const STALE_DAYS = 40;

/**
 * The plans the lines imply: a provider's debits of the same amount (to 1 %:
 * a first instalment carries the fees), a month apart, the latest less than
 * forty days ago, and fewer than its count when the line says one.
 */
export function detectInstalmentPlans(
  transactions: readonly DetectionInput[],
  today: string,
): (RecurringProposal & { instalments: InstalmentPlan })[] {
  const lines = transactions
    .filter((tx) => tx.categoryType !== "income")
    .map((tx) => ({ tx, provider: instalmentProviderOf(tx.note) }))
    .filter(
      (entry): entry is { tx: DetectionInput; provider: string } =>
        entry.provider !== null,
    )
    .sort((a, b) => a.tx.occurredOn.localeCompare(b.tx.occurredOn));

  // Newest first: each line joins the run of a later one a month after it,
  // same provider and amount, or starts its own.
  const runs: { provider: string; rows: DetectionInput[] }[] = [];
  for (const { tx, provider } of [...lines].reverse()) {
    const run = runs.find((candidate) => {
      const first = candidate.rows[0]!;
      const gap = daysBetween(tx.occurredOn, first.occurredOn);
      return (
        candidate.provider === provider &&
        gap >= 25 &&
        gap <= 36 &&
        Math.abs(first.amount - tx.amount) <=
          Math.max(0.01, first.amount * 0.01)
      );
    });
    if (run) {
      run.rows.unshift(tx);
    } else {
      runs.push({ provider, rows: [tx] });
    }
  }

  const plans: (RecurringProposal & { instalments: InstalmentPlan })[] = [];
  for (const { provider, rows } of runs) {
    const first = rows[0]!;
    const latest = rows[rows.length - 1]!;
    if (daysBetween(latest.occurredOn, today) > STALE_DAYS) {
      continue;
    }
    const count =
      rows.map((row) => instalmentCountOf(row.note)).find((n) => n !== null) ??
      null;
    if (count !== null && rows.length >= count) {
      continue;
    }
    const cents = Math.round(latest.amount * 100);
    plans.push({
      key: `instalments:${provider}:${cents}:${first.occurredOn}`,
      label: latest.note?.trim() || provider,
      categoryId: latest.categoryId,
      categoryName: latest.categoryName,
      categoryType: latest.categoryType,
      recurrence: "monthly",
      months: null,
      dayOfMonth: Number(first.occurredOn.slice(8, 10)),
      dayOfWeek: null,
      amount: latest.amount,
      count: rows.length,
      lastSeenOn: latest.occurredOn,
      variability: 0,
      instalments: {
        provider,
        paid: rows.length,
        count,
        firstOn: first.occurredOn,
      },
    });
  }
  return plans;
}

/** Whether a line belongs to a plan in several times, not a monthly charge. */
export function isInstalmentLine(note: string | null | undefined): boolean {
  return instalmentProviderOf(note) !== null;
}

/**
 * The day the last of `count` instalments is debited, the first being on
 * `firstOn`: what the recurring entry ends on.
 */
export function lastInstalmentOn(firstOn: string, count: number): string {
  const year = Number(firstOn.slice(0, 4));
  const month = Number(firstOn.slice(5, 7)) - 1 + (count - 1);
  const day = Number(firstOn.slice(8, 10));
  const at = new Date(Date.UTC(year, month, 1));
  const last = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
