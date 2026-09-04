"use server";

import { z } from "zod";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { revalidateEverySurface } from "@/lib/revalidate-paths";

/**
 * Confirming, refusing and undoing a fulfilment.
 *
 * The whole point of this feature is that nothing here ever runs on its own.
 * An earlier version of the app matched bank rows to recurring templates
 * automatically, on amount and a five-day window, and had to grow a recovery
 * action for the ones it swallowed — so every one of these is the direct
 * result of a press, and the undo is a first-class action rather than an
 * afterthought.
 */

type ActionResult = { error?: string; success?: boolean; message?: string };

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const input = z.object({
  templateId: uuid,
  occurredOn: isoDate,
  transactionId: uuid,
});

/**
 * Whether an error means migration 023 has not run.
 *
 * Reported rather than swallowed here. A silent no-op on a button the user
 * just pressed is the worst of the options: the row would reappear on the
 * next load with no explanation.
 */
function schemaMissing(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

const SETUP_MESSAGE =
  "Confirming charges needs migration 023 — run it and this will work.";

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = input.safeParse({ templateId, occurredOn, transactionId });
  if (!parsed.success) {
    return { error: "Invalid selection" };
  }

  const supabase = await createClient();

  // Verified rather than trusted. The occurrence date and the template come
  // from a form that a stale tab could replay, and the transaction has to be
  // the caller's own — the row is keyed by user id, but a foreign transaction
  // id would otherwise be recorded against it.
  const [{ data: template }, { data: transaction }] = await Promise.all([
    supabase
      .from("recurring_templates")
      .select("id")
      .eq("id", parsed.data.templateId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id")
      .eq("id", parsed.data.transactionId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!template || !transaction) {
    return { error: "That charge is no longer here" };
  }

  const { error } = await supabase.from("recurring_fulfilments").upsert(
    {
      user_id: user.id,
      template_id: parsed.data.templateId,
      occurred_on: parsed.data.occurredOn,
      transaction_id: parsed.data.transactionId,
    },
    { onConflict: "user_id,template_id,occurred_on" },
  );

  if (error) {
    if (schemaMissing(error)) {
      return { error: SETUP_MESSAGE };
    }
    // The unique index on transaction_id is the one worth translating: it
    // means this movement is already standing in for a different occurrence.
    if (error.code === "23505") {
      return {
        error: "That movement is already accounted for by another charge",
      };
    }
    return { error: error.message };
  }

  revalidateEverySurface();
  return { success: true, message: "Counted — it is no longer forecast" };
}

/** No: that is not what this charge was. */
export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = input.safeParse({ templateId, occurredOn, transactionId });
  if (!parsed.success) {
    return { error: "Invalid selection" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("recurring_fulfilment_refusals").upsert(
    {
      user_id: user.id,
      template_id: parsed.data.templateId,
      occurred_on: parsed.data.occurredOn,
      transaction_id: parsed.data.transactionId,
    },
    {
      onConflict: "user_id,template_id,occurred_on,transaction_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    if (schemaMissing(error)) {
      return { error: SETUP_MESSAGE };
    }
    return { error: error.message };
  }

  revalidateEverySurface();
  // Deliberately says what it will and will not do. The refusal names the
  // pair, so a better candidate for the same occurrence is still offered.
  return { success: true, message: "Won't suggest that pairing again" };
}

/** Take a confirmation back, and put the occurrence back in the forecast. */
export async function undoFulfilment(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (
    !uuid.safeParse(templateId).success ||
    !isoDate.safeParse(occurredOn).success
  ) {
    return { error: "Invalid selection" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    if (schemaMissing(error)) {
      return { error: SETUP_MESSAGE };
    }
    return { error: error.message };
  }

  revalidateEverySurface();
  return { success: true, message: "Back in the forecast" };
}
