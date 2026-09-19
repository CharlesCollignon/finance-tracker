import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency } from "@finance/core/constants";
import {
  CATEGORY_READ_COOLDOWN_SECONDS,
  CATEGORY_READ_RESERVATION_SECONDS,
  CATEGORY_READ_WRITES_PER_MONTH,
  verifyCategoryRead,
} from "@finance/core/category-read";
import {
  buildCategoryReadPrompt,
  CATEGORY_READ_PROMPT_VERSION,
} from "@finance/core/category-read-prompt";
import {
  decideMonthReadWrite,
  explainWriteRefusal,
  writesRemaining,
} from "@finance/core/month-read-budget";
import { factsDigest } from "@finance/core/month-facts";
import type { Database } from "@finance/core/types/database";
import { categoryReadConfigured } from "@/lib/category-read/client";
import { gatherCategoryFacts } from "@/lib/category-read/facts";
import { categoryReadSource } from "@/lib/category-read/source";
import { getLocale, getT } from "@/lib/locale";
import {
  readCategoryReadState,
  refundWrite,
  reserveWrite,
  storeWrite,
} from "@/lib/category-read/store";

type Client = SupabaseClient<Database>;

/**
 * Write a read of one category, or say why not.
 *
 * The same order of operations as `month-read/write.ts`, and the same
 * promise: nothing here throws. Every way of not getting a read — no key, no
 * allowance, a thin category, a category that has gone since the button was
 * pressed, an unreachable model, an answer that invented a figure — comes
 * back as `written: false` with a sentence, because the read the panel
 * already holds is still perfectly readable and none of these is an error
 * worth retrying.
 */

export interface WriteCategoryReadOutcome {
  written: boolean;
  /** What to tell the user, when there is anything worth saying. */
  message: string | null;
  writesLeft: number;
}

export async function writeCategoryRead(
  userId: string,
  categoryId: string,
  client?: Client,
): Promise<WriteCategoryReadOutcome> {
  const locale = await getLocale();
  const t = await getT();

  if (!categoryReadConfigured()) {
    return {
      written: false,
      message: t("categoryRead.noWriter"),
      writesLeft: 0,
    };
  }

  const [state, facts] = await Promise.all([
    readCategoryReadState(userId, categoryId, client),
    // `locale` threaded through explicitly rather than left for
    // `gatherCategoryFacts` to read again on its own: it labels the figures
    // and `buildCategoryReadPrompt` writes the instructions in the same
    // language below, and the two must be the one same value or a French
    // prompt could be sent with English figure labels.
    gatherCategoryFacts(userId, categoryId, client, locale),
  ]);

  if (facts === null) {
    // The category named does not belong to this caller — deleted, most
    // likely, between the panel opening and the button being pressed.
    // Nothing was reserved yet, so there is nothing to refund.
    return {
      written: false,
      message: t("categoryRead.gone"),
      writesLeft: writesRemaining(state.tally, CATEGORY_READ_WRITES_PER_MONTH),
    };
  }

  const decision = decideMonthReadWrite({
    tally: state.tally,
    facts,
    now: new Date().toISOString(),
    tracked: state.tracked,
    allowance: CATEGORY_READ_WRITES_PER_MONTH,
    cooldownSeconds: CATEGORY_READ_COOLDOWN_SECONDS,
    reservationSeconds: CATEGORY_READ_RESERVATION_SECONDS,
  });

  if (!decision.write) {
    return {
      written: false,
      message: explainWriteRefusal(decision, facts.monthLabel, locale),
      writesLeft: writesRemaining(state.tally, CATEGORY_READ_WRITES_PER_MONTH),
    };
  }

  // Reserved before the call, not counted after it — see `month-read/write.ts`.
  const reserved = await reserveWrite(userId, categoryId, client);
  if (!reserved || reserved.writes <= state.writes) {
    // The database declined where the pure decision had allowed it: usually
    // a second press landing first, or the category having gone since the
    // state above was read. Its own state is the authority.
    return {
      written: false,
      message: t("monthRead.inFlight"),
      writesLeft: writesRemaining(
        reserved?.tally ?? state.tally,
        CATEGORY_READ_WRITES_PER_MONTH,
      ),
    };
  }

  const prompt = buildCategoryReadPrompt(facts, {
    // The server has no idea which currency the reader has chosen, and does
    // not need one: nothing the model formats ever reaches a screen.
    money: (amount) => formatCurrency(amount, "EUR", locale),
    locale,
  });

  const raw = await categoryReadSource.write(prompt);

  if (raw === null) {
    // Never reached the provider, or came back unreadable at the envelope
    // level. This is the one case that is refunded: nothing was spent.
    await refundWrite(userId, categoryId, client);
    return {
      written: false,
      message: t("monthRead.noAnswer"),
      writesLeft: writesRemaining(state.tally, CATEGORY_READ_WRITES_PER_MONTH),
    };
  }

  const verdict = verifyCategoryRead(raw, facts, locale);

  if (!verdict.ok) {
    // Kept, not refunded: an answer arrived and cost money. The previous
    // read stays where it is — a rejected answer is a reason to keep what
    // was already there, not to blank the panel.
    await storeWrite(
      userId,
      categoryId,
      {
        read: null,
        facts: null,
        digest: null,
        trimmed: 0,
        model: categoryReadSource.model,
        promptVersion: CATEGORY_READ_PROMPT_VERSION,
        refusedDelta: 1,
        locale,
      },
      client,
    );

    return {
      written: false,
      message:
        verdict.reason === "invented-figure" ||
        verdict.reason === "unknown-datum"
          ? t("monthRead.threwAway", { detail: verdict.detail })
          : t("monthRead.unusable"),
      writesLeft: writesRemaining(reserved.tally, CATEGORY_READ_WRITES_PER_MONTH),
    };
  }

  await storeWrite(
    userId,
    categoryId,
    {
      read: verdict.read,
      facts,
      digest: factsDigest(facts),
      trimmed: verdict.trimmed.length,
      model: categoryReadSource.model,
      promptVersion: CATEGORY_READ_PROMPT_VERSION,
      refusedDelta: 0,
      locale,
    },
    client,
  );

  return {
    written: true,
    message: null,
    writesLeft: writesRemaining(reserved.tally, CATEGORY_READ_WRITES_PER_MONTH),
  };
}
