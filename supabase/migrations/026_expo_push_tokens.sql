-- Where to send a notification to somebody's phone.
--
-- `017_push_subscriptions` says, in its own header, that "the mobile app
-- schedules its reminders on the device, so it needs neither of these". That
-- was true of reminders and false of everything else. A reminder is something
-- the phone already knows — a template says rent leaves on the 5th, so the
-- 4th at seven in the evening can be scheduled months ahead. Anything that
-- depends on what the world did cannot be: the overnight bank sync leaving
-- six entries needing a category is news the phone has no way to have, and
-- the app it happened in was silent about it while the browser was told.
--
-- So the phone gets a row here, and the two cron routes fan out to both. The
-- notification_log in 017 is shared and needs no change: it keys what has
-- already been said per user, not per device, which is what makes "said once"
-- mean once across a laptop and a phone rather than once each.

-- One row per device that has granted permission.
create table expo_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Expo's address for this installation, e.g. ExponentPushToken[xxxxxxxx].
  -- Unique because re-registering the same device must update the row rather
  -- than add a second one — Expo hands back the same token for the same
  -- install, and a duplicate would mean two copies of every notification.
  token text not null unique,
  -- 'ios' | 'android'. Kept for reading the table, not for branching on:
  -- Expo's send API takes the token and works out the rest.
  platform text,
  -- Helps a user recognise which device a row is, when revoking one.
  device_name text,
  created_at timestamptz not null default now(),
  -- Touched on each successful send, so a dead row is identifiable even if
  -- Expo never reports DeviceNotRegistered for it.
  last_seen_at timestamptz not null default now()
);

create index expo_push_tokens_user_idx on expo_push_tokens (user_id);

alter table expo_push_tokens enable row level security;

-- The same shape as push_subscriptions: a user owns their own rows, the
-- service role (which bypasses RLS) is what actually reads them to send.
create policy "expo_push_tokens_select_own"
  on expo_push_tokens for select
  using (auth.uid() = user_id);

create policy "expo_push_tokens_insert_own"
  on expo_push_tokens for insert
  with check (auth.uid() = user_id);

create policy "expo_push_tokens_update_own"
  on expo_push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expo_push_tokens_delete_own"
  on expo_push_tokens for delete
  using (auth.uid() = user_id);
