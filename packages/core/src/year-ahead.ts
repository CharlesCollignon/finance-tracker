/**
 * The Plan's year ahead, account by account.
 *
 * The card used to state one figure: what the current account would hold at
 * the end of the window, plus everything moved to savings and investments on
 * the way. Nobody could tell from it where that money would be, and it left
 * out what the savings accounts already held. This draws the same future as
 * one series per place the money sits:
 *
 *   `current`   — the current accounts, walked forward by the projection's
 *                 on-hand track (`projection.ts`): the salary in, the charges
 *                 and the everyday spending out, the transfers to savings and
 *                 wallets out.
 *   an envelope — each savings account and wallet, as the long view and the
 *                 milestones see it (`future-plan.ts`): what it holds today,
 *                 what the recurring entries put in, and its return.
 *   `elsewhere` — set aside with no account to name: transfers out of the
 *                 current account that no account's own payments account
 *                 for, such as the margin left at a broker above the
 *                 purchases it funds. Present only when there is any.
 *
 * The figure is their sum. The envelopes are the milestones' own, so a
 * milestone and the band that crosses it always agree.
 *
 * Pure and shared, so the phone draws the same bands from the same figures.
 */

import {
  ENVELOPE_ORDER,
  projectEnvelopes,
  type Envelope,
  type EnvelopeId,
} from "./future-plan";
import type { ProjectionPoint } from "./projection";
import { FRENCH_SAVINGS_2026, isSavingsKind } from "./savings-accounts";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/* --------------------------------------------------------------- settings */

/** The windows the card offers, in months. */
export const YEAR_AHEAD_HORIZONS = [6, 12, 24, 60] as const;
export type YearAheadHorizon = (typeof YEAR_AHEAD_HORIZONS)[number];
export const YEAR_AHEAD_DEFAULT_HORIZON: YearAheadHorizon = 12;
/** How far the forward projection has to reach for the longest window. */
export const YEAR_AHEAD_MAX_MONTHS = 60;

/** Where money sits on the card. */
export type YearAheadAccountId = "current" | "elsewhere" | EnvelopeId;

const ACCOUNT_IDS: readonly YearAheadAccountId[] = [
  "current",
  "elsewhere",
  ...ENVELOPE_ORDER,
];

/**
 * Something the recurring entries cannot know about: a raise from a given
 * month, a bonus, a large one-off expense. Each lands on the current account,
 * which is where a salary and a holiday both go through.
 */
export type YearAheadEventKind = "raise" | "bonus" | "expense";

export const YEAR_AHEAD_EVENT_KINDS: readonly YearAheadEventKind[] = [
  "raise",
  "bonus",
  "expense",
];

export interface YearAheadEvent {
  id: string;
  kind: YearAheadEventKind;
  /** Positive: the raise each month, the bonus, the expense. */
  amount: number;
  /** The month it lands in: 1 is the month in progress. */
  month: number;
}

/** What a new event starts at, before the reader changes it. */
export const YEAR_AHEAD_EVENT_DEFAULTS: Record<YearAheadEventKind, number> = {
  raise: 100,
  bonus: 1000,
  expense: 2000,
};

/** Past this many, the curve is a calendar rather than a picture. */
export const YEAR_AHEAD_MAX_EVENTS = 6;

/** The card's settings, as a browser or the phone remembers them. */
export interface YearAheadSettings {
  horizon: YearAheadHorizon;
  /** Every figure in today's euros, at `YEAR_AHEAD_INFLATION`. */
  realTerms: boolean;
  /** Where « Et si… » puts the extra; null for the default account. */
  to: YearAheadAccountId | null;
  /** The accounts taken out of the figure and the chart. */
  hidden: YearAheadAccountId[];
  events: YearAheadEvent[];
}

export const YEAR_AHEAD_DEFAULT_SETTINGS: YearAheadSettings = {
  horizon: YEAR_AHEAD_DEFAULT_HORIZON,
  realTerms: false,
  to: null,
  hidden: [],
  events: [],
};

function isAccountId(value: unknown): value is YearAheadAccountId {
  return ACCOUNT_IDS.includes(value as YearAheadAccountId);
}

/**
 * Whatever was stored, read defensively: anything an older build or a hand
 * wrote that is not a setting falls back to the default, one field at a time.
 */
export function parseYearAheadSettings(value: unknown): YearAheadSettings {
  if (!value || typeof value !== "object") {
    return YEAR_AHEAD_DEFAULT_SETTINGS;
  }
  const stored = value as Record<string, unknown>;
  const horizon = YEAR_AHEAD_HORIZONS.includes(
    stored.horizon as YearAheadHorizon,
  )
    ? (stored.horizon as YearAheadHorizon)
    : YEAR_AHEAD_DEFAULT_HORIZON;
  const hidden = Array.isArray(stored.hidden)
    ? [...new Set(stored.hidden.filter(isAccountId))]
    : [];
  const events = Array.isArray(stored.events)
    ? stored.events
        .flatMap((entry): YearAheadEvent[] => {
          const row = (entry ?? {}) as Record<string, unknown>;
          if (
            typeof row.id !== "string" ||
            !YEAR_AHEAD_EVENT_KINDS.includes(row.kind as YearAheadEventKind) ||
            typeof row.amount !== "number" ||
            !Number.isFinite(row.amount) ||
            typeof row.month !== "number" ||
            !Number.isFinite(row.month)
          ) {
            return [];
          }
          return [
            {
              id: row.id,
              kind: row.kind as YearAheadEventKind,
              amount: Math.max(0, row.amount),
              month: Math.min(
                YEAR_AHEAD_MAX_MONTHS,
                Math.max(1, Math.round(row.month)),
              ),
            },
          ];
        })
        .slice(0, YEAR_AHEAD_MAX_EVENTS)
    : [];
  return {
    horizon,
    realTerms: stored.realTerms === true,
    to: isAccountId(stored.to) ? stored.to : null,
    hidden,
    events,
  };
}

/**
 * Where « Et si… » puts the extra until the reader picks: the first savings
 * account that can be emptied tomorrow, which is where a spare fifty euros
 * usually goes; else the first account there is; else the current account.
 */
export function defaultExtraTarget(
  envelopes: readonly Envelope[],
): YearAheadAccountId {
  const liquid = envelopes.find(
    (envelope) =>
      envelope.id === "savings" ||
      (isSavingsKind(envelope.id) && FRENCH_SAVINGS_2026[envelope.id].liquid),
  );
  return liquid?.id ?? envelopes[0]?.id ?? "current";
}

/**
 * The account « Et si… » goes to: the one picked while it still exists —
 * a wallet sold, a livret closed — else the default.
 */
export function resolveExtraTarget(
  picked: YearAheadAccountId | null,
  envelopes: readonly Envelope[],
): YearAheadAccountId {
  if (
    picked === "current" ||
    envelopes.some((envelope) => envelope.id === picked)
  ) {
    return picked!;
  }
  return defaultExtraTarget(envelopes);
}

/* ---------------------------------------------------------------- realism */

/**
 * How fast prices rise each year: the ECB's target, which French inflation
 * has hovered around since 2024. Income, charges and everyday spending rise
 * with it month by month; the regular transfers to savings stay what the
 * reader set, as they do in life until someone changes them.
 */
export const YEAR_AHEAD_INFLATION = 0.02;

/**
 * How much a year can swing around an account's expected return — its
 * long-run annual volatility. World equities (an MSCI World tracker, what a
 * PEA, a CTO or a PER usually holds) have moved about 15 % a year; a life
 * insurance mixing a euro fund and units about 40 % of that; crypto four
 * times as much as equities. Savings accounts pay a known rate: they do
 * not swing.
 */
export const ACCOUNT_VOLATILITY: Partial<Record<EnvelopeId, number>> = {
  pea: 0.15,
  cto: 0.15,
  per: 0.15,
  av: 0.06,
  crypto: 0.65,
};

/** Equity-like accounts move together, on one market; crypto on its own. */
const SHOCK_STREAM: Partial<Record<EnvelopeId, "markets" | "crypto">> = {
  pea: "markets",
  cto: "markets",
  per: "markets",
  av: "markets",
  crypto: "crypto",
};

/** How many futures the range is drawn from, and the share it holds. */
const PATHS = 400;
const RANGE_LOW = 0.1;
const RANGE_HIGH = 0.9;

/** A small seeded generator, so the same figures always draw the same range. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shockCache = new Map<string, Float64Array>();

/**
 * Standard normal shocks for every path and month of one stream, drawn once
 * and kept: a slider moved does not reshuffle the future under it.
 */
function shocks(stream: "markets" | "crypto", months: number): Float64Array {
  const key = `${stream}:${months}`;
  const cached = shockCache.get(key);
  if (cached) {
    return cached;
  }
  const random = mulberry32(stream === "markets" ? 20261009 : 19800301);
  const values = new Float64Array(PATHS * months);
  for (let index = 0; index < values.length; index += 2) {
    // Box–Muller: two normals from two uniforms.
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    values[index] = radius * Math.cos(2 * Math.PI * v);
    if (index + 1 < values.length) {
      values[index + 1] = radius * Math.sin(2 * Math.PI * v);
    }
  }
  shockCache.set(key, values);
  return values;
}

function percentile(sorted: readonly number[], share: number): number {
  return sorted[Math.round(share * (sorted.length - 1))] ?? 0;
}

/* ------------------------------------------------------------------ events */

/**
 * What an event has done to the current account by the end of month `step`.
 * A raise counts every month from its own; a bonus or an expense once.
 */
function eventEffect(event: YearAheadEvent, step: number): number {
  if (step < event.month) {
    return 0;
  }
  switch (event.kind) {
    case "raise":
      return event.amount * (step - event.month + 1);
    case "bonus":
      return event.amount;
    case "expense":
      return -event.amount;
  }
}

/* --------------------------------------------------------------- the card */

export interface YearAheadInput {
  /** The forward projection, at least as long as the horizon. */
  points: readonly ProjectionPoint[];
  /**
   * What the current accounts hold today, or null with no bank connected:
   * the band then starts at zero and shows what the months add.
   */
  onHandToday: number | null;
  /** The savings accounts and wallets, from the user's own figures. */
  envelopes: readonly Envelope[];
  /** Months to draw. */
  horizon: number;
  /** « Et si… »: so much more each month, into this account. */
  extra?: { monthly: number; to: YearAheadAccountId };
  events?: readonly YearAheadEvent[];
  hidden?: readonly YearAheadAccountId[];
  /**
   * Whether the envelopes are all there. False while the wallets' market
   * value is on its way: what goes into them would otherwise read as set
   * aside with no account, so « Autre épargne » waits for them.
   */
  complete?: boolean;
  /**
   * How fast prices rise each year. Income, charges and everyday spending
   * follow it; 0 (the default) leaves them as the recurring entries say.
   */
  inflation?: number;
  /** Every figure in today's euros, deflated at `inflation`. */
  realTerms?: boolean;
}

export interface YearAheadBand {
  id: YearAheadAccountId;
  /** Index 0 is today; index i the end of the i-th month. */
  values: number[];
  /** The same, as things stand: no extra, no events. */
  baseline: number[];
  hidden: boolean;
}

/** Why the money ends up where it does, per month on average. */
export interface YearAheadFlow {
  /** Everything the recurring entries bring in. */
  income: number;
  /** The charges. */
  committed: number;
  /** What closed months measure a month costs unseen; zero until measured. */
  everyday: number;
  /** Into each account, as the recurring entries put it there. */
  into: { id: YearAheadAccountId; monthly: number }[];
  /** What is left on the current account; negative when it falls. */
  current: number;
  /** Over the window: interest and estimated returns, every account. */
  growth: number;
  /** Over the window: what the events add, net. */
  events: number;
  /** Over the window: the extra, every month of it. */
  extra: number;
  /** Over the window: what the accounts' fees cost, in returns not earned. */
  fees: number;
}

export interface YearAhead {
  /** The months drawn: the horizon, or fewer when the projection is shorter. */
  months: number;
  /** Every account, the hidden ones included, in reading order. */
  bands: YearAheadBand[];
  /** The visible accounts, added up, with the extra and the events. */
  total: number[];
  /** The visible accounts as things stand. */
  baseline: number[];
  /**
   * Where 8 futures in 10 put the visible accounts, month by month, from
   * the accounts' long-run volatility. Null when nothing visible moves with
   * the markets.
   */
  range: { low: number[]; high: number[] } | null;
  /**
   * What the visible accounts would be worth at the end after the tax on
   * their gains, were everything sold — and each account's own.
   */
  afterTax: {
    total: number;
    byAccount: Partial<Record<YearAheadAccountId, number>>;
  };
  flow: YearAheadFlow;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return roundMoney(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

/**
 * Each account's value month by month, today first, and what the full ones
 * turned away: a livret at its ceiling takes no more, and the transfer then
 * stays on the current account — the bank refuses it rather than losing it.
 */
function envelopeSeries(
  envelopes: readonly Envelope[],
  months: number,
): {
  values: Map<EnvelopeId, number[]>;
  /** What has gone into each account so far, month by month, today first. */
  paid: Map<EnvelopeId, number[]>;
  turnedAway: number[];
  growth: number;
} {
  const run = projectEnvelopes({
    envelopes,
    years: months / 12,
    inflation: 0,
    withdrawalRate: 0,
  });
  const values = new Map<EnvelopeId, number[]>();
  const paid = new Map<EnvelopeId, number[]>();
  const turnedAway = Array.from({ length: months + 1 }, () => 0);
  for (const envelope of envelopes) {
    const account = run.monthlyByAccount.find((row) => row.id === envelope.id);
    values.set(envelope.id, [
      roundMoney(envelope.initial),
      ...(account?.values ?? []),
    ]);
    paid.set(envelope.id, [0, ...(account?.paid ?? [])]);
    account?.paid.forEach((paid, index) => {
      turnedAway[index + 1]! += Math.max(
        0,
        envelope.monthly * (index + 1) - paid,
      );
    });
  }
  return {
    values,
    paid,
    turnedAway: turnedAway.map(roundMoney),
    growth: run.gains,
  };
}

/**
 * The year ahead as one series per account, the figure as their sum, and
 * the flow that explains it.
 */
export function buildYearAhead(input: YearAheadInput): YearAhead {
  const months = Math.max(0, Math.min(input.horizon, input.points.length));
  const window = input.points.slice(0, months);
  const extra = input.extra && input.extra.monthly > 0 ? input.extra : null;
  const events = (input.events ?? []).filter((event) => event.amount > 0);
  const hidden = new Set(input.hidden ?? []);

  /* The flow first: the bands need what is set aside with no account. */
  const setAside = mean(window.map((point) => point.setAside));
  const into = input.envelopes
    .filter((envelope) => envelope.monthly > 0)
    .map((envelope) => ({
      id: envelope.id as YearAheadAccountId,
      monthly: roundMoney(envelope.monthly),
    }));
  const named = into.reduce((sum, row) => sum + row.monthly, 0);
  // Under a euro a month is rounding between two averages, not a place.
  const elsewhere =
    input.complete !== false && setAside - named >= 1
      ? roundMoney(setAside - named)
      : 0;
  if (elsewhere > 0) {
    into.push({ id: "elsewhere", monthly: elsewhere });
  }

  /* The envelopes, at their return after their own fees (`Envelope.fees`,
     which projectEnvelopes takes off), and twice when the extra goes into
     one of them: compounding makes it worth more than the sum of the
     payments. */
  const inflation = input.inflation ?? 0;
  const net = input.envelopes;
  const extraEnvelope =
    extra && input.envelopes.some((envelope) => envelope.id === extra.to)
      ? extra
      : null;
  const boosted = (envelopes: readonly Envelope[]) =>
    extraEnvelope
      ? envelopes.map((envelope) =>
          envelope.id === extraEnvelope.to
            ? { ...envelope, monthly: envelope.monthly + extraEnvelope.monthly }
            : envelope,
        )
      : envelopes;
  const asTheyStand = envelopeSeries(net, months);
  const withExtra = extraEnvelope
    ? envelopeSeries(boosted(net), months)
    : asTheyStand;
  // What the same accounts would have earned with no fees at all.
  const grossGrowth = input.envelopes.some(
    (envelope) => (envelope.fees ?? 0) > 0,
  )
    ? envelopeSeries(
        boosted(input.envelopes.map((envelope) => ({ ...envelope, fees: 0 }))),
        months,
      ).growth
    : withExtra.growth;

  /* Prices rise: the salary, the charges and the everyday spending follow
     them month by month, so what the current account keeps grows (or
     shrinks) with the gap between them. */
  const lifted = [0];
  let lift = 0;
  window.forEach((point, index) => {
    const rise = Math.pow(1 + inflation, index / 12) - 1;
    lift += (point.income - point.expense - point.unrecorded) * rise;
    lifted.push(lift);
  });

  /* The current account: the projection's on-hand track, with the events,
     what a full account turned away and, when it is the one picked, the
     extra. */
  const opening = input.onHandToday ?? 0;
  const currentBaseline = [
    roundMoney(opening),
    ...window.map((point, index) =>
      roundMoney(
        point.onHand +
          (asTheyStand.turnedAway[index + 1] ?? 0) +
          (lifted[index + 1] ?? 0),
      ),
    ),
  ];
  const currentValues = currentBaseline.map((_, step) => {
    if (step === 0) {
      return roundMoney(opening);
    }
    const fromEvents = events.reduce(
      (sum, event) => sum + eventEffect(event, step),
      0,
    );
    const fromExtra = extra?.to === "current" ? extra.monthly * step : 0;
    return roundMoney(
      window[step - 1]!.onHand +
        (withExtra.turnedAway[step] ?? 0) +
        (lifted[step] ?? 0) +
        fromEvents +
        fromExtra,
    );
  });

  const elsewhereSeries = Array.from({ length: months + 1 }, (_, step) =>
    roundMoney(elsewhere * step),
  );
  const elsewhereValues =
    extra?.to === "elsewhere"
      ? elsewhereSeries.map((value, step) =>
          roundMoney(value + extra.monthly * step),
        )
      : elsewhereSeries;

  const bands: YearAheadBand[] = [
    {
      id: "current",
      values: currentValues,
      baseline: currentBaseline,
      hidden: hidden.has("current"),
    },
    ...input.envelopes.map((envelope) => ({
      id: envelope.id as YearAheadAccountId,
      values: withExtra.values.get(envelope.id) ?? [],
      baseline: asTheyStand.values.get(envelope.id) ?? [],
      hidden: hidden.has(envelope.id),
    })),
    ...(elsewhere > 0 || extra?.to === "elsewhere"
      ? [
          {
            id: "elsewhere" as const,
            values: elsewhereValues,
            baseline: elsewhereSeries,
            hidden: hidden.has("elsewhere"),
          },
        ]
      : []),
  ];

  const sum = (pick: (band: YearAheadBand) => number[]) =>
    Array.from({ length: months + 1 }, (_, step) =>
      roundMoney(
        bands
          .filter((band) => !band.hidden)
          .reduce((total, band) => total + (pick(band)[step] ?? 0), 0),
      ),
    );

  const income = mean(window.map((point) => point.income));
  const committed = mean(window.map((point) => point.expense));
  const everyday = mean(window.map((point) => point.unrecorded));
  const total = sum((band) => band.values);
  const visible = (id: YearAheadAccountId) => !hidden.has(id);

  /* The range: each visible account that moves with the markets, played
     over many futures on its own volatility around its expected return —
     the equity ones on one shared market, crypto on its own — with the
     rest of the money added as the plan has it. */
  const risky = net.filter(
    (envelope) =>
      (ACCOUNT_VOLATILITY[envelope.id] ?? 0) > 0 && visible(envelope.id),
  );
  let range: YearAhead["range"] = null;
  if (risky.length > 0 && months > 0) {
    const sums = Array.from(
      { length: months + 1 },
      () => new Float64Array(PATHS),
    );
    const fixed = total.map(
      (value, step) =>
        value -
        risky.reduce(
          (sum, envelope) =>
            sum + (withExtra.values.get(envelope.id)?.[step] ?? 0),
          0,
        ),
    );
    for (const envelope of risky) {
      const yearly = ACCOUNT_VOLATILITY[envelope.id]!;
      const monthlyVolatility = yearly / Math.sqrt(12);
      // A drift whose average month grows at the account's return, as the
      // central line does — the median future sits a little lower.
      const drift =
        Math.log(1 + envelope.annualReturn - (envelope.fees ?? 0)) / 12 -
        (monthlyVolatility * monthlyVolatility) / 2;
      const payment =
        envelope.monthly +
        (extraEnvelope?.to === envelope.id ? extraEnvelope.monthly : 0);
      const draws = shocks(SHOCK_STREAM[envelope.id] ?? "markets", months);
      for (let path = 0; path < PATHS; path += 1) {
        let value = envelope.initial;
        sums[0]![path]! += value;
        for (let month = 1; month <= months; month += 1) {
          const shock = draws[path * months + (month - 1)]!;
          value = value * Math.exp(drift + monthlyVolatility * shock) + payment;
          sums[month]![path]! += value;
        }
      }
    }
    const low: number[] = [];
    const high: number[] = [];
    sums.forEach((paths, step) => {
      const sorted = Array.from(paths, (value) => value + fixed[step]!).sort(
        (left, right) => left - right,
      );
      low.push(roundMoney(percentile(sorted, RANGE_LOW)));
      high.push(roundMoney(percentile(sorted, RANGE_HIGH)));
    });
    range = { low, high };
  }

  /* After tax, were everything sold at the end: each account's gains —
     what it holds beyond what it started with and what went in — taxed at
     its rate. The current account has no gains to tax. */
  const byAccount: Partial<Record<YearAheadAccountId, number>> = {};
  for (const band of bands) {
    if (band.hidden) {
      continue;
    }
    const end = band.values[months] ?? 0;
    const envelope = input.envelopes.find((each) => each.id === band.id);
    if (!envelope) {
      byAccount[band.id] = end;
      continue;
    }
    const paidIn = withExtra.paid.get(envelope.id)?.[months] ?? 0;
    const gains = end - envelope.initial - paidIn;
    byAccount[band.id] = roundMoney(
      end - (gains > 0 ? gains * envelope.taxOnGains : 0),
    );
  }

  /* In today's euros: every figure divided by how much prices will have
     risen by its month. */
  const deflate = (values: number[]) =>
    input.realTerms && inflation !== 0
      ? values.map((value, step) =>
          roundMoney(value / Math.pow(1 + inflation, step / 12)),
        )
      : values;
  const endDeflator =
    input.realTerms && inflation !== 0
      ? Math.pow(1 + inflation, months / 12)
      : 1;

  return {
    months,
    bands: bands.map((band) => ({
      ...band,
      values: deflate(band.values),
      baseline: deflate(band.baseline),
    })),
    total: deflate(total),
    baseline: deflate(sum((band) => band.baseline)),
    range: range
      ? { low: deflate(range.low), high: deflate(range.high) }
      : null,
    afterTax: {
      total: roundMoney(
        Object.values(byAccount).reduce((sum, value) => sum + value, 0) /
          endDeflator,
      ),
      byAccount: Object.fromEntries(
        Object.entries(byAccount).map(([id, value]) => [
          id,
          roundMoney(value / endDeflator),
        ]),
      ),
    },
    flow: {
      income,
      committed,
      everyday,
      into,
      current: roundMoney(income - committed - everyday - setAside),
      growth: roundMoney(withExtra.growth),
      events: roundMoney(
        events.reduce((sum, event) => sum + eventEffect(event, months), 0),
      ),
      extra: extra ? roundMoney(extra.monthly * months) : 0,
      fees: roundMoney(Math.max(0, grossGrowth - withExtra.growth)),
    },
  };
}

/* ------------------------------------------------------------- the chart */

/**
 * A series stretched or squeezed to a fixed number of samples, by straight
 * lines between its points.
 *
 * Every line and range is drawn from the same number of points whatever the
 * window, so a path can morph into the next one — six months into five
 * years — instead of being redrawn from nothing.
 */
export function resampleSeries(
  values: readonly number[],
  samples: number,
): number[] {
  if (values.length === 0 || samples <= 0) {
    return [];
  }
  if (values.length === 1 || samples === 1) {
    return Array.from({ length: samples }, () => values[0]!);
  }
  const last = values.length - 1;
  return Array.from({ length: samples }, (_, index) => {
    const position = (index / (samples - 1)) * last;
    const below = Math.floor(position);
    const above = Math.min(last, below + 1);
    const weight = position - below;
    return values[below]! + (values[above]! - values[below]!) * weight;
  });
}

/**
 * Two to four round amounts across `[min, max]` for a value axis: steps of
 * 1, 2, 2.5 or 5 times a power of ten, the smallest that keeps it to four.
 */
export function niceTicks(min: number, max: number): number[] {
  const raw = (max - min) / 3;
  if (!(raw > 0)) {
    return [];
  }
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((each) => each * power)
      .find((each) => each >= raw) ?? 10 * power;
  const ticks: number[] = [];
  for (let tick = Math.ceil(min / step) * step; tick < max; tick += step) {
    ticks.push(Math.round(tick));
  }
  return ticks;
}
