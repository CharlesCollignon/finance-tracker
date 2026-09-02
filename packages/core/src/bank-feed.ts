/**
 * Turning what the bank says into what the ledger holds.
 *
 * The app was built on the premise that a transaction is something the user
 * decided to write down. A bank feed breaks that premise in a useful way and
 * a dangerous one at the same time: useful because the restaurants and the
 * rounds of drinks finally appear, dangerous because a feed inserts things
 * nobody looked at, and a ledger you have stopped trusting is worse than one
 * with gaps in it.
 *
 * So nothing here inserts on a guess. A row is only written unasked when the
 * user's own history already answers for it — the same merchant, categorised
 * the same way, more than once — or when the card network's own code says
 * plainly what it is. Everything else waits to be looked at, and each answer
 * makes the next one more likely to be automatic.
 *
 * Free of database and network concerns, so the decisions are testable
 * without either.
 */

import { categoryNameForMcc, mccNeedsReview } from "./bank-mcc";
import { lookupBankMerchant, type BankMerchantIndex } from "./bank-merchant";
import {
  lookupMerchant,
  normalizeMerchant,
  type MerchantIndex,
} from "./merchant-memory";

/** One transaction as the provider reported it, narrowed to what we read. */
export interface BankTransaction {
  id: string;
  /** Decimal string. Never parsed to a float; see `amount` below. */
  amount: string;
  currency: string;
  /** ISO 20022: CRDT money in, DBIT money out. */
  creditDebitIndicator: string;
  bookingDate: string | null;
  valueDate: string | null;
  transactionDate: string | null;
  creditorName: string | null;
  creditorIban: string | null;
  debtorName: string | null;
  debtorIban: string | null;
  remittanceInformation: string | null;
  merchantCategoryCode: string | null;
}

export type FeedDirection = "in" | "out";

export interface BankFeedCandidate {
  /** The provider's id for this transaction — the only safe dedupe key. */
  providerId: string;
  occurredOn: string;
  /**
   * Positive decimal string, exactly as the bank stated it. Kept as a string
   * all the way to the numeric column: the provider is deliberate about never
   * handing out floats, and re-introducing one here to save a cast would put
   * rounding error into a ledger whose whole point is that it reconciles.
   */
  amount: string;
  currency: string;
  direction: FeedDirection;
  /** Merchant for money out, payer for money in. */
  counterparty: string | null;
  merchantCategoryCode: string | null;
  /** What the transaction's note becomes, and what merchant memory matches on. */
  note: string;
}

/** A decimal string the numeric(12,2) column will accept, and its sign. */
const DECIMAL = /^-?\d{1,10}(\.\d{1,2})?$/;

function normalizeAmount(
  raw: string,
): { amount: string; negative: boolean } | null {
  const trimmed = raw.trim();
  if (!DECIMAL.test(trimmed)) {
    return null;
  }
  const negative = trimmed.startsWith("-");
  const amount = negative ? trimmed.slice(1) : trimmed;
  return Number(amount) === 0 ? null : { amount, negative };
}

/**
 * Which way the money went.
 *
 * The indicator is authoritative where the bank sets it, but not every
 * institution does, so a leading minus is honoured as a fallback. Getting
 * this wrong turns a salary into an expense, so it fails closed: no
 * indicator and no sign means no candidate.
 */
function resolveDirection(
  tx: BankTransaction,
  negative: boolean,
): FeedDirection | null {
  const indicator = tx.creditDebitIndicator?.trim().toUpperCase();
  if (indicator === "CRDT") {
    return "in";
  }
  if (indicator === "DBIT") {
    return "out";
  }
  return negative ? "out" : null;
}

export interface ToCandidateOptions {
  /**
   * IBANs of the user's own connected accounts. A movement between two of
   * them is not income and not spending — it is the same money — and booking
   * it would double-count against whatever it was moved for.
   */
  ownIbans?: ReadonlySet<string>;
}

function cleanIban(iban: string | null): string | null {
  return iban ? iban.replace(/\s+/g, "").toUpperCase() : null;
}

/** `null` when the row is not something the ledger should ever hold. */
export function toCandidate(
  tx: BankTransaction,
  options: ToCandidateOptions = {},
): BankFeedCandidate | null {
  const occurredOn = tx.bookingDate ?? tx.valueDate ?? tx.transactionDate;
  if (!occurredOn || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return null;
  }

  const money = normalizeAmount(tx.amount);
  if (!money) {
    return null;
  }

  const direction = resolveDirection(tx, money.negative);
  if (!direction) {
    return null;
  }

  const own = options.ownIbans;
  if (own?.size) {
    const other = cleanIban(
      direction === "out" ? tx.creditorIban : tx.debtorIban,
    );
    if (other && own.has(other)) {
      return null;
    }
  }

  const counterparty =
    (direction === "out" ? tx.creditorName : tx.debtorName)?.trim() || null;
  const note =
    counterparty ?? tx.remittanceInformation?.trim() ?? "Bank transaction";

  return {
    providerId: tx.id,
    occurredOn,
    amount: money.amount,
    currency: tx.currency,
    direction,
    counterparty,
    merchantCategoryCode: tx.merchantCategoryCode?.trim() || null,
    note,
  };
}

/* ------------------------------------------------------------- deciding */

export type FeedReason = "merchant" | "mcc";

export interface FeedSuggestion {
  categoryId: string;
  categoryName: string;
  reason: FeedReason;
}

export type FeedDecision =
  /** Written straight through: the user has already answered this one. */
  | { kind: "auto"; suggestion: FeedSuggestion }
  /** Waits to be looked at, with a starting point where there is one. */
  | { kind: "review"; suggestion: FeedSuggestion | null; why: ReviewReason };

export type ReviewReason =
  | "unknown-merchant"
  | "needs-a-look"
  | "money-in"
  | "possible-refund"
  | "no-such-category";

/**
 * How many times the user has to have categorised a merchant the same way
 * before the feed stops asking. Twice is the point at which it is a habit
 * rather than a coincidence, and the cost of being wrong is one correction.
 */
export const AUTO_MERCHANT_THRESHOLD = 2;

export interface DecideOptions {
  /** Exact-note matching, shared with hand entry; see merchant-memory. */
  merchants: MerchantIndex;
  /**
   * Coarse matching for the way a bank spells a merchant. Optional, so the
   * CSV path — whose notes are the user's own words — keeps exact matching.
   */
  bankMerchants?: BankMerchantIndex;
  /** Category name to id, for resolving what an MCC suggests. */
  categoryIdsByName: ReadonlyMap<string, { id: string; name: string }>;
}

export function decide(
  candidate: BankFeedCandidate,
  { merchants, bankMerchants, categoryIdsByName }: DecideOptions,
): FeedDecision {
  const rule = lookupMerchant(merchants, candidate.note);

  // Money arriving is rarer and more consequential than money leaving — a
  // salary, a refund, a transfer someone sent. None of it should land
  // uninspected.
  if (candidate.direction === "in") {
    const suggestion = rule
      ? {
          categoryId: rule.categoryId,
          categoryName: rule.categoryName,
          reason: "merchant" as const,
        }
      : null;
    return {
      kind: "review",
      suggestion,
      why:
        rule && rule.categoryType === "expense"
          ? "possible-refund"
          : "money-in",
    };
  }

  if (mccNeedsReview(candidate.merchantCategoryCode)) {
    return { kind: "review", suggestion: null, why: "needs-a-look" };
  }

  if (
    rule &&
    rule.count >= AUTO_MERCHANT_THRESHOLD &&
    rule.categoryType !== "income"
  ) {
    return {
      kind: "auto",
      suggestion: {
        categoryId: rule.categoryId,
        categoryName: rule.categoryName,
        reason: "merchant",
      },
    };
  }

  // The coarse key catches the same shop spelled differently by the terminal.
  // It is trusted only where every past transaction under it agreed: a key
  // this blunt can gather two different merchants, and a split verdict is
  // exactly what that looks like from here.
  const coarse = bankMerchants
    ? lookupBankMerchant(bankMerchants, candidate.note)
    : null;
  if (coarse && coarse.unanimous && coarse.count >= AUTO_MERCHANT_THRESHOLD) {
    return {
      kind: "auto",
      suggestion: {
        categoryId: coarse.categoryId,
        categoryName: coarse.categoryName,
        reason: "merchant",
      },
    };
  }

  const mccName = categoryNameForMcc(candidate.merchantCategoryCode);
  if (mccName) {
    const category = categoryIdsByName.get(mccName.toLowerCase());
    if (category) {
      return {
        kind: "auto",
        suggestion: {
          categoryId: category.id,
          categoryName: category.name,
          reason: "mcc",
        },
      };
    }
    // The code said "Restaurants" and there is no such category. Filing the
    // dinner under Other and calling it done would be worse than asking — but
    // if the user's own history has an answer, that still beats nothing.
    return {
      kind: "review",
      suggestion: rule
        ? {
            categoryId: rule.categoryId,
            categoryName: rule.categoryName,
            reason: "merchant",
          }
        : null,
      why: "no-such-category",
    };
  }

  const fallback = rule ?? coarse;
  return {
    kind: "review",
    suggestion: fallback
      ? {
          categoryId: fallback.categoryId,
          categoryName: fallback.categoryName,
          reason: "merchant",
        }
      : null,
    why: "unknown-merchant",
  };
}

export interface PlannedFeedRow {
  candidate: BankFeedCandidate;
  decision: FeedDecision;
}

export interface FeedPlan {
  automatic: PlannedFeedRow[];
  review: PlannedFeedRow[];
  /** Rows the ledger should never hold: own transfers, unparseable, zero. */
  discarded: number;
  /** Rows already seen on an earlier sync. */
  duplicates: number;
}

/**
 * The whole sync, decided in one pass.
 *
 * Deduplication is on the provider's own transaction id rather than anything
 * derived: two identical coffees on the same day at the same counter are two
 * transactions, and any key built from date, amount and merchant would
 * collapse them into one.
 */
export function planFeed(
  transactions: readonly BankTransaction[],
  options: DecideOptions &
    ToCandidateOptions & { seenProviderIds?: ReadonlySet<string> },
): FeedPlan {
  const seen = options.seenProviderIds ?? new Set<string>();
  const automatic: PlannedFeedRow[] = [];
  const review: PlannedFeedRow[] = [];
  let discarded = 0;
  let duplicates = 0;

  for (const tx of transactions) {
    if (seen.has(tx.id)) {
      duplicates += 1;
      continue;
    }

    const candidate = toCandidate(tx, options);
    if (!candidate) {
      discarded += 1;
      continue;
    }

    const decision = decide(candidate, options);
    (decision.kind === "auto" ? automatic : review).push({
      candidate,
      decision,
    });
  }

  return { automatic, review, discarded, duplicates };
}

/** Category name index in the shape `decide` wants. */
export function indexCategoriesByName(
  categories: readonly { id: string; name: string }[],
): Map<string, { id: string; name: string }> {
  return new Map(
    categories.map((c) => [
      c.name.trim().toLowerCase(),
      { id: c.id, name: c.name },
    ]),
  );
}

/** Exposed for the review UI, which shows why a row is waiting. */
export function describeReviewReason(why: ReviewReason): string {
  switch (why) {
    case "money-in":
      return "Money arriving — say what it was";
    case "possible-refund":
      return "Looks like a refund from somewhere you usually spend";
    case "needs-a-look":
      return "Cash or a transfer — not spending yet";
    case "no-such-category":
      return "No category for this kind of spending yet";
    case "unknown-merchant":
      return "First time here";
  }
}

export { normalizeMerchant };
