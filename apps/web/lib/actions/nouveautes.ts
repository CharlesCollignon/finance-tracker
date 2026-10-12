"use server";

import type { ActionResult } from "@finance/core/action-result";
import {
  CHANGELOG_REACTIONS,
  ROADMAP_VOTE,
  type ReactionKind,
} from "@finance/core/reactions";
import * as preferences from "@finance/data/preferences";
import * as reactions from "@finance/data/reactions";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

/**
 * « Nouveautés » has been read up to `entryId`: the dot in the account menu
 * goes, here and on the phone.
 *
 * No redraw: the page that calls it is the list itself, which has already
 * said what was new; the shell's dot is gone on the next page.
 */
export async function markNouveautesSeen(
  entryId: string,
): Promise<ActionResult> {
  const locale = await getLocale();
  return asUser(
    (db, userId) => preferences.markChangelogSeen(db, userId, entryId, locale),
    { redraw: "never" },
  );
}

/**
 * Say or take back a reaction (`changelog:<id>`: « J'adore », « Utile »,
 * « Enfin ! ») or a vote (`roadmap:<id>`: « J'attends ça »). The page has
 * already drawn the change; a redraw would only take it back.
 */
export async function setNouveautesReaction(
  target: string,
  kind: ReactionKind,
  on: boolean,
): Promise<ActionResult> {
  const allowed = target.startsWith("changelog:")
    ? (CHANGELOG_REACTIONS as readonly string[]).includes(kind)
    : target.startsWith("roadmap:") && kind === ROADMAP_VOTE;
  if (!allowed) {
    return { error: "errors.invalidInput" };
  }
  return asUser(
    (db, userId) => reactions.setReaction(db, userId, target, kind, on),
    { redraw: "never" },
  );
}
