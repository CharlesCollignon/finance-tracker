// No URL polyfill here: Expo's winter runtime already installs a spec-compliant
// URL/URLSearchParams (whatwg-url-minimum) plus URL.createObjectURL. Importing
// react-native-url-polyfill overwrote those globals with a weaker version.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { Database } from "@finance/core/types/database";
import { announcingFetch } from "@/lib/data-version";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    // Every write tells the screens that read what it wrote — see
    // `lib/data-version.ts` for why this is the one place that happens.
    global: { fetch: announcingFetch },
    auth: {
      experimental: { passkey: true },
      // AsyncStorage (not SecureStore) because Supabase sessions can exceed
      // SecureStore's 2KB per-key limit. RLS is the real security boundary.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based session detection on native; there is no browser redirect.
      detectSessionInUrl: false,
    },
  },
);

// Refresh tokens only while the app is in the foreground, and stop when
// backgrounded — the pattern recommended by the Supabase Expo guide.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
