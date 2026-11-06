import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseDesign, type Design } from "@finance/core/designs";
import { readDesign } from "@finance/data/preferences";

import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "design";

/**
 * The design this phone was last drawn in, read before the first screen so
 * the app opens in it rather than in « Nuit » corrected a moment later.
 */
export async function loadDesign(): Promise<Design> {
  try {
    return parseDesign(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return parseDesign(null);
  }
}

export async function saveDesign(design: Design): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, design);
  } catch {
    // The row still has it; the next start reads it from there.
  }
}

/** The design this user chose on any of their devices; « Nuit » if none. */
export function fetchStoredDesign(userId: string): Promise<Design> {
  return readDesign(supabase, userId);
}
