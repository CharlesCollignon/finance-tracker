"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  DRAIN_COOLDOWN_SECONDS,
  readInstrument,
} from "@/lib/instrument-reading/read";
import type { InstrumentReadStatus } from "@finance/core/instrument-reading";
import { gatherLookThrough } from "@/lib/wallet-read/facts";
import { writeWalletRead } from "@/lib/wallet-read/write";

/**
 * The two presses the look-through surface makes.
 *
 * Both delegate to the shared implementation the phone's routes also call, so
 * there is one order of operations per outcome and one set of words. Actions
 * return result objects and never throw — the house convention, and the right
 * one here because every refusal is an ordinary answer rather than an error.
 */

export interface WalletReadActionResult {
  read: boolean;
  message: string | null;
  readsLeft: number;
}

export async function reviewWallets(): Promise<WalletReadActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { read: false, message: "errors.notAuthenticated", readsLeft: 0 };
  }

  const outcome = await writeWalletRead(user.id);

  if (outcome.read) {
    revalidatePath("/investments/look-through");
  }

  return outcome;
}

export interface ReadInstrumentActionResult {
  /**
   * From the shared union, not a copy of it.
   *
   * This list was written out by hand here and again in `read.ts`, and the
   * two were never quite the same — which is exactly how a refusal to answer
   * *yet* came back looking like a refusal to answer at all. `drainStep` in
   * core is the one place that decides what each of them means.
   */
  status: InstrumentReadStatus;
  /** What is left in the queue afterwards, so the client can pace itself. */
  remaining: number;
}

/**
 * Read the next instrument that needs it.
 *
 * The client does not choose which — it asks for the next one and the queue
 * decides, worst first. That keeps the decision about what is worth spending
 * on in one place, and means a client cannot aim the call at an instrument
 * that does not need reading.
 */
export async function readNextInstrument(): Promise<ReadInstrumentActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { status: "not-authenticated", remaining: 0 };
  }

  const bundle = await gatherLookThrough(user.id);
  const next = bundle.queue[0];

  if (next === undefined) {
    return { status: "nothing-to-read", remaining: 0 };
  }

  const position = bundle.positions.find(
    (row) => row.isin === next && row.marketValue > 0,
  );

  const outcome = await readInstrument(
    user.id,
    next,
    position?.name ?? next,
    bundle.portfolio.columns
      .flatMap((column) => column.items)
      .find((item) => item.isin === next)?.instrumentSymbol ?? null,
    // No quiet period. This action exists to be called in a loop, and the
    // house default would refuse every call after the first — see
    // `DRAIN_COOLDOWN_SECONDS` for why dropping it costs nothing.
    { cooldownSeconds: DRAIN_COOLDOWN_SECONDS },
  );

  if (outcome.status === "read" || outcome.status === "already-fresh") {
    revalidatePath("/investments/look-through");
    revalidatePath("/investments");
  }

  return {
    status: outcome.status,
    // Only an instrument that actually left the queue may shrink the count.
    // A reading that landed left it, and so did one that turned out to be
    // fresh already; every other answer leaves it exactly where it was. The
    // comment here used to claim as much while the arithmetic below it
    // subtracted one unconditionally, so a refused walk reported a queue
    // shorter than the one it had just failed to move.
    remaining:
      outcome.status === "read" || outcome.status === "already-fresh"
        ? Math.max(0, bundle.queue.length - 1)
        : bundle.queue.length,
  };
}
