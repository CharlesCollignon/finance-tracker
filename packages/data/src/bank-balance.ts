import {
  balanceBefore,
  cashBalanceAsOf,
  type AccountRows,
  type CashBalance,
  type CloseWaitReason,
} from "@finance/core/bank-balance";
import { countedAccounts } from "@finance/core/bank-accounts";
import { lastDayIsoOfMonth } from "@finance/core/constants";
import type { CloseableMonth } from "@finance/core/month-close";
import type { BankAccount } from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * Every account the connection has ever shown, ticked or not — a person's;
 * or, for a shared space, the joint accounts its partners feed it with
 * (migration 061).
 */
export async function getBankAccounts(
  db: Db,
  userId: string,
): Promise<BankAccount[]> {
  let { data, error } = await db
    .from("bank_accounts")
    .select("*")
    .or(`user_id.eq.${userId},space_id.eq.${userId}`)
    .order("label");
  // Before migration 060 there is no space to ask about: the person's own,
  // so a deployment ahead of its migrations still reads the balance.
  if (error?.code === "42703") {
    ({ data, error } = await db
      .from("bank_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("label"));
  }

  // Before migration 021 this table does not exist, and reading balances is
  // an enhancement to a screen that has to work without it. A surface people
  // use every day must not fall over because an optional feature's migration
  // has not been run yet.
  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as BankAccount[];
}

/**
 * What the counted accounts held at the end of a given day.
 *
 * Reads the stored statement rather than the bank: the figure a close was
 * based on should not change afterwards, the provider's window is finite,
 * and the phone holds no credentials and cannot reach the provider at all.
 *
 * Null when the feature is not set up — no connection, or nobody has said
 * which accounts hold spendable money. That is different from a reading that
 * failed, which comes back as a CashBalance with `ok: false` and the accounts
 * it could not read.
 */
export async function readCashBalance(
  db: Db,
  userId: string,
  date: string,
): Promise<CashBalance | null> {
  const accounts = await getBankAccounts(db, userId);
  const counted = countedAccounts(accounts, userId);

  if (counted.length === 0) {
    return null;
  }

  try {
    return await readAccountBalances(db, userId, counted, date);
  } catch (error) {
    if (isMissingSchema(error as { code?: string; message?: string })) {
      return null;
    }
    throw error;
  }
}

type StatementRow = {
  occurred_on: string;
  balance_after: number | null;
  intraday_index: number;
  amount: number;
  direction: "in" | "out";
};

/**
 * What these accounts held at the end of a day, one account at a time.
 *
 * One at a time because only one row each is needed — the day's last
 * movement, on or before it — and a single capped read across them all let a
 * busy account's movements push a quiet one's out of the page, which then
 * read as empty and held every close.
 *
 * For a day before an account's statement begins, the balance just before
 * its first movement — once its whole history is in, and never before: an
 * account the bank has given a few weeks of would read last year as those
 * weeks' start.
 */
export async function readAccountBalances(
  db: Db,
  userId: string,
  accounts: readonly BankAccount[],
  date: string,
): Promise<CashBalance> {
  const columns =
    "occurred_on, balance_after, intraday_index, amount, direction";
  const read = async (account: BankAccount): Promise<AccountRows> => {
    const last = await db
      .from("bank_feed_items")
      .select(columns)
      .eq("user_id", userId)
      .eq("provider_account_id", account.provider_account_id)
      .lte("occurred_on", date)
      // The day's last movement is its lowest index: a statement is newest
      // first within a day.
      .order("occurred_on", { ascending: false })
      .order("intraday_index", { ascending: true })
      .limit(1);
    if (last.error) {
      throw last.error;
    }
    const rows = (last.data ?? []) as StatementRow[];

    if (rows.length === 0 && account.history_imported_at !== null) {
      const first = await db
        .from("bank_feed_items")
        .select(columns)
        .eq("user_id", userId)
        .eq("provider_account_id", account.provider_account_id)
        .order("occurred_on", { ascending: true })
        .order("intraday_index", { ascending: false })
        .limit(1);
      if (first.error) {
        throw first.error;
      }
      const earliest = (first.data ?? [])[0] as StatementRow | undefined;
      const before = earliest
        ? balanceBefore({
            balanceAfter:
              earliest.balance_after === null
                ? null
                : Number(earliest.balance_after),
            amount: Number(earliest.amount),
            direction: earliest.direction,
          })
        : null;
      if (before !== null) {
        return {
          accountId: account.provider_account_id,
          label: account.label,
          rows: [{ occurredOn: date, balanceAfter: before, intradayIndex: 0 }],
        };
      }
    }

    return {
      accountId: account.provider_account_id,
      label: account.label,
      rows: rows.map((row) => ({
        occurredOn: row.occurred_on,
        balanceAfter:
          row.balance_after === null ? null : Number(row.balance_after),
        intradayIndex: row.intraday_index,
      })),
    };
  };

  // A lapsed consent stores no rows, so it arrives here with an empty list
  // and is reported as unreadable rather than as an empty account.
  return cashBalanceAsOf(await Promise.all(accounts.map(read)), date);
}

/** An account a month close waits on, and why it cannot be read. */
export interface CloseWaitAccount {
  /** « Crédit Agricole · Compte de dépôt ». */
  name: string;
  reason: CloseWaitReason;
}

/**
 * Why the month a close is due for has not closed itself: the counted
 * accounts the statement cannot read on its last day — the day the
 * automatic close reads — each by bank and name. Empty when nothing waits
 * on the bank: no month due yet, no counted account, or one the statement
 * reads in full, which the next sync will close.
 */
export async function readCloseWait(
  db: Db,
  userId: string,
  next: CloseableMonth | null,
  today: string,
): Promise<CloseWaitAccount[]> {
  if (!next || today < next.observeOn) {
    return [];
  }
  const cash = await readCashBalance(
    db,
    userId,
    lastDayIsoOfMonth(next.year, next.month),
  );
  if (!cash || cash.ok) {
    return [];
  }
  const accounts = await getBankAccounts(db, userId);
  return cash.missing.map((entry) => {
    const account = accounts.find(
      (each) => each.provider_account_id === entry.accountId,
    );
    return {
      name: account?.bank_name
        ? `${account.bank_name} · ${entry.label}`
        : entry.label,
      reason: account?.needs_reconnect ? "lapsed" : entry.reason,
    };
  });
}
