import type { Key } from "./i18n/t";

/**
 * What a ledger row can say about itself.
 *
 * A transaction has no state of its own — `transactions` has eight columns and
 * not one of them is a status — so everything a row can claim is a fact stored
 * beside it:
 *
 *   confirmed  a row in `recurring_fulfilments` names this transaction, so the
 *              user has said this movement *is* the occurrence a template
 *              called for. Permanent, and the only one that is a decision.
 *   proposed   `proposeFulfilments` thinks it might be, and is waiting for a
 *              press. Transient: recomputed on every read, and gone the moment
 *              it is answered either way.
 *
 * There is no third member. A row that is neither is simply absent from the
 * index below, which is the honest shape: "nothing to say about this row" is an
 * absence rather than a state, and giving it a name would invite a dot for it.
 */
export type FulfilmentState = "confirmed" | "proposed";

/**
 * Transaction id → what that row can say. Absent means neither.
 *
 * Takes bare ids rather than `FulfilmentProposal[]` for two reasons. A
 * proposal carries twelve fields describing *why* it was offered, none of
 * which a row needs, and on web this data crosses the server/client boundary —
 * where the app's convention is already to hand over plain arrays
 * (`skippedKeys={[...skippedKeys]}`) rather than richer structures. Iterables
 * rather than sets so a caller can pass either without copying.
 *
 * Confirmed is written last and so wins, but only defensively: the two inputs
 * are already disjoint by construction. `proposeFulfilments` is given
 * `claimedTransactionIds`, which excludes the *transaction* and not merely the
 * occurrence key, so a confirmed movement is never offered again. The ordering
 * here guards against that guarantee moving, not a case anyone expects.
 *
 * The confirmed ids are deliberately not month-scoped by their caller.
 * `recurring_fulfilments.occurred_on` is the *occurrence's* date rather than
 * the movement's — a payment on the 31st can fulfil an occurrence dated the
 * 1st — so filtering by the month on screen would drop the mark from the very
 * row that earned it.
 */
export function indexFulfilmentStates(
  proposedTransactionIds: Iterable<string>,
  confirmedTransactionIds: Iterable<string>,
): Map<string, FulfilmentState> {
  const states = new Map<string, FulfilmentState>();

  for (const transactionId of proposedTransactionIds) {
    states.set(transactionId, "proposed");
  }
  for (const transactionId of confirmedTransactionIds) {
    states.set(transactionId, "confirmed");
  }

  return states;
}

/**
 * The dot's colour, by state.
 *
 * Green for settled and orange for outstanding, which is the app's usual
 * reading of those two. Note what is *not* here: the row's amount already
 * carries `TYPE_AMOUNT_CLASS`, where green means income and red means expense,
 * so this deliberately spends no red — a red dot beside a red amount would be
 * two different meanings in one colour. `warning` exists for this and is
 * orange rather than gold for the same reason: gold is the accent, and it is
 * already the tab badge and the stale-figures dot.
 *
 * Class strings rather than tokens because both apps render them straight into
 * `className`. Scanned out of this package by mobile's `tailwind.config.js` and
 * by the `@source` directive in web's `globals.css`.
 */
export const FULFILMENT_DOT_CLASS: Record<FulfilmentState, string> = {
  confirmed: "bg-success",
  proposed: "bg-warning",
};

/**
 * The word for each state.
 *
 * Kept beside the colour rather than at each of the four call sites, so the
 * Ledger's List and Calendar views cannot drift into describing the same row
 * two different ways across two apps.
 *
 * "To confirm" rather than "Waiting on you" for the proposed state: it is
 * shorter, it fits a row's subtitle beside a note, and it names the state the
 * row is in rather than issuing an instruction the row cannot carry out — the
 * press that resolves it lives on the Month screen.
 */
export const FULFILMENT_STATE_KEY: Record<FulfilmentState, Key> = {
  confirmed: "fulfilment.state.confirmed",
  proposed: "fulfilment.state.toConfirm",
};
