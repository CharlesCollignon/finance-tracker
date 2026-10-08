"use server";

import type { ActionResult } from "@finance/core/action-result";
import { todayIsoLocal } from "@finance/core/constants";
import { setupPrompt, type SetupStep } from "@finance/core/setup-steps";
import { recordActivity } from "@finance/data/activity";
import { saveBalanceReading } from "@finance/data/balance-reading";
import { dismissPrompt } from "@finance/data/preferences";
import { asUser } from "@/lib/actions/as-user";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";

const STEPS: readonly Exclude<SetupStep, "bank">[] = [
  "balance",
  "salary",
  "charges",
  "close",
];

/** What the account holds today, typed on Le point's setup card. */
export async function saveBalanceReadingAction(
  amount: number,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    saveBalanceReading(db, userId, { amount, today: todayIsoLocal() }),
  );
}

/** « Plus tard »: put one setup card away, for good and on every device. */
export async function dismissSetupStep(step: string): Promise<ActionResult> {
  const known = STEPS.find((candidate) => candidate === step);
  if (!known) {
    return { error: "errors.invalidInput" };
  }
  const locale = await getLocale();
  return asUser((db, userId) =>
    dismissPrompt(db, userId, setupPrompt(known), locale),
  );
}

/** « Puis-je me permettre ? » opened: counted for the audience figures. */
export async function recordAffordAsked(): Promise<void> {
  await recordActivity(await createClient(), "afford");
}
