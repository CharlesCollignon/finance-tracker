import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency } from "@finance/core/constants";
import {
  decideWalletReadWrite,
  explainWalletReadRefusal,
  WALLET_READS_PER_MONTH,
  walletReadsRemaining,
} from "@finance/core/wallet-read-budget";
import {
  WALLET_READ_PROMPT_VERSION,
  buildWalletReadPrompt,
} from "@finance/core/wallet-read-prompt";
import { verifyWalletRead } from "@finance/core/wallet-read";
import { namesInWalletReadPrompt } from "@finance/core/wallet-read-prompt";
import { factsDigest } from "@finance/core/month-facts";
import type { Database } from "@finance/core/types/database";
import { readSource } from "@/lib/ai/read-source";
import { ACCOUNT_ALLOWANCE, writerFor } from "@/lib/ai/writer";
import { createClient } from "@/lib/supabase/server";
import { WALLET_READ_SOURCE } from "@/lib/wallet-read/client";
import { gatherLookThrough } from "@/lib/wallet-read/facts";
import {
  readWalletReadState,
  refundWalletRead,
  reserveWalletRead,
  storeWalletRead,
} from "@/lib/wallet-read/store";
import { getLocale, getT } from "@/lib/locale";

type Client = SupabaseClient<Database>;

/**
 * Read the wallets, or say why not.
 *
 * One path, shared by the server action the surface presses and the route the
 * phone posts to, so there is one order of operations and one set of words
 * for every outcome. The shape is `lib/month-read/write.ts` exactly, because the
 * sequence — decide, reserve, ask, verify, store or refund — is the part that
 * must not vary between features spending the same key.
 *
 * Nothing here throws. Every way of not getting a read — no key, no
 * allowance, a portfolio nothing has been read for, an unreachable model, an
 * answer that named a figure or invented a fund — comes back as
 * `read: false` with a sentence. None is an error worth retrying, and in
 * every one of them the surface is still entirely usable: the look-through
 * and the app's own target are what it falls back to.
 */

export interface WalletReadOutcome {
  read: boolean;
  /** What to tell the user, when there is anything worth saying. */
  message: string | null;
  readsLeft: number;
}

export async function writeWalletRead(
  userId: string,
  client?: Client,
): Promise<WalletReadOutcome> {
  const locale = await getLocale();
  const t = await getT();

  const { writer, account } = await writerFor(
    userId,
    client ?? (await createClient()),
  );
  if (!writer) {
    return {
      read: false,
      message: account ? t("aiAccount.connectFirst") : t("walletRead.noWriter"),
      readsLeft: 0,
    };
  }
  const allowance = account ? ACCOUNT_ALLOWANCE : WALLET_READS_PER_MONTH;
  const source = readSource(WALLET_READ_SOURCE, writer);

  const [{ stored, tracked }, bundle] = await Promise.all([
    readWalletReadState(userId, client),
    gatherLookThrough(userId, client),
  ]);

  const { facts, lookThrough } = bundle;

  const decision = decideWalletReadWrite({
    tally: stored?.tally ?? null,
    facts,
    storedDigest: stored?.read ? stored.factsDigest : null,
    now: new Date().toISOString(),
    tracked,
    allowance,
  });

  if (!decision.write) {
    return {
      read: false,
      message: explainWalletReadRefusal(decision, locale),
      readsLeft: walletReadsRemaining(stored?.tally ?? null, allowance),
    };
  }

  // Reserved before the call, not counted after it. Counting afterwards means
  // any number of concurrent presses all pass the check and all spend.
  const reserved = await reserveWalletRead(userId, client, allowance);
  const before = stored?.tally.writes ?? 0;
  if (!reserved || reserved.writes <= before) {
    // The database declined where the pure decision had allowed it, which
    // means something changed underneath — usually a second press landing
    // first. Its own state is the authority.
    return {
      read: false,
      message: t("walletRead.inFlight"),
      readsLeft: walletReadsRemaining(
        reserved ?? stored?.tally ?? null,
        allowance,
      ),
    };
  }

  const prompt = buildWalletReadPrompt(facts, lookThrough, {
    // The server has no idea which currency the reader has chosen, and does
    // not need one: nothing the model formats ever reaches a screen.
    money: (amount) => formatCurrency(amount, "EUR", locale),
    locale,
    wallets: bundle.walletsInUse,
  });

  const raw = await source.write(prompt);

  if (raw === null) {
    // Never reached the provider, or came back unreadable at the envelope
    // level. The one case that is refunded: nothing was spent.
    await refundWalletRead(userId, client);
    return {
      read: false,
      message: t("walletRead.noAnswer"),
      readsLeft: walletReadsRemaining(stored?.tally ?? null, allowance),
    };
  }

  const verdict = verifyWalletRead(raw, facts, locale, {
    names: namesInWalletReadPrompt(lookThrough),
  });

  if (!verdict.ok) {
    // The reason, on the server, once — never the answer itself, which can
    // quote the prompt back. Without it every refusal was the same sentence
    // and the one that kept recurring could not be told from the others.
    console.warn(
      `[wallet-read] answer refused (${verdict.reason}): ${
        verdict.issue ?? verdict.detail
      }`,
    );
    // Kept, not refunded: an answer arrived and cost money. The previous read
    // stays where it is — a rejected answer is a reason to keep what was
    // already there, not to throw the surface back to silence.
    await storeWalletRead(
      userId,
      {
        read: null,
        facts: null,
        digest: null,
        dropped: 0,
        model: source.model,
        promptVersion: WALLET_READ_PROMPT_VERSION,
        locale,
        refusedDelta: 1,
      },
      client,
    );

    return {
      read: false,
      // Always named: « n'a pas pu être utilisée » alone gave the reader
      // nothing to report and the prompt nothing to fix.
      message: t("walletRead.threwAway", { detail: verdict.detail }),
      readsLeft: walletReadsRemaining(reserved, allowance),
    };
  }

  await storeWalletRead(
    userId,
    {
      read: verdict.read,
      facts,
      digest: factsDigest(facts),
      dropped: verdict.dropped.length,
      model: source.model,
      promptVersion: WALLET_READ_PROMPT_VERSION,
      locale,
      refusedDelta: 0,
    },
    client,
  );

  return {
    read: true,
    message: null,
    readsLeft: walletReadsRemaining(reserved, allowance),
  };
}
