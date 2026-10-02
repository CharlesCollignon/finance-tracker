import { useEffect, useState } from "react";

import {
  flagsFromRows,
  isFlagOn,
  NO_FLAGS,
  type FlagKey,
  type FlagSet,
} from "@finance/core/flags";

import { useAppForeground } from "@/hooks/useAppForeground";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

/**
 * The flags on for this account, as the database decides them — the same
 * `evaluated_feature_flags()` the web asks (migration 039). Anything short of
 * an answer is every flag off: signed out, the migration not run, a fault.
 * A flag's off side is the app as it was.
 */
async function getFlags(): Promise<FlagSet> {
  const { data, error } = await supabase.rpc("evaluated_feature_flags");
  return error ? NO_FLAGS : flagsFromRows(data);
}

/**
 * Whether one flag is on. Asked when the account changes and again each time
 * the app comes back to the foreground, which is when a flag switched on the
 * server can reach a phone that was already open.
 */
export function useFlag(key: FlagKey): boolean {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [answer, setAnswer] = useState<{
    userId: string;
    flags: FlagSet;
  } | null>(null);
  const [asked, setAsked] = useState(0);
  useAppForeground(() => setAsked((count) => count + 1));

  useEffect(() => {
    if (!userId) {
      return;
    }
    let live = true;
    void getFlags().then((flags) => {
      if (live) {
        setAnswer({ userId, flags });
      }
    });
    return () => {
      live = false;
    };
  }, [userId, asked]);

  return answer !== null && answer.userId === userId && isFlagOn(answer.flags, key);
}
