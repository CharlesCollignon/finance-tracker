import { aiModel, type WriterState } from "@finance/core/ai-models";
import { flagsFromRows, isFlagOn } from "@finance/core/flags";
import { DEFAULT_WRITER_MODEL, describeModel } from "@finance/core/model-name";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Who would write this user's reads, as a screen needs to know it — the
 * web's `writerStateFor`, read straight from Supabase.
 *
 * Behind `ai.account`. Off, Pluclair's key writes through the web, with its
 * allowances, wherever this build can reach the web at all. On, the user's
 * own AI account does: writable once one is connected, named by its model,
 * with no monthly count. Never the key: the phone only ever learns which
 * model, and whether there is one.
 */
export async function getWriterState(userId: string): Promise<WriterState> {
  const [{ data: rows }, { data: connection }] = await Promise.all([
    supabase.rpc("evaluated_feature_flags"),
    supabase
      .from("ai_connections")
      .select("model")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const reachable = WEB_APP_URL !== null;
  if (!isFlagOn(flagsFromRows(rows), "ai.account")) {
    return {
      account: false,
      writable: reachable,
      name: describeModel(DEFAULT_WRITER_MODEL).brand,
    };
  }
  return {
    account: true,
    writable: reachable && connection !== null,
    name: aiModel(connection?.model).name,
  };
}
