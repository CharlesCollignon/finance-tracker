import { LOCALES } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  buildSpaceBalance,
  type SpaceBalance,
} from "@finance/core/space-balance";

import type { Db } from "./client";
import { isMissingSchemaOrFunction } from "./schema";
import { readSpaceRows, type Space } from "./spaces";

/** The names « Versement au compte commun » has, as the function matches them. */
const TRANSFER_NAMES = LOCALES.map((locale) =>
  translator(locale)("space.transferCategory").trim().toLowerCase(),
);

/**
 * « Équilibre » over a span, for a member of the space: what each partner
 * put into the joint account (`space_contributions`, migration 078), the
 * split, and what the space spent — `buildSpaceBalance` over them. Null
 * before the migration has run.
 */
export async function readSpaceBalance(
  db: Db,
  space: Space,
  from: string,
  to: string,
): Promise<SpaceBalance | null> {
  const [{ data, error }, rows] = await Promise.all([
    db.rpc("space_contributions", {
      target_space: space.id,
      from_day: from,
      to_day: to,
      category_names: TRANSFER_NAMES,
    }),
    readSpaceRows(db, space.id, { from, to }),
  ]);
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  const put = new Map(
    (data ?? []).map((row) => [row.user_id as string, Number(row.total)]),
  );
  const spent = rows
    .filter((row) => row.categories.type === "expense")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  return buildSpaceBalance(
    space.members.map((member) => ({
      userId: member.userId,
      name: member.name,
      share: member.share,
      put: put.get(member.userId) ?? 0,
    })),
    spent,
  );
}
