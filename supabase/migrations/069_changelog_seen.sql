-- 069: the newest « Nouveautés » entry this person has seen, on any device.
--
-- The web's account menu and the phone's Profile put a dot on what is new
-- since then, and opening « Nouveautés » moves it to the newest entry. One
-- column beside `milestone_seen` (048), for the same reason: the laptop and
-- the phone have to agree on what was already seen. Covered by the table's
-- own row level security (027): a person reads and writes their own row.
--
-- An entry id (`YYYY-MM-DD-slug`, `packages/core/src/changelog-entries.ts`),
-- or null for someone who has never opened the list. Code reads a missing
-- column as null, so the apps run before this does.
--
-- Run after 068. Reverse: alter table user_preferences drop column changelog_seen;

alter table user_preferences
  add column if not exists changelog_seen text;
