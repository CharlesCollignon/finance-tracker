import { aiModel, type WriterState } from "@finance/core/ai-models";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Who would write this user's reads and answer their questions, as a screen
 * needs to know it — the web's `writerStateFor`, read straight from
 * Supabase: their own connected AI account, named by its model, or nothing,
 * and the screens invite them to connect one. Never the key: the phone only
 * ever learns which model, and whether there is one.
 */
export async function getWriterState(userId: string): Promise<WriterState> {
  const { data: connection } = await supabase
    .from("ai_connections")
    .select("model")
    .eq("user_id", userId)
    .maybeSingle();
  if (connection === null) {
    return { account: false, writable: false, name: "" };
  }
  return {
    account: true,
    writable: WEB_APP_URL !== null,
    name: aiModel(connection.model).name,
  };
}
