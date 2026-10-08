-- 058: first-party audience measurement (docs/plans/EVERYDAY_PLAN.md,
-- Phase 1).
--
-- Whether Pluclair is used, not what it is used on: one row per person and
-- day the app is opened, and a count of a few things done that day (a
-- transaction added, a month closed, « Puis-je me permettre ? » asked). No
-- amount, shop, category or free text, ever.
--
-- The row does not name the person. Its `actor` is a SHA-256 of the account
-- id with a salt drawn once for this database and kept where no client can
-- read it, so the rows cannot be joined back to an account from outside the
-- database, and inside it only through the one function that writes them.
-- What they are for is three figures (`insights.figures`): day-30
-- retention, the share of the week's users who open the app on three days or
-- more, and the share who close their month.
--
-- Written by `record_activity`, called by both apps as the signed-in user,
-- which writes nothing for someone who turned « Mesure d'audience » off in
-- Profile (`user_preferences.measure_audience`). Kept 13 months
-- (`sweep_activity`, from the nightly sweep), and gone with the account.
--
-- The `insights` schema is not exposed through the API: the owner reads the
-- figures from the SQL editor.
--
-- Reversible:
--   drop trigger if exists forget_activity on auth.users;
--   drop function public.record_activity(text), public.sweep_activity(),
--     insights.forget_actor();
--   drop schema insights cascade;
--   alter table user_preferences drop column measure_audience;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/058_audience_measurement.test.sql`.

create schema if not exists insights;
revoke all on schema insights from public, anon, authenticated;

-- One salt for the database, drawn here and never shown to a client.
create table if not exists insights.salt (
  only_row boolean primary key default true check (only_row),
  salt text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into insights.salt default values on conflict do nothing;

create table if not exists insights.activity_days (
  actor text not null,
  day date not null,
  -- How many times each counted thing was done that day, by name.
  events jsonb not null default '{}'::jsonb,
  primary key (actor, day)
);
create index if not exists activity_days_day_idx on insights.activity_days (day);

-- Out of the API's reach already (the schema is not exposed, and its use is
-- revoked above), and locked as well: row level security with no policy
-- lets no client role read or write a row. The functions below run as the
-- tables' owner, which it does not stop.
alter table insights.salt enable row level security;
alter table insights.activity_days enable row level security;

-- The switch in Profile. On unless turned off, as the privacy policy says.
alter table user_preferences
  add column if not exists measure_audience boolean not null default true;

/** The actor a user's rows are kept under. */
create or replace function insights.actor_of(who uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest((select s.salt from insights.salt s) || who::text, 'sha256'),
    'hex'
  );
$$;
revoke all on function insights.actor_of(uuid) from public, anon, authenticated;

-- The signed-in user opened the app today, and — when `event` is given —
-- did one of the counted things. Anything else is ignored rather than
-- refused: a client older or newer than this list must not fail a save.
create or replace function public.record_activity(event text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  today date := (now() at time zone 'Europe/Paris')::date;
begin
  if who is null then
    return;
  end if;
  if event is not null and event not in ('add', 'close', 'afford') then
    event := null;
  end if;
  if exists (
    select 1 from public.user_preferences p
    where p.user_id = who and p.measure_audience = false
  ) then
    return;
  end if;

  insert into insights.activity_days as a (actor, day, events)
  values (
    insights.actor_of(who),
    today,
    case when event is null then '{}'::jsonb else jsonb_build_object(event, 1) end
  )
  on conflict (actor, day) do update
    set events = case
      when event is null then a.events
      else jsonb_set(
        a.events,
        array[event],
        to_jsonb(coalesce((a.events ->> event)::int, 0) + 1)
      )
    end;
end;
$$;
revoke all on function public.record_activity(text) from public, anon;
grant execute on function public.record_activity(text) to authenticated;

-- Thirteen months, then gone: what the nightly sweep calls.
create or replace function public.sweep_activity()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  delete from insights.activity_days
  where day < ((now() at time zone 'Europe/Paris')::date - interval '13 months');
  get diagnostics gone = row_count;
  return gone;
end;
$$;
revoke all on function public.sweep_activity() from public, anon, authenticated;
grant execute on function public.sweep_activity() to service_role;

-- An account deleted takes its rows with it.
create or replace function insights.forget_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from insights.activity_days where actor = insights.actor_of(old.id);
  return old;
end;
$$;
drop trigger if exists forget_activity on auth.users;
create trigger forget_activity
  after delete on auth.users
  for each row execute function insights.forget_actor();

-- The three figures. Read with `select * from insights.figures;`.
--
--   day30_pct   of the people first seen 28 days ago or more, the share who
--               opened the app again 28 days or more after their first day
--   habit_pct   of the people who opened it in the last 7 days, the share
--               who did on 3 days or more
--   closed_pct  of the people who opened it in the last 35 days, the share
--               who closed a month in them
create or replace view insights.figures as
with
  today as (select (now() at time zone 'Europe/Paris')::date as day),
  firsts as (
    select actor, min(day) as first_day
    from insights.activity_days
    group by actor
  ),
  week as (
    select actor, count(*) as days
    from insights.activity_days, today
    where activity_days.day > today.day - 7
    group by actor
  ),
  recent as (
    select actor, bool_or(events ? 'close') as closed
    from insights.activity_days, today
    where activity_days.day > today.day - 35
    group by actor
  )
select
  (select count(*) from week) as active_this_week,
  (select round(100.0 * count(*) filter (where exists (
      select 1 from insights.activity_days a
      where a.actor = f.actor and a.day >= f.first_day + 28
    )) / nullif(count(*), 0), 1)
   from firsts f, today
   where f.first_day <= today.day - 28) as day30_pct,
  (select round(100.0 * count(*) filter (where days >= 3) / nullif(count(*), 0), 1)
   from week) as habit_pct,
  (select round(100.0 * count(*) filter (where closed) / nullif(count(*), 0), 1)
   from recent) as closed_pct;
