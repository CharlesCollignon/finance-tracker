import type { BankAttention } from "./bank-attention";
import type { Key, Vars } from "./i18n/t";

/**
 * What is waiting for the reader — « À faire » — agreed once instead of
 * several times.
 *
 * The dashboard and the Month screen each grew their own list of "things to
 * do" independently, and because the two screens are never seen side by
 * side, nobody noticed that they disagreed: one counted five kinds of thing,
 * the other three, and even the ones both counted were announced in
 * different words, some of them never translated at all. Then Le point grew
 * banners of its own beside the list — a bank about to stop, accounts
 * waiting to be told what they are — and two cards that asked their own
 * question at the top of the screen. This module is the one list all of it
 * belongs to, and the strip both apps draw from it is the one place that
 * counts.
 *
 * It carries no rendered text, only an i18n key and its params — mirroring
 * `resolveSpine`'s refusal to decide anything a client is better placed to
 * decide, here applied to translation rather than pixels. A client calls
 * `t()` on what it is handed; it cannot introduce a fourth wording by
 * improvising its own string, because there is no string here to improvise
 * from. A day is handed on as an ISO date for the client to format.
 *
 * The order is fixed and is the point of the exercise:
 *
 *  1. `wrong` items first. A swallowed bank entry is not an errand, it is a
 *     records problem: something the account did has already gone
 *     unrecorded, silently, and every figure elsewhere in the app is wrong
 *     until it is dealt with. A bank feed that has stopped shares that
 *     property — every balance on screen is quietly yesterday's — so it
 *     ranks beside it.
 *  2. Closing the month, next. It is the ritual the whole loop is built
 *     on — the one moment the app checks its own bookkeeping against the
 *     bank rather than trusting its own arithmetic — which is enough to
 *     rank it above mere errands. It still ranks below `wrong`, because a
 *     records gap is exactly the thing that makes a close's answer
 *     inaccurate: closing on top of a swallowed entry would produce a
 *     close that looks clean and is not.
 *  3. The questions whose answer changes the figures on the screen: a
 *     movement that looks like a charge arrived, a purchase inside a wallet
 *     that may have gone through. A salary confirmed as arrived stops being
 *     counted as still to come.
 *  4. The errands, in a fixed order of their own: entries waiting on a
 *     category (`inbox`) come first because an uncategorised entry keeps
 *     every total that depends on categories wrong, not merely incomplete;
 *     then the accounts the bank shows that nobody has filed, whose rows
 *     reach nothing until then; then last month's statement, for someone
 *     who brings their own; then a consent to renew, said two weeks ahead;
 *     and a repeating charge merely noticed (`proposals`) last — nothing is
 *     blocked or incorrect without it, it is only a suggestion.
 *
 * Recurring charges waiting to be written used to be an errand. They are
 * not anyone's errand any more: the month fills itself from them, so there
 * is nothing here for the reader to go and do.
 */

export type AttentionId =
  | "swallowed"
  | "bankStopped"
  | "close"
  | "arrived"
  | "purchases"
  | "inbox"
  | "accounts"
  | "statement"
  | "bankRenew"
  | "proposals";

/** Le point, opening the month close's sheet. */
export const CLOSE_HREF = "/bearing?close=1";

/** Le point's own cards, where « C'est arrivé ? » and the purchases are. */
export const ARRIVED_HREF = "/bearing#arrived";
export const PURCHASES_HREF = "/bearing#purchases";

/** The strip's order, first to last; see the module note for why. */
const ORDER: readonly AttentionId[] = [
  "swallowed",
  "bankStopped",
  "close",
  "arrived",
  "purchases",
  "inbox",
  "accounts",
  "statement",
  "bankRenew",
  "proposals",
];

export interface AttentionInput {
  /** Bank entries an earlier sync merged away rather than left for review. */
  swallowed: number;
  /** Entries with no category, waiting behind the inbox review. */
  pendingInbox: number;
  /**
   * The next month a close could act on, or null when nothing is open to
   * close. `isBaseline` marks the very first close, which asks for a
   * starting balance rather than confirming a period — a different message
   * and a different action, not merely a different count.
   */
  readyToClose: { monthLabel: string; isBaseline?: boolean } | null;
  /** Charges the feed has noticed repeat, waiting to become a template. */
  proposals: number;
  /** Movements that look like a charge that has arrived, waiting for a yes or a no. */
  arrived?: number;
  /** Purchases inside a wallet whose day has come, waiting to be confirmed. */
  purchases?: number;
  /**
   * Last month's statement, not brought yet, for someone who imports: the
   * month's name, as the reminder says it.
   */
  statementDue?: { month: string } | null;
}

/** What the person's bank asks of them — theirs, never the space's. */
export interface BankAttentionInput {
  /** The connection about to stop, or stopped. */
  bank: BankAttention | null;
  /** Accounts the bank shows that nobody has said anything about yet. */
  awaitingAccounts: number;
}

export interface AttentionItem {
  /** Stable id, and the reason this row exists. */
  id: AttentionId;
  /**
   * Whether this is something gone wrong or merely something outstanding.
   * Only `swallowed` and a bank that stopped are `wrong` — see the ordering
   * note above for why.
   */
  tone: "waiting" | "wrong";
  /** The catalogue key a client passes to `t()`. Never rendered here. */
  messageKey: Key;
  /** The params `t()` needs to fill in `messageKey` and `actionKey`, if any. */
  params?: Vars;
  /** A day the message names, ISO, for the client to format. */
  date?: string;
  /** Where the decision gets made. */
  href: string;
  /** The catalogue key for the row's call to action. */
  actionKey: Key;
}

/**
 * Builds the list of things waiting for the reader, in a fixed priority
 * order — see the module doc comment for what the order means and why.
 *
 * A condition absent from the input (a zero count, a null `readyToClose`)
 * simply produces no item; there is no "everything is fine" item to add,
 * because an empty list already says that, and saying it twice would be the
 * kind of filler this module exists to avoid.
 */
export function buildAttention(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.swallowed > 0) {
    items.push({
      id: "swallowed",
      tone: "wrong",
      messageKey: "month.attentionSwallowed",
      params: { count: input.swallowed },
      href: "/transactions",
      actionKey: "month.actionReopen",
    });
  }

  if (input.readyToClose) {
    const { monthLabel, isBaseline } = input.readyToClose;
    // Le point itself, asked to open the close: the close lives on the
    // momentum card there since it left the Plan.
    items.push(
      isBaseline
        ? {
            id: "close",
            tone: "waiting",
            messageKey: "month.attentionBaseline",
            href: CLOSE_HREF,
            actionKey: "month.actionStart",
          }
        : {
            id: "close",
            tone: "waiting",
            messageKey: "month.attentionReadyToClose",
            params: { month: monthLabel },
            href: CLOSE_HREF,
            actionKey: "month.actionClose",
          },
    );
  }

  if (input.arrived && input.arrived > 0) {
    items.push({
      id: "arrived",
      tone: "waiting",
      messageKey: "month.attentionArrived",
      params: { count: input.arrived },
      href: ARRIVED_HREF,
      actionKey: "month.actionConfirm",
    });
  }

  if (input.purchases && input.purchases > 0) {
    items.push({
      id: "purchases",
      tone: "waiting",
      messageKey: "month.attentionPurchases",
      params: { count: input.purchases },
      href: PURCHASES_HREF,
      actionKey: "month.actionConfirm",
    });
  }

  if (input.pendingInbox > 0) {
    items.push({
      id: "inbox",
      tone: "waiting",
      messageKey: "month.attentionInbox",
      params: { count: input.pendingInbox },
      // The review itself, not the page it lives on — see the web dashboard
      // for why: landing on the Ledger with the inbox still shut behind a
      // second Review button is the same question asked twice.
      href: "/transactions?review=inbox",
      actionKey: "month.actionReview",
    });
  }

  if (input.statementDue) {
    items.push({
      id: "statement",
      tone: "waiting",
      messageKey: "month.attentionStatement",
      params: { month: input.statementDue.month },
      href: "/import",
      actionKey: "month.actionImport",
    });
  }

  if (input.proposals > 0) {
    items.push({
      id: "proposals",
      tone: "waiting",
      messageKey: "month.attentionProposals",
      params: { count: input.proposals },
      href: "/recurring",
      actionKey: "month.actionReview",
    });
  }

  return sortAttention(items);
}

/**
 * What the bank asks, as items of the same list: a consent to renew, a feed
 * that stopped, accounts waiting to be filed. Apart from `buildAttention`
 * because they are the person's, read with their own session, where the
 * rest is the owner on screen's — a space has no bank of its own.
 */
export function bankAttentionItems(input: BankAttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { bank } = input;

  if (bank?.kind === "expired") {
    items.push({
      id: "bankStopped",
      tone: "wrong",
      messageKey: "bankConnect.expiredTitle",
      href: "/bank",
      actionKey: "bankConnect.reconnect",
    });
  } else if (bank?.kind === "paused") {
    items.push({
      id: "bankStopped",
      tone: "wrong",
      messageKey: "bankConnect.pausedBody",
      href: "/bank",
      actionKey: "bankConnect.details",
    });
  } else if (bank?.kind === "renew") {
    items.push(
      bank.daysLeft >= 0
        ? {
            id: "bankRenew",
            tone: "waiting",
            messageKey: "bankConnect.consentSoon",
            date: bank.validUntil,
            href: "/bank",
            actionKey: "bankConnect.renew",
          }
        : {
            id: "bankRenew",
            tone: "waiting",
            messageKey: "bankConnect.consentEnded",
            href: "/bank",
            actionKey: "bankConnect.renew",
          },
    );
  }

  if (input.awaitingAccounts > 0) {
    items.push({
      id: "accounts",
      tone: "waiting",
      messageKey: "bankAccounts.bearingLine",
      params: { count: input.awaitingAccounts },
      href: "/bank",
      actionKey: "bankAccounts.bearingCta",
    });
  }

  return sortAttention(items);
}

/**
 * The strip's order, whatever the items came from: `buildAttention`'s and
 * `bankAttentionItems`'s put together read as one list.
 */
export function sortAttention(items: readonly AttentionItem[]): AttentionItem[] {
  return [...items].sort(
    (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id),
  );
}
