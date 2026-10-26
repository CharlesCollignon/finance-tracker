import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BANK_APP_PACKAGES,
  notificationLines,
  type BankId,
  type BankNotification,
} from "@finance/core/statement";
import type { StatementImportInput } from "@finance/core/validations/statements";

import {
  installedPackages,
  listenerAvailable,
  listenerEnabled,
  takeNotifications,
} from "../../modules/notification-listener";
import { importStatement } from "@/lib/statements";

/** The account the lines go on, as the statements route takes it. */
export type ListenerAccount = StatementImportInput["account"];

/**
 * The bank apps' notifications, read as lines (`docs/plans/STATEMENTS_PLAN.md`,
 * Phase 5): what the listener kept since the app was last open, turned into
 * provisional lines (`@finance/core/statement/notification`) and sent to the
 * statements route as any import, on the account the person chose here.
 * Nothing is read until that account is chosen, so no notification is ever
 * taken from the queue and lost.
 */

const ACCOUNT_KEY = (userId: string) => `listener.account.${userId}`;
const STATS_KEY = (userId: string) => `listener.stats.${userId}`;

export interface ListenerStats {
  /** Milliseconds since the epoch, or null before the first read. */
  lastReadAt: number | null;
  broughtSoFar: number;
}

const NO_STATS: ListenerStats = { lastReadAt: null, broughtSoFar: 0 };

export async function readListenerAccount(
  userId: string,
): Promise<ListenerAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY(userId));
    return raw ? (JSON.parse(raw) as ListenerAccount) : null;
  } catch {
    return null;
  }
}

export async function writeListenerAccount(
  userId: string,
  account: ListenerAccount | null,
): Promise<void> {
  if (account) {
    await AsyncStorage.setItem(ACCOUNT_KEY(userId), JSON.stringify(account));
  } else {
    await AsyncStorage.removeItem(ACCOUNT_KEY(userId));
  }
}

export async function readListenerStats(userId: string): Promise<ListenerStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY(userId));
    return raw ? { ...NO_STATS, ...(JSON.parse(raw) as Partial<ListenerStats>) } : NO_STATS;
  } catch {
    return NO_STATS;
  }
}

/** The bank apps this phone has, among those Pluclair knows. */
export function installedBankApps(): { bank: BankId; packageName: string }[] {
  const known = (Object.entries(BANK_APP_PACKAGES) as [BankId, readonly string[]][]).flatMap(
    ([bank, packages]) => packages.map((packageName) => ({ bank, packageName })),
  );
  const installed = new Set(installedPackages(known.map((app) => app.packageName)));
  return known.filter((app) => installed.has(app.packageName));
}

/** The phone's own day for a moment, YYYY-MM-DD. */
function dayOf(postedAt: number): string {
  const date = new Date(postedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type DrainResult =
  | { kind: "unavailable" }
  | { kind: "noAccount" }
  | { kind: "nothing" }
  | { kind: "read"; brought: number; skipped: number }
  | { kind: "error"; error: string; skipped: number };

/**
 * Everything the listener kept, read and sent. Called when the app comes
 * to the foreground and from the screen's own button; nothing happens
 * without the access, an account, or something waiting.
 */
export async function drainBankNotifications(
  userId: string,
  ownerId: string,
): Promise<DrainResult> {
  if (!listenerAvailable || !listenerEnabled()) {
    return { kind: "unavailable" };
  }
  const account = await readListenerAccount(userId);
  if (!account) {
    return { kind: "noAccount" };
  }
  const kept = takeNotifications();
  if (kept.length === 0) {
    return { kind: "nothing" };
  }
  const notifications: BankNotification[] = kept.map((one) => ({
    packageName: one.packageName,
    title: one.title,
    text: one.text,
    postedAt: one.postedAt,
    postedOn: dayOf(one.postedAt),
  }));
  const { lines, bank, skipped } = notificationLines(notifications);
  if (lines.length === 0) {
    await bump(userId, 0);
    return { kind: "read", brought: 0, skipped };
  }
  const days = lines.map((line) => line.bookingDate ?? "").filter(Boolean).sort();
  const result = await importStatement(
    {
      account,
      // The same shape the web's alert path sends (`takeAlert`).
      lines: lines as StatementImportInput["lines"],
      format: "notification",
      bank,
      fileName: null,
      from: days[0] ?? null,
      to: days[days.length - 1] ?? null,
      closing: null,
      source: "notification",
    },
    ownerId,
  );
  if (!result.ok) {
    return { kind: "error", error: result.error, skipped };
  }
  const brought = result.outcome.matched + result.outcome.filed + result.outcome.waiting;
  await bump(userId, brought);
  return { kind: "read", brought, skipped };
}

async function bump(userId: string, brought: number): Promise<void> {
  const stats = await readListenerStats(userId);
  await AsyncStorage.setItem(
    STATS_KEY(userId),
    JSON.stringify({ lastReadAt: Date.now(), broughtSoFar: stats.broughtSoFar + brought }),
  );
}
