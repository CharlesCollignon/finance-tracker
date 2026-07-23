import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { Database } from "@finance/core/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // AsyncStorage (not SecureStore) because Supabase sessions can exceed
    // SecureStore's 2KB per-key limit. RLS is the real security boundary.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native; there is no browser redirect.
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground, and stop when
// backgrounded — the pattern recommended by the Supabase Expo guide.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
