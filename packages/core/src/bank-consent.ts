/**
 * The consent a user gives before Pluclair reads their bank data.
 *
 * Asked at the moment the credentials file is handed over, and recorded with
 * the version of the words that were on screen (`bank_connections`,
 * migration 044). It names the chain the data travels along — the user's
 * bank, Enable Banking Oy (the licensed account information provider),
 * open-banking.io (the user's own account), then Pluclair — says what
 * Pluclair reads and how often it asks the bank, and carries the explicit
 * consent GDPR article 9 needs, because transactions can reveal health,
 * beliefs or union membership.
 *
 * The text itself lives in the catalogues (`bankConnect.consent*`). Change
 * this version whenever that text changes in substance: a connection whose
 * recorded version is not this one is asked again.
 */
export const BANK_CONSENT_VERSION = "2026-10-01";

/** Whether a recorded consent covers the words on screen today. */
export function consentIsCurrent(version: string | null | undefined): boolean {
  return version === BANK_CONSENT_VERSION;
}
