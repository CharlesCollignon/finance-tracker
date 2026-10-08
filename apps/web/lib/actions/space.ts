"use server";

import { cookies } from "next/headers";
import type { ActionResult } from "@finance/core/action-result";
import { buildLedgerCsv } from "@finance/core/ledger-csv";
import * as spaces from "@finance/data/spaces";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";
import { getOwner } from "@/lib/owner";
import { OWNER_COOKIE, OWNER_COOKIE_OPTIONS } from "@/lib/owner-cookie";
import { revalidateApp } from "@/lib/revalidate-paths";
import { createClient } from "@/lib/supabase/server";

/**
 * The shared space itself (`docs/plans/SHARED_SPACE_DESIGN.md`): making it,
 * naming it, inviting, joining, leaving, and which of the two the shared
 * screens show. The database's functions check membership; these only say
 * who is asking and redraw.
 */

async function rememberOwner(spaceId: string | null): Promise<void> {
  const jar = await cookies();
  if (spaceId) {
    jar.set(OWNER_COOKIE, spaceId, OWNER_COOKIE_OPTIONS);
  } else {
    jar.delete(OWNER_COOKIE);
  }
}

/** « Moi » or « Commun » on the shared screens. */
export async function showJointAction(joint: boolean): Promise<ActionResult> {
  const owner = await getOwner();
  if (!owner) {
    return { error: "errors.notAuthenticated" };
  }
  if (joint && !owner.space) {
    return { error: "errors.notAllowed" };
  }
  await rememberOwner(joint ? owner.space!.id : null);
  revalidateApp();
  return { success: true };
}

export async function createSpaceAction(): Promise<
  ActionResult<{ spaceId: string }>
> {
  return asUser((db) => spaces.createSpace(db));
}

export async function renameSpaceAction(name: string): Promise<ActionResult> {
  const owner = await getOwner();
  if (!owner?.space) {
    return { error: "errors.notAllowed" };
  }
  const spaceId = owner.space.id;
  return asUser((db) => spaces.renameSpace(db, spaceId, name));
}

/** A link to send, valid seven days, for one person. */
export async function createSpaceInviteAction(): Promise<
  ActionResult<{ token: string }>
> {
  const owner = await getOwner();
  if (!owner?.space) {
    return { error: "errors.notAllowed" };
  }
  const spaceId = owner.space.id;
  return asUser((db) => spaces.createSpaceInvite(db, spaceId), {
    redraw: "never",
  });
}

/** Joining from a link — and landing in the space, which is why they came. */
export async function joinSpaceAction(
  token: string,
): Promise<ActionResult<{ spaceId: string }>> {
  const result = await asUser((db) => spaces.joinSpace(db, token));
  if (result.success) {
    await rememberOwner(result.spaceId);
    revalidateApp();
  }
  return result;
}

/** The joint rows as the Journal's CSV, to keep before leaving. */
export async function exportSpaceAction(): Promise<
  ActionResult<{ csv: string; count: number }>
> {
  const owner = await getOwner();
  if (!owner?.space) {
    return { error: "errors.notAllowed" };
  }
  const [rows, locale] = await Promise.all([
    spaces.readSpaceRows(await createClient(), owner.space.id),
    getLocale(),
  ]);
  return {
    success: true,
    csv: buildLedgerCsv(rows, locale),
    count: rows.length,
  };
}

/** Leaving: the access goes at once, and the screens go back to « Moi ». */
export async function leaveSpaceAction(): Promise<ActionResult> {
  const owner = await getOwner();
  if (!owner?.space) {
    return { error: "errors.notAllowed" };
  }
  const spaceId = owner.space.id;
  const result = await asUser((db) => spaces.leaveSpace(db, spaceId));
  if (result.success) {
    await rememberOwner(null);
    revalidateApp();
  }
  return result;
}
