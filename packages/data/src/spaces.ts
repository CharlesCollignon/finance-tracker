import type { ActionResult } from "@finance/core/action-result";
import type { TransactionWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchemaOrFunction } from "./schema";

/**
 * The shared space (migration 060, `docs/plans/SHARED_SPACE_DESIGN.md`): a
 * space is an owner, so its money is read and written by every other module
 * here handed its id. This is the space itself — making one, inviting to it,
 * joining, leaving — all through the database's own functions, which check
 * membership.
 */

export interface SpaceMember {
  userId: string;
  name: string;
  /** Their part of the joint spending (6b), between 0 and 1. */
  share: number;
}

export interface Space {
  id: string;
  name: string;
  members: SpaceMember[];
}

/** What a link to join says before it is used. */
export interface SpaceInvite {
  spaceId: string;
  spaceName: string;
  invitedBy: string;
  usable: boolean;
}

/**
 * The space this person is in, with its members by name, or null — also
 * where migration 060 is not run.
 */
export async function getMySpace(
  db: Db,
  userId: string,
): Promise<Space | null> {
  const { data: membership, error } = await db
    .from("space_members")
    .select("space_id, spaces(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  if (!membership) {
    return null;
  }
  const { data: people, error: peopleError } = await db.rpc("space_people", {
    target_space: membership.space_id,
  });
  if (peopleError) {
    throw peopleError;
  }
  const space = membership.spaces as { name: string } | null;
  return {
    id: membership.space_id,
    name: space?.name ?? "Commun",
    members: (people ?? []).map((person) => ({
      userId: person.user_id,
      name: person.name ?? "",
      share: Number(person.share),
    })),
  };
}

/** The error a space function raised, as a message key. */
function spaceError(error: { message?: string; code?: string }): string {
  const message = error.message ?? "";
  if (message.includes("already in a space")) {
    return "space.alreadyInOne";
  }
  if (message.includes("space full")) {
    return "space.full";
  }
  if (message.includes("invite not usable")) {
    return "space.inviteUnusable";
  }
  if (message.includes("not signed in")) {
    return "errors.notAuthenticated";
  }
  if (error.code === "42501") {
    return "errors.notAllowed";
  }
  return "errors.couldNotSave";
}

export async function createSpace(
  db: Db,
  name?: string,
): Promise<ActionResult<{ spaceId: string }>> {
  const { data, error } = await db.rpc("create_space", {
    new_name: name?.trim() || "Commun",
  });
  return error
    ? { error: spaceError(error) }
    : { success: true, spaceId: data as string, message: "space.created" };
}

export async function renameSpace(
  db: Db,
  spaceId: string,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    return { error: "space.nameInvalid" };
  }
  const { error } = await db.rpc("rename_space", {
    target_space: spaceId,
    new_name: trimmed,
  });
  return error ? { error: spaceError(error) } : { success: true };
}

/** A link's token, valid seven days, for one person. */
export async function createSpaceInvite(
  db: Db,
  spaceId: string,
): Promise<ActionResult<{ token: string }>> {
  const { data, error } = await db.rpc("create_space_invite", {
    target_space: spaceId,
  });
  return error
    ? { error: spaceError(error) }
    : { success: true, token: data as string };
}

export async function peekSpaceInvite(
  db: Db,
  token: string,
): Promise<SpaceInvite | null> {
  const { data, error } = await db.rpc("peek_space_invite", {
    invite_token: token,
  });
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  const row = (data ?? [])[0];
  return row
    ? {
        spaceId: row.space_id,
        spaceName: row.space_name ?? "Commun",
        invitedBy: row.invited_by ?? "",
        usable: row.usable === true,
      }
    : null;
}

export async function joinSpace(
  db: Db,
  token: string,
): Promise<ActionResult<{ spaceId: string }>> {
  const { data, error } = await db.rpc("join_space", { invite_token: token });
  return error
    ? { error: spaceError(error) }
    : { success: true, spaceId: data as string, message: "space.joined" };
}

/** Leave: the access goes at once; the last one out takes the space. */
export async function leaveSpace(
  db: Db,
  spaceId: string,
): Promise<ActionResult> {
  const { error } = await db.rpc("leave_space", { target_space: spaceId });
  return error
    ? { error: spaceError(error) }
    : { success: true, message: "space.left" };
}

/**
 * The person's part of the joint spending, the partner's being the rest
 * (migration 062). A part, between 0 and 1.
 */
export async function setMyShare(
  db: Db,
  spaceId: string,
  share: number,
): Promise<ActionResult> {
  if (!Number.isFinite(share) || share < 0 || share > 1) {
    return { error: "errors.invalidInput" };
  }
  const { error } = await db.rpc("set_space_share", {
    target_space: spaceId,
    my_share: Math.round(share * 100) / 100,
  });
  return error ? { error: spaceError(error) } : { success: true };
}

/**
 * What « Avec ma part du commun » needs over a span of days: the person's
 * part and the space's rows. Null outside a space — or where migration 060
 * is not run — so the switch is not offered.
 */
export async function readMyShare(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<{ share: number; rows: TransactionWithCategory[] } | null> {
  const { data: membership, error } = await db
    .from("space_members")
    .select("space_id, share")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  if (!membership) {
    return null;
  }
  return {
    share: Number(membership.share),
    rows: await readSpaceRows(db, membership.space_id, { from, to }),
  };
}

/** How many rows one request of the export brings back. */
const EXPORT_PAGE = 1000;

/**
 * Every joint row, oldest first — what a partner takes with them before
 * leaving (the Journal's CSV over the whole space). In pages, because a
 * request returns a thousand rows at most.
 */
export async function readSpaceRows(
  db: Db,
  spaceId: string,
  /** Only these days, both ends included; every row without. */
  span?: { from: string; to: string },
): Promise<TransactionWithCategory[]> {
  const rows: TransactionWithCategory[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    let query = db
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", spaceId);
    if (span) {
      query = query.gte("occurred_on", span.from).lte("occurred_on", span.to);
    }
    const { data, error } = await query
      .order("occurred_on")
      .order("id")
      .range(from, from + EXPORT_PAGE - 1);
    if (error) {
      throw error;
    }
    rows.push(...((data ?? []) as TransactionWithCategory[]));
    if (!data || data.length < EXPORT_PAGE) {
      return rows;
    }
  }
}
