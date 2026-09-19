/**
 * Which findings lead, chosen by a model.
 *
 * `buildCategoryFindings` already orders the band, by weight in currency
 * units a month, heaviest first. That ordering is defensible on its own and
 * stays the fallback — it is what the screen shows on a deployment with no
 * model key, and what it goes back to the moment anything here is in doubt.
 *
 * What a model buys is the one thing weight cannot see: what a person can act
 * on. A thirty-euro drift in restaurants deserves more attention than a
 * two-hundred-euro drift in an indexed rent, and that is a judgement a model
 * makes well and a formula makes badly.
 *
 * ## The model chooses and orders; it does not write figures
 *
 * It picks from a closed catalogue of finding ids — the ones it was handed,
 * and nothing else. An id it was never given is not a finding this app can
 * render, so that pick is dropped; the rest of the answer stands, because a
 * model that invented one id has not thereby lost the judgement behind the
 * other four.
 *
 * It may attach a remark, and **a remark may contain no figure at all**. The
 * weight is already rendered beside it, in its own element, where privacy
 * mode can blur it and the currency toggle can follow it — the argument
 * `month-facts.ts` makes at length. A remark that writes one is dropped and
 * counted in `trimmed`; the pick survives, because what the call was for was
 * the ordering and the remark is a garnish on it.
 *
 * The digit-and-quantity-word net is `writesAFigure`, imported from
 * `./month-read` rather than written again. This repo has twice paid for two
 * copies of one rule, and there will not be a third.
 *
 * Pure. Testable without a database, a network or a model.
 */

import { z } from "zod";

import type { CategoryFinding } from "./category-findings";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { fingerprint } from "./month-facts";
import { visibleLength, writesAFigure, type MonthReadRefusal } from "./month-read";

/* ----------------------------------------------------------- the answer */

export interface CategorySelectionPick {
  /** One of the finding ids the model was handed, and nothing else. */
  id: string;
  /** One clause of judgement, with no figure in it. Absent is ordinary. */
  remark?: string;
}

/** What is stored: an order over ids, never an order over figures. */
export interface CategorySelection {
  picks: CategorySelectionPick[];
}

export type CategorySelectionVerdict =
  | {
      ok: true;
      selection: CategorySelection;
      /** Remarks dropped for writing a figure, or for running long. */
      trimmed: number;
    }
  | { ok: false; reason: MonthReadRefusal; detail: string };

/**
 * How many the model may name, which is how many the band shows.
 *
 * `MAX_FINDINGS_SHOWN` is the band's own constant and lives with the
 * component that slices to it. Naming more here would let a model spend its
 * judgement on rows nobody sees.
 */
export const MAX_SELECTION_PICKS = 5;

/**
 * How many findings there have to be before an order is worth asking for.
 *
 * Two. One finding is already first and none is nothing to rank, so a call
 * about either could only ever return what the screen already shows. The
 * write path refuses below this — it reaches `decideMonthReadWrite` as the
 * `thin` it already knows how to refuse — and the band hides its button on
 * the same test, so the control is absent rather than present and useless.
 */
export const MIN_FINDINGS_TO_RANK = 2;

/**
 * Longest a remark may be, measured as a reader sees it.
 *
 * A finding row is one line: a category, a sentence, a weight. A remark sits
 * inside that line's budget, so this is far shorter than a read's claim —
 * a paragraph here would push the weight off a phone-width row.
 */
export const MAX_REMARK_LENGTH = 70;

/**
 * The allowance, and the two waits around it.
 *
 * Five a month rather than the category read's ten: there is one band on the
 * screen and one order over it, where there are as many reads as there are
 * categories. The cooldown and the reservation window are the month read's
 * unchanged — they answer "was this pressed twice" and "did a call that
 * started ever finish", which are not questions this surface answers
 * differently.
 */
export const CATEGORY_SELECTION_WRITES_PER_MONTH = 5;
export const CATEGORY_SELECTION_COOLDOWN_SECONDS = 60;
export const CATEGORY_SELECTION_RESERVATION_SECONDS = 120;

/**
 * Bounds that mean the model ignored the format entirely rather than ran a
 * little long. Local, and for the reason `category-read.ts` gives for its
 * own: neither file is the other's configuration.
 */
const RUNAWAY_PICKS = 40;
const RUNAWAY_ID_LENGTH = 200;
const RUNAWAY_REMARK_LENGTH = 600;

/**
 * The shape the model is asked for, and the shape it is held to.
 *
 * Enforced here rather than trusted from the provider, for the reason
 * `monthReadAnswerSchema` gives: strict json_schema mode does not reliably
 * honour `minItems`, `maxItems` or `maxLength`, and a provider guarantee
 * reduces retries but is never the contract. `.strict()`, so a model that
 * answers with a different top-level key has answered a different question
 * rather than been quietly half-understood.
 */
export const categorySelectionAnswerSchema = z
  .object({
    picks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(RUNAWAY_ID_LENGTH),
            remark: z.string().max(RUNAWAY_REMARK_LENGTH).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(RUNAWAY_PICKS),
  })
  .strict();

/* ----------------------------------------------------- the JSON schema */

/**
 * The wording inside the response format, per language.
 *
 * A schema description is an instruction read at the moment the field is
 * written, which is exactly when a system prompt fifty lines up has stopped
 * being persuasive — see `SCHEMA_WORDS` in `./category-read` for the measured
 * version of that claim.
 */
const SCHEMA_WORDS: Record<Locale, { id: string; remark: string }> = {
  en: {
    id: "A finding id, copied exactly from the list you were given.",
    remark:
      "Optional. One short clause saying why this one leads. No number of " +
      "any kind — the amount is already printed beside it.",
  },
  fr: {
    id: "Un id de constat, copié tel quel depuis la liste fournie.",
    remark:
      "Facultatif. Une courte proposition disant pourquoi celui-ci passe " +
      "devant. Aucun nombre, d'aucune sorte — le montant est déjà imprimé à " +
      "côté.",
  },
};

/**
 * Sent to the provider as `response_format`.
 *
 * Exported so the prompt and the adapter cannot drift apart. Counts and
 * lengths are deliberately absent: see `categorySelectionAnswerSchema`.
 */
export function categorySelectionJsonSchema(locale: Locale = DEFAULT_LOCALE) {
  const words = SCHEMA_WORDS[locale];
  return {
    type: "json_schema",
    json_schema: {
      name: "category_selection",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["picks"],
        properties: {
          picks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "remark"],
              properties: {
                id: { type: "string", description: words.id },
                // Required by strict mode, which has no notion of an absent
                // key; an empty string is how "no remark" arrives, and it is
                // normalised away below.
                remark: { type: "string", description: words.remark },
              },
            },
          },
        },
      },
    },
  };
}

/* ------------------------------------------------------------ the digest */

/**
 * A fingerprint of the findings, for noticing that they have moved.
 *
 * `factsDigest`'s analogue over findings, sharing its hash rather than
 * inventing one. Ids and weights, sorted, because those are exactly the two
 * things a stored order claims to describe: which findings there were, and
 * how heavy each one was. A finding that has arrived, gone, or changed weight
 * moves this; the order they happen to arrive in does not.
 *
 * What it is for is the one rule this feature is easiest to get subtly wrong
 * on. A stored order is kept with the digest of the findings it was chosen
 * from. When they move — a transaction is added, a month turns — the stored
 * order is not merely old: it is a ranking that claims to describe figures
 * that have changed. It must not be applied.
 */
export function findingsDigest(findings: readonly CategoryFinding[]): string {
  return fingerprint(
    [...findings]
      .map((finding) => `${finding.id}:${finding.severity.toFixed(2)}`)
      .sort()
      .join("|"),
  );
}

/* ----------------------------------------------------- the verification */

/**
 * Hold the answer to the findings it was given.
 *
 * One fatal outcome, and it is the only one where nothing can be salvaged: an
 * answer that is not the shape asked for, or one in which no pick names a
 * finding this app is holding. Everything else is a trim, because the app's
 * own order is always underneath — a half-usable answer still improves on it
 * for the half that is usable, and refusing outright would spend one of five
 * monthly attempts to show nothing.
 *
 * `locale` reaches only the refusal sentences, which are the reader's, not
 * the model's.
 */
export function verifyCategorySelection(
  raw: unknown,
  findings: readonly CategoryFinding[],
  locale: Locale = DEFAULT_LOCALE,
): CategorySelectionVerdict {
  const t = translator(locale);
  const parsed = categorySelectionAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "unreadable",
      detail:
        parsed.error.issues[0]?.message ?? t("monthRead.refusal.wrongShape"),
    };
  }

  const offered = new Set(findings.map((finding) => finding.id));
  const taken = new Set<string>();
  const picks: CategorySelectionPick[] = [];
  let trimmed = 0;

  /** A remark, or nothing — and `trimmed` bumped when something was lost. */
  const keptRemark = (written: string | undefined): { remark?: string } => {
    const remark = written?.trim();
    if (!remark) {
      return {};
    }
    // The same net the reads use, imported rather than rewritten: digits, and
    // the quantity words that are digits spelled out.
    if (writesAFigure(remark) || visibleLength(remark) > MAX_REMARK_LENGTH) {
      trimmed += 1;
      return {};
    }
    return { remark };
  };

  for (const pick of parsed.data.picks) {
    const id = pick.id.trim();

    // The closed catalogue. An id that was never offered names nothing this
    // app can render, so there is no honest way to keep the pick — but it is
    // this pick that goes, not the answer.
    if (!offered.has(id) || taken.has(id)) {
      continue;
    }
    taken.add(id);

    picks.push({ id, ...keptRemark(pick.remark) });

    if (picks.length === MAX_SELECTION_PICKS) {
      break;
    }
  }

  if (picks.length === 0) {
    return {
      ok: false,
      reason: "nothing-left",
      detail: t("monthRead.refusal.everythingDropped"),
    };
  }

  return { ok: true, selection: { picks }, trimmed };
}

/* -------------------------------------------------------- the ordering */

/**
 * The findings, with the chosen ones in front.
 *
 * Nothing is dropped, and nothing is invented: every finding handed in comes
 * back, the chosen ones in the model's order and the rest behind them in the
 * app's. A pick that no longer names a finding is skipped rather than being
 * an error — this runs against the findings as they stand now, and by the
 * time the caller has decided staleness does not apply, the only ids that can
 * be missing are ones that went in the same instant.
 */
export function applySelection(
  findings: readonly CategoryFinding[],
  selection: CategorySelection,
): CategoryFinding[] {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const chosen: CategoryFinding[] = [];
  const taken = new Set<string>();

  for (const pick of selection.picks) {
    const finding = byId.get(pick.id);
    if (finding && !taken.has(pick.id)) {
      chosen.push(finding);
      taken.add(pick.id);
    }
  }

  return [...chosen, ...findings.filter((finding) => !taken.has(finding.id))];
}

/** The remark against each finding it was written about, for rendering. */
export function selectionRemarks(
  selection: CategorySelection,
): Record<string, string> {
  const remarks: Record<string, string> = {};
  for (const pick of selection.picks) {
    if (pick.remark) {
      remarks[pick.id] = pick.remark;
    }
  }
  return remarks;
}
