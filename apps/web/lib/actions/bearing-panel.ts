"use server";

import type { FactFamily } from "@finance/core/bearing-facts";
import type { PanelBlock } from "@finance/core/bearing-panels";
import {
  parseBudgetViewMode,
  parseMonthParams,
} from "@finance/core/constants";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import {
  gatherPanelDetail,
  type PanelDetail,
  type PanelScope,
} from "@/lib/bearing/panel-detail";

/** The longest window the Plan surface will project. */
const MAX_HORIZON = 36;

/**
 * The detail under a tile's figure.
 *
 * Asked for on expand rather than gathered with the page, because a home
 * screen that waited on five families' worth of detail — most of which
 * nobody will open — would be slower for everybody to serve the few who do.
 * The headline is already on screen and already correct; this is only what
 * sits beneath it.
 *
 * No `revalidatePath`: opening a panel changes nothing. This is a Server
 * Function in the reading sense rather than an action — the same `"use
 * server"` mechanism `bearing.ts` uses, minus the write and minus the
 * invalidation that would follow one.
 *
 * `blocks` is the panel's own block list, forwarded so the gatherer can skip
 * the one genuinely expensive block nobody asked for. It is a hint about work
 * and never about access: every read underneath is scoped to the signed-in
 * user, so the worst a lying caller achieves is fetching their own month read
 * when they were not going to draw it.
 *
 * The scope arrives from a browser, so it is re-parsed here through the same
 * helpers the address bar goes through rather than trusted as typed. A
 * nonsense month falls back to this one instead of reaching a query.
 */
export async function bearingPanelAction(
  family: FactFamily,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
): Promise<PanelDetail | null> {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const { year, month } = parseMonthParams(
    String(scope.year),
    String(scope.month),
  );

  const horizon = Number.isInteger(scope.horizon)
    ? Math.min(Math.max(scope.horizon!, 1), MAX_HORIZON)
    : undefined;

  return gatherPanelDetail(
    user.id,
    family,
    { year, month, view: parseBudgetViewMode(scope.view), horizon },
    blocks,
    await getLocale(),
  );
}
