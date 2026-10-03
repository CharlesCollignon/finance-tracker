import type { ActionResult } from "@finance/core/action-result";

import { getRecurringProposals } from "./bank-inbox";
import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * Answering a standing charge the statement implies: taking it on as a
 * recurring entry, or refusing it for good.
 *
 * The bodies behind the web's actions and the phone's own writes, so both
 * apps make the same template from the same suggestion and keep a refusal
 * the same way. Each takes the client its caller authenticated with, so row
 * level security applies as that user, and none of it revalidates: that is
 * the web action's concern, not the phone's.
 */

/**
 * Make the suggestion a recurring entry. Read again rather than trusted
 * from the screen: what is written is what the statement implies now, and a
 * suggestion taken on elsewhere in the meantime is gone.
 */
export async function acceptRecurringProposal(
  db: Db,
  userId: string,
  key: string,
  today: string,
): Promise<ActionResult<{ name?: string }>> {
  const proposals = await getRecurringProposals(db, userId, today);
  const proposal = proposals.find((candidate) => candidate.key === key);
  if (!proposal) {
    return { error: "actions.suggestionGone" };
  }

  const { error } = await db.from("recurring_templates").insert({
    user_id: userId,
    category_id: proposal.categoryId,
    amount: proposal.amount,
    recurrence: proposal.recurrence,
    day_of_month: proposal.dayOfMonth,
    day_of_week: proposal.dayOfWeek,
    month_of_year:
      proposal.recurrence === "yearly"
        ? Number(proposal.lastSeenOn.slice(5, 7))
        : null,
    description: proposal.label,
    active: true,
  });
  if (error) {
    return { error: dbError(error) };
  }
  return { success: true, name: proposal.label };
}

/**
 * Refuse one suggestion for good. Recorded rather than merely hidden: a
 * refusal that lasts until the next load is not a refusal, which is exactly
 * how these kept coming back.
 */
export async function dismissRecurringProposal(
  db: Db,
  userId: string,
  key: string,
): Promise<ActionResult> {
  if (!key.trim()) {
    return { error: "errors.invalidInput" };
  }
  const { error } = await db
    .from("recurring_proposal_dismissals")
    .upsert(
      { user_id: userId, merchant_key: key.trim() },
      { onConflict: "user_id,merchant_key", ignoreDuplicates: true },
    );
  if (error) {
    return { error: dbError(error) };
  }
  return { success: true, message: "actions.suggestionDismissed" };
}
