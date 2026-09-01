-- Web push: where to send, and what has already been sent.
--
-- The mobile app schedules its reminders on the device, so it needs neither
-- of these. The web cannot: a browser has to be told by a server, which means
-- keeping the endpoint the push service gave us and remembering what we have
-- already said so a daily job does not repeat itself.

-- 1. One row per browser that has granted permission.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The push service's URL for this browser. Unique because re-subscribing
  -- the same browser must update the row rather than add a second one.
  endpoint text not null unique,
  -- The two keys the payload is encrypted with, base64url as the browser
  -- gives them. Useless without the endpoint, and useless for reading
  -- anything — they only let us write to this one browser.
  p256dh text not null,
  auth text not null,
  -- Helps a user recognise which browser a row is, when revoking one.
  user_agent text,
  created_at timestamptz not null default now(),
  -- Touched on each successful send, so dead rows are identifiable even if a
  -- push service never returns 410.
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- 2. What has already been said.
--
-- The interesting event is crossing a line, not being over it, so a daily job
-- must not repeat yesterday's news. The key encodes the month and the thing
-- it refers to, e.g. "breach:2026-09:<budget id>" or "month-open:2026-09".

create table notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Sends run under the service role, but a user should be able to see what
-- was sent to them; nothing here is writable from the client.
alter table notification_log enable row level security;

create policy "notification_log_select_own"
  on notification_log for select
  using (auth.uid() = user_id);
