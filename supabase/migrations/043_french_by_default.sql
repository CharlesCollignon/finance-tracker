-- French by default.
--
-- Pluclair is for French users, about French banks, so a preferences row
-- created without a language now speaks French. Until now the default was
-- English, and several writes create the row without naming a language (a
-- currency choice, a dismissed invitation), which quietly set a French
-- reader's app — and the reminders the cron writes for them — to English.
--
-- Existing rows are left as they are: a stored 'en' may be somebody's choice,
-- and nothing here can tell a choice from an old default. To move everyone to
-- French in one go, knowing that it overrides choices too:
--
--   update user_preferences set locale = 'fr';

alter table user_preferences alter column locale set default 'fr';
