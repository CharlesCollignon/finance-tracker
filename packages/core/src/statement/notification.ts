import type { BankId } from "./banks";
import { messageLineId } from "./line-ids";
import { alertInText } from "./mail";
import type { RawLine } from "./model";

/**
 * A bank app's notification on the phone, read as a line
 * (`docs/plans/STATEMENTS_PLAN.md`, Phase 5): « Paiement de 12,30 € chez
 * MONOP' » becomes a provisional line on the account the person chose, the
 * moment it shows — the words of the alert e-mail, read the same way
 * (`alertInText`), with the bank known from the app that posted it.
 *
 * Android only, and on the phone only: the listener module
 * (`apps/mobile/modules/notification-listener`) keeps the notifications of
 * the apps the person picked and nothing else; this reads them and the
 * phone sends the lines to the statements route as any import. What is not
 * one operation — a balance, a ceiling, an advertisement — is dropped.
 *
 * The package names are the ones the apps publish on the Play Store, as
 * known when this was written; a bank that renames its app is a line this
 * list learns. Unverified on a device until an APK runs it.
 */

/** The Android package names each bank's app goes by. */
export const BANK_APP_PACKAGES: Record<BankId, readonly string[]> = {
  boursobank: ["com.boursorama.android.clients"],
  "credit-agricole": ["fr.creditagricole.androidapp"],
  "bnp-paribas": ["net.bnpparibas.mescomptes"],
  "societe-generale": ["mobi.societegenerale.mobile.lappli"],
  lcl: ["fr.lcl.android.customerarea"],
  "caisse-epargne": ["fr.caissedepargne.android.mobilebanking"],
  "banque-populaire": ["fr.banquepopulaire.cyberplus"],
  "credit-mutuel": ["com.cm_prod.bad"],
  cic: ["com.cic_prod.bad"],
  "la-banque-postale": ["com.fullsix.android.labanquepostale.accountaccess"],
  fortuneo: ["com.fortuneo.android"],
  "hello-bank": ["net.bnpparibas.hellobank"],
  monabanq: ["com.monabanq.mobile"],
  hsbc: ["fr.hsbc.hsbcfrance", "com.hsbc.ccmfr"],
  revolut: ["com.revolut.revolut"],
  n26: ["de.number26.android"],
  qonto: ["fr.qonto.android", "com.qonto.android"],
  shine: ["com.shine.app"],
  nickel: ["com.financierepresselimited.nickel", "fr.nickel.app"],
  sumeria: ["com.lydia", "com.lydiaapp.lydia", "eu.sumeria.app"],
};

/** The bank behind an app's package name, or null. */
export function bankFromPackage(packageName: string): BankId | null {
  const name = packageName.trim().toLowerCase();
  for (const [bank, packages] of Object.entries(BANK_APP_PACKAGES) as [
    BankId,
    readonly string[],
  ][]) {
    if (packages.includes(name)) {
      return bank;
    }
  }
  return null;
}

/** One notification, as the listener kept it. */
export interface BankNotification {
  /** The app's package name. */
  packageName: string;
  title: string;
  text: string;
  /** When it was posted, YYYY-MM-DD in the phone's day. */
  postedOn: string;
  /** Milliseconds since the epoch: what tells two identical ones apart. */
  postedAt: number;
}

/** A line read off a notification, with the id the feed knows it by. */
type NotificationLine = RawLine & { id: string };

export interface NotificationAlert {
  bank: BankId;
  /** The card's or account's last four digits, when the words give them. */
  tail: string | null;
  line: NotificationLine;
}

/**
 * The one operation a notification announces, or null: not a bank's app,
 * or nothing in it that plainly went one way. Its line's id comes from
 * its words and the moment it was posted, so the same notification read
 * twice adds nothing twice.
 */
export function notificationAlert(
  notification: BankNotification,
): NotificationAlert | null {
  const bank = bankFromPackage(notification.packageName);
  if (!bank) {
    return null;
  }
  const alert = alertInText(
    bank,
    `${notification.title}\n${notification.text}`,
    notification.postedOn,
  );
  if (!alert) {
    return null;
  }
  return {
    bank: alert.bank,
    tail: alert.tail,
    line: {
      ...alert.line,
      id: messageLineId(alert.line, `notification:${notification.postedAt}`),
    },
  };
}

/**
 * A batch of notifications as the lines to send, with the bank of the
 * first that read and how many said nothing a line could be made of.
 */
export function notificationLines(notifications: readonly BankNotification[]): {
  lines: NotificationLine[];
  bank: BankId | null;
  skipped: number;
} {
  const lines: NotificationLine[] = [];
  let bank: BankId | null = null;
  let skipped = 0;
  for (const notification of notifications) {
    const alert = notificationAlert(notification);
    if (!alert) {
      skipped += 1;
      continue;
    }
    bank ??= alert.bank;
    lines.push(alert.line);
  }
  return { lines, bank, skipped };
}
