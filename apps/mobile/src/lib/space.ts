import { Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { Locale } from "@finance/core/i18n/locale";
import { buildLedgerCsv } from "@finance/core/ledger-csv";
import { readSpaceRows } from "@finance/data/spaces";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * The shared space's two hand-offs on the phone: the invite link, sent the
 * way the person likes, and the space's rows as the Journal's CSV, offered
 * before leaving it.
 */

/** The link a partner opens to join; null without a web app to open it on. */
export function inviteUrl(token: string): string | null {
  return WEB_APP_URL ? `${WEB_APP_URL}/join/${token}` : null;
}

/** The share sheet, with the link in the message. */
export async function sendInvite(url: string, text: string): Promise<void> {
  try {
    await Share.share({ message: `${text}\n${url}`, url });
  } catch {
    // Closed without sending: nothing to say.
  }
}

/**
 * Every joint row as the Journal's CSV, handed to the share sheet so it can
 * be saved or sent. The number of rows, or null when there was nothing to
 * share it with.
 */
export async function exportSpaceRows(
  spaceId: string,
  name: string,
  locale: Locale,
): Promise<number | null> {
  const rows = await readSpaceRows(supabase, spaceId);
  if (rows.length === 0 || !(await Sharing.isAvailableAsync())) {
    return rows.length === 0 ? 0 : null;
  }
  const file = new File(Paths.cache, `${name.replace(/[^\p{L}\p{N} _-]/gu, "") || "commun"}.csv`);
  file.write(`﻿${buildLedgerCsv(rows, locale)}`);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: name,
    UTI: "public.comma-separated-values-text",
  });
  return rows.length;
}
