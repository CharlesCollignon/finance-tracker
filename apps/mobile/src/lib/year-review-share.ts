import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { Locale } from "@finance/core/i18n/locale";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * « Votre année » as an image, to the phone's share sheet. The web draws it
 * (`/api/year-review/image`) — the cards with no amount in them — for the
 * account in the bearer token; it is downloaded into the cache and handed
 * on, and kept nowhere else.
 */
export async function shareYearImage(
  year: number,
  locale: Locale,
  title: string,
): Promise<"shared" | "unavailable" | "failed"> {
  if (!WEB_APP_URL || !(await Sharing.isAvailableAsync())) {
    return "unavailable";
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return "failed";
  }
  try {
    const file = await File.downloadFileAsync(
      `${WEB_APP_URL}/api/year-review/image?y=${year}&l=${locale}`,
      new File(Paths.cache, `pluclair-${year}.png`),
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
        idempotent: true,
      },
    );
    await Sharing.shareAsync(file.uri, {
      mimeType: "image/png",
      dialogTitle: title,
      UTI: "public.png",
    });
    return "shared";
  } catch {
    return "failed";
  }
}
