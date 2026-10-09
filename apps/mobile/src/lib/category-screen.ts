import { ACCOUNT_ALLOWANCE, type WriterState } from "@finance/core/ai-models";
import type { CategoryScreen } from "@finance/core/category-screen";
import { MIN_FINDINGS_TO_RANK } from "@finance/core/category-selection";
import type { Locale } from "@finance/core/i18n/locale";
import { writesRemaining } from "@finance/core/month-read-budget";
import { readCategoryScreen } from "@finance/data/category-screen";

import { getWriterState } from "@/lib/ai-writer";
import { announcingFetch } from "@/lib/data-version";
import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * The Ledger's by-category view on the phone.
 *
 * Reading needs no server of ours, as for the month read: the rows, the
 * stored category reads and the band's order all come out of Supabase under
 * row level security, assembled by the same `@finance/data/category-screen`
 * the web page uses. Writing a read or re-ranking the band does need one —
 * the model key lives on the web server — so a press posts to
 * `/api/category-read` or `/api/category-rerank` with the access token the
 * app already holds.
 */

export interface PhoneCategoryScreen {
  screen: CategoryScreen;
  /** Who would write: the user's own AI account, or nobody. */
  writer: WriterState;
  /** Whether a read can be asked for from this build at all. */
  readWritable: boolean;
  /** The category reads' shared allowance, left this month. */
  readWritesLeft: number;
  /** Whether a re-rank can be asked for: a server, a tally, enough to rank. */
  rerankWritable: boolean;
  rerankWritesLeft: number;
}

export async function getCategoryScreen(
  userId: string,
  locale: Locale,
): Promise<PhoneCategoryScreen> {
  const [{ screen, readTally, selection }, writer] = await Promise.all([
    readCategoryScreen(supabase, userId, locale),
    getWriterState(userId),
  ]);
  // Without a writer there is no one to ask; without a tally the call could
  // not be counted, and a call that cannot be counted is not capped.
  return {
    screen,
    writer,
    readWritable: writer.writable && readTally.tracked,
    readWritesLeft: readTally.tracked
      ? writesRemaining(
          {
            writes: readTally.writes,
            refused: 0,
            lastWrittenAt: null,
            pendingSince: null,
          },
          ACCOUNT_ALLOWANCE,
        )
      : 0,
    rerankWritable:
      writer.writable &&
      selection.tracked &&
      screen.allFindings.length >= MIN_FINDINGS_TO_RANK,
    rerankWritesLeft: selection.tracked
      ? writesRemaining(
          selection.tally,
          ACCOUNT_ALLOWANCE,
        )
      : 0,
  };
}

export interface CategoryWriteOutcome {
  written: boolean;
  /** A sentence or a message key; the toast resolves either. */
  message: string | null;
  writesLeft: number | null;
}

/** Long enough for a model to answer, short enough not to hang a press. */
const TIMEOUT_MS = 45_000;

async function askTheWeb(
  path: "/api/category-read" | "/api/category-rerank",
  body: object,
): Promise<CategoryWriteOutcome> {
  const quiet: CategoryWriteOutcome = {
    written: false,
    message: null,
    writesLeft: null,
  };
  if (!WEB_APP_URL) {
    return quiet;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return quiet;
  }

  // An explicit controller rather than AbortSignal.timeout, as the month
  // read has: a build without it would hang the spinner rather than fail.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await announcingFetch(`${WEB_APP_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const answer = (await response.json().catch(() => null)) as {
      written?: boolean;
      message?: string | null;
      error?: string;
      writesLeft?: number;
    } | null;

    if (!response.ok) {
      // Reported rather than thrown: what is on screen is still readable.
      return {
        written: false,
        message: answer?.error ?? "monthRead.writeFailed",
        writesLeft: null,
      };
    }
    return {
      written: answer?.written ?? false,
      message: answer?.message ?? null,
      writesLeft: answer?.writesLeft ?? null,
    };
  } catch {
    return { written: false, message: "monthRead.writeFailed", writesLeft: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Write a read of one category — the web's own writer, through its route. */
export function writeCategoryRead(
  categoryId: string,
): Promise<CategoryWriteOutcome> {
  return askTheWeb("/api/category-read", { categoryId });
}

/** Ask which findings should lead — the web's own re-rank, through its route. */
export function rerankFindings(): Promise<CategoryWriteOutcome> {
  return askTheWeb("/api/category-rerank", {});
}
