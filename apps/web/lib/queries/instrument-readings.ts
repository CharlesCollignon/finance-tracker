import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingSchema } from "@finance/data/schema";
import type { Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import * as readings from "@finance/data/instrument-readings";

type Client = SupabaseClient<Database>;

export async function getInstrumentReadings(
  userId: string,
  client?: Client,
): Promise<readings.InstrumentReadings> {
  return readings.getInstrumentReadings(
    client ?? (await createClient()),
    userId,
  );
}

/** What is left of this month's reading allowance, and whether it is counted. */
export async function getReadingTally(
  userId: string,
  client?: Client,
): Promise<{ reads: number; pendingSince: string | null; tracked: boolean }> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("instrument_reading_tallies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { reads: 0, pendingSince: null, tracked: false };
    }
    throw error;
  }

  return {
    reads: data?.reads ?? 0,
    pendingSince: data?.pending_since ?? null,
    tracked: true,
  };
}
