"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ActionResult } from "@finance/core/action-result";
import {
  ENTRAIDE_HREF,
  entraideTargetOf,
  isEntraideRule,
} from "@finance/core/entraide";
import { isFlagOn } from "@finance/core/flags";
import { decide } from "@finance/data/entraide-moderation";
import { pushDecision } from "@/lib/entraide-push";
import { getFlags } from "@/lib/flags";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A moderator's decision on Entraide: only for an account with
 * `community.moderate`, and then with the service role, which is what may
 * hide, restore and bar (migration 072). The author and whoever reported
 * are told after the reply has gone back (`lib/entraide-push.ts`).
 */
export async function moderate(
  input:
    | { action: "hide"; target: string; rule: string; facts: string }
    | { action: "keep"; target: string }
    | {
        action: "bar";
        authorId: string;
        target: string;
        rule: string;
        facts: string;
      }
    | { action: "unbar"; authorId: string; target: string },
): Promise<ActionResult> {
  if (!isFlagOn(await getFlags(), "community.moderate")) {
    return { error: "errors.notAllowed" };
  }
  const admin = createAdminClient();
  const target = entraideTargetOf(input.target);
  if (!admin || !target) {
    return { error: admin ? "errors.invalidInput" : "errors.notAllowed" };
  }
  const rule =
    "rule" in input && isEntraideRule(input.rule) ? input.rule : null;
  const facts = "facts" in input ? input.facts.trim() : "";

  const result =
    input.action === "keep"
      ? await decide(admin, { action: "keep", target })
      : input.action === "unbar"
        ? await decide(admin, { action: "unbar", authorId: input.authorId })
        : rule && facts
          ? await decide(
              admin,
              input.action === "hide"
                ? { action: "hide", target, rule, facts }
                : { action: "bar", authorId: input.authorId, rule, facts },
            )
          : null;
  if (!result) {
    return { error: "errors.invalidInput" };
  }
  if (!result.success) {
    return { error: result.error };
  }
  const outcome = result.outcome;
  after(() => pushDecision(outcome, target));
  revalidatePath(ENTRAIDE_HREF);
  revalidatePath(`${ENTRAIDE_HREF}/moderation`);
  return { success: true };
}
