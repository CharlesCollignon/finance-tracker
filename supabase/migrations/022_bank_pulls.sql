-- When the bank itself was last asked, as against the copy of it we read.
--
-- Until now "Sync" read open-banking.io's stored statement and never asked
-- the bank for anything. That is fast, free and unlimited, and it is only as
-- fresh as whatever the provider last happened to fetch on its own schedule —
-- so pressing it twice in a minute returned the same rows twice and the app
-- had no way to be more current than it already was.
--
-- The SDK's `syncAll` is the call that actually reaches the bank. It is the
-- one thing here with a real ceiling, and the ceiling is regulatory rather
-- than commercial: under PSD2 an account information service may read an
-- account at most four times a day when the user is not present, and as often
-- as it likes when they are. So the two kinds of pull have to be counted
-- separately, and the count has to outlive the process — a serverless
-- function holds no memory between invocations, and an in-memory guard would
-- reset to zero on every cold start.
--
-- One row per user per day. Bounded by construction, cheap to read, and old
-- rows are a single delete to prune whenever that becomes worth doing.

create table bank_pulls (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The local day the counters below belong to. The unattended allowance is
  -- daily, so the day is the key rather than a column.
  pulled_on date not null,

  -- Pulls made with nobody watching: the cron. These are what the four-a-day
  -- allowance applies to.
  unattended smallint not null default 0 check (unattended >= 0),
  -- Pulls made because someone pressed refresh. Counted for the record and
  -- for a cooldown, not against the allowance.
  attended smallint not null default 0 check (attended >= 0),

  -- The most recent pull of either kind. This, and not the counters, is what
  -- the cooldown is measured from, and what the interface reads to say how
  -- old the figures on screen are.
  last_pulled_at timestamptz not null default now(),

  primary key (user_id, pulled_on)
);

-- Reading the newest row or two for a user, which is the only access pattern:
-- the cooldown has to see across midnight, when today's row does not exist
-- yet and the last pull is on yesterday's.
create index bank_pulls_user_day_idx on bank_pulls (user_id, pulled_on desc);

alter table bank_pulls enable row level security;

create policy "bank_pulls_select_own"
  on bank_pulls for select using (auth.uid() = user_id);

create policy "bank_pulls_insert_own"
  on bank_pulls for insert with check (auth.uid() = user_id);

create policy "bank_pulls_update_own"
  on bank_pulls for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bank_pulls_delete_own"
  on bank_pulls for delete using (auth.uid() = user_id);

-- Record a pull and return the row it landed on.
--
-- A function rather than an upsert from the client, because two refreshes
-- racing must not each read 2 and write 3. `insert … on conflict do update`
-- with the increment computed by Postgres from the stored value takes a row
-- lock and serialises them, so the pair lands as 4.
--
-- security definer so the unattended run can call it under the service role
-- and an ordinary session can call it for itself; the body is confined to the
-- user id it is given, and the grant below is what stops a session passing
-- somebody else's.
create or replace function record_bank_pull(
  target_user uuid,
  was_attended boolean,
  today date
)
returns bank_pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  result bank_pulls;
begin
  if target_user is null or target_user <> coalesce(auth.uid(), target_user) then
    raise exception 'record_bank_pull: not permitted for that user';
  end if;

  insert into bank_pulls (user_id, pulled_on, unattended, attended, last_pulled_at)
  values (
    target_user,
    today,
    case when was_attended then 0 else 1 end,
    case when was_attended then 1 else 0 end,
    now()
  )
  on conflict (user_id, pulled_on) do update
    set unattended = bank_pulls.unattended
          + case when was_attended then 0 else 1 end,
        attended = bank_pulls.attended
          + case when was_attended then 1 else 0 end,
        last_pulled_at = now()
  returning * into result;

  return result;
end;
$$;

-- The service role bypasses RLS and has no auth.uid(), which the guard above
-- allows for exactly that reason. An ordinary session may only ever name
-- itself.
grant execute on function record_bank_pull(uuid, boolean, date) to authenticated, service_role;
