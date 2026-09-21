/**
 * What an instrument is made of, as read from the market.
 *
 * The catalogue in `etf-shortlist.ts` holds what does not move — the
 * identifier, the index, the domicile, the replication. This holds what does:
 * the ongoing charge, where the money actually sits by country and sector,
 * and the largest constituents. Those drift, so they are read rather than
 * written down, and every reading carries the date it was taken and the pages
 * it came from.
 *
 * Split that way for one reason. A figure in a source file is a figure nobody
 * revisits; a figure with a `sourcedAt` beside it is a figure the surface can
 * admit is eight months old. The app never pretends to know something more
 * recently than it does.
 *
 * This module is provider-ignorant on purpose, like `month-read.ts`: it
 * defines the request, the answer schema, the verifier and a fake source, and
 * knows nothing about who answers. The keyed adapter lives in `apps/web`,
 * because `packages/core` is bundled into the phone app and a key referenced
 * from here would ship inside it.
 */

import { z } from "zod";

import { ISIN_REGEX } from "./market/yahoo";

/**
 * The sectors, closed.
 *
 * A closed list rather than whatever the factsheet happened to call them.
 * "Tech", "Technology" and "Information Technology" are the same sector and
 * three different map keys, and weights that do not aggregate are weights
 * that silently under-report concentration — which is the one thing this
 * whole feature exists to measure. So the vocabulary is handed to the model
 * in full and anything outside it is refused.
 *
 * These are the eleven GICS sectors, which is what every European factsheet
 * reports against.
 */
export const SECTOR_IDS = [
  "energy",
  "materials",
  "industrials",
  "consumer-discretionary",
  "consumer-staples",
  "health-care",
  "financials",
  "information-technology",
  "communication-services",
  "utilities",
  "real-estate",
] as const;

export type SectorId = (typeof SECTOR_IDS)[number];

/** How readable each sector is, for a surface that shows them. */
export const SECTOR_LABELS: Record<SectorId, string> = {
  energy: "Energy",
  materials: "Materials",
  industrials: "Industrials",
  "consumer-discretionary": "Consumer discretionary",
  "consumer-staples": "Consumer staples",
  "health-care": "Health care",
  financials: "Financials",
  "information-technology": "Information technology",
  "communication-services": "Communication services",
  utilities: "Utilities",
  "real-estate": "Real estate",
};

/**
 * How long a reading is treated as current.
 *
 * Not an eviction policy — nothing is deleted and a stale reading is still
 * used, because last year's country split is a far better answer than no
 * answer. This only decides when the surface says how old it is and when the
 * daily job puts it back in the queue to be read again. The house pattern is
 * comparison, not expiry: see `describeReadFreshness`.
 */
export const READING_FRESH_DAYS = 180;

/**
 * Bumped when the shape changes enough that old readings should be retaken.
 *
 * 2 added `assetKind`, and waited for migration 037 to give it somewhere to
 * live. A reading taken at 1 is still perfectly usable — its weights are its
 * weights — but it cannot say whether the instrument has a composition at
 * all, which is the one question deciding whether the surface keeps offering
 * to read it again. Bumping this puts every existing reading back in the
 * queue through `readingIsStale`, so one press re-reads the portfolio and the
 * answer arrives for keeps. A portfolio's worth of re-reads is a few pence.
 */
export const READING_VERSION = 2;

const weightsSchema = z
  .record(z.string(), z.number().min(0).max(1))
  .refine(
    (weights) =>
      Object.values(weights).reduce((sum, weight) => sum + weight, 0) <= 1.005,
    { message: "errors.weightsOverOne" },
  );

/**
 * What the model is asked to come back with.
 *
 * Strict, and re-validated even though a strict output format was requested —
 * a provider guarantee is an optimisation, never the contract.
 */
/**
 * What kind of thing an instrument holds.
 *
 * Asked of the reader because nothing else in the app can answer it. The
 * shortlist in `etf-shortlist.ts` carries an asset class, but it is a
 * hand-curated catalogue of the funds this app will *name*, and a portfolio
 * holds whatever its owner bought — a gold ETC that is not on the list was
 * read, published no countries and no sectors, and was filed under "read, but
 * incomplete" with an offer to read it again. There was nothing to find. Gold
 * sits in no country and is in no sector, and saying so is a fact about the
 * instrument rather than a gap in the reading.
 *
 * Four, and the distinction that earns its keep is the last two against the
 * first two. `bonds` is here so that a debt fund need not be called a fund of
 * companies, which would be a small lie told for want of a word.
 */
export const ASSET_KINDS = [
  "companies",
  "bonds",
  "commodity",
  "crypto",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

/**
 * Whether this kind of instrument has countries and sectors to resolve to.
 *
 * `null` — a reading taken before the reader was ever asked — resolves, which
 * is what every reading meant until now. Assuming the opposite would silently
 * reclassify a whole portfolio of funds as things that can never be
 * described, on no evidence at all.
 */
export function resolvesToComposition(kind: AssetKind | null): boolean {
  return kind !== "commodity" && kind !== "crypto";
}

export const instrumentReadingAnswerSchema = z
  .object({
    isin: z.string().regex(ISIN_REGEX, "errors.notAnIsin"),
    /**
     * What the instrument holds, when the reader could tell.
     *
     * Nullable because the answer is worth having without it: a fund that
     * reports its countries has plainly got a composition, and refusing that
     * reading over a missing label would cost more than the label is worth.
     */
    assetKind: z.enum(ASSET_KINDS).nullable(),
    /** Annual ongoing charge as a fraction: 0.002 = 0.20%. */
    ongoingCharge: z.number().min(0).max(0.1).nullable(),
    currency: z.string().length(3).nullable(),
    /** ISO 3166-1 alpha-2 → share of the fund, 0–1. */
    countryWeights: weightsSchema,
    /**
     * `partialRecord`, not `record`.
     *
     * Zod 4's `z.record` over an enum key is exhaustive: it demands a weight
     * for all eleven sectors and rejects a fund that reports the four it
     * actually holds. `partialRecord` allows the subset while still refusing
     * a sector outside the vocabulary, which is the pair of properties this
     * needs — open about what is absent, closed about what is named.
     */
    sectorWeights: z.partialRecord(
      z.enum(SECTOR_IDS),
      // Nullable because a strict output format declares every sector and
      // lets the model say "not reported" with a null. The verifier drops
      // anything that is not a positive weight, so a null costs nothing —
      // but rejecting the whole answer over one would cost the reading.
      z.number().min(0).max(1).nullable(),
    ),
    topConstituents: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          weight: z.number().min(0).max(1),
        }),
      )
      .max(25),
    /** The pages this was read from. Empty means it was not sourced. */
    sources: z.array(z.string().url()).max(10),
  })
  .strict();

export type InstrumentReadingAnswer = z.infer<
  typeof instrumentReadingAnswerSchema
>;

/**
 * The same shape, as a provider's strict output format.
 *
 * Alongside the Zod schema rather than instead of it, for the reason stated
 * at the top of `wallet-read.ts`: strict mode narrows what comes back, the
 * verifier decides whether it is usable.
 *
 * `sectorWeights` is spelled out property by property rather than left as a
 * free-form object, because that is the only way a strict schema can close
 * the sector vocabulary — and an open one is how "Tech", "Technology" and
 * "Information Technology" become three sectors that do not add up.
 */
export function instrumentReadingJsonSchema() {
  const sectorProperties: Record<string, unknown> = {};
  for (const sector of SECTOR_IDS) {
    sectorProperties[sector] = {
      type: ["number", "null"],
      description: "Fraction of the fund, 0 to 1. Null if not reported.",
    };
  }

  return {
    type: "json_schema",
    json_schema: {
      name: "instrument_reading",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "isin",
          "assetKind",
          "ongoingCharge",
          "currency",
          "countryWeights",
          "sectorWeights",
          "topConstituents",
          "sources",
        ],
        properties: {
          isin: {
            type: "string",
            description:
              "The ISIN these figures are for. Must match the one asked about.",
          },
          assetKind: {
            type: ["string", "null"],
            enum: [...ASSET_KINDS, null],
            description:
              "What the instrument holds: 'companies' for a share or a fund of shares, 'bonds' for debt, 'commodity' for a metal or a basket of them, 'crypto' for a coin. Null only if the notes do not say.",
          },
          ongoingCharge: {
            type: ["number", "null"],
            description:
              "Annual ongoing charge as a fraction: 0.002 means 0.20% a year. Null if the notes do not give it. Never estimated.",
          },
          currency: {
            type: ["string", "null"],
            description: "Three-letter code, or null.",
          },
          countryWeights: {
            type: "object",
            additionalProperties: { type: "number" },
            description:
              "ISO 3166-1 alpha-2 country code to fraction of the fund, 0 to 1. Only countries the notes actually report.",
          },
          sectorWeights: {
            type: "object",
            additionalProperties: false,
            properties: sectorProperties,
            description:
              "Fraction of the fund per sector. Omit or null any sector the notes do not report.",
          },
          topConstituents: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "weight"],
              properties: {
                name: { type: "string" },
                weight: {
                  type: "number",
                  description: "Fraction of the fund, 0 to 1.",
                },
              },
            },
            description: "Largest holdings, as published. Empty if not given.",
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description: "The page URLs these figures were taken from.",
          },
        },
      },
    },
  };
}

/** A stored reading: the answer, plus how and when it was taken. */
export interface InstrumentReading {
  isin: string;
  /** What it holds, or null on a reading taken before this was asked. */
  assetKind: AssetKind | null;
  ongoingCharge: number | null;
  currency: string | null;
  countryWeights: Record<string, number>;
  sectorWeights: Partial<Record<SectorId, number>>;
  topConstituents: { name: string; weight: number }[];
  /**
   * How much of the fund the constituents account for.
   *
   * A top ten covering 22% of a fund and a top ten covering 65% support very
   * different claims, and a reader cannot tell which they are looking at from
   * the names alone. Carried so that anything derived from constituents can
   * state its own reach.
   */
  constituentsCoverage: number;
  sources: string[];
  sourcedAt: string;
  model: string | null;
  version: number;
}

export interface InstrumentReadingRequest {
  isin: string;
  /** The instrument's name, to disambiguate a search. */
  name: string;
  symbol: string | null;
}

/**
 * Where readings come from.
 *
 * `null` means "no answer right now" — no key, unreachable, rate-limited,
 * timed out, or an answer that did not parse. Never a thrown error: a missing
 * reading is an ordinary state this app renders, not a failure.
 */
/**
 * Why the last attempt came back with nothing.
 *
 * `read` answering `null` is one signal standing for several very different
 * situations, and the caller has to tell them apart to say anything useful:
 * a plan without the web search connector will refuse every instrument for
 * ever, while a fund nobody has published a factsheet for is one instrument
 * to walk past. Reported alongside the answer rather than thrown, because a
 * search that found nothing is an ordinary outcome and not an error.
 */
export type ReadingFailure = "no-search" | "provider-down" | "nothing-found";

export interface InstrumentReadingSource {
  read(request: InstrumentReadingRequest): Promise<unknown | null>;
  readonly model: string;
  /** Why the last `read` answered null, or null if the last one answered. */
  readonly lastFailure: ReadingFailure | null;
}

export type ReadingRefusal =
  | { reason: "wrong-instrument"; asked: string; answered: string }
  | { reason: "unparseable" }
  | { reason: "nothing-useful" };

export type ReadingVerdict =
  | { ok: true; reading: InstrumentReading }
  | { ok: false; refusal: ReadingRefusal };

function sumWeights(weights: Record<string, number>): number {
  return Object.values(weights).reduce((sum, weight) => sum + weight, 0);
}

/**
 * Turn a model's answer into a reading, or refuse it.
 *
 * Three things are checked that the schema cannot:
 *
 *   - that the answer is about the instrument that was asked about. A search
 *     for one fund can land on its sibling share class, and a reading filed
 *     under the wrong ISIN is worse than no reading.
 *   - that something useful came back. An answer with no charge, no countries
 *     and no sectors parsed correctly and says nothing; storing it would only
 *     stop the instrument being read again.
 *   - that the country codes are country codes. Anything else is dropped
 *     rather than refused, because one unrecognised line should not throw
 *     away a good reading — but it is dropped, not coerced, so the coverage
 *     figure stays honest.
 */
export function verifyInstrumentReading(
  asked: InstrumentReadingRequest,
  answer: unknown,
  now: Date,
  model: string | null,
): ReadingVerdict {
  const parsed = instrumentReadingAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    return { ok: false, refusal: { reason: "unparseable" } };
  }

  const data = parsed.data;
  const askedIsin = asked.isin.trim().toUpperCase();
  const answeredIsin = data.isin.trim().toUpperCase();

  if (askedIsin !== answeredIsin) {
    return {
      ok: false,
      refusal: {
        reason: "wrong-instrument",
        asked: askedIsin,
        answered: answeredIsin,
      },
    };
  }

  const countryWeights: Record<string, number> = {};
  for (const [code, weight] of Object.entries(data.countryWeights)) {
    const upper = code.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(upper) && weight > 0) {
      countryWeights[upper] = (countryWeights[upper] ?? 0) + weight;
    }
  }

  const sectorWeights: Partial<Record<SectorId, number>> = {};
  for (const [sector, weight] of Object.entries(data.sectorWeights)) {
    // Null and zero are both "the fund does not report this", and neither
    // belongs in the map: a recorded zero would read as a sector the fund
    // deliberately avoids rather than one nobody published a figure for.
    if (weight !== null && weight > 0) {
      sectorWeights[sector as SectorId] = weight;
    }
  }

  const constituents = data.topConstituents.filter(
    (entry) => entry.weight > 0 && entry.name.trim() !== "",
  );

  const assetKind = data.assetKind ?? null;

  // "There is nothing here to find" is itself worth storing. A gold ETC that
  // publishes no charge still tells the app that it will never have a country
  // or a sector, which is what stops the surface offering to go and look for
  // one for ever.
  const saysSomething =
    data.ongoingCharge !== null ||
    Object.keys(countryWeights).length > 0 ||
    Object.keys(sectorWeights).length > 0 ||
    !resolvesToComposition(assetKind);

  if (!saysSomething) {
    return { ok: false, refusal: { reason: "nothing-useful" } };
  }

  return {
    ok: true,
    reading: {
      isin: askedIsin,
      assetKind,
      ongoingCharge: data.ongoingCharge,
      currency: data.currency?.trim().toUpperCase() ?? null,
      countryWeights,
      sectorWeights,
      topConstituents: constituents.map((entry) => ({
        name: entry.name.trim(),
        weight: entry.weight,
      })),
      // Capped at 1: published weights rounded to a decimal place can sum to
      // a hair over the whole fund, and a coverage above 100% is nonsense.
      constituentsCoverage: Math.min(
        1,
        constituents.reduce((sum, entry) => sum + entry.weight, 0),
      ),
      sources: data.sources,
      sourcedAt: now.toISOString(),
      model,
      version: READING_VERSION,
    },
  };
}

/** Whole days between a reading and now, floored at zero. */
export function readingAgeDays(reading: InstrumentReading, now: Date): number {
  const taken = new Date(reading.sourcedAt).getTime();
  if (!Number.isFinite(taken)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((now.getTime() - taken) / 86_400_000));
}

/**
 * Whether this reading should be taken again.
 *
 * Stale does not mean unusable — the caller keeps showing it. It means the
 * daily job should put this instrument back in the queue, and the surface
 * should say how old the figures are.
 */
export function readingIsStale(reading: InstrumentReading, now: Date): boolean {
  return (
    reading.version < READING_VERSION ||
    readingAgeDays(reading, now) > READING_FRESH_DAYS
  );
}

/** How complete a reading is, for deciding what to read next. */
export function readingCompleteness(reading: InstrumentReading): number {
  const has = [
    reading.ongoingCharge !== null,
    Object.keys(reading.countryWeights).length > 0,
    Object.keys(reading.sectorWeights).length > 0,
    reading.topConstituents.length > 0,
  ];
  return has.filter(Boolean).length / has.length;
}

/**
 * Which instruments to read next, worst first.
 *
 * Never read is worse than read badly, which is worse than read a long time
 * ago — that order is what stops a portfolio sitting half-classified while
 * the job re-reads something it already knows.
 */
export function readingQueue(
  isins: string[],
  readings: Map<string, InstrumentReading>,
  now: Date,
): string[] {
  return [...isins]
    .filter((isin) => {
      const reading = readings.get(isin);
      return reading === undefined || readingIsStale(reading, now);
    })
    .sort((left, right) => {
      const leftReading = readings.get(left);
      const rightReading = readings.get(right);
      if (leftReading === undefined || rightReading === undefined) {
        return leftReading === undefined
          ? rightReading === undefined
            ? 0
            : -1
          : 1;
      }
      const byCompleteness =
        readingCompleteness(leftReading) - readingCompleteness(rightReading);
      if (byCompleteness !== 0) {
        return byCompleteness;
      }
      return (
        readingAgeDays(rightReading, now) - readingAgeDays(leftReading, now)
      );
    });
}

export interface FakeInstrumentReadingSource extends InstrumentReadingSource {
  calls: InstrumentReadingRequest[];
}

/**
 * A source that answers from a script and records what it was asked.
 *
 * Exported from production code rather than built with a mocking library, so
 * a test can prove no network happened the same way `createFakeMonthReadSource`
 * does.
 */
export function createFakeInstrumentReadingSource(
  answers: Record<string, unknown | null>,
  model = "fake",
): FakeInstrumentReadingSource {
  const calls: InstrumentReadingRequest[] = [];
  let lastFailure: ReadingFailure | null = null;

  return {
    calls,
    model,
    get lastFailure() {
      return lastFailure;
    },
    async read(request) {
      calls.push(request);
      const answer = answers[request.isin.trim().toUpperCase()] ?? null;
      lastFailure = answer === null ? "nothing-found" : null;
      return answer;
    },
  };
}

/**
 * Every answer a request to read one instrument can come back with.
 *
 * Held here rather than beside the caller because three places need to agree
 * on it: the adapter in `apps/web` that talks to the tally, the server action
 * that wraps it, and the queue walk below that decides what to do next. It
 * used to be written out separately in each, and the drift between two of
 * those spellings is what this module's `drainStep` was added to end.
 */
export const INSTRUMENT_READ_STATUSES = [
  "read",
  "already-fresh",
  "nothing-to-read",
  "cooling",
  "allowance-spent",
  "not-yours",
  "no-reader",
  /**
   * The five that replaced `unavailable`.
   *
   * One status used to stand for all of them, and the surface had one
   * sentence for all of them: "That instrument could not be read just now."
   * A plan without the web search connector, a provider that is down, a
   * migration that has not run and a fund nobody has published a factsheet
   * for are four different problems with four different answers, and
   * collapsing them left a reader with a button that looked broken and no
   * way to find out why.
   *
   * The split also decides how far a walk down the queue gets. The first
   * three are facts about the reader, so every instrument behind this one
   * would fail the same way and the walk stops. The last two are facts about
   * this one instrument, so the walk leaves it behind and carries on.
   */
  "not-set-up",
  "no-search",
  "provider-down",
  "nothing-found",
  "wrong-instrument",
  "not-authenticated",
] as const;

export type InstrumentReadStatus = (typeof INSTRUMENT_READ_STATUSES)[number];

/** Why a walk down the queue stopped. */
export type DrainHalt =
  | "done"
  | "cooling"
  | "allowance"
  | "not-yours"
  | "no-reader"
  | "not-set-up"
  | "no-search"
  | "provider-down"
  | "nothing-found"
  | "wrong-instrument"
  | "signed-out";

export type DrainStep =
  { go: true; remaining: number } | { go: false; halt: DrainHalt };

/**
 * What the queue walk should do with one instrument's answer.
 *
 * Pure, and here rather than inside the button, because the rule it encodes
 * is not obvious and was got wrong: the walk carries on only when the queue
 * actually moved. A reading that landed moved it, and so did one that turned
 * out to be fresh already — nothing was bought, but the instrument is behind
 * us either way. Every other answer leaves the instrument exactly where it
 * was, at the head of the queue, so carrying on would ask the same question
 * about the same instrument for as long as the queue had anything in it.
 *
 * `cooling` is the one halt that is worth offering to retry. The tally is
 * keyed on the user rather than the instrument, so a reading that has just
 * landed puts the *next* instrument inside the cooldown — a refusal to answer
 * yet, not a refusal to answer. Reporting that as a spent allowance is what
 * made this walk stop after a single instrument and blame the writer for it.
 */
export function drainStep(
  status: InstrumentReadStatus,
  remaining: number,
): DrainStep {
  switch (status) {
    case "read":
    case "already-fresh":
      return remaining > 0
        ? { go: true, remaining }
        : { go: false, halt: "done" };
    case "nothing-to-read":
      return { go: false, halt: "done" };
    case "cooling":
      return { go: false, halt: "cooling" };
    case "allowance-spent":
      return { go: false, halt: "allowance" };
    case "not-yours":
      return { go: false, halt: "not-yours" };
    case "no-reader":
      return { go: false, halt: "no-reader" };
    case "not-set-up":
      return { go: false, halt: "not-set-up" };
    case "no-search":
      return { go: false, halt: "no-search" };
    case "provider-down":
      return { go: false, halt: "provider-down" };
    case "nothing-found":
      return { go: false, halt: "nothing-found" };
    case "wrong-instrument":
      return { go: false, halt: "wrong-instrument" };
    case "not-authenticated":
      return { go: false, halt: "signed-out" };
  }
}

/**
 * Whether pressing the same button again could get further.
 *
 * Only the cooldown: it clears by itself within seconds. A spent allowance
 * waits for the month to turn, an unread instrument needs a working reader,
 * and the other three are not about time at all.
 */
export function haltIsRetryable(halt: DrainHalt): boolean {
  return halt === "cooling";
}

/**
 * Whether this halt is about the one instrument rather than the whole walk.
 *
 * The difference decides whether pressing "Read the rest" once gets through a
 * portfolio. A failed read leaves its instrument at the head of the queue, so
 * a walk that simply carried on would ask about the same one for ever — which
 * is why every halt used to stop it dead. But that meant one fund nobody has
 * published a factsheet for blocked every fund behind it, and no number of
 * presses would ever get past it.
 *
 * So the two instrument-specific answers are handled differently: the caller
 * remembers that ISIN, asks for the next instrument *excluding* it, and
 * reports at the end how many it could not read. The rest are facts about the
 * reader — no key, no search connector, no migration, no allowance left — and
 * every instrument behind this one would fail in exactly the same way.
 */
export function haltIsInstrumentSpecific(halt: DrainHalt): boolean {
  return halt === "nothing-found" || halt === "wrong-instrument";
}
