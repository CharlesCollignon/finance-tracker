/**
 * The wallets, read out loud.
 *
 * Sibling of `month-read.ts`, and built out of its parts rather than beside
 * them: `writesAFigure`, `citedIds`, `visibleLength` and `factSegments` are
 * all reused, because a second copy of the figure check would be a second
 * place for the one bug that matters here to hide.
 *
 * What is different is the suggestions. A month read suggests in prose and
 * stops there. A wallet read has to name an instrument and say how much of
 * the portfolio it should be — and "how much" is the one thing a model is
 * never allowed to write. So a suggestion carries prose *and* two closed
 * vocabulary fields: a role and a weight class. The prose explains, the
 * fields drive `buildTargetAllocation`, and every percentage on screen is
 * arithmetic this app did.
 *
 * ## What is fatal and what is merely dropped
 *
 * An ISIN outside the catalogue is fatal for the whole read. The catalogue is
 * closed and was handed over in full, so naming something outside it is not
 * a judgement error — it is a fabricated identifier, and a read that
 * fabricated one has told us what its other claims are worth. This is the
 * line `verifyMonthRead` draws for a datum never sent, for the same reason.
 *
 * A fund placed in a wrapper it cannot sit in only drops that suggestion. The
 * eligibility was in the prompt, so it is a mistake — but it is a mistake
 * about French tax rules rather than an invented fact, `buildTargetAllocation`
 * refuses it independently, and throwing away four good observations over it
 * would be the harshest possible answer to the smallest possible error.
 */

import { z } from "zod";

import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { ETF_SHORTLIST, shortlistEntry } from "./etf-shortlist";
import { INVESTMENT_WALLET_IDS } from "./investments";
import { factSegments, visibleLength, writesAFigure, citedIds } from "./month-read";
import type { ClaimTone, ReadSegment, SuggestionEffort } from "./month-read";
import { factIds } from "./month-facts";
import type { LookThroughFacts } from "./look-through-facts";
import {
  SUGGESTION_ROLES,
  WEIGHT_CLASSES,
  buildTargetAllocation,
  type RoleAssignment,
  type TargetAllocation,
} from "./look-through-target";

export const MAX_WALLET_HEADLINE_LENGTH = 90;
export const MAX_WALLET_CLAIM_LENGTH = 240;
export const MAX_WALLET_OBSERVATIONS = 4;
export const MAX_WALLET_SUGGESTIONS = 4;

export const WALLET_READ_VERSION = 1;

const claimSchema = z
  .object({
    text: z.string().min(1).max(600),
    basis: z.array(z.string().min(1).max(80)).max(4),
  })
  .strict();

export const walletReadAnswerSchema = z
  .object({
    headline: z.string().min(1).max(300),
    observations: z
      .array(
        claimSchema.extend({
          tone: z.enum(["good", "neutral", "watch"]),
        }).strict(),
      )
      .min(1)
      .max(8),
    suggestions: z
      .array(
        claimSchema.extend({
          effort: z.enum(["now", "this-month", "habit"]),
          /** From the catalogue handed over in the prompt. Never invented. */
          isin: z.string().min(1).max(20),
          role: z.enum(SUGGESTION_ROLES),
          wallet: z.enum(INVESTMENT_WALLET_IDS as [string, ...string[]]),
          /** How big, said without a number. */
          weightClass: z.enum(WEIGHT_CLASSES),
        }).strict(),
      )
      .max(8),
  })
  .strict();

export type WalletReadAnswer = z.infer<typeof walletReadAnswerSchema>;

const SCHEMA_WORDS: Record<
  Locale,
  {
    headline: string;
    claim: string;
    basis: string;
    isin: string;
    weightClass: string;
  }
> = {
  en: {
    headline: "One short clause. No figures, not even as {{fact:id}}.",
    claim: "Two sentences at most. Write every figure as {{fact:id}}.",
    basis:
      'The ids this rests on, bare: "us-share", not "{{fact:us-share}}". Every id used in the text must appear here.',
    isin: "Copied exactly from the catalogue you were given. Never invented.",
    weightClass:
      "How big a part this should play. Never a percentage — the app computes those.",
  },
  fr: {
    headline:
      "Une seule courte proposition. Aucun chiffre, pas même sous la forme {{fact:id}}.",
    claim:
      "Deux phrases au plus. Écrivez chaque chiffre sous la forme {{fact:id}}.",
    basis:
      'Les ids sur lesquels cela repose, nus : "us-share", pas "{{fact:us-share}}". Tout id utilisé dans le texte doit figurer ici.',
    isin: "Copié exactement du catalogue fourni. Jamais inventé.",
    weightClass:
      "L'importance que cette ligne doit avoir. Jamais un pourcentage — l'app les calcule.",
  },
};

/**
 * The same shape, as a provider's strict output format.
 *
 * Mistral's `response_format`, alongside the Zod schema above rather than
 * instead of it: strict mode does not reliably honour `maxItems` or
 * `maxLength`, and in any case a provider guarantee is an optimisation and
 * never the contract. This narrows what comes back; `verifyWalletRead` is
 * what decides whether it is usable.
 *
 * The descriptions carry the two rules the schema itself cannot express — no
 * figures in prose, and no percentages anywhere — because a field description
 * is read at the moment the field is written, which is exactly when a system
 * prompt three hundred lines up has stopped being persuasive.
 */
export function walletReadJsonSchema(locale: Locale = DEFAULT_LOCALE) {
  const words = SCHEMA_WORDS[locale];
  return {
    type: "json_schema",
    json_schema: {
      name: "wallet_read",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "observations", "suggestions"],
        properties: {
          headline: { type: "string", description: words.headline },
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
              required: [
                "text",
                "basis",
                "effort",
                "isin",
                "role",
                "wallet",
                "weightClass",
              ],
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
                isin: { type: "string", description: words.isin },
                role: { type: "string", enum: [...SUGGESTION_ROLES] },
                wallet: { type: "string", enum: [...INVESTMENT_WALLET_IDS] },
                weightClass: {
                  type: "string",
                  enum: [...WEIGHT_CLASSES],
                  description: words.weightClass,
                },
              },
            },
          },
        },
      },
    },
  };
}

export interface WalletObservation {
  text: string;
  tone: ClaimTone;
  basis: string[];
}

export interface WalletSuggestion {
  text: string;
  effort: SuggestionEffort;
  basis: string[];
  isin: string;
  role: RoleAssignment["role"];
  wallet: RoleAssignment["wallet"];
  weightClass: RoleAssignment["weightClass"];
}

export interface WalletRead {
  headline: string;
  observations: WalletObservation[];
  suggestions: WalletSuggestion[];
}

export interface WalletReadRequest {
  system: string;
  user: string;
  locale: Locale;
}

/**
 * Where reads come from.
 *
 * `null` means "no answer right now" — no key, unreachable, rate-limited,
 * timed out, or an answer that did not parse. Never a thrown error.
 */
export interface WalletReadSource {
  write(request: WalletReadRequest): Promise<unknown | null>;
  readonly model: string;
}

export type WalletReadRefusal =
  /** Not the shape asked for. */
  | "unreadable"
  /** A figure the app did not give it. */
  | "invented-figure"
  /** Rests on a datum that was never sent. */
  | "unknown-datum"
  /** Named an instrument that is not in the catalogue. */
  | "invented-instrument"
  /** Nothing survived trimming. */
  | "nothing-left";

export interface DroppedClaim {
  kind: "observation" | "suggestion";
  text: string;
  why: "figure" | "unknown-datum" | "unbacked-placeholder" | "too-long" | "wrong-wrapper";
}

export type WalletReadVerdict =
  | { ok: true; read: WalletRead; dropped: DroppedClaim[] }
  | { ok: false; reason: WalletReadRefusal; detail: string };

/**
 * Check a read against the figures it was given and the catalogue it was
 * handed, and hand back what survives.
 */
export function verifyWalletRead(
  raw: unknown,
  facts: LookThroughFacts,
  locale: Locale = DEFAULT_LOCALE,
): WalletReadVerdict {
  const t = translator(locale);
  const parsed = walletReadAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "unreadable",
      detail:
        parsed.error.issues[0]?.message ?? t("walletRead.refusal.wrongShape"),
    };
  }

  const answer = parsed.data;
  const known = factIds(facts);

  // Every reference, anywhere: declared bases and inline placeholders alike.
  const everyReference = [
    ...answer.observations.flatMap((row) => [
      ...row.basis.map(bareId),
      ...citedIds(row.text),
    ]),
    ...answer.suggestions.flatMap((row) => [
      ...row.basis.map(bareId),
      ...citedIds(row.text),
    ]),
    ...citedIds(answer.headline),
  ];
  const unknownDatum = everyReference.find((id) => !known.has(id));
  if (unknownDatum !== undefined) {
    return {
      ok: false,
      reason: "unknown-datum",
      detail: t("walletRead.refusal.unknownDatum", { id: unknownDatum }),
    };
  }

  // An invented identifier is fatal before anything else is considered. A
  // read that made one up has told us what the rest of it is worth.
  for (const row of answer.suggestions) {
    if (shortlistEntry(row.isin) === null) {
      return {
        ok: false,
        reason: "invented-instrument",
        detail: t("walletRead.refusal.unknownInstrument", { isin: row.isin }),
      };
    }
  }

  if (writesAFigure(withoutInstrumentNames(answer.headline))) {
    return {
      ok: false,
      reason: "invented-figure",
      detail: t("walletRead.refusal.headlineHadFigure"),
    };
  }

  // The one length that is fatal, because a headline cannot be dropped: it is
  // the line the whole surface rests on and there is nothing to fall back to.
  if (visibleLength(answer.headline) > MAX_WALLET_HEADLINE_LENGTH) {
    return {
      ok: false,
      reason: "unreadable",
      detail: t("walletRead.refusal.headlineTooLong"),
    };
  }

  const dropped: DroppedClaim[] = [];

  function keepProse(
    row: { text: string; basis: string[] },
    kind: "observation" | "suggestion",
  ): boolean {
    if (writesAFigure(withoutInstrumentNames(row.text))) {
      dropped.push({ kind, text: row.text, why: "figure" });
      return false;
    }
    // What a claim declares it rests on must match what it points at. A
    // placeholder outside the basis is a claim whose footing cannot be
    // checked, which makes staleness undetectable for it later.
    const unbacked = citedIds(row.text).some(
      (id) => !row.basis.map(bareId).includes(id),
    );
    if (unbacked) {
      dropped.push({ kind, text: row.text, why: "unbacked-placeholder" });
      return false;
    }
    if (visibleLength(row.text) > MAX_WALLET_CLAIM_LENGTH) {
      dropped.push({ kind, text: row.text, why: "too-long" });
      return false;
    }
    return true;
  }

  const observations: WalletObservation[] = answer.observations
    .filter((row) => keepProse(row, "observation"))
    .slice(0, MAX_WALLET_OBSERVATIONS)
    .map((row) => ({
      text: row.text,
      tone: row.tone,
      basis: row.basis.map(bareId),
    }));

  const suggestions: WalletSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of answer.suggestions) {
    if (!keepProse(row, "suggestion")) {
      continue;
    }

    const entry = shortlistEntry(row.isin)!;
    const wallet = row.wallet as RoleAssignment["wallet"];

    if (!entry.wrappers.includes(wallet)) {
      dropped.push({ kind: "suggestion", text: row.text, why: "wrong-wrapper" });
      continue;
    }
    if (seen.has(entry.isin)) {
      continue;
    }
    seen.add(entry.isin);

    suggestions.push({
      text: row.text,
      effort: row.effort,
      basis: row.basis.map(bareId),
      isin: entry.isin,
      role: row.role,
      wallet,
      weightClass: row.weightClass,
    });

    if (suggestions.length >= MAX_WALLET_SUGGESTIONS) {
      break;
    }
  }

  if (observations.length === 0) {
    return {
      ok: false,
      reason: "nothing-left",
      detail: t("walletRead.refusal.everythingDropped"),
    };
  }

  return {
    ok: true,
    read: { headline: answer.headline, observations, suggestions },
    dropped,
  };
}

/**
 * Every catalogued name and index, longest first.
 *
 * Longest first matters: "MSCI World" is a substring of nothing here, but
 * "S&P 500" must be removed before a shorter overlapping match can leave
 * "500" behind.
 */
const INSTRUMENT_LITERALS: string[] = [
  ...new Set(
    Object.values(ETF_SHORTLIST).flatMap((entry) => [
      entry.name,
      entry.index,
      entry.symbol,
    ]),
  ),
].sort((left, right) => right.length - left.length);

/**
 * The text with catalogued instrument names taken out.
 *
 * Because half the index names in existence contain a number. "S&P 500",
 * "STOXX Europe 600", "Russell 2000", "Nasdaq-100" — every one of those trips
 * a check whose entire purpose is to catch invented quantities, and the
 * result was that any suggestion naming the fund it was about got silently
 * dropped. Observed on a real answer: two of three suggestions thrown away,
 * both for the digits in a fund's own name.
 *
 * A digit inside a catalogued name is an identifier, not a figure, and the
 * app is the one that put that name in front of the model. Removing the names
 * before checking leaves the rule exactly as strict about everything it was
 * meant to be strict about — a model can still not write "about 20%" or "two
 * thirds", because neither is in this list.
 */
function withoutInstrumentNames(text: string): string {
  let stripped = text;
  for (const literal of INSTRUMENT_LITERALS) {
    if (literal.trim() === "") {
      continue;
    }
    stripped = stripped.split(literal).join(" ");
  }
  return stripped;
}

/**
 * A basis entry stripped of the wrapper it should not have had.
 *
 * A model told to write figures as `{{fact:id}}` will sometimes write its
 * basis entries the same way. That is the right datum in the wrong
 * punctuation, and refusing a whole read over it would be the harshest
 * possible answer to the smallest possible mistake — the same leniency
 * `month-read.ts` applies for the same reason.
 */
function bareId(entry: string): string {
  const wrapped = entry.trim().match(/^\{\{fact:(.+)\}\}$/);
  return wrapped ? wrapped[1]!.trim() : entry.trim();
}

/* -------------------------------------------------------- the rendering */

export interface RenderedWalletClaim {
  segments: ReadSegment[];
  tone: ClaimTone;
}

export interface RenderedWalletSuggestion {
  segments: ReadSegment[];
  effort: SuggestionEffort;
  /** From the catalogue, never from the read. */
  name: string;
  symbol: string;
  isin: string;
  wallet: RoleAssignment["wallet"];
  role: RoleAssignment["role"];
}

export interface RenderedWalletRead {
  headline: ReadSegment[];
  observations: RenderedWalletClaim[];
  suggestions: RenderedWalletSuggestion[];
}

export function renderWalletRead(
  read: WalletRead,
  facts: LookThroughFacts,
  formatMoney: (amount: number) => string,
  locale: Locale = DEFAULT_LOCALE,
): RenderedWalletRead | null {
  const headline = factSegments(read.headline, facts, formatMoney, locale);
  if (!headline) {
    return null;
  }

  const observations: RenderedWalletClaim[] = [];
  for (const row of read.observations) {
    const segments = factSegments(row.text, facts, formatMoney, locale);
    if (segments) {
      observations.push({ segments, tone: row.tone });
    }
  }

  const suggestions: RenderedWalletSuggestion[] = [];
  for (const row of read.suggestions) {
    const segments = factSegments(row.text, facts, formatMoney, locale);
    const entry = shortlistEntry(row.isin);
    // An instrument that has left the catalogue since the read was written
    // cannot be rendered: there is no name for it that this app vouches for.
    if (segments && entry) {
      suggestions.push({
        segments,
        effort: row.effort,
        name: entry.name,
        symbol: entry.symbol,
        isin: entry.isin,
        wallet: row.wallet,
        role: row.role,
      });
    }
  }

  // A headline with nothing under it is not a read. `verifyWalletRead`
  // refuses an answer whose every observation had to be dropped, and the
  // same judgement has to hold here: figures can disappear between writing
  // and rendering — a position sold, an instrument un-read — and when they
  // take every observation with them, there is nothing honest left to show.
  if (read.observations.length > 0 && observations.length === 0) {
    return null;
  }

  return { headline, observations, suggestions };
}

/**
 * The target a read implies.
 *
 * The read supplies roles and weight classes; every weight comes from
 * `buildTargetAllocation`. A read with no usable suggestions yields no target
 * and the caller falls back to `defaultAssignments`, which is why the surface
 * always has one to show.
 */
export function targetFromWalletRead(read: WalletRead): TargetAllocation {
  return buildTargetAllocation(
    read.suggestions.map((row) => ({
      isin: row.isin,
      role: row.role,
      wallet: row.wallet,
      weightClass: row.weightClass,
    })),
  );
}

/**
 * The lines that sit under a read.
 *
 * Two of them always: that this is information rather than advice, and that
 * the figures are the app's own. The rest are the look-through's caveats,
 * which is where the overlap floor and the unread share get said out loud
 * whether or not the model chose to mention them.
 */
export function walletReadFooting(
  facts: LookThroughFacts,
  locale: Locale = DEFAULT_LOCALE,
): string[] {
  const t = translator(locale);
  const lines = [t("walletRead.footing.notAdvice")];

  if (facts.missing.some((row) => row.why === "no-reading")) {
    lines.push(t("walletRead.footing.partiallyRead"));
  }

  return lines;
}

export interface FakeWalletReadSource extends WalletReadSource {
  calls: WalletReadRequest[];
}

/**
 * A source that answers from a script and records what it was asked.
 *
 * Exported from production code rather than built with a mocking library, so
 * a test can prove no network happened — the same arrangement as
 * `createFakeMonthReadSource`.
 */
export function createFakeWalletReadSource(
  answers: (unknown | null)[],
  model = "fake",
): FakeWalletReadSource {
  const calls: WalletReadRequest[] = [];
  let index = 0;

  return {
    calls,
    model,
    async write(request) {
      calls.push(request);
      const answer = answers[index] ?? null;
      index += 1;
      return answer;
    },
  };
}
