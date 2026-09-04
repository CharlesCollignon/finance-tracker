/**
 * A month read: prose written by a model, figures written by the app.
 *
 * The model is handed a `MonthFacts` pack and answers with sentences
 * containing `{{fact:id}}` placeholders, plus a declaration, per sentence, of
 * which figures it rests on. Nothing it writes reaches a screen until every
 * placeholder has been replaced with the app's own formatted value and every
 * declaration has been checked against the pack.
 *
 * **What this guarantees, exactly.** No *figure* on the screen is one the app
 * did not compute. It does not guarantee the judgements are sound: "you are
 * spending noticeably more on groceries" contains no figure and is not
 * verifiable here. The digit and quantity-word checks below are a net, not a
 * proof, and saying otherwise would be the kind of small lie this codebase
 * avoids elsewhere.
 *
 * Two severities, because a wording slip in the third suggestion and a
 * fabricated headline are not the same event. A trim drops one claim and
 * keeps the read; a fatal verdict throws the whole thing away and stores
 * nothing.
 *
 * The port mirrors `market/quote-source.ts`: one method, `null` for "no
 * answer right now" as an ordinary outcome, and adapters that never throw.
 * No secret ever reaches this module — it is bundled into the phone.
 */

import { z } from "zod";

import {
  factIds,
  findFact,
  formatFact,
  type MonthFact,
  type MonthFacts,
} from "./month-facts";

/* ------------------------------------------------------------- the port */

export interface MonthReadRequest {
  system: string;
  user: string;
}

/**
 * Seam for the writer. `null` means "no answer right now", which is an
 * ordinary outcome — unreachable, rate-limited, timed out — and not a
 * failure the caller should treat as exceptional. Adapters never throw.
 */
export interface MonthReadSource {
  /** The model's raw JSON answer, unparsed. Verification happens here, not there. */
  write(request: MonthReadRequest): Promise<unknown | null>;
  /** Which model answered, for the record. */
  readonly model: string;
}

/* ----------------------------------------------------------- the answer */

export type ClaimTone = "good" | "neutral" | "watch";
export type SuggestionEffort = "now" | "this-month" | "habit";

/** Longest a headline may be. One clause, not a paragraph. */
export const MAX_HEADLINE_LENGTH = 90;
/** Longest a claim may be, measured as a reader sees it. */
export const MAX_CLAIM_LENGTH = 240;

/**
 * What a placeholder is worth on screen.
 *
 * `{{fact:unrecorded-allowance}}` is twenty-nine characters that a reader
 * never sees; what lands in its place is something like "240,00 €". Counting
 * the raw text would charge a claim for the markup and punish it for citing
 * figures, which is the opposite of what this feature wants — so the caps
 * above are measured against the rendered length, estimated with this.
 */
const NOMINAL_FIGURE_WIDTH = 8;

/**
 * Bounds that mean the model ignored the format entirely rather than ran a
 * little long. A claim over this is not prose that needs trimming, it is a
 * different kind of answer, and the read is refused.
 */
const RUNAWAY_HEADLINE_LENGTH = 400;
const RUNAWAY_CLAIM_LENGTH = 1200;

/**
 * How long a claim reads, with each figure counted at its rendered width.
 *
 * Exported because the caps and this measure have to travel together: a limit
 * applied to a different string than the one on screen is not a limit anyone
 * can reason about.
 */
export function visibleLength(text: string): number {
  let placeholders = 0;
  const stripped = text.replace(PLACEHOLDER, () => {
    placeholders += 1;
    return "";
  });
  return stripped.length + placeholders * NOMINAL_FIGURE_WIDTH;
}
export const MAX_OBSERVATIONS = 4;
export const MAX_SUGGESTIONS = 3;

/**
 * Counts that mean the answer is not a read at all.
 *
 * Distinct from the caps above, which are what the card holds. A model that
 * offers six observations has written one too many, and the fix is to take
 * the first four; a model that offers sixty has misunderstood the job, and
 * there is nothing to salvage. Only the second is fatal.
 */
const RUNAWAY_CLAIMS = 24;
const RUNAWAY_BASIS = 16;

/**
 * The shape the model is asked for, and the shape it is held to.
 *
 * Enforced here rather than trusted from the provider. Mistral's strict
 * json_schema mode does not reliably honour `minItems`, `maxItems` or
 * `maxLength`, and a provider guarantee is an optimisation that reduces
 * retries in any case — never the contract. `.strict()` so an extra
 * top-level key is a rejection rather than something silently ignored.
 *
 * The lengths here are the runaway bounds, not the caps. A claim that runs a
 * little long is prose, not a broken answer: it is trimmed below, on its
 * rendered length, and the rest of the read survives. Failing the whole read
 * over a sentence thirty characters past a limit spends someone's allowance
 * to show them nothing, which is the wrong price for a wrapping problem.
 */
export const monthReadAnswerSchema = z
  .object({
    headline: z.string().min(1).max(RUNAWAY_HEADLINE_LENGTH),
    observations: z
      .array(
        z
          .object({
            text: z.string().min(1).max(RUNAWAY_CLAIM_LENGTH),
            basis: z.array(z.string()).min(1).max(RUNAWAY_BASIS),
            tone: z.enum(["good", "neutral", "watch"]),
          })
          .strict(),
      )
      .min(1)
      .max(RUNAWAY_CLAIMS),
    suggestions: z
      .array(
        z
          .object({
            text: z.string().min(1).max(RUNAWAY_CLAIM_LENGTH),
            basis: z.array(z.string()).min(1).max(RUNAWAY_BASIS),
            effort: z.enum(["now", "this-month", "habit"]),
          })
          .strict(),
      )
      .max(RUNAWAY_CLAIMS),
  })
  .strict();

export type MonthReadAnswer = z.infer<typeof monthReadAnswerSchema>;

/** What is stored: the model's prose, still tokenised, never its figures. */
export interface MonthRead {
  headline: string;
  observations: { text: string; basis: string[]; tone: ClaimTone }[];
  suggestions: { text: string; basis: string[]; effort: SuggestionEffort }[];
}

/* ----------------------------------------------------- the JSON schema */

/**
 * Sent to Mistral as `response_format`.
 *
 * Exported so the prompt tests and the adapter cannot drift apart. Counts and
 * lengths are deliberately absent: see `monthReadAnswerSchema`. No `$defs` or
 * `$ref` — strict-mode support for references is uneven across providers, and
 * this schema is small enough to inline.
 */
export const MONTH_READ_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "month_read",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "observations", "suggestions"],
      properties: {
        headline: {
          type: "string",
          description: "One short clause. No figures, not even as {{fact:id}}.",
        },
        observations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "basis", "tone"],
            properties: {
              text: {
                type: "string",
                description:
                  "Two sentences at most. Write every figure as {{fact:id}}.",
              },
              basis: {
                type: "array",
                items: { type: "string" },
                description:
                  'The ids this rests on, bare: "expenses", not "{{fact:expenses}}". Every id used in the text must appear here.',
              },
              tone: { type: "string", enum: ["good", "neutral", "watch"] },
            },
          },
        },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "basis", "effort"],
            properties: {
              text: {
                type: "string",
                description:
                  "Two sentences at most. Write every figure as {{fact:id}}.",
              },
              basis: {
                type: "array",
                items: { type: "string" },
                description:
                  'The ids this rests on, bare: "expenses", not "{{fact:expenses}}". Every id used in the text must appear here.',
              },
              effort: {
                type: "string",
                enum: ["now", "this-month", "habit"],
              },
            },
          },
        },
      },
    },
  },
} as const;

/* ----------------------------------------------------- the verification */

export type MonthReadRefusal =
  /** Not the shape asked for. */
  | "unreadable"
  /** A figure the app did not give it. */
  | "invented-figure"
  /** Rests on a datum that was never sent. */
  | "unknown-datum"
  /** Nothing survived trimming. */
  | "nothing-left";

export interface TrimmedClaim {
  kind: "observation" | "suggestion";
  text: string;
  why: "figure" | "unknown-datum" | "unbacked-placeholder" | "too-long";
}

export type MonthReadVerdict =
  | { ok: true; read: MonthRead; trimmed: TrimmedClaim[] }
  | { ok: false; reason: MonthReadRefusal; detail: string };

const PLACEHOLDER = /\{\{fact:([^}]+)\}\}/g;

/**
 * Words that are a quantity wherever they appear.
 *
 * The digit check catches "412"; this catches "roughly two thousand euros"
 * and "up by a third", which are the same offence spelled out. Every one of
 * these is a proportion or a scale — none of them has an innocent reading in
 * a sentence about money.
 */
const SCALE_WORDS = [
  "half",
  "third",
  "quarter",
  "double",
  "triple",
  "twice",
  "hundred",
  "thousand",
  "dozen",
  "zero",
];

/**
 * Small integers, which are only a quantity next to a unit.
 *
 * These deliberately do *not* trip on their own. "One of your caps is over"
 * states no figure — it is ordinary prose, and an earlier version of this
 * denylist trimmed exactly that kind of true, useful sentence. But "nine
 * percent" is a figure the model computed, so a small integer immediately
 * before a unit is caught.
 */
const SMALL_INTEGERS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

const UNIT_WORDS = ["percent", "per cent", "euro", "euros", "cent", "cents"];

const SCALE_PATTERN = new RegExp(`\\b(${SCALE_WORDS.join("|")})\\b`, "i");

const INTEGER_WITH_UNIT_PATTERN = new RegExp(
  `\\b(${SMALL_INTEGERS.join("|")})\\s+(${UNIT_WORDS.join("|")})\\b`,
  "i",
);

/** The text with every placeholder removed, for checking what is left. */
function withoutPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER, " ");
}

function citedIds(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]!.trim());
}

/** Whether a claim's prose smuggles in a figure of its own. */
export function writesAFigure(text: string): boolean {
  const bare = withoutPlaceholders(text);
  return (
    /\d/.test(bare) ||
    SCALE_PATTERN.test(bare) ||
    INTEGER_WITH_UNIT_PATTERN.test(bare)
  );
}

/**
 * The same declaration, written the way the app reads it.
 *
 * A model that has just been told to write figures as `{{fact:income}}` will
 * sometimes write its basis entries the same way. That is the right datum in
 * the wrong punctuation, and refusing a whole read over it would be the
 * harshest possible answer to the smallest possible mistake — so the wrapper
 * is stripped here and the id underneath is what everything downstream sees,
 * including what is stored.
 *
 * Lenient in what is accepted, strict in what is kept: an entry that is not a
 * bare id and not a wrapped one is passed through unchanged, to fail the
 * known-datum check below on its own merits.
 */
function bareId(entry: string): string {
  const wrapped = entry.trim().match(/^\{\{fact:(.+)\}\}$/);
  return wrapped ? wrapped[1].trim() : entry.trim();
}

function normalise(answer: MonthReadAnswer): MonthReadAnswer {
  return {
    ...answer,
    observations: answer.observations.map((row) => ({
      ...row,
      basis: row.basis.map(bareId),
    })),
    suggestions: answer.suggestions.map((row) => ({
      ...row,
      basis: row.basis.map(bareId),
    })),
  };
}

/**
 * Hold the answer to the pack.
 *
 * Fatal outcomes are the ones where nothing the model wrote can be trusted:
 * a shape that is not the schema, a headline with a figure in it, or a
 * reference to a datum that was never sent. That last one is fatal rather
 * than trimmed on purpose — a model citing a figure we did not provide is a
 * model working from something other than our data, and the rest of what it
 * wrote is no more trustworthy than the part that gave it away.
 */
export function verifyMonthRead(
  raw: unknown,
  facts: MonthFacts,
): MonthReadVerdict {
  const parsed = monthReadAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "unreadable",
      detail: parsed.error.issues[0]?.message ?? "Not the shape asked for",
    };
  }

  const answer = normalise(parsed.data);
  const known = factIds(facts);

  // Anywhere at all: basis entries and placeholders alike.
  const everyReference = [
    ...answer.observations.flatMap((row) => [
      ...row.basis,
      ...citedIds(row.text),
    ]),
    ...answer.suggestions.flatMap((row) => [
      ...row.basis,
      ...citedIds(row.text),
    ]),
    ...citedIds(answer.headline),
  ];
  const unknown = everyReference.find((id) => !known.has(id));
  if (unknown !== undefined) {
    return {
      ok: false,
      reason: "unknown-datum",
      detail: `It referred to "${unknown}", which was never sent`,
    };
  }

  if (writesAFigure(answer.headline)) {
    return {
      ok: false,
      reason: "invented-figure",
      detail: "The headline contained a figure of its own",
    };
  }

  // The one length that is fatal, because a headline cannot be dropped: it is
  // the line the whole card rests on and there is nothing to fall back to.
  if (visibleLength(answer.headline) > MAX_HEADLINE_LENGTH) {
    return {
      ok: false,
      reason: "unreadable",
      detail: "The headline was longer than one line",
    };
  }

  const trimmed: TrimmedClaim[] = [];

  function keep<T extends { text: string; basis: string[] }>(
    row: T,
    kind: "observation" | "suggestion",
  ): boolean {
    if (writesAFigure(row.text)) {
      trimmed.push({ kind, text: row.text, why: "figure" });
      return false;
    }
    // The model's own declaration of what it rests on must match what it
    // points at. A placeholder outside the basis is a claim whose footing we
    // cannot check, which makes staleness undetectable for it later.
    const unbacked = citedIds(row.text).some((id) => !row.basis.includes(id));
    if (unbacked) {
      trimmed.push({ kind, text: row.text, why: "unbacked-placeholder" });
      return false;
    }
    // Last, and on the rendered length: a claim that would not fit the card
    // is dropped rather than shown, but it is the least serious thing that
    // can be wrong with one, so it is checked after the two that matter.
    if (visibleLength(row.text) > MAX_CLAIM_LENGTH) {
      trimmed.push({ kind, text: row.text, why: "too-long" });
      return false;
    }
    return true;
  }

  // Filtered first, then cut to what the card holds: if the model wrote five
  // observations and one has to go, the reader should get four good ones
  // rather than three.
  const observations = answer.observations
    .filter((row) => keep(row, "observation"))
    .slice(0, MAX_OBSERVATIONS);
  const suggestions = answer.suggestions
    .filter((row) => keep(row, "suggestion"))
    .slice(0, MAX_SUGGESTIONS);

  if (observations.length === 0) {
    return {
      ok: false,
      reason: "nothing-left",
      detail: "Every observation had to be dropped",
    };
  }

  return {
    ok: true,
    read: { headline: answer.headline, observations, suggestions },
    trimmed,
  };
}

/* -------------------------------------------------------- the rendering */

export type ReadSegment =
  | { kind: "text"; text: string }
  | { kind: "figure"; factId: string; label: string; display: string };

export interface RenderedClaim {
  segments: ReadSegment[];
  tone: ClaimTone;
}

export interface RenderedSuggestion {
  segments: ReadSegment[];
  effort: SuggestionEffort;
}

export interface RenderedRead {
  headline: ReadSegment[];
  observations: RenderedClaim[];
  suggestions: RenderedSuggestion[];
}

function segmentsFor(
  text: string,
  facts: MonthFacts,
  formatMoney: (amount: number) => string,
): ReadSegment[] | null {
  const segments: ReadSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PLACEHOLDER)) {
    const id = match[1]!.trim();
    const fact: MonthFact | null = findFact(facts, id);
    // The figure has gone since the read was written — a deleted category, a
    // removed cap. The claim can no longer be rendered honestly.
    if (!fact) {
      return null;
    }

    if (match.index! > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, match.index!) });
    }
    segments.push({
      kind: "figure",
      factId: id,
      label: fact.label,
      display: formatFact(fact, formatMoney),
    });
    cursor = match.index! + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments;
}

/**
 * Turn a stored read into segments, against the figures as they stand now.
 *
 * Rendered from the *current* pack rather than the stored one, deliberately.
 * A stored "Kept 1 240 €" sitting three cards below a recap that says 1 190 €
 * is a visible self-contradiction on one screen; a fresh figure inside a
 * sentence whose judgement has aged is not, and the ageing is something
 * `describeReadFreshness` can say out loud.
 *
 * Null when the headline can no longer be rendered — at that point there is
 * nothing honest left to show.
 */
export function renderMonthRead(
  read: MonthRead,
  facts: MonthFacts,
  formatMoney: (amount: number) => string,
): RenderedRead | null {
  const headline = segmentsFor(read.headline, facts, formatMoney);
  if (!headline) {
    return null;
  }

  const observations: RenderedClaim[] = [];
  for (const row of read.observations) {
    const segments = segmentsFor(row.text, facts, formatMoney);
    if (segments) {
      observations.push({ segments, tone: row.tone });
    }
  }

  if (observations.length === 0) {
    return null;
  }

  const suggestions: RenderedSuggestion[] = [];
  for (const row of read.suggestions) {
    const segments = segmentsFor(row.text, facts, formatMoney);
    if (segments) {
      suggestions.push({ segments, effort: row.effort });
    }
  }

  // Soonest first, so the list reads in the order a person would act.
  const order: Record<SuggestionEffort, number> = {
    now: 0,
    "this-month": 1,
    habit: 2,
  };
  suggestions.sort((left, right) => order[left.effort] - order[right.effort]);

  return { headline, observations, suggestions };
}

/**
 * Every figure a read rests on: what it declared, plus what it pointed at.
 *
 * The union rather than either alone. `basis` is the model's declaration and
 * placeholders are what it actually used; verification keeps them consistent
 * for surviving claims, and the union is the honest footing either way.
 */
export function readFooting(read: MonthRead): string[] {
  const ids = new Set<string>(citedIds(read.headline));
  for (const row of [...read.observations, ...read.suggestions]) {
    for (const id of row.basis) {
      ids.add(id);
    }
    for (const id of citedIds(row.text)) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

/* ------------------------------------------------------- a fixed writer */

export interface FakeMonthReadSource extends MonthReadSource {
  /** Requests made, in order. Lets a test assert nothing was asked. */
  readonly calls: MonthReadRequest[];
}

/**
 * A writer that answers from a script, for tests.
 *
 * Mirrors `createFakeQuoteSource`, including the `calls` array — the point of
 * which is asserting that a thin month never reached the model at all.
 */
export function createFakeMonthReadSource(
  answers: readonly (unknown | null)[],
  model = "fake",
): FakeMonthReadSource {
  const calls: MonthReadRequest[] = [];
  let index = 0;

  return {
    model,
    calls,
    async write(request) {
      calls.push(request);
      const answer = answers[index] ?? null;
      index += 1;
      return answer;
    },
  };
}
