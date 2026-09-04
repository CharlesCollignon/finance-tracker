-- One written read per month, and what it cost to get.
--
-- A language model writes the prose of a month read. It never writes a
-- number: it is handed the figures and refers to them by name, and the app
-- substitutes its own values when the read is rendered. So what is stored
-- here is prose with holes in it — `{{fact:expenses}}` rather than
-- "1 650,50 €" — and that is deliberate three times over. The reader's
-- display currency is a browser preference no server can know. Amounts are
-- blurred one element at a time in privacy mode, which prose cannot be. And
-- a figure the app did not compute has no business reaching a screen.
--
-- The figures are stored too, but not to render from. They are the footing:
-- the values the judgement was formed against, kept so the app can notice
-- when they have moved and say "three of the figures this rests on have
-- changed" instead of quietly leaving a stale opinion beside fresh numbers.
--
-- The read and its call budget share this row because they share a key. One
-- row per user per month answers both "what does it say" and "how many times
-- have you asked", and `022_bank_pulls` already argued why a counter has to
-- live in the database at all: a serverless function holds no memory between
-- invocations, and an in-memory guard resets on every cold start.

create table month_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The month written about, stored as its first day, as month_closes does.
  month date not null,

  -- Times the writer has been asked, whether or not it answered well: a
  -- model that answered badly still cost money. Refunded only for an attempt
  -- that never reached the provider — see refund_month_read below.
  writes smallint not null default 0 check (writes >= 0),
  -- Answers thrown away for putting in a figure the app did not give it.
  -- Shown to nobody; this is the number that says whether the prompt works.
  refused smallint not null default 0 check (refused >= 0),
  last_written_at timestamptz,
  -- Set while a call is in flight, cleared when it lands. At most one
  -- outstanding reservation per row, which is what makes the refund
  -- idempotent and two simultaneous presses one call rather than two.
  pending_since timestamptz,

  -- The read itself: prose with figure placeholders, never figures. Null
  -- while every attempt so far has been refused or gone unanswered.
  read jsonb,
  -- The figures it was written from, for noticing they have moved.
  facts jsonb,
  facts_digest text,
  -- How many claims were dropped for smuggling in a figure. For tuning the
  -- prompt, not for the reader.
  trimmed smallint not null default 0 check (trimmed >= 0),
  model text,
  prompt_version smallint,
  written_at timestamptz,
  -- Room for the obvious follow-up: writing a read the moment a month closes,
  -- which is one call per user per month and the cheapest possible schedule.
  -- Carried from the start so that change needs no migration.
  source text not null default 'pressed'
    check (source in ('pressed', 'auto')),

  primary key (user_id, month)
);

-- The same rule month_closes uses: a read is a statement about a month, so a
-- mid-month date here is a bug rather than extra precision. The cast is
-- explicit so the check resolves to the immutable date_trunc(text,
-- timestamp) overload, which is what a CHECK constraint requires.
alter table month_reads
  add constraint month_reads_month_is_first_day
  check (month = date_trunc('month', month::timestamp)::date);

alter table month_reads enable row level security;

-- Select only, and deliberately so.
--
-- `bank_pulls` grants update-own alongside its counter function, and that is
-- harmless there: the ceiling it guards is regulatory, and the person it
-- protects is the one holding the session. This ceiling guards the
-- deployment owner's bill against the deployment owner's own client, and a
-- counter the client may UPDATE is a counter the client may set back to
-- zero. So every write here goes through a function instead.
create policy "month_reads_select_own"
  on month_reads for select using (auth.uid() = user_id);

-- Take an attempt, if one is going.
--
-- The whole decision is one statement so that Postgres takes the row lock
-- and two simultaneous presses serialise: the second sees `pending_since`
-- already set and changes nothing. The caller compares `writes` before and
-- after to learn whether it got the reservation.
--
-- Reserving before the call rather than counting after it is what makes the
-- ceiling hold. Counting afterwards means any number of concurrent presses
-- all pass the check and all spend.
create or replace function reserve_month_read(
  target_user uuid,
  target_month date,
  allowance smallint,
  cooldown_seconds int,
  reservation_seconds int
)
returns month_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result month_reads;
begin
  if target_user is null or target_user <> coalesce(auth.uid(), target_user) then
    raise exception 'reserve_month_read: not permitted for that user';
  end if;

  insert into month_reads (user_id, month, writes, pending_since)
  values (target_user, target_month, 1, now())
  on conflict (user_id, month) do update
    set writes = month_reads.writes + 1,
        pending_since = now()
    where month_reads.writes < allowance
      and (
        month_reads.last_written_at is null
        or month_reads.last_written_at
             < now() - make_interval(secs => cooldown_seconds)
      )
      and (
        month_reads.pending_since is null
        -- A reservation older than this belonged to a call that never came
        -- back. Holding the month closed on its account would be worse than
        -- letting one extra attempt through.
        or month_reads.pending_since
             < now() - make_interval(secs => reservation_seconds)
      )
  returning * into result;

  -- The conflict clause declined, so nothing was returned. Hand back the row
  -- as it stands and let the caller read the reason off it.
  if result is null then
    select * into result from month_reads
      where user_id = target_user and month = target_month;
  end if;

  return result;
end;
$$;

-- Land a finished attempt.
--
-- Clears the reservation either way. Writes the read when one survived
-- verification; when none did, bumps `refused` and leaves the previous read
-- in place — a rejected answer is a reason to keep what was already there,
-- not to blank the card.
create or replace function store_month_read(
  target_user uuid,
  target_month date,
  new_read jsonb,
  new_facts jsonb,
  new_digest text,
  new_trimmed smallint,
  new_model text,
  new_prompt_version smallint,
  refused_delta smallint,
  new_source text
)
returns month_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result month_reads;
begin
  if target_user is null or target_user <> coalesce(auth.uid(), target_user) then
    raise exception 'store_month_read: not permitted for that user';
  end if;

  update month_reads
     set pending_since = null,
         last_written_at = now(),
         refused = month_reads.refused + coalesce(refused_delta, 0),
         read = coalesce(new_read, month_reads.read),
         facts = case when new_read is null then month_reads.facts else new_facts end,
         facts_digest = case when new_read is null then month_reads.facts_digest else new_digest end,
         trimmed = case when new_read is null then month_reads.trimmed else coalesce(new_trimmed, 0) end,
         model = case when new_read is null then month_reads.model else new_model end,
         prompt_version = case when new_read is null then month_reads.prompt_version else new_prompt_version end,
         written_at = case when new_read is null then month_reads.written_at else now() end,
         source = case when new_read is null then month_reads.source else coalesce(new_source, 'pressed') end
   where user_id = target_user and month = target_month
  returning * into result;

  return result;
end;
$$;

-- Hand back an attempt that never reached the provider.
--
-- Guarded on there being an outstanding reservation, which is what makes it
-- unabusable: at most one is ever outstanding, so a client can only ever
-- return the attempt it just took. An answer that arrived and was rejected
-- is not refunded — it cost money.
create or replace function refund_month_read(
  target_user uuid,
  target_month date
)
returns month_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result month_reads;
begin
  if target_user is null or target_user <> coalesce(auth.uid(), target_user) then
    raise exception 'refund_month_read: not permitted for that user';
  end if;

  update month_reads
     set writes = greatest(0, month_reads.writes - 1),
         pending_since = null
   where user_id = target_user
     and month = target_month
     and month_reads.pending_since is not null
  returning * into result;

  if result is null then
    select * into result from month_reads
      where user_id = target_user and month = target_month;
  end if;

  return result;
end;
$$;

-- The service role has no auth.uid(), which the guards above allow for
-- exactly that reason: it is how the future automatic write, at the moment a
-- month closes, will act. An ordinary session may only ever name itself.
grant execute on function reserve_month_read(uuid, date, smallint, int, int)
  to authenticated, service_role;
grant execute on function store_month_read(
  uuid, date, jsonb, jsonb, text, smallint, text, smallint, smallint, text
) to authenticated, service_role;
grant execute on function refund_month_read(uuid, date)
  to authenticated, service_role;
