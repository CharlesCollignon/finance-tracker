import type { Db } from "@finance/data/client";
import * as closes from "@finance/data/month-close";
import type {
  MonthCloseResult,
  RecordedCashFlows,
} from "@finance/core/month-close";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * The month close's reads — `@finance/data/month-close`, shared with the
 * phone — with the web's signatures: the request's client, or the one handed
 * in by the unattended close run, which reads under the service role.
 */

export type {
  ClosedMonthRow,
  MonthCloseOverview,
} from "@finance/data/month-close";

export async function getMonthCloseSettings(
  userId: string,
): Promise<closes.CloseSettings> {
  return closes.getMonthCloseSettings(await createClient(), userId);
}

export async function getRecordedCashFlows(
  userId: string,
  year: number,
  month: number,
  client?: Db,
): Promise<RecordedCashFlows> {
  return closes.getRecordedCashFlows(
    client ?? (await createClient()),
    userId,
    year,
    month,
  );
}

export async function getMonthCloseOverview(
  userId: string,
  today: string,
): Promise<closes.MonthCloseOverview> {
  return closes.getMonthCloseOverview(
    await createClient(),
    userId,
    today,
    await getLocale(),
  );
}

export async function previewMonthClose(
  userId: string,
  year: number,
  month: number,
  closingBalance: number,
): Promise<MonthCloseResult> {
  return closes.previewMonthClose(
    await createClient(),
    userId,
    year,
    month,
    closingBalance,
  );
}
