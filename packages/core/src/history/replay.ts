/**
 * A reader's own accounts, replayed on what markets actually did.
 *
 * The Plan used to draw the future as a 7 % line inside a bell curve nobody
 * had seen. This puts the same accounts — what each holds today, what goes
 * in each month, what it costs — through every stretch of history since
 * 1970 instead: what they would have become from January 1970, from February
 * 1970, and so on to the last start the horizon leaves room for. Nothing here
 * predicts; every figure is a past that happened, and the copy says
 * « départs », never « chances », because three hundred overlapping windows
 * are not three hundred futures.
 *
 * Four questions, one function each:
 *
 * - `replayPlan`: where the accounts end up, start by start, and the band
 *   most starts fall in.
 * - `crashTest`: what one of the great falls would do to them today, and
 *   how long the money takes to be worth what was put in.
 * - `lossOdds`: how often an account has ended below where it started,
 *   once prices are counted.
 * - `sustainableWithdrawal`: the yearly withdrawal that has always lasted.
 *
 * Everything runs in today's euros, deflated month by month by French
 * prices, except the crash tests, which are told in the euros of the day:
 * « −9 800 € en mars 2009 » is what the statement would have said.
 *
 * Pure: the series come from `historySeries` unless a test hands in its own.
 */

import { addMonths, monthsBetween, type HistoryMonth } from "./month";
import {
  historySeries,
  type HistorySeries,
  type HistorySeriesId,
} from "./series";

/** A source of returns an account can follow; `cash` earns nothing. */
export type MixKey = Exclude<HistorySeriesId, "cpi-fr"> | "cash";

/** What an account follows: shares of sources that add up to 1. */
export type SeriesMix = Partial<Record<MixKey, number>>;

export interface ReplayAccount {
  /** The account's own id, carried to the results. */
  id: string;
  /** What it holds today. */
  value: number;
  /** What goes in each month, in today's euros: it rises with prices. */
  monthly: number;
  /** The first months' payments, when they differ from `monthly`. */
  schedule?: readonly number[];
  /** What it follows. Empty is cash. */
  mix: SeriesMix;
  /** A contract's own rate — a PEL's — followed instead of the mix. */
  fixedRate?: number;
  /** What it costs a year, as a fraction, taken off every month's return. */
  fees?: number;
  /**
   * What the reader added to history's return, a year, as a fraction: the
   * « Hypothèses » edit. It moves every start by the same amount, so the
   * crashes keep their shape.
   */
  shift?: number;
  /** The most it can hold, in today's euros; payments stop there. */
  ceiling?: number | null;
}

/** Hands a series to the replay; `historySeries` unless a test says other. */
export type SeriesReader = (id: HistorySeriesId) => HistorySeries;

/**
 * A source with no history for some months. `month`: another series stands
 * in month by month, as the Livret A does for the LEP before it opened.
 * `window`: a stretch the source does not cover in full holds still in
 * today's euros throughout — bitcoin before 2014, which has no history
 * worth replaying a decade on.
 */
const STAND_INS: Partial<
  Record<MixKey, { kind: "month"; by: HistorySeriesId } | { kind: "window" }>
> = {
  lep: { kind: "month", by: "livret-a" },
  bitcoin: { kind: "window" },
};

export interface StandIn {
  key: MixKey;
  /** The series that stood in, or `flat` for held still. */
  as: HistorySeriesId | "flat";
}

/* ----------------------------------------------------------- the stepping */

interface Prepared {
  account: ReplayAccount;
  /** The monthly factor fees and the shift make, applied to every month. */
  adjust: number;
  fixed: number | null;
  keys: readonly [MixKey, number][];
}

function prepare(accounts: readonly ReplayAccount[]): Prepared[] {
  return accounts.map((account) => ({
    account,
    adjust: Math.pow(1 + (account.shift ?? 0) - (account.fees ?? 0), 1 / 12),
    fixed:
      account.fixedRate === undefined
        ? null
        : Math.pow(1 + account.fixedRate, 1 / 12) - 1,
    keys: (Object.entries(account.mix) as [MixKey, number][]).filter(
      ([, weight]) => weight > 0,
    ),
  }));
}

/**
 * The history one call reads, by month index from its first month — prices'
 * first, January 1970 — so the inner loops count rather than parse dates.
 */
class History {
  readonly cpi: HistorySeries;
  readonly epoch: HistoryMonth;
  readonly end: HistoryMonth;
  /** Months from the epoch to the end, both counted. */
  readonly length: number;
  private readonly offsets = new Map<
    HistorySeriesId,
    { series: HistorySeries; offset: number }
  >();

  constructor(readonly read: SeriesReader) {
    this.cpi = read("cpi-fr");
    this.epoch = this.cpi.start;
    this.end = this.cpi.end;
    this.length = monthsBetween(this.epoch, this.end) + 1;
  }

  /** A series and how many months after the epoch it starts. */
  entry(id: HistorySeriesId): { series: HistorySeries; offset: number } {
    let known = this.offsets.get(id);
    if (!known) {
      const series = this.read(id);
      known = { series, offset: monthsBetween(this.epoch, series.start) };
      this.offsets.set(id, known);
    }
    return known;
  }

  /** A series' return at a month index, or null outside it. */
  at(id: HistorySeriesId, index: number): number | null {
    const { series, offset } = this.entry(id);
    const at = index - offset;
    return at >= 0 && at < series.returns.length ? series.returns[at] : null;
  }

  inflation(index: number): number {
    return this.cpi.returns[index] ?? 0;
  }

  /** The month index of the first month a set of sources all have. */
  firstShared(keys: readonly MixKey[]): number {
    return keys.reduce((latest, key) => {
      if (key === "cash" || STAND_INS[key]?.kind === "month") {
        return latest;
      }
      return Math.max(latest, this.entry(key as HistorySeriesId).offset);
    }, 0);
  }

  month(index: number): HistoryMonth {
    return addMonths(this.epoch, index);
  }
}

/**
 * One stretch of history: reads each source's return, standing in where a
 * source falls short, and notes what stood in.
 */
class Window {
  readonly standIns = new Map<MixKey, StandIn>();
  private readonly covered = new Map<MixKey, boolean>();

  constructor(
    private readonly history: History,
    /** Month index of the window's first month. */
    readonly start: number,
    readonly months: number,
  ) {}

  /** The nominal return of a source at a month index of this window. */
  nominal(key: MixKey, index: number, inflation: number): number {
    if (key === "cash") {
      return 0;
    }
    const standIn = STAND_INS[key];
    if (standIn?.kind === "window" && !this.covers(key)) {
      this.standIns.set(key, { key, as: "flat" });
      return inflation;
    }
    const own = this.history.at(key, index);
    if (own !== null) {
      return own;
    }
    if (standIn?.kind === "month") {
      this.standIns.set(key, { key, as: standIn.by });
      return this.history.at(standIn.by, index) ?? 0;
    }
    throw new Error(`No history for ${key} in ${this.history.month(index)}.`);
  }

  private covers(key: MixKey): boolean {
    let known = this.covered.get(key);
    if (known === undefined) {
      const { series, offset } = this.history.entry(key as HistorySeriesId);
      known =
        this.start >= offset &&
        this.start + this.months <= offset + series.returns.length;
      this.covered.set(key, known);
    }
    return known;
  }
}

/** One account's nominal return in a month, fees and shift included. */
function accountReturn(
  prepared: Prepared,
  window: Window,
  index: number,
  inflation: number,
): number {
  const base =
    prepared.fixed ??
    prepared.keys.reduce(
      (sum, [key, weight]) =>
        sum + weight * window.nominal(key, index, inflation),
      0,
    );
  return (1 + base) * prepared.adjust - 1;
}

function paymentIn(account: ReplayAccount, index: number): number {
  return account.schedule?.[index] ?? account.monthly;
}

/* ------------------------------------------------------------ the replay */

export interface ReplayInput {
  accounts: readonly ReplayAccount[];
  /** How many months ahead. */
  months: number;
  read?: SeriesReader;
}

export interface ReplayResult {
  months: number;
  /** The first and last start, and how many there were. */
  firstStart: HistoryMonth;
  lastStart: HistoryMonth;
  starts: number;
  /**
   * Month by month from the first month ahead, across starts, in today's
   * euros: the tenth percentile, the median, the ninetieth. Eight starts in
   * ten end between `p10` and `p90`.
   */
  band: { p10: number[]; p50: number[]; p90: number[] };
  /** The median month by month in the euros of the day, for milestones. */
  nominalMedian: number[];
  /** Where the accounts end, in today's euros. */
  end: { p10: number; p50: number; p90: number };
  worst: { start: HistoryMonth; value: number };
  best: { start: HistoryMonth; value: number };
  /** Each account's median end, in today's euros, in the input's order. */
  accounts: { id: string; median: number }[];
  /** The sources that stood in somewhere, once each. */
  standIns: StandIn[];
}

/** The value at a fraction of the way through sorted values. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const at = q * (sorted.length - 1);
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
}

const ascending = (left: number, right: number) => left - right;

/**
 * Every start from January 1970 that leaves room for the horizon, each
 * replayed month by month: the accounts grow by their sources' returns,
 * net of fees and the reader's shift, shrink by French prices, and take
 * their payments at each month's end — the long view's convention.
 */
export function replayPlan(input: ReplayInput): ReplayResult {
  const history = new History(input.read ?? historySeries);
  const months = Math.max(1, Math.round(input.months));
  const starts = history.length - months + 1;
  if (starts < 1) {
    throw new Error(`No history is long enough for ${months} months.`);
  }

  const prepared = prepare(input.accounts);
  const realByMonth = Array.from({ length: months }, () => [] as number[]);
  const nominalByMonth = Array.from({ length: months }, () => [] as number[]);
  const ends: { start: number; value: number }[] = [];
  const accountEnds = input.accounts.map(() => [] as number[]);
  const standIns = new Map<MixKey, StandIn>();

  for (let s = 0; s < starts; s += 1) {
    const window = new Window(history, s, months);
    const values = input.accounts.map((account) => account.value);
    let prices = 1;
    for (let k = 0; k < months; k += 1) {
      const inflation = history.inflation(s + k);
      prices *= 1 + inflation;
      let total = 0;
      prepared.forEach((each, index) => {
        const ret = accountReturn(each, window, s + k, inflation);
        const grown = (values[index] * (1 + ret)) / (1 + inflation);
        const payment = paymentIn(each.account, k);
        const ceiling = each.account.ceiling ?? null;
        const room =
          ceiling === null
            ? payment
            : Math.max(0, Math.min(payment, ceiling - grown));
        values[index] = grown + room;
        total += values[index];
      });
      realByMonth[k].push(total);
      nominalByMonth[k].push(total * prices);
    }
    ends.push({ start: s, value: values.reduce((sum, v) => sum + v, 0) });
    values.forEach((value, index) => accountEnds[index].push(value));
    for (const [key, standIn] of window.standIns) {
      standIns.set(key, standIn);
    }
  }

  const band = {
    p10: [] as number[],
    p50: [] as number[],
    p90: [] as number[],
  };
  const nominalMedian: number[] = [];
  for (let k = 0; k < months; k += 1) {
    const sorted = realByMonth[k].sort(ascending);
    band.p10.push(quantile(sorted, 0.1));
    band.p50.push(quantile(sorted, 0.5));
    band.p90.push(quantile(sorted, 0.9));
    nominalMedian.push(quantile(nominalByMonth[k].sort(ascending), 0.5));
  }
  const byValue = [...ends].sort((left, right) => left.value - right.value);
  const sortedEnds = byValue.map((end) => end.value);
  const named = (end: { start: number; value: number }) => ({
    start: history.month(end.start),
    value: end.value,
  });

  return {
    months,
    firstStart: history.epoch,
    lastStart: history.month(starts - 1),
    starts,
    band,
    nominalMedian,
    end: {
      p10: quantile(sortedEnds, 0.1),
      p50: quantile(sortedEnds, 0.5),
      p90: quantile(sortedEnds, 0.9),
    },
    worst: named(byValue[0]),
    best: named(byValue[byValue.length - 1]),
    accounts: input.accounts.map((account, index) => ({
      id: account.id,
      median: quantile(accountEnds[index].sort(ascending), 0.5),
    })),
    standIns: [...standIns.values()],
  };
}

/* -------------------------------------------------------- the crash tests */

export type CrashEpisodeId = "2000" | "2008" | "2020" | "2022";

/**
 * The great falls of developed shares in euros, by the month their peak
 * closed — measured on the `world` series: 2000 fell 52 % to March 2003,
 * 2008 49 % to February 2009, 2020 22 % to March, 2022 16 % to June.
 */
export const CRASH_EPISODES: Record<CrashEpisodeId, { peak: HistoryMonth }> = {
  "2000": { peak: "2000-08" },
  "2008": { peak: "2007-05" },
  "2020": { peak: "2019-12" },
  "2022": { peak: "2021-12" },
};

export interface CrashPoint {
  month: HistoryMonth;
  /** What the accounts were worth, in the euros of the day. */
  value: number;
  /** What had been put in: today's value plus the payments so far. */
  invested: number;
}

export interface CrashTest {
  episode: CrashEpisodeId;
  /** Month by month from the peak to the end of the history. */
  path: CrashPoint[];
  /** The month furthest below what was put in. */
  low: CrashPoint & { loss: number; lossShare: number };
  /**
   * Months from the peak until the accounts were worth what was put in,
   * payments carrying on; 0 if they never fell below it, null if they had
   * not recovered when the history ends.
   */
  recoveredAfter: number | null;
  /** The same with no payment after the peak. */
  recoveredAfterAlone: number | null;
  /** Accounts the history does not reach back to, left out: bitcoin in 2000. */
  absent: string[];
}

/** One run from the peak, in the euros of the day, payments flat. */
function crashRun(
  history: History,
  prepared: readonly Prepared[],
  start: number,
  withPayments: boolean,
): CrashPoint[] {
  const months = history.length - start;
  const window = new Window(history, start, months);
  const values = prepared.map((each) => each.account.value);
  let invested = values.reduce((sum, value) => sum + value, 0);
  const path: CrashPoint[] = [];
  for (let k = 0; k < months; k += 1) {
    const inflation = history.inflation(start + k);
    let total = 0;
    prepared.forEach((each, index) => {
      const ret = accountReturn(each, window, start + k, inflation);
      const payment = withPayments ? paymentIn(each.account, k) : 0;
      values[index] = values[index] * (1 + ret) + payment;
      invested += payment;
      total += values[index];
    });
    path.push({ month: history.month(start + k), value: total, invested });
  }
  return path;
}

/** Months until a run is worth what went in again, from its lowest point. */
function recovery(path: readonly CrashPoint[]): number | null {
  let lowIndex = 0;
  path.forEach((point, index) => {
    const gap = point.value - point.invested;
    if (gap < path[lowIndex].value - path[lowIndex].invested) {
      lowIndex = index;
    }
  });
  if (path.length === 0 || path[lowIndex].value >= path[lowIndex].invested) {
    return 0;
  }
  for (let k = lowIndex; k < path.length; k += 1) {
    if (path[k].value >= path[k].invested) {
      return k + 1;
    }
  }
  return null;
}

/**
 * Today's accounts put through one of the great falls, from its peak: the
 * worst month, and how long until the money was worth what had gone in.
 * Accounts whose history does not reach back that far are left out and
 * named, rather than given a history they did not have.
 */
export function crashTest(
  accounts: readonly ReplayAccount[],
  episode: CrashEpisodeId,
  read: SeriesReader = historySeries,
): CrashTest {
  const history = new History(read);
  const start = monthsBetween(history.epoch, CRASH_EPISODES[episode].peak) + 1;
  const reaches = (account: ReplayAccount) =>
    account.fixedRate !== undefined ||
    history.firstShared(Object.keys(account.mix) as MixKey[]) <= start;
  const kept = prepare(accounts.filter(reaches));
  const absent = accounts
    .filter((account) => !reaches(account))
    .map((account) => account.id);

  const path = crashRun(history, kept, start, true);
  const alone = crashRun(history, kept, start, false);
  let lowIndex = 0;
  path.forEach((point, index) => {
    const gap = point.value - point.invested;
    if (gap < path[lowIndex].value - path[lowIndex].invested) {
      lowIndex = index;
    }
  });
  const low = path[lowIndex];
  const loss = low.value - low.invested;

  return {
    episode,
    path,
    low: {
      ...low,
      loss,
      lossShare: low.invested > 0 ? loss / low.invested : 0,
    },
    recoveredAfter: recovery(path),
    recoveredAfterAlone: recovery(alone),
    absent,
  };
}

/* -------------------------------------------------- how often it lost */

export interface LossOdds {
  years: number;
  /** Windows of that length the history holds. */
  windows: number;
  /** Of which ended below their start, in today's euros. */
  losses: number;
}

/**
 * A sum left in a mix for `years`, from every start the mix's history
 * covers: how often it ended worth less, prices counted. « Sur 10 ans, les
 * actions mondiales ont fini sous l'inflation 7 fois sur 100 depuis 1970 ».
 */
export function lossOdds(
  account: Pick<ReplayAccount, "mix" | "fees" | "shift" | "fixedRate">,
  years: number,
  read: SeriesReader = historySeries,
): LossOdds {
  const history = new History(read);
  const months = Math.round(years * 12);
  const [prepared] = prepare([
    { id: "odds", value: 1, monthly: 0, ...account },
  ]);
  const from = history.firstShared(Object.keys(account.mix) as MixKey[]);
  const windows = Math.max(0, history.length - from - months + 1);
  let losses = 0;
  for (let s = from; s < from + windows; s += 1) {
    const window = new Window(history, s, months);
    let value = 1;
    for (let k = 0; k < months; k += 1) {
      const inflation = history.inflation(s + k);
      value =
        (value * (1 + accountReturn(prepared, window, s + k, inflation))) /
        (1 + inflation);
    }
    if (value < 1) {
      losses += 1;
    }
  }
  return { years, windows, losses };
}

/* --------------------------------------------- what could be taken out */

export interface SustainableWithdrawal {
  years: number;
  windows: number;
  /** The yearly withdrawal, as a share of the start, that lasted every time. */
  always: number;
  /** The one that lasted in half the starts. */
  median: number;
}

/**
 * The most that could be taken out each year, a fixed share of the start
 * in today's euros, without the money running out over `years` — for every
 * start the history allows. The lowest is the rate that has always held:
 * this app's history, where the 4 % rule had American markets'. Null when
 * there is nothing to take from or no history that long.
 */
export function sustainableWithdrawal(
  accounts: readonly ReplayAccount[],
  years = 30,
  read: SeriesReader = historySeries,
): SustainableWithdrawal | null {
  const history = new History(read);
  const months = Math.round(years * 12);
  const starts = history.length - months + 1;
  const total = accounts.reduce((sum, account) => sum + account.value, 0);
  if (starts < 1 || total <= 0) {
    return null;
  }
  const prepared = prepare(accounts);

  const rates: number[] = [];
  for (let s = 0; s < starts; s += 1) {
    const window = new Window(history, s, months);
    // The whole's real growth, month by month, once for this start.
    const factors: number[] = [];
    for (let k = 0; k < months; k += 1) {
      const inflation = history.inflation(s + k);
      let grown = 0;
      prepared.forEach((each) => {
        grown +=
          each.account.value *
          (1 + accountReturn(each, window, s + k, inflation));
      });
      factors.push(grown / total / (1 + inflation));
    }
    const lasts = (rate: number) => {
      let value = 1;
      for (const factor of factors) {
        value = value * factor - rate / 12;
        if (value < 0) {
          return false;
        }
      }
      return true;
    };
    let low = 0;
    let high = 0.25;
    for (let step = 0; step < 40; step += 1) {
      const mid = (low + high) / 2;
      if (lasts(mid)) {
        low = mid;
      } else {
        high = mid;
      }
    }
    rates.push(low);
  }
  rates.sort(ascending);
  return {
    years,
    windows: rates.length,
    always: rates[0],
    median: quantile(rates, 0.5),
  };
}

/* ------------------------------------------------ what history returned */

export interface HistoricalReturn {
  from: HistoryMonth;
  to: HistoryMonth;
  /** Yearly, compounded, in the euros of the day. */
  nominal: number;
  /** Yearly, compounded, once prices are taken out. */
  real: number;
}

/**
 * What a mix returned a year over all the history it has, fees taken off:
 * what « Hypothèses » starts the return at, and what a reader's own figure
 * is measured from to become a shift.
 */
export function historicalReturn(
  account: Pick<ReplayAccount, "mix" | "fees" | "fixedRate">,
  read: SeriesReader = historySeries,
): HistoricalReturn {
  const history = new History(read);
  const from = history.firstShared(Object.keys(account.mix) as MixKey[]);
  const months = history.length - from;
  const [prepared] = prepare([
    { id: "history", value: 1, monthly: 0, ...account },
  ]);
  const window = new Window(history, from, months);
  let nominal = 1;
  let prices = 1;
  for (let k = 0; k < months; k += 1) {
    const inflation = history.inflation(from + k);
    nominal *= 1 + accountReturn(prepared, window, from + k, inflation);
    prices *= 1 + inflation;
  }
  return {
    from: history.month(from),
    to: history.end,
    nominal: Math.pow(nominal, 12 / months) - 1,
    real: Math.pow(nominal / prices, 12 / months) - 1,
  };
}
