/**
 * The day a card payment was made, when the bank booked it later.
 *
 * A bank books a card payment one to nine days after it was made. Bought on
 * 31 October and booked on 3 November, it counted for November: at the
 * owner's Crédit Agricole, 13 % of card lines did (Phase 0 of
 * docs/plans/CARDS_CADENCE_PLAN.md). The bank has a field for the day it was
 * made, `transactionDate`, which some banks fill; Crédit Agricole never does,
 * and writes it instead at the end of the line's text, day and month only:
 * « PAIEMENT PAR CARTE X7322 SYMPA LILLE 30/10 ».
 *
 * The same reading is what a deferred-debit card needs later (Phases 1–2):
 * its payments booked together at the end of the month, each still carrying
 * the day it was made.
 */

import { isCardLine, isCardSettlement } from "./cards";

/** Further back than this, a date in the text is not the purchase's. */
const MAX_LAG_DAYS = 45;

/** `DD/MM`, or `DD/MM/YY(YY)`, ending the text. */
const TRAILING_DATE = /(\d{2})\/(\d{2})(?:\/(\d{2}|\d{4}))?\s*$/;

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value!);
}

function validDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) {
    return null;
  }
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysBefore(earlier: string, later: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
      86_400_000,
  );
}

/**
 * The purchase day a card line's text ends with, read against the day it
 * was booked: the year is the booking's, or the one before when the month is
 * later than the booking's (bought 30/12, booked 2 January).
 */
export function purchaseDayInText(
  text: string | null | undefined,
  bookedOn: string,
): string | null {
  // A month's combined card debit ends with the period it covers, not a day
  // anything was bought.
  if (!text || !isCardLine(text) || isCardSettlement(text)) {
    return null;
  }
  const found = text.match(TRAILING_DATE);
  if (!found) {
    return null;
  }
  const day = Number(found[1]);
  const month = Number(found[2]);
  const bookedYear = Number(bookedOn.slice(0, 4));
  const bookedMonth = Number(bookedOn.slice(5, 7));
  let year = bookedYear;
  if (found[3]) {
    year = Number(found[3].length === 2 ? `20${found[3]}` : found[3]);
  } else if (month > bookedMonth) {
    year -= 1;
  }
  return validDay(year, month, day);
}

/**
 * The day a bank line was made, when it is earlier than the day it was
 * booked and close enough to be that line's: the bank's `transactionDate`
 * first, then the date ending a card line's text. Null when there is none,
 * or it is the booking day itself.
 */
export function purchaseDayOf(
  line: {
    transactionDate: string | null;
    remittanceInformation: string | null;
  },
  bookedOn: string,
): string | null {
  const candidate = isIsoDate(line.transactionDate)
    ? line.transactionDate
    : purchaseDayInText(line.remittanceInformation, bookedOn);
  if (!candidate) {
    return null;
  }
  const lag = daysBefore(candidate, bookedOn);
  return lag > 0 && lag <= MAX_LAG_DAYS ? candidate : null;
}
