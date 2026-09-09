import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency } from "@finance/core/constants";
import {
  arrangementsRemaining,
  BEARING_ARRANGEMENTS_PER_MONTH,
  BEARING_COOLDOWN_SECONDS,
  BEARING_RESERVATION_SECONDS,
  explainArrangementRefusal,
} from "@finance/core/bearing-budget";
import {
  BEARING_PROMPT_VERSION,
  buildArrangementPrompt,
} from "@finance/core/bearing-prompt";
import { verifyArrangement } from "@finance/core/bearing-read";
import { decideMonthReadWrite } from "@finance/core/month-read-budget";
import { factsDigest } from "@finance/core/month-facts";
import type { Database } from "@finance/core/types/database";
import { arrangerConfigured } from "@/lib/bearing/client";
import { gatherBearingFacts } from "@/lib/bearing/facts";
import { arrangementSource } from "@/lib/bearing/source";
import {
  readBearingState,
  refundArrangement,
  reserveArrangement,
  storeArrangement,
} from "@/lib/bearing/store";
import { getLocale, getT } from "@/lib/locale";

type Client = SupabaseClient<Database>;

/**
 * Arrange the Bearing, or say why not.
 *
 * One path, shared by the server action the surface presses and the route the
 * phone posts to, so there is one order of operations and one set of words
 * for every outcome. The shape is `lib/month-read/write.ts` exactly, because
 * the sequence — decide, reserve, ask, verify, store or refund — is the part
 * that must not vary between two features spending the same key.
 *
 * Nothing here throws. Every way of not getting an arrangement — no key, no
 * allowance, a position with nothing in it, an unreachable model, an answer
 * that named a figure that does not exist — comes back as `arranged: false`
 * with a sentence. None of them is an error worth retrying, and in every one
 * of them the surface is still perfectly usable: the app's own ordering is
 * what it falls back to.
 */

export interface ArrangeOutcome {
  arranged: boolean;
  /** What to tell the user, when there is anything worth saying. */
  message: string | null;
  arrangementsLeft: number;
}

export async function arrangeBearing(
  userId: string,
  client?: Client,
): Promise<ArrangeOutcome> {
  const locale = await getLocale();
  const t = await getT();

  if (!arrangerConfigured()) {
    return {
      arranged: false,
      message: t("bearing.noWriter"),
      arrangementsLeft: 0,
    };
  }

  const [{ stored, tracked }, facts] = await Promise.all([
    readBearingState(userId, client),
    gatherBearingFacts(userId, client),
  ]);

  // The shared ceiling, not a second copy of it. Only the allowance and the
  // wording differ between this and a month read, and both are parameters.
  const decision = decideMonthReadWrite({
    tally: stored?.tally ?? null,
    facts,
    now: new Date().toISOString(),
    tracked,
    allowance: BEARING_ARRANGEMENTS_PER_MONTH,
    cooldownSeconds: BEARING_COOLDOWN_SECONDS,
    reservationSeconds: BEARING_RESERVATION_SECONDS,
  });

  if (!decision.write) {
    return {
      arranged: false,
      message: explainArrangementRefusal(decision, locale),
      arrangementsLeft: arrangementsRemaining(stored?.tally ?? null),
    };
  }

  // Reserved before the call, not counted after it. Counting afterwards means
  // any number of concurrent presses all pass the check and all spend.
  const reserved = await reserveArrangement(userId, client);
  const before = stored?.tally.writes ?? 0;
  if (!reserved || reserved.writes <= before) {
    // The database declined where the pure decision had allowed it, which
    // means something changed underneath — usually a second press landing
    // first. Its own state is the authority.
    return {
      arranged: false,
      message: t("bearing.inFlight"),
      arrangementsLeft: arrangementsRemaining(reserved ?? stored?.tally ?? null),
    };
  }

  const prompt = buildArrangementPrompt(facts, {
    // The server has no idea which currency the reader has chosen, and does
    // not need one: nothing the model formats ever reaches a screen.
    money: (amount) => formatCurrency(amount, "EUR", locale),
    locale,
  });

  const raw = await arrangementSource.choose(prompt);

  if (raw === null) {
    // Never reached the provider, or came back unreadable at the envelope
    // level. The one case that is refunded: nothing was spent.
    await refundArrangement(userId, client);
    return {
      arranged: false,
      message: t("bearing.noAnswer"),
      arrangementsLeft: arrangementsRemaining(stored?.tally ?? null),
    };
  }

  const verdict = verifyArrangement(raw, facts, locale);

  if (!verdict.ok) {
    // Kept, not refunded: an answer arrived and cost money. The previous
    // arrangement stays where it is — a rejected answer is a reason to keep
    // what was already there, not to throw the screen back to its default.
    await storeArrangement(
      userId,
      {
        arrangement: null,
        facts: null,
        digest: null,
        dropped: 0,
        model: arrangementSource.model,
        promptVersion: BEARING_PROMPT_VERSION,
        locale,
        refusedDelta: 1,
      },
      client,
    );

    return {
      arranged: false,
      // Named rather than generic, because this is the message worth reading
      // while the prompt is still being tuned.
      message:
        verdict.reason === "unknown-datum"
          ? t("bearing.threwAway", { detail: verdict.detail })
          : t("bearing.unusable"),
      arrangementsLeft: arrangementsRemaining(reserved),
    };
  }

  await storeArrangement(
    userId,
    {
      arrangement: verdict.arrangement,
      facts,
      digest: factsDigest(facts),
      dropped: verdict.dropped.length,
      model: arrangementSource.model,
      promptVersion: BEARING_PROMPT_VERSION,
      locale,
      refusedDelta: 0,
    },
    client,
  );

  return {
    arranged: true,
    message: null,
    arrangementsLeft: arrangementsRemaining(reserved),
  };
}
