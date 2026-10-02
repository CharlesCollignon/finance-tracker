import type { Db } from "@finance/data/client";
import * as fulfilment from "@finance/data/fulfilment";
import type { FulfilmentProposal } from "@finance/core/recurring-fulfilment";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * Which recurring charges the bank looks to have already delivered — the
 * reads are `@finance/data/fulfilment`, shared with the phone. These keep the
 * web's signatures: the request's own client by default, or the one handed
 * in, which is how the unattended digest reads with the service role.
 */

export type { FulfilmentReport } from "@finance/data/fulfilment";

export async function getFulfilledKeys(
  userId: string,
  client?: Db,
): Promise<Set<string>> {
  return fulfilment.getFulfilledKeys(client ?? (await createClient()), userId);
}

export async function getConfirmedTransactionIds(
  userId: string,
  client?: Db,
): Promise<Set<string>> {
  return fulfilment.getConfirmedTransactionIds(
    client ?? (await createClient()),
    userId,
  );
}

export async function getFulfilmentReport(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Db,
): Promise<fulfilment.FulfilmentReport> {
  return fulfilment.getFulfilmentReport(
    client ?? (await createClient()),
    userId,
    templates,
    categories,
    year,
    month,
  );
}

export async function getFulfilmentProposals(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Db,
): Promise<FulfilmentProposal[]> {
  return fulfilment.getFulfilmentProposals(
    client ?? (await createClient()),
    userId,
    templates,
    categories,
    year,
    month,
  );
}

export async function countFulfilmentProposals(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Db,
): Promise<number> {
  return fulfilment.countFulfilmentProposals(
    client ?? (await createClient()),
    userId,
    templates,
    categories,
    year,
    month,
  );
}
