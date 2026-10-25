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
  /** French prices' change, by month index. */
  readonly inflation: Float64Array;
  private readonly offsets = new Map<
    HistorySeriesId,
    { series: HistorySeries; offset: number }
  >();

  constructor(readonly read: SeriesReader) {
    this.cpi = read("cpi-fr");
    this.epoch = this.cpi.start;
    this.end = this.cpi.end;
    this.length = monthsBetween(this.epoch, this.end) + 1;
    this.inflation = Float64Array.from(
      { length: this.length },
      (_, index) => this.cpi.returns[index] ?? 0,
    );
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
 * Each account's return month by month over the whole history, fees and the
 * shift in, worked out once per call: the loops over starts then read an
 * array rather than every source every month, which is what lets a phone
 * replay five hundred starts while a slider moves.
 *
 * A window a source does not cover reads its stand-in — the Livret A month
 * by month for the LEP, prices for bitcoin — noted as it is handed out.
 */
class Tracks {
  private readonly cache = new Map<string, Float64Array>();

  constructor(
    private readonly history: History,
    private readonly prepared: readonly Prepared[],
  ) {}

  /**
   * Account `index`'s nominal return by month index, as a window from
   * `start` over `months` reads it.
   */
  read(
    index: number,
    start: number,
    months: number,
    standIns?: Map<MixKey, StandIn>,
  ): Float64Array {
    const each = this.prepared[index];
    const flat: MixKey[] = [];
    if (each.fixed === null) {
      for (const [key] of each.keys) {
        if (key === "cash") {
          continue;
        }
        const { series, offset } = this.history.entry(key);
        const stop = offset + series.returns.length;
        if (start >= offset && start + months <= stop) {
          continue;
        }
        const standIn = STAND_INS[key];
        if (standIn?.kind === "window") {
          flat.push(key);
          standIns?.set(key, { key, as: "flat" });
        } else if (standIn?.kind === "month") {
          standIns?.set(key, { key, as: standIn.by });
        } else {
          const missing = start < offset ? start : stop;
          throw new Error(
            `No history for ${key} in ${this.history.month(missing)}.`,
          );
        }
      }
    }
    const signature = `${index}:${flat.join(",")}`;
    let returns = this.cache.get(signature);
    if (!returns) {
      returns = this.compute(each, flat);
      this.cache.set(signature, returns);
    }
    return returns;
  }

  private compute(each: Prepared, flat: readonly MixKey[]): Float64Array {
    const returns = new Float64Array(this.history.length);
    for (let at = 0; at < returns.length; at += 1) {
      let base = each.fixed ?? 0;
      if (each.fixed === null) {
        for (const [key, weight] of each.keys) {
          base += weight * this.nominal(key, at, flat);
        }
      }
      returns[at] = (1 + base) * each.adjust - 1;
    }
    return returns;
  }

  /** A source's return at a month index; NaN where it has none. */
  private nominal(key: MixKey, at: number, flat: readonly MixKey[]): number {
    if (key === "cash") {
      return 0;
    }
    if (flat.includes(key)) {
      return this.history.inflation[at];
    }
    const own = this.history.at(key, at);
    if (own !== null) {
      return own;
    }
    const standIn = STAND_INS[key];
    return standIn?.kind === "month"
      ? (this.history.at(standIn.by, at) ?? 0)
      : Number.NaN;
  }
}

function paymentIn(account: ReplayAccount, index: number): number {
  return account.schedule?.[index] ?? account.monthly;
}

/* ------------------------------------------------------------ the replay */

export interface ReplayInput {
  accounts: readonly ReplayAccount[];
  /** How many months ahead. */
  months: number;
  /**
   * The account a payment refused by a full one goes to instead: the
   * current account, as the bank refuses the transfer and the money stays
   * where it was. Without one, it is held as cash beside the accounts and
   * counted in the total; null leaves it out, for a total of the savings
   * and investments alone.
   */
  overflowTo?: string | null;
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
function quantile(sorted: ArrayLike<number>, q: number): number {
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
  const tracks = new Tracks(history, prepared);
  const count = input.accounts.length;
  const realByMonth = Array.from(
    { length: months },
    () => new Float64Array(starts),
  );
  const nominalByMonth = Array.from(
    { length: months },
    () => new Float64Array(starts),
  );
  const ends = new Float64Array(starts);
  const accountEnds = input.accounts.map(() => new Float64Array(starts));
  const standIns = new Map<MixKey, StandIn>();
  const payments = input.accounts.map((account) =>
    Float64Array.from({ length: months }, (_, k) => paymentIn(account, k)),
  );
  const ceilings = input.accounts.map((account) => account.ceiling ?? null);
  const values = new Float64Array(count);

  const overflow = input.accounts.findIndex(
    (account) => account.id === input.overflowTo,
  );

  for (let s = 0; s < starts; s += 1) {
    const returns = prepared.map((_, index) =>
      tracks.read(index, s, months, standIns),
    );
    input.accounts.forEach((account, index) => {
      values[index] = account.value;
    });
    // What full accounts refused, with nowhere named to go: still money.
    let spilled = 0;
    let prices = 1;
    for (let k = 0; k < months; k += 1) {
      const at = s + k;
      const inflation = history.inflation[at];
      prices *= 1 + inflation;
      spilled /= 1 + inflation;
      let refused = 0;
      for (let index = 0; index < count; index += 1) {
        const grown =
          (values[index] * (1 + returns[index][at])) / (1 + inflation);
        const payment = payments[index][k];
        const ceiling = ceilings[index];
        const room =
          ceiling === null
            ? payment
            : Math.max(0, Math.min(payment, ceiling - grown));
        values[index] = grown + room;
        refused += payment - room;
      }
      if (overflow >= 0) {
        values[overflow] += refused;
      } else if (input.overflowTo !== null) {
        spilled += refused;
      }
      let total = spilled;
      for (let index = 0; index < count; index += 1) {
        total += values[index];
      }
      realByMonth[k][s] = total;
      nominalByMonth[k][s] = total * prices;
    }
    ends[s] = realByMonth[months - 1][s];
    for (let index = 0; index < count; index += 1) {
      accountEnds[index][s] = values[index];
    }
  }

  const band = {
    p10: [] as number[],
    p50: [] as number[],
    p90: [] as number[],
  };
  const nominalMedian: number[] = [];
  for (let k = 0; k < months; k += 1) {
    // A typed array sorts by value, natively.
    const sorted = realByMonth[k].sort();
    band.p10.push(quantile(sorted, 0.1));
    band.p50.push(quantile(sorted, 0.5));
    band.p90.push(quantile(sorted, 0.9));
    nominalMedian.push(quantile(nominalByMonth[k].sort(), 0.5));
  }
  // Starts by where they end, the earlier first on a tie.
  const byValue = Array.from({ length: starts }, (_, start) => start).sort(
    (left, right) => ends[left] - ends[right],
  );
  const sortedEnds = Float64Array.from(ends).sort();
  const named = (start: number) => ({
    start: history.month(start),
    value: ends[start],
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
      median: quantile(accountEnds[index].sort(), 0.5),
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
  tracks: Tracks,
  prepared: readonly Prepared[],
  start: number,
  withPayments: boolean,
): CrashPoint[] {
  const months = history.length - start;
  const returns = prepared.map((_, index) => tracks.read(index, start, months));
  const values = prepared.map((each) => each.account.value);
  let invested = values.reduce((sum, value) => sum + value, 0);
  const path: CrashPoint[] = [];
  for (let k = 0; k < months; k += 1) {
    let total = 0;
    prepared.forEach((each, index) => {
      const ret = returns[index][start + k];
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

  const tracks = new Tracks(history, kept);
  const path = crashRun(history, tracks, kept, start, true);
  const alone = crashRun(history, tracks, kept, start, false);
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
  const tracks = new Tracks(history, [prepared]);
  const from = history.firstShared(Object.keys(account.mix) as MixKey[]);
  const windows = Math.max(0, history.length - from - months + 1);
  let losses = 0;
  for (let s = from; s < from + windows; s += 1) {
    const returns = tracks.read(0, s, months);
    let value = 1;
    for (let at = s; at < s + months; at += 1) {
      value = (value * (1 + returns[at])) / (1 + history.inflation[at]);
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
  const tracks = new Tracks(history, prepared);

  const rates: number[] = [];
  for (let s = 0; s < starts; s += 1) {
    const returns = prepared.map((_, index) => tracks.read(index, s, months));
    // Taking r a month from a start of 1 leaves, after month m, the growth
    // so far times (1 − r × the sum of 1 / the growth to each month before
    // it): the money lasts while that sum stays under 1 / r, and the sum
    // only rises, so the rate that lasts to the end is the one that just
    // reaches it. The most is 25 % a year.
    let grownSoFar = 1;
    let sum = 0;
    for (let at = s; at < s + months; at += 1) {
      let grown = 0;
      prepared.forEach((each, index) => {
        grown += each.account.value * (1 + returns[index][at]);
      });
      grownSoFar *= grown / total / (1 + history.inflation[at]);
      sum += 1 / grownSoFar;
    }
    rates.push(Math.min(0.25, 12 / sum));
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
  const returns = new Tracks(history, [prepared]).read(0, from, months);
  let nominal = 1;
  let prices = 1;
  for (let at = from; at < from + months; at += 1) {
    nominal *= 1 + returns[at];
    prices *= 1 + history.inflation[at];
  }
  return {
    from: history.month(from),
    to: history.end,
    nominal: Math.pow(nominal, 12 / months) - 1,
    real: Math.pow(nominal / prices, 12 / months) - 1,
  };
}
