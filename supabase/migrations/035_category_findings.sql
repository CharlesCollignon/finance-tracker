-- One written read per category, and one model-chosen order per user.
--
-- Same argument as 024: the prose holds figure placeholders and never
-- figures, because the display currency is a browser preference no server
-- knows and privacy mode blurs one element at a time. And the same argument
-- as 029 for the tally: a counter a client may UPDATE is a counter a client
-- may set back to zero, and a serverless function holds no memory between
-- invocations to keep it in.
--
-- Two things are written here rather than one, because the two calls cost
-- differently and fail differently. A month spent reading categories must not
-- leave the band at the top unable to reorder itself.
--
-- ## Why there are three tables for two things
--
-- The allowance for category reads is one for the whole screen — ten writes a
-- month, not five per category. Twenty categories at five each is a hundred
-- calls inside the ceiling, which is not a ceiling. An allowance counted
-- across categories cannot live in a table keyed by category, so the count
-- moves out into `category_read_tallies` and the reads themselves stay keyed
-- by (user, category), where they belong.
--
-- The selection needs no third table: there is one per user, so its tally
-- fits on its own row exactly as `bearing_arrangements` carries its own.

create table if not exists category_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,

  -- Times this category's writer has been asked, whether or not it answered
  -- well: a model that answered badly still cost money. This is the record
  -- and the before/after the caller compares to learn whether it got the
  -- reservation — it is *not* what the ceiling is checked against. That is
  -- the tally below.
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
  -- Here from the first migration rather than added later: 028 already paid
  -- for leaving it out of month_reads. Prose stays in the language it was
  -- written in, so the labels spliced into it must too, and a read composed
  -- in French and then rendered with English labels was nonsense made of two
  -- halves that were each right on their own.
  locale text check (locale is null or locale in ('en', 'fr')),

  primary key (user_id, category_id)
);

-- The allowance is for the screen, not for each category. Twenty categories
-- at five writes each is a hundred calls inside the ceiling, which is not a
-- ceiling — so the tally is counted across the table, per calendar month.
--
-- Three columns and no more. There is deliberately no `last_written_at` here:
-- the cooldown is per category, so that pressing one category does not lock
-- the other nineteen, and it lives on the row it belongs to.
create table if not exists category_read_tallies (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  writes smallint not null default 0 check (writes >= 0),
  primary key (user_id, month)
);

-- The same rule `month_reads` uses, and here it is load-bearing rather than
-- tidy: a mid-month date would open a second bucket inside one month and the
-- allowance would silently double. The cast is explicit so the check resolves
-- to the immutable date_trunc(text, timestamp) overload, which is what a
-- CHECK constraint requires.
alter table category_read_tallies
  drop constraint if exists category_read_tallies_month_is_first_day;
alter table category_read_tallies
  add constraint category_read_tallies_month_is_first_day
  check (month = date_trunc('month', month::timestamp)::date);

create table if not exists category_selections (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- The chosen finding ids in order, with an optional remark each.
  selection jsonb,
  -- The digest of the findings it was chosen from. When this stops matching,
  -- the app's own order leads again rather than a stale ranking claiming to
  -- describe figures that have changed.
  findings_digest text,

  -- The tally carries the month it belongs to and resets when the month
  -- turns, in the same statement that takes the reservation, so nothing has
  -- to remember to. 029's reserve_bearing_arrangement does this.
  --
  -- Nullable, unlike 029's, because nothing but `reserve_category_selection`
  -- ever creates this row and it always sets the month. A null here can only
  -- mean a row written by hand, and the reserve treats it as a month that is
  -- not this one — which resets the count, the safe direction.
  tally_month date,
  writes smallint not null default 0 check (writes >= 0),
  refused smallint not null default 0 check (refused >= 0),
  last_written_at timestamptz,
  pending_since timestamptz,
  model text,
  prompt_version smallint,
  written_at timestamptz
);

alter table category_selections
  drop constraint if exists category_selections_tally_month_is_first_day;
alter table category_selections
  add constraint category_selections_tally_month_is_first_day
  check (
    tally_month is null
    or tally_month = date_trunc('month', tally_month::timestamp)::date
  );

alter table category_reads enable row level security;
alter table category_read_tallies enable row level security;
alter table category_selections enable row level security;

-- Select only, for the reason `024_month_reads` sets out at length: this
-- ceiling guards the deployment owner's bill against the deployment owner's
-- own client, and a counter the client may UPDATE is a counter the client may
-- set back to zero. Every write below goes through a function instead.
drop policy if exists "category_reads_select_own" on category_reads;
create policy "category_reads_select_own"
  on category_reads for select using (auth.uid() = user_id);

drop policy if exists "category_read_tallies_select_own" on category_read_tallies;
create policy "category_read_tallies_select_own"
  on category_read_tallies for select using (auth.uid() = user_id);

drop policy if exists "category_selections_select_own" on category_selections;
create policy "category_selections_select_own"
  on category_selections for select using (auth.uid() = user_id);

/* ------------------------------------------------- the read of a category */

-- Take an attempt at reading one category, if one is going.
--
-- ## Why the month is not a parameter
--
-- 029 and 033 take `this_month` from the caller, and that is a hole: the
-- reset fires when the stored month is behind the one asked for, so a client
-- naming next month refills its own allowance. Here the month is the server's
-- own, which costs at most a few hours of skew at the turn of the month for a
-- reader in a timezone ahead of the server, and closes that door completely.
-- A ceiling a client can move is not a ceiling.
--
-- ## Why the tally is bumped first
--
-- The ceiling is cross-category, so the row that has to serialise is the
-- tally's, not the read's — and `on conflict do update ... where` is what
-- makes that hold: Postgres takes the tally's row lock and re-evaluates
-- `writes < allowance` against the row as it stands after whoever got there
-- first, so the second of two simultaneous presses on two different
-- categories sees the count already moved. Checking the tally from inside the
-- read's own statement instead would read it from the statement snapshot,
-- and any number of concurrent presses on different categories would all see
-- the same stale count and all spend.
--
-- Bumping first has one cost, and it is the cheap direction. Simultaneous
-- presses on the *same* category all pass the cooldown test below, because
-- none can see the others' reservations yet; they all bump the tally, and then
-- all but one lose the read's row lock and reserve nothing. So a genuine
-- multi-press can spend several of the month's ten for one call.
--
-- What bounds it is not the number of pressers but the allowance itself: the
-- test is `writes < allowance` against the *locked* tally row, so the count
-- can never pass the ceiling however many arrive at once. The overspend
-- therefore only ever eats into the user's own remaining writes, and never
-- into the bill. Counting more than was spent is safe in a way that counting
-- less is not.
create or replace function reserve_category_read(
  target_user uuid,
  target_category uuid,
  allowance smallint,
  cooldown_seconds int,
  reservation_seconds int
)
returns category_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  this_month date := date_trunc('month', now())::date;
  result category_reads;
begin
  if not acting_for(target_user) then
    raise exception 'reserve_category_read: not permitted for that user';
  end if;

  -- `acting_for` settles who the caller is. This settles what they may name.
  --
  -- The category id is the one argument here that points at a row the caller
  -- did not have to own, and the foreign key below only proves such a row
  -- exists — it never consults `categories.user_id`. Without this test a
  -- client calling the RPC directly could name somebody else's category: the
  -- read would still be stored under the caller's own user_id and cost only
  -- the caller's own allowance, so nothing leaks, but a real id would be
  -- accepted where an absent one raised a foreign-key violation, and that
  -- difference is an existence oracle for category ids.
  --
  -- `reserve_instrument_reading` in `032` makes the same test for the same
  -- reason, and `024` needed none because a month is not a row that belongs
  -- to anybody. Both failures answer identically now: not yours.
  if not exists (
    select 1 from categories
     where categories.id = target_category
       and categories.user_id = target_user
  ) then
    raise exception 'reserve_category_read: % is not a category of that user',
      target_category;
  end if;

  with spent as (
    insert into category_read_tallies (user_id, month, writes)
    values (target_user, this_month, 1)
    on conflict (user_id, month) do update
      set writes = category_read_tallies.writes + 1
      where category_read_tallies.writes < allowance
        -- The cooldown is tested here as well as under the read's own row
        -- lock below, and it is not belt and braces. Without it, a press
        -- refused for being too soon would still have spent a write: somebody
        -- leaning on the button would burn the month's allowance without a
        -- single call ever being made.
        and not exists (
          select 1
            from category_reads blocking
           where blocking.user_id = target_user
             and blocking.category_id = target_category
             and (
               (
                 blocking.last_written_at is not null
                 and blocking.last_written_at
                       >= now() - make_interval(secs => cooldown_seconds)
               )
               or (
                 blocking.pending_since is not null
                 and blocking.pending_since
                       >= now() - make_interval(secs => reservation_seconds)
               )
             )
        )
    returning category_read_tallies.*
  ),
  reserved as (
    insert into category_reads (user_id, category_id, writes, pending_since)
    -- No row from `spent` means the month's allowance is gone or the category
    -- is still cooling, and then nothing is inserted at all.
    select target_user, target_category, 1, now() from spent
    on conflict (user_id, category_id) do update
      set writes = category_reads.writes + 1,
          pending_since = now()
      where (
          category_reads.last_written_at is null
          or category_reads.last_written_at
               < now() - make_interval(secs => cooldown_seconds)
        )
        and (
          category_reads.pending_since is null
          -- A reservation older than this belonged to a call that never came
          -- back. Holding the category closed on its account would be worse
          -- than letting one extra attempt through.
          or category_reads.pending_since
               < now() - make_interval(secs => reservation_seconds)
        )
    returning category_reads.*
  )
  select * into result from reserved;

  -- Nothing was reserved. Hand back the row as it stands and let the caller
  -- read the reason off it — and off the tally, which it may select for
  -- itself.
  if result is null then
    select * into result from category_reads
      where user_id = target_user and category_id = target_category;
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
create or replace function store_category_read(
  target_user uuid,
  target_category uuid,
  new_read jsonb,
  new_facts jsonb,
  new_digest text,
  new_trimmed smallint,
  new_model text,
  new_prompt_version smallint,
  new_locale text,
  refused_delta smallint
)
returns category_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result category_reads;
begin
  if not acting_for(target_user) then
    raise exception 'store_category_read: not permitted for that user';
  end if;

  -- The same test as the reserve, for the same reason: the category id names
  -- a row the caller did not have to own.
  if not exists (
    select 1 from categories
     where categories.id = target_category
       and categories.user_id = target_user
  ) then
    raise exception 'store_category_read: % is not a category of that user',
      target_category;
  end if;

  update category_reads
     set pending_since = null,
         last_written_at = now(),
         refused = category_reads.refused + coalesce(refused_delta, 0),
         read = coalesce(new_read, category_reads.read),
         facts = case when new_read is null
                   then category_reads.facts else new_facts end,
         facts_digest = case when new_read is null
                          then category_reads.facts_digest else new_digest end,
         trimmed = case when new_read is null
                     then category_reads.trimmed else coalesce(new_trimmed, 0) end,
         model = case when new_read is null
                   then category_reads.model else new_model end,
         prompt_version = case when new_read is null
                            then category_reads.prompt_version
                            else new_prompt_version end,
         -- Only set alongside a read. A refused attempt leaves the stored
         -- prose alone, and so must leave its language alone too.
         locale = case when new_read is null
                    then category_reads.locale else new_locale end,
         written_at = case when new_read is null
                        then category_reads.written_at else now() end
   where user_id = target_user and category_id = target_category
  returning * into result;

  return result;
end;
$$;

-- Hand back an attempt that never reached the provider.
--
-- Guarded on there being an outstanding reservation, which is what makes it
-- unabusable: at most one is ever outstanding, so a client can only ever
-- return the attempt it just took, and calling it twice returns nothing the
-- second time. An answer that arrived and was rejected is not refunded — it
-- cost money.
--
-- The tally is given back too, in the same statement and gated on the same
-- refund having happened, so there is no arrangement of calls that decrements
-- the month's count without a reservation being released for it.
--
-- The month it is returned to is the reservation's own, read before the
-- update clears it, rather than today's. The two differ only for a call that
-- was in flight when the month turned, and in that minute today's month is
-- the wrong bucket: it would leave September a write short and hand October
-- one it never paid for.
create or replace function refund_category_read(
  target_user uuid,
  target_category uuid
)
returns category_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result category_reads;
begin
  if not acting_for(target_user) then
    raise exception 'refund_category_read: not permitted for that user';
  end if;

  -- The same test as the reserve, for the same reason: the category id names
  -- a row the caller did not have to own.
  if not exists (
    select 1 from categories
     where categories.id = target_category
       and categories.user_id = target_user
  ) then
    raise exception 'refund_category_read: % is not a category of that user',
      target_category;
  end if;

  with outstanding as (
    select date_trunc('month', category_reads.pending_since)::date as month
      from category_reads
     where category_reads.user_id = target_user
       and category_reads.category_id = target_category
       and category_reads.pending_since is not null
  ),
  refunded as (
    update category_reads
       set writes = greatest(0, category_reads.writes - 1),
           pending_since = null
     where category_reads.user_id = target_user
       and category_reads.category_id = target_category
       and category_reads.pending_since is not null
    returning category_reads.*
  ),
  untallied as (
    update category_read_tallies
       set writes = greatest(0, category_read_tallies.writes - 1)
     where category_read_tallies.user_id = target_user
       and category_read_tallies.month = (select month from outstanding)
       and exists (select 1 from refunded)
    returning category_read_tallies.*
  )
  select * into result from refunded;

  if result is null then
    select * into result from category_reads
      where user_id = target_user and category_id = target_category;
  end if;

  return result;
end;
$$;

/* ------------------------------------------------ the order of the band */

-- Take an attempt at ordering the findings, if one is going.
--
-- One row per user, so the tally sits on it and carries the month it belongs
-- to, exactly as 029's does. The rollover is in the same statement as the
-- reservation, so an allowance refills by being used and no scheduled task
-- exists that could fail to run.
--
-- `is distinct from` rather than 029's `<`, and the server's own month rather
-- than the caller's, for the reason `reserve_category_read` gives above: a
-- reset that fires on "behind the month you named" is a reset a client can
-- ask for whenever it likes.
create or replace function reserve_category_selection(
  target_user uuid,
  allowance smallint,
  cooldown_seconds int,
  reservation_seconds int
)
returns category_selections
language plpgsql
security definer
set search_path = public
as $$
declare
  this_month date := date_trunc('month', now())::date;
  result category_selections;
begin
  if not acting_for(target_user) then
    raise exception 'reserve_category_selection: not permitted for that user';
  end if;

  insert into category_selections (user_id, tally_month, writes, pending_since)
  values (target_user, this_month, 1, now())
  on conflict (user_id) do update
    set writes = case
          when category_selections.tally_month is distinct from this_month
            then 1
          else category_selections.writes + 1
        end,
        tally_month = this_month,
        pending_since = now()
    where (
        category_selections.tally_month is distinct from this_month
        or category_selections.writes < allowance
      )
      and (
        category_selections.last_written_at is null
        or category_selections.last_written_at
             < now() - make_interval(secs => cooldown_seconds)
      )
      and (
        category_selections.pending_since is null
        -- A reservation older than this belonged to a call that never came
        -- back. Holding the band closed on its account would be worse than
        -- letting one extra attempt through.
        or category_selections.pending_since
             < now() - make_interval(secs => reservation_seconds)
      )
  returning * into result;

  -- The conflict clause declined, so nothing was returned. Hand back the row
  -- as it stands and let the caller read the reason off it.
  if result is null then
    select * into result from category_selections where user_id = target_user;
  end if;

  return result;
end;
$$;

-- Land a finished attempt.
--
-- Clears the reservation either way. Writes the order when one survived
-- verification; when none did, bumps `refused` and leaves the previous order
-- in place — a rejected answer is a reason to keep what was already there,
-- not to throw the band back to its default ordering.
create or replace function store_category_selection(
  target_user uuid,
  new_selection jsonb,
  new_digest text,
  new_model text,
  new_prompt_version smallint,
  refused_delta smallint
)
returns category_selections
language plpgsql
security definer
set search_path = public
as $$
declare
  result category_selections;
begin
  if not acting_for(target_user) then
    raise exception 'store_category_selection: not permitted for that user';
  end if;

  update category_selections
     set pending_since = null,
         last_written_at = now(),
         refused = category_selections.refused + coalesce(refused_delta, 0),
         selection = coalesce(new_selection, category_selections.selection),
         -- The digest and the order move together or not at all. A digest
         -- stored beside somebody else's order is worse than no digest: it
         -- would claim a stale ranking still describes the figures.
         findings_digest = case when new_selection is null
                             then category_selections.findings_digest
                             else new_digest end,
         model = case when new_selection is null
                   then category_selections.model else new_model end,
         prompt_version = case when new_selection is null
                            then category_selections.prompt_version
                            else new_prompt_version end,
         written_at = case when new_selection is null
                        then category_selections.written_at else now() end
   where user_id = target_user
  returning * into result;

  return result;
end;
$$;

-- Hand back an attempt that never reached the provider.
--
-- The pair to the read's refund, and `029` ships the same function beside its
-- own reserve for the same case: the provider was unreachable, the call never
-- landed, and nothing should have been charged for it. Without it an outage
-- permanently costs one of an allowance that is already small, and the only
-- way to clear `pending_since` before `reservation_seconds` elapses would be
-- to store a null selection — which also starts the cooldown, so a failure
-- nobody caused would lock the band twice over.
--
-- Guarded on there being an outstanding reservation, which is what makes it
-- unabusable: at most one is ever outstanding, so a client can only ever
-- return the attempt it just took, and calling it twice returns nothing the
-- second time. An answer that arrived and was rejected is not refunded — it
-- cost money.
--
-- No tally to give back separately, unlike the read's refund: the count lives
-- on this same row, so decrementing it *is* the refund.
create or replace function refund_category_selection(target_user uuid)
returns category_selections
language plpgsql
security definer
set search_path = public
as $$
declare
  result category_selections;
begin
  if not acting_for(target_user) then
    raise exception 'refund_category_selection: not permitted for that user';
  end if;

  update category_selections
     set writes = greatest(0, category_selections.writes - 1),
         pending_since = null
   where user_id = target_user
     and category_selections.pending_since is not null
  returning * into result;

  if result is null then
    select * into result from category_selections where user_id = target_user;
  end if;

  return result;
end;
$$;

/* ------------------------------------------------------------ the grants */

-- Revoked from PUBLIC in the same migration that creates them, rather than in
-- a later correction. Postgres grants EXECUTE to PUBLIC by default, so a
-- grant to two roles on its own restricts nothing — which is exactly what
-- `025` had to come back and fix for `022` and `024`. The revoke from anon is
-- stated too, so that reinstating a PUBLIC grant by accident does not
-- silently hand the anon role what these lines exist to withhold.
revoke execute on function reserve_category_read(uuid, uuid, smallint, int, int)
  from public, anon;
revoke execute on function store_category_read(
  uuid, uuid, jsonb, jsonb, text, smallint, text, smallint, text, smallint
) from public, anon;
revoke execute on function refund_category_read(uuid, uuid) from public, anon;
revoke execute on function reserve_category_selection(uuid, smallint, int, int)
  from public, anon;
revoke execute on function store_category_selection(
  uuid, jsonb, text, text, smallint, smallint
) from public, anon;
revoke execute on function refund_category_selection(uuid) from public, anon;

grant execute on function reserve_category_read(uuid, uuid, smallint, int, int)
  to authenticated, service_role;
grant execute on function store_category_read(
  uuid, uuid, jsonb, jsonb, text, smallint, text, smallint, text, smallint
) to authenticated, service_role;
grant execute on function refund_category_read(uuid, uuid)
  to authenticated, service_role;
grant execute on function reserve_category_selection(uuid, smallint, int, int)
  to authenticated, service_role;
grant execute on function store_category_selection(
  uuid, jsonb, text, text, smallint, smallint
) to authenticated, service_role;
grant execute on function refund_category_selection(uuid)
  to authenticated, service_role;
