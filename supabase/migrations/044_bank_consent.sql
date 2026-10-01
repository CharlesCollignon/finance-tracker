-- The consent given before Pluclair reads a user's bank data.
--
-- Recorded on the connection: which version of the consent text was on
-- screen, and when it was accepted. The text names the chain the data travels
-- along (the bank, Enable Banking Oy, open-banking.io, Pluclair), what is
-- read and how often the bank is asked, and carries the explicit consent GDPR
-- article 9 requires for data that can reveal health, beliefs or union
-- membership. See `packages/core/src/bank-consent.ts`.
--
-- Null on connections made before this existed: those are asked again.

alter table bank_connections
  add column if not exists consent_version text,
  add column if not exists consent_given_at timestamptz;
