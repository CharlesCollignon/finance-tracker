/**
 * Cards, and the day a deferred-debit card's payments leave the account.
 *
 * A card on deferred debit (« débit différé ») is paid with at the till and
 * debited once a month, all its payments together. Each payment still counts
 * for the day it was made; its money leaves the current account on the debit
 * day. Banks show it three ways (docs/plans/CARDS_CADENCE_PLAN.md, Phase 0):
 *
 *  (a) the card as its own account (`CARD`), listing the payments, and one
 *      line on the current account taking the month's total;
 *  (b) the payments on the current account itself, booked on the debit day
 *      or with a later value date;
 *  (c) only that one combined line on the current account, the payments
 *      known from alerts, notifications or a card statement.
 *
 * Nothing here was checked against a real deferred card — the owner's is
 * immediate. The wordings come from what French banks are known to print and
 * are kept loose on purpose; a card is only ever treated as deferred once its
 * owner has said so (`cards.debit`, migration 087).
 */

/** How a card is debited, once asked; null until then. */
export type CardDebit = "immediate" | "deferred";

/** A card as the feed needs it. */
export interface CardRule {
  /** Last four digits, or `acct:<provider account id>` for a card account. */
  key: string;
  debit: CardDebit | null;
  /** Day of the month it is debited; 31 is the last day, whatever the month. */
  debitDay: number | null;
}

/** When a deferred card's day is not known: the month's last day, the usual. */
export const DEFAULT_DEBIT_DAY = 31;

/** The key of a card the bank shows as its own account. */
export function cardAccountKey(providerAccountId: string): string {
  return `acct:${providerAccountId}`;
}

/** Upper case without accents, for matching what banks print. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** A card line, by the words banks print on one. */
const CARD_LINE = /\b(CARTE|CB|CARD)\b/;

/** Whether a bank line is a card's: a payment, a refund, a combined debit. */
export function isCardLine(text: string | null | undefined): boolean {
  return Boolean(text) && CARD_LINE.test(plain(text!));
}

/**
 * The last four digits a line names its card by: « CARTE X7322 » (Crédit
 * Agricole), « CARTE 4974XXXXXXXX1234 », « CB*1234 », « CARTE ****1234 ».
 * Null when the line names none.
 */
export function cardNumberOf(text: string | null | undefined): string | null {
  if (!text || !isCardLine(text)) {
    return null;
  }
  const line = plain(text);
  const patterns = [
    /\bX\s?(\d{4})\b/,
    /\b\d{4,6}[X*]{4,10}(\d{4})\b/,
    /\*{2,}\s?(\d{4})\b/,
    /\bCB\s?\*\s?(\d{4})\b/,
  ];
  for (const pattern of patterns) {
    const found = line.match(pattern);
    if (found) {
      return found[1]!;
    }
  }
  return null;
}

/**
 * The month-end line that takes a deferred card's payments off the current
 * account in one: « FACTURE CARTE DU 300924 », « RELEVE DIFFERE CARTE »,
 * « PRLV CARTE DIFFEREE », « CARTE X1234 DEPENSES DU 01/09 AU 30/09 »,
 * « ARRETE CARTE », « TOTAL OPERATIONS CARTE ».
 */
export function isCardSettlement(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  const line = plain(text);
  return (
    /\bFACTURES? (DE )?(CARTE|CB)\b/.test(line) ||
    /\bRELEVE (DIFFERE |MENSUEL )?(DE )?(CARTE|CB)\b/.test(line) ||
    /\bRELEVE DIFFERE\b/.test(line) ||
    /\b(DEBIT|PRLV|PRELEVEMENT|REGLEMENT)( DE)?( LA)? (CARTE|CB)\b.*\bDIFFERE/.test(
      line,
    ) ||
    /\b(DEBIT|PRLV|PRELEVEMENT) DIFFERE\b/.test(line) ||
    /\bARRETE (DE )?(CARTE|CB)\b/.test(line) ||
    /\bTOTAL (DES )?(OPERATIONS |DEPENSES )?(CARTE|CB)\b/.test(line) ||
    /\b(CARTE|CB)\b.*\bDEPENSES DU\b/.test(line) ||
    /\bDEPENSES (CARTE|CB)\b/.test(line)
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** A card's debit day in a month, the last day when the month is shorter. */
export function debitDateIn(
  year: number,
  month: number,
  debitDay: number,
): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(debitDay, last))}`;
}

/**
 * The day a deferred card's payment made on `purchasedOn` leaves the current
 * account: the card's debit day after it, this month's when it is still to
 * come, next month's otherwise. A payment on the debit day itself goes with
 * the next one, as banks close the month a little before they debit it.
 */
export function debitDateFor(purchasedOn: string, debitDay: number): string {
  const year = Number(purchasedOn.slice(0, 4));
  const month = Number(purchasedOn.slice(5, 7));
  const thisMonth = debitDateIn(year, month, debitDay);
  if (purchasedOn < thisMonth) {
    return thisMonth;
  }
  return month === 12
    ? debitDateIn(year + 1, 1, debitDay)
    : debitDateIn(year, month + 1, debitDay);
}

/** What a deferred card has spent towards one debit. */
export interface CardCycle {
  key: string;
  /** The debit day it was worked out for. */
  debitOn: string;
  total: number;
}

/** How far the bank's debit day may be from the one worked out. */
const SETTLEMENT_DAYS = 6;

function daysApart(a: string, b: string): number {
  return Math.abs(
    Math.round(
      (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
        86_400_000,
    ),
  );
}

/**
 * The cycle a combined debit pays for: the card it names — or any deferred
 * card when it names none — debited within a few days of it, for the same
 * total to the euro or to 1 %, whichever is wider. Null when nothing it could
 * be settling is known: then it stays an expense like any other.
 */
export function settledCycle(
  settlement: { amount: number; bookedOn: string; key: string | null },
  cycles: readonly CardCycle[],
): CardCycle | null {
  const tolerance = Math.max(1, settlement.amount * 0.01);
  let best: CardCycle | null = null;
  for (const cycle of cycles) {
    if (
      (settlement.key !== null &&
        cycle.key !== settlement.key &&
        !cycle.key.startsWith("acct:")) ||
      daysApart(cycle.debitOn, settlement.bookedOn) > SETTLEMENT_DAYS ||
      Math.abs(cycle.total - settlement.amount) > tolerance
    ) {
      continue;
    }
    if (
      best === null ||
      Math.abs(cycle.total - settlement.amount) <
        Math.abs(best.total - settlement.amount)
    ) {
      best = cycle;
    }
  }
  return best;
}
