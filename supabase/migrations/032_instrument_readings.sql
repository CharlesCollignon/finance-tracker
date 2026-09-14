-- What each instrument is made of, as read from the market.
--
-- The catalogue of instruments this app will *name* lives in TypeScript, in
-- `packages/core/src/etf-shortlist.ts`, because a fund's identifier and index
-- do not move and a list in git cannot be poisoned. What does move — the
-- ongoing charge, the country and sector split, the largest constituents —
-- is read, and read things need somewhere to sit.
--
-- ## Why these rows have a user_id
--
-- A fund's composition is a fact about the fund, not about a person, so the
-- obvious design is one shared row per ISIN that everybody reads. That was
-- the first draft and it is wrong here, for two reasons.
--
-- Every other table in this schema is keyed by `user_id` and gated on
-- `auth.uid() = user_id`; `010` went further and made the insert policies
-- verify foreign-key ownership too. A shared table would be the first
-- cross-user trust boundary in the database, and the first one is the
-- expensive one — every later reader has to notice it exists.
--
-- And the input is not trustworthy. The instrument name that seeds a search
-- is typed by a person. One person's text steering a lookup whose result
-- another person's verdict rests on is a class of problem this app does not
-- otherwise have. Duplicating a few rows per household is a very cheap way
-- not to acquire it.
--
-- ## Nothing is ever evicted
--
-- A reading carries `sourced_at` and is kept. Staleness is a comparison the
-- surface makes out loud — "read seven months ago" — not an expiry that
-- deletes data, because last year's country split is a far better answer
-- than no answer, and the house pattern is `describeReadFreshness` rather
-- than a cache with a TTL.

create table if not exists instrument_readings (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ISO 6166. Shape checked, check digit not: a bad digit is something to
  -- explain to whoever typed it, which a constraint cannot do.
  isin text not null check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),

  -- Annual ongoing charge as a fraction, same convention and same ceiling as
  -- `investment_positions.ongoing_charge`, so the two can be added together
  -- without either caller remembering which unit it is in.
  ongoing_charge numeric(6, 5)
    check (ongoing_charge is null
           or (ongoing_charge >= 0 and ongoing_charge <= 0.1)),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),

  -- ISO 3166-1 alpha-2 → share of the fund. Weights as read, not normalised:
  -- a factsheet listing only its largest countries is a fact about what was
  -- published, and normalising on the way in would throw away the knowledge
  -- that the list was partial.
  country_weights jsonb not null default '{}'::jsonb,
  -- The eleven GICS sector ids, kebab-cased. Closed vocabulary, enforced in
  -- `instrument-reading.ts` rather than here: a sector added to that list
  -- should not need a migration.
  sector_weights jsonb not null default '{}'::jsonb,
  -- [{ name, weight }], largest first, as published.
  top_constituents jsonb not null default '[]'::jsonb,
  -- How much of the fund those constituents account for. A top ten covering
  -- a fifth of a fund and one covering two thirds support very different
  -- claims, and nothing downstream can tell which it has without this.
  constituents_coverage numeric(5, 4)
    check (constituents_coverage is null
           or (constituents_coverage >= 0 and constituents_coverage <= 1)),

  -- The pages it was read from, so a figure on screen can be traced back.
  sources jsonb not null default '[]'::jsonb,
  sourced_at timestamptz not null default now(),
  model text,
  -- Bumped when the shape changes enough that old readings should be retaken.
  version smallint not null default 1,

  primary key (user_id, isin)
);

alter table instrument_readings enable row level security;

-- The ordinary four, as every other user-owned table in this schema has.
-- Unlike `month_reads` and `bearing_arrangements`, these rows are written
-- through a plain upsert rather than a metered function: the row itself is
-- not the scarce thing. What costs money is the *call* that produces it, and
-- that is metered separately below.
drop policy if exists "instrument_readings_select_own" on instrument_readings;
create policy "instrument_readings_select_own"
  on instrument_readings for select
  using (auth.uid() = user_id);

drop policy if exists "instrument_readings_insert_own" on instrument_readings;
create policy "instrument_readings_insert_own"
  on instrument_readings for insert
  with check (auth.uid() = user_id);

drop policy if exists "instrument_readings_update_own" on instrument_readings;
create policy "instrument_readings_update_own"
  on instrument_readings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "instrument_readings_delete_own" on instrument_readings;
create policy "instrument_readings_delete_own"
  on instrument_readings for delete
  using (auth.uid() = user_id);

/* --------------------------------------------------------- the allowance */

-- Reading an instrument costs a paid call, so it is counted.
--
-- One row per person, holding a month and a tally, exactly as
-- `bearing_arrangements` does — and for the same stated reason: a serverless
-- function remembers nothing, and a counter a client may write is a counter a
-- client may reset.
--
-- Two things bound this beyond the tally. `reserve_instrument_reading`
-- refuses an ISIN that is not on one of the caller's own positions, so the
-- work is bounded by the portfolio rather than by whatever string arrives;
-- and a reading that is still fresh is short-circuited before the reservation
-- is taken, so re-walking a portfolio that is already read is free.
create table if not exists instrument_reading_tallies (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- First of the month, as `month_reads` and `bearing_arrangements` store it.
  tally_month date not null,
  reads smallint not null default 0 check (reads >= 0),
  last_read_at timestamptz,
  -- Set while a call is in flight. At most one outstanding, which is what
  -- makes the refund idempotent and two simultaneous presses one call.
  pending_since timestamptz
);

alter table instrument_reading_tallies
  drop constraint if exists instrument_reading_tallies_month_is_first_day;
alter table instrument_reading_tallies
  add constraint instrument_reading_tallies_month_is_first_day
  check (tally_month = date_trunc('month', tally_month::timestamp)::date);

alter table instrument_reading_tallies enable row level security;

-- Select only. Every write goes through the functions below, for the reason
-- `024_month_reads` sets out at length.
drop policy if exists "instrument_reading_tallies_select_own"
  on instrument_reading_tallies;
create policy "instrument_reading_tallies_select_own"
  on instrument_reading_tallies for select
  using (auth.uid() = user_id);

-- Take an attempt at reading one instrument, if one is going.
--
-- The ownership test is the important half. Without it this is a paid call
-- that anyone holding a token can aim at any twelve-character string, and the
-- tally would be the only thing standing between a stranger and the bill.
-- With it, the most anyone can ask about is what they themselves hold.
--
-- The month rollover is in the same statement as the reservation, so an
-- allowance refills by being used and no scheduled task exists that could
-- fail to run.
create or replace function reserve_instrument_reading(
  target_user uuid,
  target_isin text,
  this_month date,
  allowance smallint,
  cooldown_seconds int,
  reservation_seconds int
)
returns instrument_reading_tallies
language plpgsql
security definer
set search_path = public
as $$
declare
  result instrument_reading_tallies;
begin
  if not acting_for(target_user) then
    raise exception 'reserve_instrument_reading: not permitted for that user';
  end if;

  if not exists (
    select 1 from investment_positions
     where investment_positions.user_id = target_user
       and investment_positions.isin = target_isin
  ) then
    raise exception 'reserve_instrument_reading: % is not held by that user',
      target_isin;
  end if;

  insert into instrument_reading_tallies
    (user_id, tally_month, reads, pending_since)
  values (target_user, this_month, 1, now())
  on conflict (user_id) do update
    set reads = case
          when instrument_reading_tallies.tally_month < this_month then 1
          else instrument_reading_tallies.reads + 1
        end,
        tally_month = this_month,
        pending_since = now()
    where (
        instrument_reading_tallies.tally_month < this_month
        or instrument_reading_tallies.reads < allowance
      )
      and (
        instrument_reading_tallies.last_read_at is null
        or instrument_reading_tallies.last_read_at
             < now() - make_interval(secs => cooldown_seconds)
      )
      and (
        instrument_reading_tallies.pending_since is null
        -- A reservation older than this belonged to a call that never came
        -- back. Holding the queue closed on its account would be worse than
        -- letting one extra attempt through.
        or instrument_reading_tallies.pending_since
             < now() - make_interval(secs => reservation_seconds)
      )
  returning * into result;

  -- The conflict clause declined, so nothing came back. Hand over the row as
  -- it stands and let the caller read the reason off it.
  if result is null then
    select * into result
      from instrument_reading_tallies
     where user_id = target_user;
  end if;

  return result;
end;
$$;

-- Land a reading, and clear the reservation.
--
-- The reading itself is written here rather than by the caller so that
-- storing it and releasing the meter are one statement: a reading that
-- landed while the tally still showed a call in flight would block the queue
-- until the reservation aged out.
create or replace function store_instrument_reading(
  target_user uuid,
  target_isin text,
  new_charge numeric,
  new_currency text,
  new_country_weights jsonb,
  new_sector_weights jsonb,
  new_constituents jsonb,
  new_coverage numeric,
  new_sources jsonb,
  new_model text,
  new_version smallint
)
returns instrument_readings
language plpgsql
security definer
set search_path = public
as $$
declare
  result instrument_readings;
begin
  if not acting_for(target_user) then
    raise exception 'store_instrument_reading: not permitted for that user';
  end if;

  insert into instrument_readings (
    user_id, isin, ongoing_charge, currency, country_weights, sector_weights,
    top_constituents, constituents_coverage, sources, sourced_at, model, version
  )
  values (
    target_user, target_isin, new_charge, new_currency,
    coalesce(new_country_weights, '{}'::jsonb),
    coalesce(new_sector_weights, '{}'::jsonb),
    coalesce(new_constituents, '[]'::jsonb),
    new_coverage, coalesce(new_sources, '[]'::jsonb),
    now(), new_model, coalesce(new_version, 1)
  )
  on conflict (user_id, isin) do update
    set ongoing_charge = excluded.ongoing_charge,
        currency = excluded.currency,
        country_weights = excluded.country_weights,
        sector_weights = excluded.sector_weights,
        top_constituents = excluded.top_constituents,
        constituents_coverage = excluded.constituents_coverage,
        sources = excluded.sources,
        sourced_at = excluded.sourced_at,
        model = excluded.model,
        version = excluded.version
  returning * into result;

  update instrument_reading_tallies
     set pending_since = null,
         last_read_at = now()
   where user_id = target_user;

  return result;
end;
$$;

-- Hand back an attempt that never reached the provider.
--
-- Guarded on there being an outstanding reservation, which is what makes it
-- unabusable: at most one is ever outstanding, so a client can only return
-- the attempt it just took. An answer that arrived and was rejected is not
-- refunded — it cost money.
create or replace function refund_instrument_reading(target_user uuid)
returns instrument_reading_tallies
language plpgsql
security definer
set search_path = public
as $$
declare
  result instrument_reading_tallies;
begin
  if not acting_for(target_user) then
    raise exception 'refund_instrument_reading: not permitted for that user';
  end if;

  update instrument_reading_tallies
     set reads = greatest(0, instrument_reading_tallies.reads - 1),
         pending_since = null
   where user_id = target_user
     and instrument_reading_tallies.pending_since is not null
  returning * into result;

  if result is null then
    select * into result
      from instrument_reading_tallies
     where user_id = target_user;
  end if;

  return result;
end;
$$;

-- Clear a reservation without handing the attempt back.
--
-- The middle outcome, and it needs its own function. An answer that arrived
-- and was refused cost money, so the attempt stays spent — but nothing is
-- being stored, and `store_instrument_reading` is what normally clears the
-- meter. Without this the tally would sit showing a call in flight and the
-- queue would be blocked until the reservation aged out.
--
-- A function rather than an UPDATE from the client, because the tally is
-- select-only: a counter a client may write is a counter a client may reset.
create or replace function release_instrument_reading(target_user uuid)
returns instrument_reading_tallies
language plpgsql
security definer
set search_path = public
as $$
declare
  result instrument_reading_tallies;
begin
  if not acting_for(target_user) then
    raise exception 'release_instrument_reading: not permitted for that user';
  end if;

  update instrument_reading_tallies
     set pending_since = null,
         last_read_at = now()
   where user_id = target_user
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------ the grants */

-- Revoked from PUBLIC in the same migration that creates them. Postgres
-- grants EXECUTE to PUBLIC by default, so a grant to two roles on its own
-- restricts nothing — which is exactly what `025` had to come back and fix
-- for `022` and `024`.
revoke execute on function reserve_instrument_reading(
  uuid, text, date, smallint, int, int
) from public, anon;
revoke execute on function store_instrument_reading(
  uuid, text, numeric, text, jsonb, jsonb, jsonb, numeric, jsonb, text, smallint
) from public, anon;
revoke execute on function refund_instrument_reading(uuid) from public, anon;
revoke execute on function release_instrument_reading(uuid) from public, anon;

grant execute on function reserve_instrument_reading(
  uuid, text, date, smallint, int, int
) to authenticated, service_role;
grant execute on function store_instrument_reading(
  uuid, text, numeric, text, jsonb, jsonb, jsonb, numeric, jsonb, text, smallint
) to authenticated, service_role;
grant execute on function refund_instrument_reading(uuid)
  to authenticated, service_role;
grant execute on function release_instrument_reading(uuid)
  to authenticated, service_role;
