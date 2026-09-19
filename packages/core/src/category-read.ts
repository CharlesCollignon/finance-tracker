/**
 * A category read: prose written by a model, figures written by the app.
 *
 * `month-read.ts`'s contract over one category's run of months. The model is
 * handed a `CategoryFacts` pack and answers with sentences containing
 * `{{fact:id}}` placeholders, plus a declaration, per sentence, of which
 * figures it rests on. Nothing it writes reaches a screen until every
 * placeholder has been replaced with the app's own formatted value and every
 * declaration has been checked against the pack.
 *
 * Built out of that module's parts rather than beside them: `writesAFigure`,
 * `citedIds`, `visibleLength` and `factSegments` are all imported, because a
 * second copy of the digit rule is a second place for the one bug that
 * matters here to hide.
 *
 * **What this guarantees, exactly.** No *figure* on the screen is one the app
 * did not compute. It does not guarantee the judgements are sound: "this has
 * been climbing for a while now" contains no figure and is not verifiable
 * here. The digit and quantity-word checks are a net, not a proof, and saying
 * otherwise would be the kind of small lie this codebase avoids elsewhere.
 *
 * ## Two differences from a month read, both deliberate
 *
 * **No headline.** The panel this renders into already carries the category's
 * name and its normal, so a headline would be a second title six millimetres
 * under the first.
 *
 * **A figure in a claim is fatal, not trimmed.** Over there an observation
 * that wrote a number of its own is dropped and the read survives, because
 * three others survive with it. Here there are at most two, so dropping one
 * either leaves a read that is half of what was written with nothing to say
 * so, or leaves nothing at all and reports the cause as "nothing-left" — a
 * verdict that names the symptom and hides the fault. Refusing outright says
 * the true thing: the model did arithmetic, and a model doing arithmetic has
 * told us what the rest of its sentences are worth.
 */

import { z } from "zod";

import type { CategoryFacts } from "./category-facts";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { factIds } from "./month-facts";
import {
  citedIds,
  factSegments,
  MAX_CLAIM_LENGTH,
  visibleLength,
  writesAFigure,
  type ClaimTone,
  type MonthReadRefusal,
  type RenderedClaim,
  type RenderedSuggestion,
  type SuggestionEffort,
  type TrimmedClaim,
} from "./month-read";

/* ----------------------------------------------------------- the answer */

/** What is stored: the model's prose, still tokenised, never its figures. */
export interface CategoryRead {
  observations: { text: string; basis: string[]; tone: ClaimTone }[];
  suggestions: { text: string; basis: string[]; effort: SuggestionEffort }[];
}

export type CategoryReadVerdict =
  | { ok: true; read: CategoryRead; trimmed: TrimmedClaim[] }
  | { ok: false; reason: MonthReadRefusal; detail: string };

/**
 * What the panel holds, which is less than a month card holds.
 *
 * Two of each. A category read sits under a chart, a findings band and a list
 * of the month's entries; it is the last thing on a panel rather than the
 * whole of one, and four observations about a single category is a model
 * saying the same thing twice.
 */
export const MAX_CATEGORY_OBSERVATIONS = 2;
export const MAX_CATEGORY_SUGGESTIONS = 2;

/**
 * The allowance, and the two waits around it.
 *
 * Ten a month across every category rather than ten per category: a person
 * with forty categories would otherwise hold four hundred model calls, which
 * is not an allowance. The cooldown and the reservation window are the month
 * read's, unchanged — they answer the same two questions, which are "was this
 * button pressed twice" and "did a call that started ever finish".
 */
export const CATEGORY_READ_WRITES_PER_MONTH = 10;
export const CATEGORY_READ_COOLDOWN_SECONDS = 60;
export const CATEGORY_READ_RESERVATION_SECONDS = 120;

/**
 * Bounds that mean the model ignored the format entirely rather than ran a
 * little long. Local rather than imported because `month-read.ts` keeps its
 * own private — they are the same numbers for the same reason, and neither
 * file is the other's configuration.
 */
const RUNAWAY_CLAIM_LENGTH = 1200;
const RUNAWAY_CLAIMS = 24;
const RUNAWAY_BASIS = 16;

/**
 * The shape the model is asked for, and the shape it is held to.
 *
 * Enforced here rather than trusted from the provider, for the reason
 * `monthReadAnswerSchema` gives: strict json_schema mode does not reliably
 * honour `minItems`, `maxItems` or `maxLength`, and a provider guarantee is
 * an optimisation that reduces retries, never the contract. `.strict()` so an
 * extra top-level key is a rejection rather than something silently ignored —
 * which is also what refuses a `headline` this surface has no room for.
 *
 * The lengths here are the runaway bounds, not the caps: a claim that runs a
 * little long is prose, and it is trimmed below on its rendered length.
 */
export const categoryReadAnswerSchema = z
  .object({
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

export type CategoryReadAnswer = z.infer<typeof categoryReadAnswerSchema>;

/* ----------------------------------------------------- the JSON schema */

/**
 * The wording inside the response format, per language.
 *
 * A schema description is an instruction the model reads at the moment it
 * writes the field, which is exactly when a system prompt two hundred lines
 * up has stopped being persuasive. Short restatements of rules the prompt
 * already gives twice — see `FIGURE_RULE_EN` in `./month-read-prompt` for why
 * that repetition is measured rather than redundant.
 *
 * The example id is `normal`, and deliberately: it is the one datum a
 * category pack always carries, and an instruction that demonstrates an id
 * has to demonstrate one that exists or the next answer cites it verbatim.
 */
const SCHEMA_WORDS: Record<Locale, { claim: string; basis: string }> = {
  en: {
    claim: "Two sentences at most. Write every figure as {{fact:id}}.",
    basis:
      'The ids this rests on, bare: "normal", not "{{fact:normal}}". Every id used in the text must appear here.',
  },
  fr: {
    claim:
      "Deux phrases au plus. Écrivez chaque chiffre sous la forme {{fact:id}}.",
    basis:
      'Les ids sur lesquels cela repose, nus : "normal", pas "{{fact:normal}}". Tout id utilisé dans le texte doit figurer ici.',
  },
};

/**
 * Sent to the provider as `response_format`.
 *
 * Exported so the prompt tests and the adapter cannot drift apart. Counts and
 * lengths are deliberately absent: see `categoryReadAnswerSchema`. No `$defs`
 * or `$ref` — strict-mode support for references is uneven across providers,
 * and this schema is small enough to inline.
 */
export function categoryReadJsonSchema(locale: Locale = DEFAULT_LOCALE) {
  const words = SCHEMA_WORDS[locale];
  return {
    type: "json_schema",
    json_schema: {
      name: "category_read",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["observations", "suggestions"],
        properties: {
          observations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "basis", "tone"],
              properties: {
                text: { type: "string", description: words.claim },
                basis: {
                  type: "array",
                  items: { type: "string" },
                  description: words.basis,
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
                text: { type: "string", description: words.claim },
                basis: {
                  type: "array",
                  items: { type: "string" },
                  description: words.basis,
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
  };
}

/* ----------------------------------------------------- the verification */

/**
 * The same declaration, written the way the app reads it.
 *
 * A model that has just been told to write figures as `{{fact:normal}}` will
 * sometimes write its basis entries the same way. That is the right datum in
 * the wrong punctuation, and refusing a whole read over it would be the
 * harshest possible answer to the smallest possible mistake — so the wrapper
 * is stripped here and the id underneath is what everything downstream sees,
 * including what is stored. The same leniency `month-read.ts` applies, for
 * the same reason.
 *
 * Lenient in what is accepted, strict in what is kept: an entry that is not a
 * bare id and not a wrapped one is passed through unchanged, to fail the
 * known-datum check on its own merits.
 */
function bareId(entry: string): string {
  const wrapped = entry.trim().match(/^\{\{fact:(.+)\}\}$/);
  return wrapped ? wrapped[1]!.trim() : entry.trim();
}

function normalise(answer: CategoryReadAnswer): CategoryReadAnswer {
  return {
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
 * Three fatal outcomes, and each is a case where nothing the model wrote can
 * be trusted: a shape that is not the schema; a reference to a datum that was
 * never sent, which is a model working from something other than our data;
 * and a figure written in the model's own hand, which is a model doing
 * arithmetic nobody can check. What is merely trimmed is a claim that points
 * at a figure it did not declare, and a claim too long for the panel.
 */
export function verifyCategoryRead(
  raw: unknown,
  facts: CategoryFacts,
  locale: Locale = DEFAULT_LOCALE,
): CategoryReadVerdict {
  const t = translator(locale);
  const parsed = categoryReadAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "unreadable",
      detail:
        parsed.error.issues[0]?.message ?? t("monthRead.refusal.wrongShape"),
    };
  }

  const answer = normalise(parsed.data);
  const known = factIds(facts);
  const claims = [...answer.observations, ...answer.suggestions];

  // Anywhere at all: basis entries and placeholders alike.
  const everyReference = claims.flatMap((row) => [
    ...row.basis,
    ...citedIds(row.text),
  ]);
  const unknown = everyReference.find((id) => !known.has(id));
  if (unknown !== undefined) {
    return {
      ok: false,
      reason: "unknown-datum",
      detail: t("monthRead.refusal.unknownDatum", { id: unknown }),
    };
  }

  const invented = claims.find((row) => writesAFigure(row.text));
  if (invented !== undefined) {
    return {
      ok: false,
      reason: "invented-figure",
      detail: t("categoryRead.refusal.claimHadFigure"),
    };
  }

  const trimmed: TrimmedClaim[] = [];

  function keep<T extends { text: string; basis: string[] }>(
    row: T,
    kind: "observation" | "suggestion",
  ): boolean {
    // The model's own declaration of what it rests on must match what it
    // points at. A placeholder outside the basis is a claim whose footing we
    // cannot check, which makes staleness undetectable for it later.
    if (citedIds(row.text).some((id) => !row.basis.includes(id))) {
      trimmed.push({ kind, text: row.text, why: "unbacked-placeholder" });
      return false;
    }
    // Last, and on the rendered length: a claim that would not fit the panel
    // is dropped rather than shown, but it is the least serious thing that
    // can be wrong with one. `MAX_CLAIM_LENGTH` is the month read's, reused —
    // the two sit in cards of the same width, and a second number would be a
    // second thing to keep in step for no gain.
    if (visibleLength(row.text) > MAX_CLAIM_LENGTH) {
      trimmed.push({ kind, text: row.text, why: "too-long" });
      return false;
    }
    return true;
  }

  // Filtered first, then cut to what the panel holds: if the model wrote
  // three observations and one has to go, the reader should get the two good
  // ones rather than one.
  const observations = answer.observations
    .filter((row) => keep(row, "observation"))
    .slice(0, MAX_CATEGORY_OBSERVATIONS);
  const suggestions = answer.suggestions
    .filter((row) => keep(row, "suggestion"))
    .slice(0, MAX_CATEGORY_SUGGESTIONS);

  if (observations.length === 0) {
    return {
      ok: false,
      reason: "nothing-left",
      detail: t("monthRead.refusal.everythingDropped"),
    };
  }

  return { ok: true, read: { observations, suggestions }, trimmed };
}

/* -------------------------------------------------------- the rendering */

export interface RenderedCategoryRead {
  observations: RenderedClaim[];
  suggestions: RenderedSuggestion[];
}

/**
 * A stored read, filled in from the figures as they stand now.
 *
 * Rendered from the *current* pack rather than the stored one, deliberately.
 * A stored "486,00 €" sitting under a bar chart that draws 502,00 € is a
 * visible self-contradiction on one screen; a fresh figure inside a sentence
 * whose judgement has aged is not.
 *
 * `locale` is the language the *prose* was written in, which is not
 * necessarily the one the reader is in. It has to be the prose's, because the
 * labels this drops into the sentences are the model's own words for those
 * figures: a French paragraph with "A normal month" spliced into it is two
 * correct halves making one wrong sentence. The caller hands in a facts pack
 * built in the same language for the same reason.
 *
 * Null when every observation has become unrenderable — a figure cited before
 * a cap was removed, a month that no longer has anything in it. At that point
 * there is nothing honest left to show.
 */
export function renderCategoryRead(
  read: CategoryRead,
  facts: CategoryFacts,
  formatMoney: (amount: number) => string,
  locale: Locale = DEFAULT_LOCALE,
): RenderedCategoryRead | null {
  const observations: RenderedClaim[] = [];
  for (const row of read.observations) {
    const segments = factSegments(row.text, facts, formatMoney, locale);
    if (segments) {
      observations.push({ segments, tone: row.tone });
    }
  }

  if (observations.length === 0) {
    return null;
  }

  const suggestions: RenderedSuggestion[] = [];
  for (const row of read.suggestions) {
    const segments = factSegments(row.text, facts, formatMoney, locale);
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

  return { observations, suggestions };
}

/**
 * Every figure a read rests on: what it declared, plus what it pointed at.
 *
 * The union rather than either alone. `basis` is the model's declaration and
 * placeholders are what it actually used; verification keeps them consistent
 * for surviving claims, and the union is the honest footing either way. What
 * it is for is staleness: a stored read is compared against a fresh pack on
 * exactly these ids.
 */
export function categoryReadFooting(read: CategoryRead): string[] {
  const ids = new Set<string>();
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
