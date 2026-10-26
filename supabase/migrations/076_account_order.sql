-- 076: the order Placements lists a person's accounts in, on any device.
--
-- Placements leads with the CTO, the PEA and crypto, then the rest
-- (`packages/core/src/account-order.ts`), and anyone can drag the accounts
-- into an order of their own. One column beside `changelog_seen` (069), for
-- the same reason: the laptop and the phone have to agree. Covered by the
-- table's own row level security (027): a person reads and writes their own
-- row.
--
-- Account ids (`pea`, `cto`, `livret_a`…), first to last, or null for
-- someone who has never moved one. Code reads a missing column as null, so
-- the apps run before this does, in the default order.
--
-- Run after 075. Reverse: alter table user_preferences drop column account_order;

alter table user_preferences
  add column if not exists account_order text[];
