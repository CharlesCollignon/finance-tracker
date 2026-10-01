-- What someone wants to be told, and the milestone they have already seen.
--
-- Until now notifications were one switch per device: a browser had granted
-- permission or it had not, a phone had a token or it did not. That was
-- enough while the app said two things — a month has opened, a charge looks
-- arrived — and it is not enough once it says six. Someone who wants the
-- overdraft warning may not want the Monday recap, and the choice should
-- follow them from the laptop to the phone, so it lives on the user's
-- preferences row rather than on a device.
--
-- 1. Per kind, on or off.
--
-- A map from a kind of notification to whether it is wanted. An absent kind
-- is on: every kind the app sends has been chosen to be worth sending, and a
-- new kind added later reaches people without a migration, the way a new
-- screen does. Only an explicit `false` turns one off. The kinds themselves
-- are listed in `packages/core/src/notification-kinds.ts`; the column does
-- not constrain them, so a client one version behind cannot be refused a
-- write by a kind it does not know.

alter table user_preferences
  add column notification_prefs jsonb not null default '{}'::jsonb;

-- 2. The milestone already celebrated.
--
-- A milestone (`palier`) is celebrated once. "Once" was kept per device, in
-- localStorage and AsyncStorage, so the laptop and the phone each celebrated
-- the same 10 000 € — or one of them never did, because the Plan was only
-- ever opened on the other. Stored here, every device agrees, and the push
-- that announces a new one can check the same figure.
--
-- The amount itself rather than an index into the ladder, so a ladder that
-- gains a rung later does not shift what "already seen" means.

alter table user_preferences
  add column milestone_seen numeric(14, 2);
