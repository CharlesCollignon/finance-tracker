import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency, formatMonthLabel } from "@finance/core/constants";
import {
  decideMonthReadWrite,
  explainWriteRefusal,
  MONTH_READ_WRITES_PER_MONTH,
  writesRemaining,
} from "@finance/core/month-read-budget";
import { factsDigest } from "@finance/core/month-facts";
import { verifyMonthRead } from "@finance/core/month-read";
import {
  buildMonthReadPrompt,
  MONTH_READ_PROMPT_VERSION,
} from "@finance/core/month-read-prompt";
import type { Database } from "@finance/core/types/database";
import { readSource } from "@/lib/ai/read-source";
import { ACCOUNT_ALLOWANCE, writerFor } from "@/lib/ai/writer";
import { MONTH_READ_SOURCE } from "@/lib/month-read/client";
import { gatherMonthFacts } from "@/lib/month-read/facts";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getT } from "@/lib/locale";
import {
  readMonthReadState,
  refundWrite,
  reserveWrite,
  storeWrite,
} from "@/lib/month-read/store";

type Client = SupabaseClient<Database>;

/**
 * Write a month read, or say why not.
 *
 * One path, shared by the server action the web card presses and the route
 * the phone posts to, so there is one order of operations and one set of
 * words for every outcome.
 *
 * Nothing here throws. Every way of not getting a read — no key, no
 * allowance, a thin month, an unreachable model, an answer that invented a
 * figure — comes back as `written: false` with a sentence, because the read
 * the app already holds is still perfectly readable and none of these is an
 * error worth retrying.
 */

export interface WriteMonthReadOutcome {
  written: boolean;
  /** What to tell the user, when there is anything worth saying. */
  message: string | null;
  writesLeft: number;
}

export async function writeMonthRead(
  /** Whose month: a person, or their space (migration 060). */
  userId: string,
  year: number,
  month: number,
  client?: Client,
  /**
   * Whose AI account writes it, when not the owner's: a joint month is
   * written with the account of the partner who asked, on the space's own
   * quota.
   */
  writerId: string = userId,
): Promise<WriteMonthReadOutcome> {
  const locale = await getLocale();
  const t = await getT();
  const monthLabel = formatMonthLabel(year, month, locale);

  const { writer, account } = await writerFor(
    writerId,
    client ?? (await createClient()),
  );
  if (!writer) {
    return {
      written: false,
      message: account ? t("aiAccount.connectFirst") : t("monthRead.noWriter"),
      writesLeft: 0,
    };
  }
  const allowance = account ? ACCOUNT_ALLOWANCE : MONTH_READ_WRITES_PER_MONTH;
  const source = readSource(MONTH_READ_SOURCE, writer);

  const [{ stored, tracked }, facts] = await Promise.all([
    readMonthReadState(userId, year, month, client),
    gatherMonthFacts(userId, year, month, client),
  ]);

  const decision = decideMonthReadWrite({
    tally: stored?.tally ?? null,
    facts,
    now: new Date().toISOString(),
    tracked,
    allowance,
  });

  if (!decision.write) {
    return {
      written: false,
      message: explainWriteRefusal(decision, monthLabel, locale),
      writesLeft: writesRemaining(stored?.tally ?? null, allowance),
    };
  }

  // Reserved before the call, not counted after it. Counting afterwards means
  // any number of concurrent presses all pass the check and all spend.
  const reserved = await reserveWrite(userId, year, month, client, allowance);
  const before = stored?.tally.writes ?? 0;
  if (!reserved || reserved.writes <= before) {
    // The database declined where the pure decision had allowed it, which
    // means something changed underneath — usually a second press landing
    // first. Its own state is the authority.
    return {
      written: false,
      message: t("monthRead.inFlight"),
      writesLeft: writesRemaining(reserved ?? stored?.tally ?? null, allowance),
    };
  }

  const prompt = buildMonthReadPrompt(facts, {
    // The server has no idea which currency the reader has chosen, and does
    // not need one: nothing the model formats ever reaches a screen.
    money: (amount) => formatCurrency(amount, "EUR", locale),
    // The language, unlike the currency, is not a formatting detail the
    // server can ignore: it decides which language the prose comes back in,
    // and which glossary the model is held to.
    locale,
  });

  const raw = await source.write(prompt);

  if (raw === null) {
    // Never reached the provider, or came back unreadable at the envelope
    // level. This is the one case that is refunded: nothing was spent.
    await refundWrite(userId, year, month, client);
    return {
      written: false,
      message: t("monthRead.noAnswer"),
      writesLeft: writesRemaining(stored?.tally ?? null, allowance),
    };
  }

  const verdict = verifyMonthRead(raw, facts, locale);

  if (!verdict.ok) {
    // Kept, not refunded: an answer arrived and cost money. The previous
    // read stays where it is — a rejected answer is a reason to keep what
    // was already there, not to blank the card.
    await storeWrite(
      userId,
      year,
      month,
      {
        read: null,
        facts: null,
        digest: null,
        trimmed: 0,
        model: source.model,
        promptVersion: MONTH_READ_PROMPT_VERSION,
        refusedDelta: 1,
        locale,
      },
      client,
    );

    return {
      written: false,
      // Named rather than generic, because this is the message worth reading
      // while the prompt is still being tuned.
      message:
        verdict.reason === "invented-figure" ||
        verdict.reason === "unknown-datum"
          ? t("monthRead.threwAway", { detail: verdict.detail })
          : t("monthRead.unusable"),
      writesLeft: writesRemaining(reserved, allowance),
    };
  }

  await storeWrite(
    userId,
    year,
    month,
    {
      read: verdict.read,
      facts,
      digest: factsDigest(facts),
      trimmed: verdict.trimmed.length,
      model: source.model,
      promptVersion: MONTH_READ_PROMPT_VERSION,
      refusedDelta: 0,
      locale,
    },
    client,
  );

  return {
    written: true,
    message: null,
    writesLeft: writesRemaining(reserved, allowance),
  };
}
