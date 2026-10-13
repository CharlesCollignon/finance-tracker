"use server";

import type { ActionResult } from "@finance/core/action-result";
import { reactionAllowed, type ReactionKind } from "@finance/core/reactions";
import * as reactions from "@finance/data/reactions";
import { asUser } from "@/lib/actions/as-user";

/**
 * Say or take back a reaction: on « Nouveautés » (`changelog:<id>`:
 * « J'adore », « Utile », « Enfin ! »; `roadmap:<id>`: « J'attends ça »),
 * or in Entraide (`post:<id>`, `reply:<id>`: « Utile », « Merci »). The page
 * has already drawn the change; a redraw would only take it back.
 */
export async function setReaction(
  target: string,
  kind: ReactionKind,
  on: boolean,
): Promise<ActionResult> {
  if (!reactionAllowed(target, kind)) {
    return { error: "errors.invalidInput" };
  }
  return asUser(
    (db, userId) => reactions.setReaction(db, userId, target, kind, on),
    { redraw: "never" },
  );
}
