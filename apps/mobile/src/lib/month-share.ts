import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { Locale } from "@finance/core/i18n/locale";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * « Relevé du mois » as an image, to the phone's share sheet — as
 * « Votre année » goes. The web draws it (`/api/month-share/image`) for
 * the account in the bearer token and the owner named, with or without
 * the amounts; it is downloaded into the cache, handed on, and kept
 * nowhere else.
 */
export async function shareMonthImage({
  year,
  month,
  locale,
  ownerId,
  withAmounts,
  title,
}: {
  year: number;
  month: number;
  locale: Locale;
  /** Whose month: the person's, or their space's under « Commun ». */
  ownerId: string;
  withAmounts: boolean;
  title: string;
}): Promise<"shared" | "unavailable" | "failed"> {
  if (!WEB_APP_URL || !(await Sharing.isAvailableAsync())) {
    return "unavailable";
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return "failed";
  }
  const query = new URLSearchParams({
    y: String(year),
    m: String(month),
    l: locale,
    owner: ownerId,
    amounts: withAmounts ? "1" : "0",
  });
  try {
    const file = await File.downloadFileAsync(
      `${WEB_APP_URL}/api/month-share/image?${query.toString()}`,
      new File(
        Paths.cache,
        `pluclair-${year}-${String(month).padStart(2, "0")}.png`,
      ),
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
