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
  /** Where « Et si… » puts the extra; null for the default account. */
  to: YearAheadAccountId | null;
  /** The accounts taken out of the figure and the chart. */
  hidden: YearAheadAccountId[];
  events: YearAheadEvent[];
}

export const YEAR_AHEAD_DEFAULT_SETTINGS: YearAheadSettings = {
  horizon: YEAR_AHEAD_DEFAULT_HORIZON,
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

/** Each account's value month by month, today first. */
function envelopeSeries(
  envelopes: readonly Envelope[],
  months: number,
): { values: Map<EnvelopeId, number[]>; growth: number } {
  const run = projectEnvelopes({
    envelopes,
    years: months / 12,
    inflation: 0,
    withdrawalRate: 0,
  });
  const values = new Map<EnvelopeId, number[]>();
  for (const envelope of envelopes) {
    const series =
      run.monthlyByAccount.find((account) => account.id === envelope.id)
        ?.values ?? [];
    values.set(envelope.id, [roundMoney(envelope.initial), ...series]);
  }
  return { values, growth: run.gains };
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
  const elsewhere = setAside - named >= 1 ? roundMoney(setAside - named) : 0;
  if (elsewhere > 0) {
    into.push({ id: "elsewhere", monthly: elsewhere });
  }

  /* The current account: the projection's on-hand track, with the events
     and, when it is the one picked, the extra. */
  const opening = input.onHandToday ?? 0;
  const currentBaseline = [
    roundMoney(opening),
    ...window.map((point) => point.onHand),
  ];
  const currentValues = currentBaseline.map((value, step) => {
    if (step === 0) {
      return value;
    }
    const fromEvents = events.reduce(
      (sum, event) => sum + eventEffect(event, step),
      0,
    );
    const fromExtra = extra?.to === "current" ? extra.monthly * step : 0;
    return roundMoney(value + fromEvents + fromExtra);
  });

  /* The envelopes, twice when the extra goes into one of them: compounding
     makes it worth more than the sum of the payments. */
  const asTheyStand = envelopeSeries(input.envelopes, months);
  const extraEnvelope =
    extra && input.envelopes.some((envelope) => envelope.id === extra.to)
      ? extra
      : null;
  const withExtra = extraEnvelope
    ? envelopeSeries(
        input.envelopes.map((envelope) =>
          envelope.id === extraEnvelope.to
            ? { ...envelope, monthly: envelope.monthly + extraEnvelope.monthly }
            : envelope,
        ),
        months,
      )
    : asTheyStand;

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

  return {
    months,
    bands,
    total: sum((band) => band.values),
    baseline: sum((band) => band.baseline),
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
    },
  };
}

/* ------------------------------------------------------------- the chart */

/**
 * A series stretched or squeezed to a fixed number of samples, by straight
 * lines between its points.
 *
 * Every band is drawn from the same number of points whatever the window, so
 * a path can morph into the next one — six months into five years, an
 * account appearing — instead of being redrawn from nothing.
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

export interface StackedBand {
  /** The band's lower edge at each sample. */
  lower: number[];
  /** Its upper edge. */
  upper: number[];
}

/**
 * Bands stacked on one another, sample by sample: what is above zero piles
 * up from zero, what is below piles down from it — a current account that
 * falls into the red is drawn under the axis, never eating into the savings
 * stacked over it.
 */
export function stackBands(
  series: readonly (readonly number[])[],
): StackedBand[] {
  const length = series[0]?.length ?? 0;
  const above = Array.from({ length }, () => 0);
  const below = Array.from({ length }, () => 0);
  return series.map((values) => {
    const lower: number[] = [];
    const upper: number[] = [];
    for (let index = 0; index < length; index += 1) {
      const value = values[index] ?? 0;
      if (value >= 0) {
        lower.push(above[index]!);
        above[index]! += value;
        upper.push(above[index]!);
      } else {
        upper.push(below[index]!);
        below[index]! += value;
        lower.push(below[index]!);
      }
    }
    return { lower, upper };
  });
}
