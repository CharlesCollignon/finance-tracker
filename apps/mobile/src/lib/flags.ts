import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  flagsFromRows,
  parseStoredFlags,
  serializeFlags,
  type FlagSet,
} from "@finance/core/flags";

import { supabase } from "@/lib/supabase";

/**
 * Keyed per account, as onboarding is: two people on one phone must never
 * see each other's flags, even for the moment before the fetch answers.
 */
function storageKey(userId: string): string {
  return `flags.${userId}`;
}

/** The last answer this device had for the account, or null. */
export async function loadStoredFlags(userId: string): Promise<FlagSet | null> {
  try {
    return parseStoredFlags(await AsyncStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

/**
 * Asks the database, and keeps the answer for the next launch.
 *
 * Throws when there is no answer (offline, migration 039 not run), so the
 * caller keeps whatever it already had.
 */
export async function fetchFlags(userId: string): Promise<FlagSet> {
  const { data, error } = await supabase.rpc("evaluated_feature_flags");
  if (error) {
    throw error;
  }
  const flags = flagsFromRows(data);
  try {
    await AsyncStorage.setItem(storageKey(userId), serializeFlags(flags));
  } catch {
    // Ignored: the answer still holds for this session.
  }
  return flags;
}
