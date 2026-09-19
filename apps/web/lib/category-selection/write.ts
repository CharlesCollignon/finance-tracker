import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency, formatMonthLabel, getCurrentMonth } from "@finance/core/constants";
import {
  CATEGORY_SELECTION_COOLDOWN_SECONDS,
  CATEGORY_SELECTION_RESERVATION_SECONDS,
  CATEGORY_SELECTION_WRITES_PER_MONTH,
  findingsDigest,
  MIN_FINDINGS_TO_RANK,
  verifyCategorySelection,
} from "@finance/core/category-selection";
import {
  buildCategorySelectionPrompt,
  CATEGORY_SELECTION_PROMPT_VERSION,
} from "@finance/core/category-selection-prompt";
import {
  decideMonthReadWrite,
  explainWriteRefusal,
  writesRemaining,
} from "@finance/core/month-read-budget";
import type { Database } from "@finance/core/types/database";
import { gatherCategoryFindings } from "@/lib/category-selection/findings";
import { categorySelectionSource } from "@/lib/category-selection/source";
import {
  readCategorySelectionState,
  refundSelection,
  reserveSelection,
  storeSelection,
} from "@/lib/category-selection/store";
import { monthReadConfigured } from "@/lib/month-read/client";
import { getLocale, getT } from "@/lib/locale";

type Client = SupabaseClient<Database>;

/**
 * Ask a model which findings should lead, or say why not.
 *
 * The same order of operations as `category-read/write.ts`, and the same
 * promise: nothing here throws. Every way of not getting an order — no key,
 * no allowance, too few findings to rank, an unreachable model, an answer
 * naming nothing we hold — comes back as `written: false` with a sentence,
 * because the band is already perfectly readable in the app's own order and
 * none of these is an error worth a 500.
 *
 * ## Two findings, not one
 *
 * A band with a single finding cannot be re-ordered, and one with none has
 * nothing to order. Both reach `decideMonthReadWrite` as `thin`, which is the
 * ceiling's own word for "nothing worth spending a call on" and is refused
 * before the model is asked — the same shape the reads use, and the reason
 * that decision takes `{ thin: boolean }` rather than a whole pack.
 */

export interface RerankFindingsOutcome {
  written: boolean;
  /** What to tell the user, when there is anything worth saying. */
  message: string | null;
  writesLeft: number;
}

export async function rerankFindings(
  userId: string,
  client?: Client,
): Promise<RerankFindingsOutcome> {
  const locale = await getLocale();
  const t = await getT();

  if (!monthReadConfigured()) {
    return {
      written: false,
      message: t("categoryRead.noWriter"),
      writesLeft: 0,
    };
  }

  const [state, findings] = await Promise.all([
    readCategorySelectionState(userId, client),
    // `locale` threaded through explicitly rather than read again inside, so
    // that the month labels in the prompt and the instructions around them
    // are one value — the bug `category-read/write.ts` records catching.
    gatherCategoryFindings(userId, client, locale),
  ]);

  const current = getCurrentMonth();
  const monthLabel = formatMonthLabel(current.year, current.month, locale);

  const decision = decideMonthReadWrite({
    tally: state.tally,
    facts: { thin: findings.length < MIN_FINDINGS_TO_RANK },
    now: new Date().toISOString(),
    tracked: state.tracked,
    allowance: CATEGORY_SELECTION_WRITES_PER_MONTH,
    cooldownSeconds: CATEGORY_SELECTION_COOLDOWN_SECONDS,
    reservationSeconds: CATEGORY_SELECTION_RESERVATION_SECONDS,
  });

  if (!decision.write) {
    return {
      written: false,
      message: explainWriteRefusal(decision, monthLabel, locale),
      writesLeft: writesRemaining(
        state.tally,
        CATEGORY_SELECTION_WRITES_PER_MONTH,
      ),
    };
  }

  // Reserved before the call, not counted after it — see `month-read/write.ts`.
  const reserved = await reserveSelection(userId, client);
  if (!reserved || reserved.writes <= state.tally.writes) {
    // The database declined where the pure decision had allowed it: a second
    // press landing first, most often. Its own state is the authority.
    return {
      written: false,
      message: t("monthRead.inFlight"),
      writesLeft: writesRemaining(
        reserved?.tally ?? state.tally,
        CATEGORY_SELECTION_WRITES_PER_MONTH,
      ),
    };
  }

  const prompt = buildCategorySelectionPrompt(findings, {
    // The server has no idea which currency the reader has chosen, and does
    // not need one: nothing the model is shown here ever reaches a screen,
    // and nothing it writes carries a figure at all.
    money: (amount) => formatCurrency(amount, "EUR", locale),
    locale,
  });

  const raw = await categorySelectionSource.write(prompt);

  if (raw === null) {
    // Never reached the provider, or came back unreadable at the envelope
    // level. This is the one case that is refunded: nothing was spent.
    await refundSelection(userId, client);
    return {
      written: false,
      message: t("monthRead.noAnswer"),
      writesLeft: writesRemaining(
        state.tally,
        CATEGORY_SELECTION_WRITES_PER_MONTH,
      ),
    };
  }

  const verdict = verifyCategorySelection(raw, findings, locale);

  if (!verdict.ok) {
    // Kept, not refunded: an answer arrived and cost money. The order that
    // was already stored stays where it is — a rejected answer is a reason to
    // keep what was there, not to throw the band back to its default.
    await storeSelection(
      userId,
      {
        selection: null,
        digest: null,
        model: categorySelectionSource.model,
        promptVersion: CATEGORY_SELECTION_PROMPT_VERSION,
        refusedDelta: 1,
        locale,
      },
      client,
    );

    return {
      written: false,
      message: t("monthRead.unusable"),
      writesLeft: writesRemaining(
        reserved.tally,
        CATEGORY_SELECTION_WRITES_PER_MONTH,
      ),
    };
  }

  await storeSelection(
    userId,
    {
      selection: verdict.selection,
      // Taken over the findings the order was actually chosen from, which is
      // what makes staleness mean anything: when the page's own digest stops
      // matching this one, the stored order describes figures that have
      // moved, and it is not applied.
      digest: findingsDigest(findings),
      model: categorySelectionSource.model,
      promptVersion: CATEGORY_SELECTION_PROMPT_VERSION,
      refusedDelta: 0,
      locale,
    },
    client,
  );

  return {
    written: true,
    message: null,
    writesLeft: writesRemaining(
      reserved.tally,
      CATEGORY_SELECTION_WRITES_PER_MONTH,
    ),
  };
}
