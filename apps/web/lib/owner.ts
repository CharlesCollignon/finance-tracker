import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getMySpace, type Space } from "@finance/data/spaces";
import { getAuthUser } from "@/lib/auth/get-user";
import { OWNER_COOKIE } from "@/lib/owner-cookie";
import { createClient } from "@/lib/supabase/server";

/**
 * Whose money is on screen: the signed-in person's under « Moi », their
 * space's under « Commun » (`docs/plans/SHARED_SPACE_DESIGN.md`).
 *
 * A space is an owner, so the shared surfaces — Le point, the Journal,
 * Récurrents, the close, the inbox, the categories — read and write with this
 * id where they used to hand the person's. The choice is a cookie, honoured
 * only while the person is a member of that space: one naming a space they
 * left falls back to them.
 */

export interface Owner {
  /** Who is signed in. */
  userId: string;
  /** Whose money the shared surfaces show: the person, or their space. */
  ownerId: string;
  /** The space they are in, or null. */
  space: Space | null;
  /** Whether « Commun » is the view. */
  joint: boolean;
}

/** Request-scoped, like `getAuthUser`. Null for nobody signed in. */
export const getOwner = cache(async (): Promise<Owner | null> => {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }
  const space = await getMySpace(await createClient(), user.id).catch(
    () => null,
  );
  const chosen = (await cookies()).get(OWNER_COOKIE)?.value;
  const joint = space !== null && chosen === space.id;
  return {
    userId: user.id,
    ownerId: joint ? space.id : user.id,
    space,
    joint,
  };
});
