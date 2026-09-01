/**
 * What a PEA is, as opposed to just another wallet id.
 *
 * The app already hardcodes `pea` as a place investments live. Two facts about
 * the wrapper matter to anyone holding one, and both are things people track
 * by hand today: contributions are capped for the life of the plan, and the
 * plan has to be five years old before withdrawals get their tax treatment.
 *
 * Only the paid-in cash counts against the ceiling — growth does not, which is
 * exactly the point people get wrong.
 */

/** Statutory cap on lifetime contributions to a PEA, in euro. */
export const PEA_CONTRIBUTION_CEILING = 150_000;

/** Years from opening before withdrawals keep the plan's tax treatment. */
export const PEA_MATURITY_YEARS = 5;

/** Past this share of the ceiling the headroom is worth flagging. */
const HEADROOM_WARNING_RATIO = 0.9;

export interface PeaStatus {
  ceiling: number;
  /** Cash paid in over the life of the plan. Growth is excluded. */
  contributed: number;
  headroom: number;
  /** Share of the ceiling used, 0–1 (can exceed 1 if over-contributed). */
  ratio: number;
  /** True once contributions are within the last tenth of the ceiling. */
  nearCeiling: boolean;
  /** True when contributions have passed the statutory cap. */
  overCeiling: boolean;
  openedOn: string | null;
  /** ISO date the five-year clock is reached; null when opening is unknown. */
  maturesOn: string | null;
  matured: boolean;
  /** Whole months until maturity; null when matured or opening is unknown. */
  monthsToMaturity: number | null;
}

function addYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(
    Date.UTC((year ?? 1970) + years, (month ?? 1) - 1, day ?? 1),
  );
  return target.toISOString().slice(0, 10);
}

function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const [fromYear, fromMonth, fromDay] = fromIso.split("-").map(Number);
  const [toYear, toMonth, toDay] = toIso.split("-").map(Number);

  let months =
    ((toYear ?? 0) - (fromYear ?? 0)) * 12 + ((toMonth ?? 0) - (fromMonth ?? 0));

  // Not a full month until the day of month is reached.
  if ((toDay ?? 0) < (fromDay ?? 0)) {
    months -= 1;
  }

  return months;
}

/**
 * The two facts, computed.
 *
 * `contributed` is the caller's job to total, because what counts as a
 * contribution depends on how the user records transfers — this module should
 * not guess at the ledger's shape.
 */
export function buildPeaStatus(
  contributed: number,
  openedOn: string | null,
  today: string,
  ceiling: number = PEA_CONTRIBUTION_CEILING,
): PeaStatus {
  const paid = Math.max(0, contributed);
  const headroom = Math.max(0, ceiling - paid);
  const ratio = ceiling > 0 ? paid / ceiling : 0;

  const base: PeaStatus = {
    ceiling,
    contributed: paid,
    headroom,
    ratio,
    nearCeiling: ratio >= HEADROOM_WARNING_RATIO,
    overCeiling: paid > ceiling,
    openedOn,
    maturesOn: null,
    matured: false,
    monthsToMaturity: null,
  };

  if (!openedOn) {
    return base;
  }

  const maturesOn = addYears(openedOn, PEA_MATURITY_YEARS);
  const matured = today >= maturesOn;

  return {
    ...base,
    maturesOn,
    matured,
    monthsToMaturity: matured
      ? null
      : Math.max(0, wholeMonthsBetween(today, maturesOn)),
  };
}

/** One plain-language line about the five-year clock. */
export function peaMaturityHint(status: PeaStatus): string | null {
  if (!status.openedOn || !status.maturesOn) {
    return null;
  }

  if (status.matured) {
    return "Past five years — withdrawals keep the plan's tax treatment.";
  }

  const months = status.monthsToMaturity ?? 0;

  if (months <= 0) {
    return "Five years is reached this month.";
  }

  if (months === 1) {
    return "One month until the five-year mark.";
  }

  if (months < 12) {
    return `${months} months until the five-year mark.`;
  }

  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years === 1 ? "1 year" : `${years} years`;

  return rest === 0
    ? `${yearPart} until the five-year mark.`
    : `${yearPart} ${rest} months until the five-year mark.`;
}
