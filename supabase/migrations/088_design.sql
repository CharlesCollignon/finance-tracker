-- 088: the design a person reads Pluclair in, on any device.
--
-- Four looks over the same screens (`packages/core/src/designs.ts`): « Nuit »,
-- the dark back-lit ledger the app has always had, and « Papier », « Bento »
-- and « Console ». One column beside `account_order` (076), for the same
-- reason: the laptop and the phone have to agree. Covered by the table's own
-- row level security (027): a person reads and writes their own row.
--
-- Null for someone who has never chosen, which is answered by the default
-- (« Nuit ») rather than written down. Code reads a missing column as null,
-- so the apps run before this does, in the default design.
--
-- Run after 087. Reverse: alter table user_preferences drop column design;

alter table user_preferences
  add column if not exists design text
    check (design in ('nuit', 'papier', 'bento', 'console'));
