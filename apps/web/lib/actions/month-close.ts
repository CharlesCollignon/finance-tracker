"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { todayIsoLocal } from "@finance/core/constants";
import {
  monthColumnValue,
  observationDateFor,
  type MonthCloseResult,
} from "@finance/core/month-close";
import {
  closeDaySchema,
  monthCloseSchema,
  unrecordedCapSchema,
} from "@finance/core/validations/month-close";
import {
  getMonthCloseSettings,
  previewMonthClose,
} from "@/lib/queries/month-close";

type ActionResult = { error?: string; success?: boolean; message?: string };

function revalidateCloseDependents(): void {
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}

/**
 * What closing this month with this balance would say, without recording it.
 *
 * The sheet shows the answer before the user commits, because a reconciliation
 * that lands as a surprise after an irreversible-feeling save is a reason not
 * to close next month.
 */
export async function previewMonthCloseAction(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult & { result?: MonthCloseResult }> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid close" };
  }

  try {
    const result = await previewMonthClose(
      user.id,
      parsed.data.year,
      parsed.data.month,
      parsed.data.closingBalance,
    );
    return { success: true, result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not work that out.",
    };
  }
}

export async function recordMonthClose(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult & { result?: MonthCloseResult }> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid close" };
  }

  const settings = await getMonthCloseSettings(user.id);
  const observeOn = observationDateFor(
    parsed.data.year,
    parsed.data.month,
    settings.closeDay,
  );

  // A month cannot be closed before the day its balance is read on: the
  // spending is still landing, and the figure would be measured against a
  // window that has not finished.
  if (todayIsoLocal() < observeOn) {
    return {
      error: `This month can be closed from ${observeOn}, once the last of its spending has landed.`,
    };
  }

  try {
    // Worked out before writing, so a rejected reconciliation is never stored
    // and the reveal is the same figure the row will replay to.
    const result = await previewMonthClose(
      user.id,
      parsed.data.year,
      parsed.data.month,
      parsed.data.closingBalance,
    );

    const supabase = await createClient();
    const { error } = await supabase.from("month_closes").upsert(
      {
        user_id: user.id,
        month: monthColumnValue(parsed.data.year, parsed.data.month),
        closing_balance: parsed.data.closingBalance,
        observed_on: observeOn,
      },
      { onConflict: "user_id,month" },
    );

    if (error) {
      return { error: error.message };
    }

    revalidateCloseDependents();
    return { success: true, result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not close the month.",
    };
  }
}

/** Undo a mistyped balance. The months after it simply re-link. */
export async function deleteMonthClose(
  year: number,
  month: number,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = monthCloseSchema.safeParse({
    year,
    month,
    closingBalance: 0,
  });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("month_closes")
    .delete()
    .eq("user_id", user.id)
    .eq("month", monthColumnValue(parsed.data.year, parsed.data.month));

  if (error) {
    return { error: error.message };
  }

  revalidateCloseDependents();
  return { success: true, message: "Close removed" };
}

export async function updateUnrecordedCap(
  cap: number | null,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = unrecordedCapSchema.safeParse({ cap });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid cap" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("month_close_settings").upsert(
    {
      user_id: user.id,
      unrecorded_cap: parsed.data.cap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidateCloseDependents();
  return {
    success: true,
    message: parsed.data.cap === null ? "Cap removed" : "Cap set",
  };
}

export async function updateCloseDay(closeDay: number): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = closeDaySchema.safeParse({ closeDay });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid day" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("month_close_settings").upsert(
    {
      user_id: user.id,
      close_day: parsed.data.closeDay,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidateCloseDependents();
  return { success: true, message: "Reading day updated" };
}
