-- The wallets, read out loud.
--
-- A look-through is arithmetic: what the positions are made of by country and
-- sector, what they cost all in, which of them track the same index, and what
-- share of the money the app cannot see. It is computed on every page load
-- and needs no model. This table holds the thing written *over* it — what a
-- reader noticed and what it suggests — which does need one, and therefore
-- needs counting.
--
-- One row per person, holding the current read and the tally, shaped exactly
-- like `bearing_arrangements` in `029`. The reasoning there applies verbatim:
-- a read is worth having for about as long as the portfolio sits still, and
-- keying one row per attempt would spend a row on every press and make "how
-- many this month" a range scan over a table that grows forever.
--
-- ## What is deliberately not in here
--
-- No percentages. The suggestions name an instrument and say what part it
-- should play — a role and a weight class, both from closed vocabularies —
-- and every weight is computed in `look-through-target.ts` from those. So the
-- figures on screen are the app's arithmetic even in the one place the
-- feature is most tempted to let a model do sums, and a stored read stays
-- valid when the portfolio's value moves under it.
--
-- No instrument names either. A suggestion is an ISIN, and the name beside it
-- on screen is rendered from the catalogue in `etf-shortlist.ts`. A
-- transposed identifier reaching a reader as a fund name is the worst thing
-- this feature could produce, so the two are never carried together.

create table if not exists wallet_reads (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- The month the tally below is counting. First of the month, as
  -- `month_reads` and `bearing_arrangements` store theirs.
  tally_month date not null,
  -- Reads asked for this month, answered well or not: a model that answered
  -- badly still cost money. Refunded only for an attempt that never reached
  -- the provider.
  writes smallint not null default 0 check (writes >= 0),
  -- Answers thrown away whole — for naming a figure, citing a datum that
  -- does not exist, or proposing an instrument the catalogue has never heard
  -- of. Shown to nobody; this is the number that says whether the prompt
  -- works.
  refused smallint not null default 0 check (refused >= 0),
  last_written_at timestamptz,
  -- Set while a call is in flight, cleared when it lands. At most one
  -- outstanding reservation, which is what makes the refund idempotent and
  -- two simultaneous presses one call rather than two.
  pending_since timestamptz,

  -- The read: a headline, some observations, some suggestions. Figure
  -- placeholders rather than figures. Null while every attempt has been
  -- refused or gone unanswered, which is an ordinary state — the surface
  -- still shows the whole look-through and its own default target, and
  -- nobody is told anything is missing.
  read jsonb,
  -- The figures it was written against, for noticing they have moved. Not for
  -- rendering from: the look-through is always drawn from the figures as they
  -- stand, so a value on screen can never contradict the one beside it.
  facts jsonb,
  facts_digest text,
  -- Claims dropped for smuggling in a figure, and suggestions dropped for
  -- naming something uncatalogued or placing it in a wrapper it cannot sit
  -- in. For tuning the prompt, not for the reader.
  dropped smallint not null default 0 check (dropped >= 0),
  model text,
  prompt_version smallint,
  -- The language the prose is in, which may not be the reader's. Same reason
  -- `028` added it to a month read: prose stays in the language it was
  -- written in, so the labels spliced into it must too.
  locale text check (locale in ('en', 'fr')),
  read_at timestamptz
);

alter table wallet_reads
  drop constraint if exists wallet_reads_tally_month_is_first_day;
alter table wallet_reads
  add constraint wallet_reads_tally_month_is_first_day
  check (tally_month = date_trunc('month', tally_month::timestamp)::date);

alter table wallet_reads enable row level security;

-- Select only, for the reason `024_month_reads` sets out at length.
drop policy if exists "wallet_reads_select_own" on wallet_reads;
create policy "wallet_reads_select_own"
  on wallet_reads for select using (auth.uid() = user_id);

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
create or replace function reserve_wallet_read(
  target_user uuid,
  this_month date,
  allowance smallint,
  cooldown_seconds int,
  reservation_seconds int
)
returns wallet_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result wallet_reads;
begin
  if not acting_for(target_user) then
    raise exception 'reserve_wallet_read: not permitted for that user';
  end if;

  insert into wallet_reads (user_id, tally_month, writes, pending_since)
  values (target_user, this_month, 1, now())
  on conflict (user_id) do update
    set writes = case
          when wallet_reads.tally_month < this_month then 1
          else wallet_reads.writes + 1
        end,
        tally_month = this_month,
        pending_since = now()
    where (
        wallet_reads.tally_month < this_month
        or wallet_reads.writes < allowance
      )
      and (
        wallet_reads.last_written_at is null
        or wallet_reads.last_written_at
             < now() - make_interval(secs => cooldown_seconds)
      )
      and (
        wallet_reads.pending_since is null
        -- A reservation older than this belonged to a call that never came
        -- back. Holding the surface closed on its account would be worse
        -- than letting one extra attempt through.
        or wallet_reads.pending_since
             < now() - make_interval(secs => reservation_seconds)
      )
  returning * into result;

  -- The conflict clause declined, so nothing was returned. Hand back the row
  -- as it stands and let the caller read the reason off it.
  if result is null then
    select * into result from wallet_reads where user_id = target_user;
  end if;

  return result;
end;
$$;

-- Land a finished attempt.
--
-- Clears the reservation either way. Writes the read when one survived
-- verification; when none did, bumps `refused` and leaves the previous read
-- in place — a rejected answer is a reason to keep what was already there,
-- not to throw the surface back to silence.
create or replace function store_wallet_read(
  target_user uuid,
  new_read jsonb,
  new_facts jsonb,
  new_digest text,
  new_dropped smallint,
  new_model text,
  new_prompt_version smallint,
  new_locale text,
  refused_delta smallint
)
returns wallet_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result wallet_reads;
begin
  if not acting_for(target_user) then
    raise exception 'store_wallet_read: not permitted for that user';
  end if;

  update wallet_reads
     set pending_since = null,
         last_written_at = now(),
         refused = wallet_reads.refused + coalesce(refused_delta, 0),
         read = coalesce(new_read, wallet_reads.read),
         facts = case when new_read is null
                   then wallet_reads.facts else new_facts end,
         facts_digest = case when new_read is null
                          then wallet_reads.facts_digest else new_digest end,
         dropped = case when new_read is null
                     then wallet_reads.dropped else coalesce(new_dropped, 0) end,
         model = case when new_read is null
                   then wallet_reads.model else new_model end,
         prompt_version = case when new_read is null
                            then wallet_reads.prompt_version
                            else new_prompt_version end,
         locale = case when new_read is null
                    then wallet_reads.locale else new_locale end,
         read_at = case when new_read is null
                     then wallet_reads.read_at else now() end
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
create or replace function refund_wallet_read(target_user uuid)
returns wallet_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result wallet_reads;
begin
  if not acting_for(target_user) then
    raise exception 'refund_wallet_read: not permitted for that user';
  end if;

  update wallet_reads
     set writes = greatest(0, wallet_reads.writes - 1),
         pending_since = null
   where user_id = target_user
     and wallet_reads.pending_since is not null
  returning * into result;

  if result is null then
    select * into result from wallet_reads where user_id = target_user;
  end if;

  return result;
end;
$$;

/* ------------------------------------------------------------ the grants */

-- Revoked from PUBLIC in the same migration that creates them. Postgres
-- grants EXECUTE to PUBLIC by default, so a grant to two roles on its own
-- restricts nothing — which is exactly what `025` had to come back and fix
-- for `022` and `024`.
revoke execute on function reserve_wallet_read(uuid, date, smallint, int, int)
  from public, anon;
revoke execute on function store_wallet_read(
  uuid, jsonb, jsonb, text, smallint, text, smallint, text, smallint
) from public, anon;
revoke execute on function refund_wallet_read(uuid) from public, anon;

grant execute on function reserve_wallet_read(uuid, date, smallint, int, int)
  to authenticated, service_role;
grant execute on function store_wallet_read(
  uuid, jsonb, jsonb, text, smallint, text, smallint, text, smallint
) to authenticated, service_role;
grant execute on function refund_wallet_read(uuid)
  to authenticated, service_role;
