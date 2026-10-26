"use server";

import type { ActionResult } from "@finance/core/action-result";
import type { FilingRuleInput } from "@finance/core/validations/filing-rules";
import * as rules from "@finance/data/filing-rules";
import { asOwner } from "@/lib/actions/as-user";

/**
 * The rules a person writes for filing a line (migration 077): the bodies
 * are `@finance/data/filing-rules`, the phone's too. As the owner on
 * screen: a joint account's lines have the space's rules.
 */

export async function addFilingRule(
  input: FilingRuleInput,
): Promise<ActionResult<{ id: string; words: string }>> {
  return asOwner((db, ownerId) => rules.addFilingRule(db, ownerId, input));
}

export async function updateFilingRule(
  id: string,
  input: FilingRuleInput,
): Promise<ActionResult> {
  return asOwner((db, ownerId) =>
    rules.updateFilingRule(db, ownerId, id, input),
  );
}

export async function deleteFilingRule(id: string): Promise<ActionResult> {
  return asOwner((db, ownerId) => rules.deleteFilingRule(db, ownerId, id));
}
