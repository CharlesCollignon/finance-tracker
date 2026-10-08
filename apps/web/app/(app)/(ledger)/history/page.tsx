import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import {
  MIN_FINDINGS_TO_RANK,
  CATEGORY_SELECTION_WRITES_PER_MONTH,
} from "@finance/core/category-selection";
import { CATEGORY_READ_WRITES_PER_MONTH } from "@finance/core/category-read";
import { writesRemaining } from "@finance/core/month-read-budget";
import { readCategoryScreen } from "@finance/data/category-screen";
import { CategoryHistoryView } from "@/components/finance/category/CategoryHistoryView";
import { getLocale } from "@/lib/locale";
import { ACCOUNT_ALLOWANCE, writerStateFor } from "@/lib/ai/writer";

/**
 * The by-category screen: every category's run, what moved, and a read of
 * one category on request.
 *
 * What it draws is `@finance/data/category-screen`'s, shared with the phone:
 * the rows of the window, the stored reads and the band's order, assembled by
 * `@finance/core/category-screen`. What is the web's own is only what needs
 * this server's configuration — whether a model key exists to offer a read or
 * a re-rank at all.
 */

export default async function HistoryPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const owner = await getOwner();
  const ownerId = owner?.ownerId ?? user.id;
  // The category reads and the re-rank are a person's (their tallies, their
  // rows); only the month read was taken into the joint space.
  const joint = owner?.joint ?? false;
  const [{ screen, readTally, selection }, writer] = await Promise.all([
    readCategoryScreen(supabase, ownerId, locale),
    writerStateFor(user.id, supabase),
  ]);

  /**
   * Whether the panel may offer a read at all — both halves, as the band's
   * re-rank has below, and for the same two failures.
   *
   * No model key and the button would do nothing, so there is none. Migration
   * 035 unapplied and the attempt could not be counted, and a call that
   * cannot be counted is a call that is not capped — so there is none there
   * either. Without the second half the panel showed a disabled button
   * reading "No reads left this month" on a deployment where the allowance is
   * untouched and the table it would be counted in does not exist, which is
   * both a refusal nobody earned and a sentence that is not true.
   */
  const readConfigured = !joint && writer.writable && readTally.tracked;
  const readWritesLeft = readTally.tracked
    ? writesRemaining(
        {
          writes: readTally.writes,
          refused: 0,
          lastWrittenAt: null,
          pendingSince: null,
        },
        writer.account ? ACCOUNT_ALLOWANCE : CATEGORY_READ_WRITES_PER_MONTH,
      )
    : 0;

  /**
   * Whether the band may offer a re-rank at all.
   *
   * Both halves matter, and for different failures. No model key on this
   * deployment and the button would do nothing, so it is absent — the band
   * is then byte-identical to what it showed before this feature existed.
   * Migration 035 unapplied and the attempt could not be counted, and a call
   * that cannot be counted is a call that is not capped, so the button is
   * absent there too rather than present and refusing. Fewer findings than
   * there are ways to order them and there is nothing to ask — the same test
   * the write path makes, from the same constant.
   */
  const rerankConfigured =
    !joint &&
    writer.writable &&
    selection.tracked &&
    screen.allFindings.length >= MIN_FINDINGS_TO_RANK;
  const rerankWritesLeft = selection.tracked
    ? writesRemaining(
        selection.tally,
        writer.account
          ? ACCOUNT_ALLOWANCE
          : CATEGORY_SELECTION_WRITES_PER_MONTH,
      )
    : 0;

  // The header and the views are the Ledger layout's, so they stay put while
  // this loads.
  return (
    <CategoryHistoryView
      cards={screen.cards}
      findings={screen.findings}
      remarks={screen.remarks}
      rerankState={screen.rerankState}
      rerankConfigured={rerankConfigured}
      rerankWritesLeft={rerankWritesLeft}
      breakdown={screen.breakdown}
      breakdownTotal={screen.breakdownTotal}
      behind={screen.behind}
      behindMonth={screen.behindMonth}
      behindMonthLabel={screen.behindMonthLabel}
      reads={screen.reads}
      readFacts={screen.readFacts}
      readLocale={screen.readLocale}
      readThin={screen.readThin}
      readWritesLeft={readWritesLeft}
      readConfigured={readConfigured}
      readWriterBrand={writer.name}
      readAccount={writer.account}
      readModels={screen.readModels}
    />
  );
}
