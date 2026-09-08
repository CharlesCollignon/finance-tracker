-- What language the app speaks to somebody in.
--
-- Every preference in this app has so far lived in the browser or on the
-- phone: the display currency in localStorage, the privacy blur in
-- localStorage, the remembered month in a cookie. That was defensible while
-- every preference only ever affected a screen the person was looking at.
-- Language is the first one that does not.
--
-- The daily digest in `/api/cron/notify` is composed on a server, for
-- somebody who is asleep, from a table of push subscriptions. There is no
-- browser in that request to read a preference out of, and no session either.
-- A locale in localStorage would mean the app speaks French all day and then
-- sends its notifications in English, which is worse than not translating
-- them at all — it reads as a different app.
--
-- Hence a row. Not `user_metadata` on the auth user, which would have been
-- free to read on both clients: the cron job would then have to page the
-- entire auth user list to build a map of who reads what, where one select
-- on this table does it. The web app does not pay for that read on every
-- request either, because the proxy caches the answer in a cookie.
--
-- Named for preferences rather than for the locale so the two that are
-- currently stranded in browser storage have somewhere to move when they are
-- next touched — a currency that does not follow you to a new laptop is a
-- bug that has simply not been filed yet. That move is not this migration.

-- One row per user, created lazily, the same shape and for the same reason as
-- `month_close_settings` in 018: somebody who has never chosen a language has
-- no row, which is the honest state, and is answered by the default rather
-- than by a row full of defaults.
create table user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The language the app is read in. Constrained rather than free text
  -- because both clients switch on it, and a locale nobody has a catalogue
  -- for would fall back silently on every string — a whole app in English
  -- with no indication why. 'en' is the default because it is the source
  -- language, so it is the only one guaranteed to have every message.
  locale text not null default 'en'
    check (locale in ('en', 'fr')),
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "user_preferences_select_own"
  on user_preferences for select using (auth.uid() = user_id);

create policy "user_preferences_insert_own"
  on user_preferences for insert with check (auth.uid() = user_id);

create policy "user_preferences_update_own"
  on user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_preferences_delete_own"
  on user_preferences for delete using (auth.uid() = user_id);
