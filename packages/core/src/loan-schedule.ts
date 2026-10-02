/**
 * A loan's amortisation schedule: every payment it calls for, each split
 * into principal, interest and insurance.
 *
 * Worked out the way a French bank works it: the monthly rate is the yearly
 * one divided by twelve, the payment is rounded to the cent, each month's
 * interest is rounded on its own, and the last payment takes whatever the
 * rounding left, so what is owed ends at exactly zero.
 *
 * Nothing in it is stored. The outstanding principal on any day is read off
 * the schedule, and the one figure the user may give instead is the one
 * their bank shows after an early repayment or a change of terms: the
 * schedule keeps what came before that day and carries on from the figure,
 * either keeping the payment and ending sooner, or keeping the end and
 * paying less.
 */

/** Paid down month by month, or interest only and the principal at the end. */
export type LoanKind = "amortising" | "in_fine";

/**
 * The first months of a loan, when the principal is not repaid yet: with a
 * partial deferral the interest is paid, with a total one nothing is, and
 * the interest is added to what is owed.
 */
export type DeferralKind = "none" | "partial" | "total";

/** What the bank kept after an early repayment: the payment or the end. */
export type KnownOutstandingKeeps = "payment" | "term";

export interface KnownOutstanding {
  /** Still owed once every payment dated on or before `on` was made. */
  outstanding: number;
  on: string;
  keeps: KnownOutstandingKeeps;
}

export interface LoanTerms {
  kind: LoanKind;
  principal: number;
  /** Yearly and nominal, as a fraction: 0.035 for 3.5 %. */
  annualRate: number;
  /** Every month the loan runs, a deferral included. */
  months: number;
  firstPaymentOn: string;
  /** A fixed amount each month: insurance on the initial capital. */
  insuranceMonthly: number;
  /**
   * Yearly, as a fraction of what is still owed, when the insurance follows
   * it down instead. Wins over `insuranceMonthly`.
   */
  insuranceRate: number | null;
  deferralMonths: number;
  deferralKind: DeferralKind;
  known: KnownOutstanding | null;
}

export interface LoanPayment {
  /** 1 for the first payment. */
  index: number;
  on: string;
  /**
   * What the payment repays of what is owed. Negative in a total deferral,
   * where the month's interest is added to it instead.
   */
  principal: number;
  interest: number;
  insurance: number;
  /** What leaves the account for the loan itself, insurance aside. */
  payment: number;
  /** Still owed once this payment is made. */
  outstanding: number;
}

/** Far beyond any loan, so a schedule that cannot end still does. */
const MAX_PAYMENTS = 1200;

function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The day of the payment `offset` months after the first, on the same day
 * of the month or the month's last day when it is shorter — the way a
 * recurring template's occurrences fall.
 */
function paymentDate(first: string, offset: number): string {
  const [year, month, day] = first.split("-").map(Number);
  const months = month! - 1 + offset;
  const y = year! + Math.floor(months / 12);
  const m = (((months % 12) + 12) % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(Math.min(day!, last))}`;
}

/** The constant payment that repays `capital` in `months` at `rate` a month. */
function annuity(capital: number, rate: number, months: number): number {
  if (months <= 1) {
    return cents(capital * (1 + rate));
  }
  if (rate === 0) {
    return cents(capital / months);
  }
  return cents((capital * rate) / (1 - (1 + rate) ** -months));
}

function insuranceOn(terms: LoanTerms, owed: number): number {
  return terms.insuranceRate === null
    ? terms.insuranceMonthly
    : cents((owed * terms.insuranceRate) / 12);
}

/** Payments from some point on, and what is still owed after them. */
interface Run {
  rows: LoanPayment[];
  owed: number;
}

function payment(
  terms: LoanTerms,
  index: number,
  owed: number,
  principal: number,
  interest: number,
): LoanPayment {
  const outstanding = cents(owed - principal);
  return {
    index,
    on: paymentDate(terms.firstPaymentOn, index - 1),
    principal,
    interest,
    insurance: insuranceOn(terms, owed),
    payment: cents(Math.max(0, principal + interest)),
    outstanding,
  };
}

/** Deferred months from `from` to `to`, inclusive. */
function defer(terms: LoanTerms, from: number, to: number, owed: number): Run {
  const rate = terms.annualRate / 12;
  const rows: LoanPayment[] = [];
  for (let index = from; index <= to; index++) {
    const interest = cents(owed * rate);
    // In a total deferral nothing is paid: the interest is owed instead.
    const principal = terms.deferralKind === "total" ? -interest : 0;
    const row = payment(terms, index, owed, principal, interest);
    rows.push(row);
    owed = row.outstanding;
  }
  return { rows, owed };
}

/**
 * Constant payments from `from` that end on `last`, the last one taking
 * what the rounding left.
 */
function amortiseTo(
  terms: LoanTerms,
  from: number,
  last: number,
  owed: number,
): Run {
  const rate = terms.annualRate / 12;
  const each = annuity(owed, rate, last - from + 1);
  const rows: LoanPayment[] = [];
  for (let index = from; index <= last && owed > 0; index++) {
    const interest = cents(owed * rate);
    const principal =
      index === last ? owed : Math.min(owed, cents(each - interest));
    const row = payment(terms, index, owed, principal, interest);
    rows.push(row);
    owed = row.outstanding;
  }
  return { rows, owed };
}

/**
 * Payments of `each` from `from` until nothing is owed — or null when `each`
 * does not even cover the interest, and would never end.
 */
function amortiseAt(
  terms: LoanTerms,
  from: number,
  each: number,
  owed: number,
): Run | null {
  const rate = terms.annualRate / 12;
  if (each <= cents(owed * rate)) {
    return null;
  }
  const rows: LoanPayment[] = [];
  for (let index = from; owed > 0 && index < from + MAX_PAYMENTS; index++) {
    const interest = cents(owed * rate);
    const principal = Math.min(owed, cents(each - interest));
    const row = payment(terms, index, owed, principal, interest);
    rows.push(row);
    owed = row.outstanding;
  }
  return { rows, owed };
}

/** Interest only from `from` to `last`, and the principal with the last. */
function inFine(
  terms: LoanTerms,
  from: number,
  last: number,
  owed: number,
): Run {
  const rate = terms.annualRate / 12;
  const rows: LoanPayment[] = [];
  for (let index = from; index <= last; index++) {
    const interest = cents(owed * rate);
    const row = payment(
      terms,
      index,
      owed,
      index === last ? owed : 0,
      interest,
    );
    rows.push(row);
    owed = row.outstanding;
  }
  return { rows, owed };
}

/** The schedule from `from` on, with `owed` still owed before it. */
function scheduleFrom(terms: LoanTerms, from: number, owed: number): Run {
  if (terms.kind === "in_fine") {
    return inFine(terms, from, terms.months, owed);
  }
  const deferred = defer(
    terms,
    from,
    Math.min(terms.deferralMonths, terms.months - 1),
    owed,
  );
  const amortised = amortiseTo(
    terms,
    from + deferred.rows.length,
    terms.months,
    deferred.owed,
  );
  return {
    rows: [...deferred.rows, ...amortised.rows],
    owed: amortised.owed,
  };
}

/** The payment the schedule settles into once any deferral is over. */
function regularRow(
  rows: readonly LoanPayment[],
  terms: LoanTerms,
): LoanPayment | undefined {
  return terms.kind === "in_fine"
    ? rows[0]
    : (rows[Math.min(terms.deferralMonths, rows.length - 1)] ?? rows[0]);
}

/** Every payment the loan calls for, in order. */
export function loanSchedule(terms: LoanTerms): LoanPayment[] {
  const original = scheduleFrom(terms, 1, terms.principal).rows;
  const known = terms.known;
  if (!known) {
    return original;
  }

  const kept = original.filter((row) => row.on <= known.on);
  const next = kept.length + 1;
  const owed = cents(known.outstanding);
  // Repaid in full, or a figure from after the last payment: nothing more.
  if (owed <= 0 || next > terms.months) {
    return kept;
  }

  // Still deferred, or interest only: the terms carry on from the figure.
  if (terms.kind === "in_fine" || next <= terms.deferralMonths) {
    return [...kept, ...scheduleFrom(terms, next, owed).rows];
  }

  if (known.keeps === "payment") {
    const each = regularRow(original, terms)?.payment ?? 0;
    const run = amortiseAt(terms, next, each, owed);
    if (run) {
      return [...kept, ...run.rows];
    }
  }
  return [...kept, ...amortiseTo(terms, next, terms.months, owed).rows];
}

/**
 * Still owed on `day`, once every payment dated on or before it is made.
 * Before the first payment it is the principal; on and after the day the
 * user gave a figure for, until the next payment, it is that figure.
 */
export function outstandingOn(
  terms: LoanTerms,
  schedule: readonly LoanPayment[],
  day: string,
): number {
  const paid = schedule.filter((row) => row.on <= day).at(-1);
  if (
    terms.known &&
    day >= terms.known.on &&
    (!paid || paid.on <= terms.known.on)
  ) {
    return cents(terms.known.outstanding);
  }
  return paid ? paid.outstanding : terms.principal;
}

/** The first payment on or after `day`, or null once the loan is repaid. */
export function nextPayment(
  schedule: readonly LoanPayment[],
  day: string,
): LoanPayment | null {
  return schedule.find((row) => row.on >= day) ?? null;
}

/**
 * What leaves the account each month once the loan is under way: the
 * regular payment and its insurance. Insurance that follows what is owed
 * down makes the first such month the largest.
 */
export function monthlyOutlay(
  terms: LoanTerms,
  schedule: readonly LoanPayment[],
): number {
  const row = regularRow(schedule, terms);
  return row ? cents(row.payment + row.insurance) : 0;
}

export interface LoanTotals {
  interest: number;
  insurance: number;
  /** Interest, insurance and the fees: what borrowing costs, all told. */
  cost: number;
  /** The day of the last payment, or null for a loan with none. */
  endsOn: string | null;
}

export function loanTotals(
  schedule: readonly LoanPayment[],
  fees: number,
): LoanTotals {
  const interest = cents(schedule.reduce((sum, row) => sum + row.interest, 0));
  const insurance = cents(
    schedule.reduce((sum, row) => sum + row.insurance, 0),
  );
  return {
    interest,
    insurance,
    cost: cents(interest + insurance + fees),
    endsOn: schedule.at(-1)?.on ?? null,
  };
}
