/**
 * An arrangement: chosen by a model, computed by the app.
 *
 * The Bearing asks a language model a narrower question than a month read
 * does. Not "describe this" but "of these twenty-nine figures, which eight
 * matter most today, in what order, and can you put four words beside each".
 * That is a ranking problem with a caption attached, and it suits a model far
 * better than prose does: the judgement is the valuable part and the sentence
 * is not.
 *
 * The invariant is the one `month-read.ts` establishes and it is not relaxed
 * here. **The model never writes a number.** It names figures by id and may
 * write `{{fact:id}}` inside a caption; the app substitutes its own formatted
 * value at render. So the same three machines are reused rather than
 * reimplemented — `writesAFigure`, `citedIds` and `factSegments` — and the
 * same two severities apply: a bad caption is dropped and the arrangement
 * survives, an invented figure throws the whole answer away.
 *
 * What is *not* inherited is the size decision. A tile's span comes from its
 * slot, so there is no field here for a model to get wrong.
 *
 * The port mirrors `market/quote-source.ts`: one method, `null` for "no
 * answer right now" as an ordinary outcome, adapters that never throw. No
 * secret reaches this module — it is bundled into the phone.
 */

import { z } from "zod";

import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { BearingFacts } from "./bearing-facts";
import {
  BEARING_TILES,
  isTileId,
  MAX_TILES,
  slotSpan,
  type TileId,
  type TileSeries,
  type TileSpan,
} from "./bearing-tiles";
import { findFact, formatFact } from "./month-facts";
import {
  citedIds,
  factSegments,
  visibleLength,
  writesAFigure,
  type ReadSegment,
} from "./month-read";

/* ------------------------------------------------------------- the port */

export interface ArrangementRequest {
  system: string;
  user: string;
  /** The language the whole request is in, response format included. */
  locale: Locale;
}

export interface ArrangementSource {
  /** The model's raw JSON answer, unparsed. Verification happens here. */
  choose(request: ArrangementRequest): Promise<unknown | null>;
  readonly model: string;
}

/* ----------------------------------------------------------- the answer */

/**
 * Four words, not a sentence.
 *
 * The whole premise of this surface is that it is made of numbers. A caption
 * exists to say the one thing a figure cannot say about itself — "third month
 * over", "ahead of target" — and a caption long enough to need reading has
 * turned a tile back into a paragraph. Measured on rendered length, so citing
 * a figure does not eat the budget.
 */
export const MAX_CAPTION_LENGTH = 40;

/** Not a caption that ran long; a different kind of answer entirely. */
const RUNAWAY_CAPTION_LENGTH = 300;
const RUNAWAY_TILES = 60;

export const arrangementAnswerSchema = z
  .object({
    tiles: z
      .array(
        z
          .object({
            id: z.string().min(1),
            caption: z.string().max(RUNAWAY_CAPTION_LENGTH).optional(),
            /** The ids the caption rests on, bare. */
            basis: z.array(z.string()).max(8).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(RUNAWAY_TILES),
  })
  .strict();

export type ArrangementAnswer = z.infer<typeof arrangementAnswerSchema>;

/** What is stored: an order and some captions, never a figure. */
export interface ArrangedTile {
  id: TileId;
  /** Tokenised prose, or null when the model offered none. */
  caption: string | null;
  basis: string[];
}

export interface Arrangement {
  tiles: ArrangedTile[];
}

/* ------------------------------------------------------ the JSON schema */

const SCHEMA_WORDS: Record<Locale, { id: string; caption: string; basis: string }> =
  {
    en: {
      id: "One id from the list of figures you were given.",
      caption:
        "Optional. At most six words. No figures except as {{fact:id}}. Omit it rather than stating the number again.",
      basis:
        'The ids the caption rests on, bare: "on-hand", not "{{fact:on-hand}}".',
    },
    fr: {
      id: "Un id de la liste de chiffres qui vous a été donnée.",
      caption:
        "Facultatif. Six mots au plus. Aucun chiffre sauf sous la forme {{fact:id}}. Omettez-le plutôt que de répéter le nombre.",
      basis:
        'Les ids sur lesquels la légende repose, nus : "on-hand", pas "{{fact:on-hand}}".',
    },
  };

export function arrangementJsonSchema(locale: Locale = DEFAULT_LOCALE) {
  const words = SCHEMA_WORDS[locale];
  return {
    type: "json_schema",
    json_schema: {
      name: "bearing_arrangement",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["tiles"],
        properties: {
          tiles: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "caption", "basis"],
              properties: {
                id: { type: "string", description: words.id },
                caption: { type: "string", description: words.caption },
                basis: {
                  type: "array",
                  items: { type: "string" },
                  description: words.basis,
                },
              },
            },
          },
        },
      },
    },
  };
}

/* ---------------------------------------------------- the verification */

export type ArrangementRefusal =
  /** Not the shape asked for. */
  | "unreadable"
  /** Named a figure that was never sent. */
  | "unknown-datum"
  /** Nothing survived. */
  | "nothing-left";

export interface DroppedCaption {
  id: string;
  caption: string;
  why: "figure" | "unbacked-placeholder" | "too-long";
}

export type ArrangementVerdict =
  | { ok: true; arrangement: Arrangement; dropped: DroppedCaption[] }
  | { ok: false; reason: ArrangementRefusal; detail: string };

/**
 * Hold the answer to the pack.
 *
 * A tile id that is not in the catalogue, or whose figure this person's pack
 * does not carry, is fatal rather than skipped — and that is a stricter line
 * than the month read draws for a claim. The reason is that the catalogue is
 * *closed* and was handed over in full: a month read can cite
 * `top-expense:c4` and be wrong about one category, but a model naming a tile
 * that does not exist has ignored a list of twenty-nine strings it was just
 * given, and nothing else in that answer is worth more trust than that.
 *
 * A caption is the forgiving half. It is dropped and its tile kept, because
 * losing four words is not a reason to lose the arrangement.
 */
export function verifyArrangement(
  raw: unknown,
  facts: BearingFacts,
  locale: Locale = DEFAULT_LOCALE,
): ArrangementVerdict {
  const t = translator(locale);
  const parsed = arrangementAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "unreadable",
      detail: parsed.error.issues[0]?.message ?? t("bearing.refusal.wrongShape"),
    };
  }

  const known = new Set(facts.facts.map((fact) => fact.id));
  const dropped: DroppedCaption[] = [];
  const tiles: ArrangedTile[] = [];
  const seen = new Set<TileId>();

  for (const row of parsed.data.tiles) {
    const id = row.id.trim();

    if (!isTileId(id) || !known.has(id)) {
      return {
        ok: false,
        reason: "unknown-datum",
        detail: t("bearing.refusal.unknownTile", { id }),
      };
    }

    // A model that lists the same figure twice has misread the job, but it
    // has not invented anything — the second mention is simply ignored, the
    // way `mergeArrangement` would ignore it downstream anyway.
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const basis = (row.basis ?? []).map(bareId);
    const caption = row.caption?.trim() ?? "";

    if (caption.length === 0) {
      tiles.push({ id, caption: null, basis: [] });
      continue;
    }

    // A caption citing a figure nobody computed is the one caption-level
    // mistake that is still fatal, for the same reason it is in a month read:
    // a model referring to data it was not given is working from something
    // other than this person's figures.
    const cited = citedIds(caption);
    const unknownCite = [...cited, ...basis].find((ref) => !known.has(ref));
    if (unknownCite !== undefined) {
      return {
        ok: false,
        reason: "unknown-datum",
        detail: t("bearing.refusal.unknownDatum", { id: unknownCite }),
      };
    }

    const why = captionFault(caption, cited, basis);
    if (why) {
      dropped.push({ id, caption, why });
      tiles.push({ id, caption: null, basis: [] });
      continue;
    }

    tiles.push({ id, caption, basis });
  }

  if (tiles.length === 0) {
    return {
      ok: false,
      reason: "nothing-left",
      detail: t("bearing.refusal.nothingLeft"),
    };
  }

  return { ok: true, arrangement: { tiles: tiles.slice(0, MAX_TILES) }, dropped };
}

/** What is wrong with a caption, or null when nothing is. */
function captionFault(
  caption: string,
  cited: readonly string[],
  basis: readonly string[],
): DroppedCaption["why"] | null {
  if (writesAFigure(caption)) {
    return "figure";
  }
  // The declaration has to match what the text points at, so staleness stays
  // detectable per tile later.
  if (cited.some((id) => !basis.includes(id))) {
    return "unbacked-placeholder";
  }
  if (visibleLength(caption) > MAX_CAPTION_LENGTH) {
    return "too-long";
  }
  return null;
}

/**
 * A basis entry written the way the app reads it.
 *
 * Same leniency `month-read.ts` extends and for the same observed reason: a
 * model just told to write figures as `{{fact:x}}` will sometimes write its
 * basis that way too, which is the right datum in the wrong punctuation.
 */
function bareId(entry: string): string {
  const wrapped = entry.trim().match(/^\{\{fact:(.+)\}\}$/);
  return wrapped ? wrapped[1]!.trim() : entry.trim();
}

/* -------------------------------------------------------- the rendering */

export interface RenderedTile {
  id: TileId;
  /** The datum's own label, in the reader's language. */
  label: string;
  /** The app's formatted value — never the model's. */
  display: string;
  value: number;
  sense: "up-is-good" | "up-is-bad" | "neutral";
  /** The clause the pack carries, when it has one. */
  note: string | null;
  href: string | null;
  series: TileSeries | null;
  /** Null when there is no caption, or it cannot be rendered honestly. */
  caption: ReadSegment[] | null;
  /** From the slot, never from the model. */
  span: TileSpan;
}

/**
 * The tiles to draw, in order, filled in from the figures as they stand now.
 *
 * Rendered from the *current* pack rather than the one the arrangement was
 * chosen against, for the reason `renderMonthRead` gives: a stored figure
 * sitting beside a fresh one is a visible self-contradiction on a single
 * screen. What can age is the choice of tiles, and that is something the
 * surface says out loud rather than hides.
 *
 * `order` is the merged list from `mergeArrangement` — the user's pins
 * already applied — so this does no ordering of its own.
 */
export function renderArrangement(
  order: readonly TileId[],
  arrangement: Arrangement | null,
  facts: BearingFacts,
  formatMoney: (amount: number) => string,
  locale: Locale = DEFAULT_LOCALE,
): RenderedTile[] {
  const captions = new Map(
    (arrangement?.tiles ?? []).map((tile) => [tile.id, tile.caption] as const),
  );

  const rendered: RenderedTile[] = [];

  for (const id of order) {
    const fact = findFact(facts, id);
    if (!fact) {
      continue;
    }

    const caption = captions.get(id) ?? null;
    const meta = BEARING_TILES[id];

    rendered.push({
      id,
      label: fact.label,
      display: formatFact(fact, formatMoney, locale),
      value: fact.value,
      sense: fact.sense,
      note: fact.note ?? null,
      href: meta.href,
      series: meta.series ?? null,
      caption: caption
        ? factSegments(caption, facts, formatMoney, locale)
        : null,
      // Assigned here, from the position, so the grid's rhythm is a property
      // of the layout rather than of whatever the model happened to answer.
      span: slotSpan(rendered.length),
    });
  }

  return rendered;
}

/** Which datums an arrangement's captions rest on, for the freshness check. */
export function arrangementFooting(
  arrangement: Arrangement | null,
): string[] {
  const footing = new Set<string>();
  for (const tile of arrangement?.tiles ?? []) {
    footing.add(tile.id);
    for (const id of tile.basis) {
      footing.add(id);
    }
  }
  return [...footing];
}
