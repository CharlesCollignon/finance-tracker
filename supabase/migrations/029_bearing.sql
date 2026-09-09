-- The Bearing: which figures lead, and who decided.
--
-- Two different things are stored here and they deliberately live in two
-- different places, because they are protected against two different people.
--
-- The user's own arrangement is a preference. It is theirs, it costs nothing,
-- and the only thing that could go wrong is losing it — so it goes in
-- `user_preferences`, client-writable under the RLS policies already there.
-- That table was named for preferences rather than for the locale precisely
-- so this could happen: its own comment says the two settings "currently
-- stranded in browser storage have somewhere to move when they are next
-- touched". A tile order in localStorage is a bug that has simply not been
-- filed yet, for the same reason a currency in localStorage is: it does not
-- follow you to a new laptop, and here it also would not follow you to the
-- phone, where the dragging is likeliest to happen.
--
-- The model's arrangement is a bill. The ceiling on it guards the deployment
-- owner's money against the deployment owner's own client, and `024_month_reads`
-- already made the argument: a counter a client may UPDATE is a counter a
-- client may set back to zero, and a serverless function holds no memory
-- between invocations to keep it in. So that half is select-only with every
-- write behind a `security definer` function.
--
-- The functions here are written against `acting_for()` from `025` from the
-- start, rather than repeating the mistake that migration exists to correct,
-- and their default PUBLIC grant is revoked in the same breath as it is
-- created rather than in a later migration.

/* --------------------------------------------------- the user's own order */

-- Which figure the user has dragged into which slot: {"invested": 0}.
--
-- A map rather than an array because it is sparse by nature. Somebody who
-- drags one tile to the top has pinned exactly one tile, and an array would
-- have to invent an opinion about the other eleven — turning a single
-- deliberate choice into a frozen layout that the model may then never
-- improve again.
--
-- Null, not '{}', for someone who has never dragged anything. The difference
-- is real: no row and no opinion is what lets the arrangement lead, and this
-- column having a value is what `mergeArrangement` treats as an override.
alter table user_preferences
  add column if not exists bearing_pins jsonb;

-- A guard against a blob, not against a wrong slot number.
--
-- Which slots exist is the grid's business and it changes when the grid does;
-- that check lives in `bearing-tiles.ts`, where it is unit-tested and where an
-- out-of-range pin is dropped rather than rejected. What the database insists
-- on is only that this is an object of numbers, so a read never has to defend
-- itself against an array or a string.
--
-- A function rather than the obvious `not exists (select ...)`, because
-- Postgres refuses a subquery in a CHECK constraint. `immutable` is what makes
-- it usable there and is honest: it reads nothing but its argument.
create or replace function bearing_pins_valid(pins jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select pins is null
    or (
      jsonb_typeof(pins) = 'object'
      and not exists (
        select 1
        from jsonb_each(pins) as entry(key, value)
        where jsonb_typeof(entry.value) <> 'number'
      )
    );
$$;

alter table user_preferences
  drop constraint if exists user_preferences_bearing_pins_is_object;
alter table user_preferences
  add constraint user_preferences_bearing_pins_is_object
  check (bearing_pins_valid(bearing_pins));

/* ------------------------------------------------- the model's own order */

-- One row per user. Not per month, and not per day.
--
-- A month read is about a month, so its row is keyed by the month it
-- describes and its allowance falls out of that key for free. A bearing is
-- about a day, and keying one row per day would spend a row on every visit
-- and make "how many have you asked for this month" a range scan over a
-- table that grows forever. So there is one row, holding the current
-- arrangement, and the tally carries the month it belongs to and resets when
-- the month turns — which `reserve_bearing_arrangement` does in the same
-- statement that takes the reservation, so nothing has to remember to.
create table if not exists bearing_arrangements (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- The month the tally below is counting. First of the month, as
  -- `month_reads` stores its month, so the two read the same way.
  tally_month date not null,
  -- Times the arranger has been asked this month, answered well or not: a
  -- model that answered badly still cost money. Refunded only for an attempt
  -- that never reached the provider.
  writes smallint not null default 0 check (writes >= 0),
  -- Answers thrown away for naming a figure the app did not give. Shown to
  -- nobody; this is the number that says whether the prompt works.
  refused smallint not null default 0 check (refused >= 0),
  last_written_at timestamptz,
  -- Set while a call is in flight, cleared when it lands. At most one
  -- outstanding reservation, which is what makes the refund idempotent and
  -- two simultaneous presses one call rather than two.
  pending_since timestamptz,

  -- The arrangement: an order and some captions, with figure placeholders
  -- rather than figures. Null while every attempt has been refused or gone
  -- unanswered, which is an ordinary state — the surface renders the app's
  -- own ordering and nobody is told anything is missing.
  arrangement jsonb,
  -- The figures it was chosen against, for noticing they have moved. Not for
  -- rendering from: the tiles are always drawn from the figures as they
  -- stand, so a value on screen can never contradict the one beside it.
  facts jsonb,
  facts_digest text,
  -- How many captions were dropped for smuggling in a figure. For tuning the
  -- prompt, not for the reader.
  dropped smallint not null default 0 check (dropped >= 0),
  model text,
  prompt_version smallint,
  -- The language the captions are in, which may not be the reader's. Same
  -- reason `028` added it to a month read: prose stays in the language it was
  -- written in, so the labels spliced into it must too.
  locale text check (locale in ('en', 'fr')),
  arranged_at timestamptz
);

alter table bearing_arrangements
  drop constraint if exists bearing_arrangements_tally_month_is_first_day;
alter table bearing_arrangements
  add constraint bearing_arrangements_tally_month_is_first_day
  check (tally_month = date_trunc('month', tally_month::timestamp)::date);

alter table bearing_arrangements enable row level security;

-- Select only, for the reason `024_month_reads` sets out at length.
drop policy if exists "bearing_arrangements_select_own" on bearing_arrangements;
create policy "bearing_arrangements_select_own"
  on bearing_arrangements for select using (auth.uid() = user_id);

-- Take an attempt, if one is going.
--
-- The whole decision is one statement so Postgres takes the row lock and two
-- simultaneous presses serialise: the second sees `pending_since` already set
-- and changes nothing. The caller compares `writes` before and after to learn
-- whether it got the reservation.
--
-- The month rollover is here rather than in a job. When `tally_month` is
-- behind the month being asked for, the update resets the count to one and
-- moves the month — so an allowance refills by being used, and no scheduled
-- task exists that could fail to run.
create or replace function reserve_bearing_arrangement(
  target_user uuid,
  this_month date,
  allowance smallint,
  cooldown_seconds int,
  reservation_seconds int
)
returns bearing_arrangements
language plpgsql
security definer
set search_path = public
as $$
declare
  result bearing_arrangements;
begin
  if not acting_for(target_user) then
    raise exception 'reserve_bearing_arrangement: not permitted for that user';
  end if;

  insert into bearing_arrangements (user_id, tally_month, writes, pending_since)
  values (target_user, this_month, 1, now())
  on conflict (user_id) do update
    set writes = case
          when bearing_arrangements.tally_month < this_month then 1
          else bearing_arrangements.writes + 1
        end,
        tally_month = this_month,
        pending_since = now()
    where (
        bearing_arrangements.tally_month < this_month
        or bearing_arrangements.writes < allowance
      )
      and (
        bearing_arrangements.last_written_at is null
        or bearing_arrangements.last_written_at
             < now() - make_interval(secs => cooldown_seconds)
      )
      and (
        bearing_arrangements.pending_since is null
        -- A reservation older than this belonged to a call that never came
        -- back. Holding the surface closed on its account would be worse
        -- than letting one extra attempt through.
        or bearing_arrangements.pending_since
             < now() - make_interval(secs => reservation_seconds)
      )
  returning * into result;

  -- The conflict clause declined, so nothing was returned. Hand back the row
  -- as it stands and let the caller read the reason off it.
  if result is null then
    select * into result from bearing_arrangements where user_id = target_user;
  end if;

  return result;
end;
$$;

-- Land a finished attempt.
--
-- Clears the reservation either way. Writes the arrangement when one survived
-- verification; when none did, bumps `refused` and leaves the previous
-- arrangement in place — a rejected answer is a reason to keep what was
-- already there, not to throw the screen back to its default ordering.
create or replace function store_bearing_arrangement(
  target_user uuid,
  new_arrangement jsonb,
  new_facts jsonb,
  new_digest text,
  new_dropped smallint,
  new_model text,
  new_prompt_version smallint,
  new_locale text,
  refused_delta smallint
)
returns bearing_arrangements
language plpgsql
security definer
set search_path = public
as $$
declare
  result bearing_arrangements;
begin
  if not acting_for(target_user) then
    raise exception 'store_bearing_arrangement: not permitted for that user';
  end if;

  update bearing_arrangements
     set pending_since = null,
         last_written_at = now(),
         refused = bearing_arrangements.refused + coalesce(refused_delta, 0),
         arrangement = coalesce(new_arrangement, bearing_arrangements.arrangement),
         facts = case when new_arrangement is null
                   then bearing_arrangements.facts else new_facts end,
         facts_digest = case when new_arrangement is null
                          then bearing_arrangements.facts_digest else new_digest end,
         dropped = case when new_arrangement is null
                     then bearing_arrangements.dropped else coalesce(new_dropped, 0) end,
         model = case when new_arrangement is null
                   then bearing_arrangements.model else new_model end,
         prompt_version = case when new_arrangement is null
                            then bearing_arrangements.prompt_version else new_prompt_version end,
         locale = case when new_arrangement is null
                    then bearing_arrangements.locale else new_locale end,
         arranged_at = case when new_arrangement is null
                         then bearing_arrangements.arranged_at else now() end
   where user_id = target_user
  returning * into result;

  return result;
end;
$$;

-- Hand back an attempt that never reached the provider.
--
-- Guarded on there being an outstanding reservation, which is what makes it
-- unabusable: at most one is ever outstanding, so a client can only return
-- the attempt it just took. An answer that arrived and was rejected is not
-- refunded — it cost money.
create or replace function refund_bearing_arrangement(target_user uuid)
returns bearing_arrangements
language plpgsql
security definer
set search_path = public
as $$
declare
  result bearing_arrangements;
begin
  if not acting_for(target_user) then
    raise exception 'refund_bearing_arrangement: not permitted for that user';
  end if;

  update bearing_arrangements
     set writes = greatest(0, bearing_arrangements.writes - 1),
         pending_since = null
   where user_id = target_user
     and bearing_arrangements.pending_since is not null
  returning * into result;

  if result is null then
    select * into result from bearing_arrangements where user_id = target_user;
  end if;

  return result;
end;
$$;

/* ------------------------------------------------------------ the grants */

-- Revoked from PUBLIC in the same migration that creates them, rather than in
-- a later correction. Postgres grants EXECUTE to PUBLIC by default, so a
-- grant to two roles on its own restricts nothing — which is exactly what
-- `025` had to come back and fix for `022` and `024`.
revoke execute on function reserve_bearing_arrangement(uuid, date, smallint, int, int)
  from public, anon;
revoke execute on function store_bearing_arrangement(
  uuid, jsonb, jsonb, text, smallint, text, smallint, text, smallint
) from public, anon;
revoke execute on function refund_bearing_arrangement(uuid) from public, anon;

grant execute on function reserve_bearing_arrangement(uuid, date, smallint, int, int)
  to authenticated, service_role;
grant execute on function store_bearing_arrangement(
  uuid, jsonb, jsonb, text, smallint, text, smallint, text, smallint
) to authenticated, service_role;
grant execute on function refund_bearing_arrangement(uuid)
  to authenticated, service_role;
