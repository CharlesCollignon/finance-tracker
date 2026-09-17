import type { Key, Vars } from "./i18n/t";

/**
 * What is waiting for the reader, agreed once instead of twice.
 *
 * The dashboard and the Month screen each grew their own list of "things to
 * do" independently, and because the two screens are never seen side by
 * side, nobody noticed that they disagreed: one counted five kinds of thing,
 * the other three, and even the ones both counted were announced in
 * different words, some of them never translated at all. That was
 * survivable while each list only had to be right on its own screen. It
 * stops being survivable once the home spine shows a single item plus
 * "+N" for the rest, because now *which* item comes first is a claim about
 * what matters most, made once, read by both clients.
 *
 * So this module carries no rendered text, only an i18n key and its params
 * — mirroring `resolveSpine`'s refusal to decide anything a client is
 * better placed to decide, here applied to translation rather than pixels.
 * A client calls `t()` on what it is handed; it cannot introduce a fourth
 * wording by improvising its own string, because there is no string here to
 * improvise from.
 *
 * The order is fixed and is the point of the exercise:
 *
 *  1. `wrong` items first. A swallowed bank entry is not an errand, it is a
 *     records problem: something the account did has already gone
 *     unrecorded, silently, and every figure elsewhere in the app is wrong
 *     until it is dealt with. Nothing else here shares that property, so
 *     nothing else outranks it.
 *  2. Closing the month, second. It is the ritual the whole loop is built
 *     on — the one moment the app checks its own bookkeeping against the
 *     bank rather than trusting its own arithmetic — which is enough to
 *     rank it above mere errands. It still ranks below `wrong`, because a
 *     records gap is exactly the thing that makes a close's answer
 *     inaccurate: closing on top of a swallowed entry would produce a
 *     close that looks clean and is not.
 *  3. The three errands, in a fixed order of their own: entries waiting on
 *     a category (`inbox`) come first because an uncategorised entry keeps
 *     every total that depends on categories wrong, not merely incomplete.
 *     Recurring items ready to write (`apply`) come next: money already
 *     committed, sitting unwritten. A repeating charge merely noticed
 *     (`proposals`) comes last — nothing is blocked or incorrect without
 *     it, it is only a suggestion.
 */

export type AttentionId = "swallowed" | "close" | "inbox" | "apply" | "proposals";

export interface AttentionInput {
  /** Bank entries an earlier sync merged away rather than left for review. */
  swallowed: number;
  /** Entries with no category, waiting behind the inbox review. */
  pendingInbox: number;
  /** Recurring items this month's plan is ready to write as rows. */
  recurringToApply: number;
  /**
   * The next month a close could act on, or null when nothing is open to
   * close. `isBaseline` marks the very first close, which asks for a
   * starting balance rather than confirming a period — a different message
   * and a different action, not merely a different count.
   */
  readyToClose: { monthLabel: string; isBaseline?: boolean } | null;
  /** Charges the feed has noticed repeat, waiting to become a template. */
  proposals: number;
}

export interface AttentionItem {
  /** Stable id, and the reason this row exists. */
  id: AttentionId;
  /**
   * Whether this is something gone wrong or merely something outstanding.
   * Only `swallowed` is `wrong` — see the ordering note above for why.
   */
  tone: "waiting" | "wrong";
  /** The catalogue key a client passes to `t()`. Never rendered here. */
  messageKey: Key;
  /** The params `t()` needs to fill in `messageKey`, if any. */
  params?: Vars;
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
    items.push(
      isBaseline
        ? {
            id: "close",
            tone: "waiting",
            messageKey: "month.attentionBaseline",
            href: "/budgets",
            actionKey: "month.actionStart",
          }
        : {
            id: "close",
            tone: "waiting",
            messageKey: "month.attentionReadyToClose",
            params: { month: monthLabel },
            href: "/budgets",
            actionKey: "month.actionClose",
          },
    );
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

  if (input.recurringToApply > 0) {
    items.push({
      id: "apply",
      tone: "waiting",
      messageKey: "month.attentionApply",
      params: { count: input.recurringToApply },
      // The Ledger, not the Charges list: applying writes rows, and the
      // button that writes them lives where the rows land.
      href: "/transactions",
      actionKey: "month.actionApply",
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

  return items;
}
