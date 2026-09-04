-- Who may call the four functions that write on a user's behalf.
--
-- `022_bank_pulls` and `024_month_reads` each define `security definer`
-- functions that take a `target_user` and write rows for them. Both files say,
-- in a comment, that the `grant execute ... to authenticated, service_role`
-- underneath is what stops a session naming somebody else. That is wrong, in
-- two ways that compound, and this migration is the correction.
--
-- The first: Postgres grants EXECUTE on a new function to PUBLIC by default.
-- An explicit grant to two roles adds nothing and takes nothing away, so
-- `anon` — the role behind the publishable key that ships in every browser
-- and both app bundles — could call all four.
--
-- The second, and the one that made the first bite: the guard reads
--
--     target_user <> coalesce(auth.uid(), target_user)
--
-- which passes whenever `auth.uid()` is null. That was written for the service
-- role, which has no `auth.uid()` because it is not a person. But `anon` has
-- no `auth.uid()` either, for the opposite reason, and the guard cannot tell
-- the two apart. An unauthenticated caller naming any user id was therefore
-- treated as that user: it could spend their month-read allowance, put prose
-- of its own choosing on their Month page, or inflate their bank-pull tally
-- until the day's PSD2 ceiling refused their own refresh.
--
-- User ids are uuids and are not enumerable, which is the only reason this was
-- narrow rather than wide. It is not a defence, and "you must guess a uuid" is
-- not an access rule.
--
-- Fixed on both sides, because either alone would do it and neither should be
-- the only thing standing there:
--
--   1. The grant is made real by revoking the default one from PUBLIC.
--   2. The guard names the service role explicitly instead of inferring it
--      from an absence, so a caller with no `auth.uid()` and no service-role
--      claim is refused rather than trusted.
--
-- Nothing about the bodies changes. Each function is recreated whole because
-- `create or replace` is the only way to change one, and each is byte-for-byte
-- its previous self apart from the guard.

/* ------------------------------------------------------------ the guard */

-- The rule the four functions share, in one place so they cannot drift.
--
-- Either you are the user you name, or you are the service role acting for
-- them — which is how the cron runs, with no session and nobody present.
-- `request.jwt.claims` is what PostgREST sets from the caller's key; a
-- connection with no claims at all (psql, a migration) is not trusted here
-- either, because anything with that kind of access can write the table
-- directly and does not need a function.
create or replace function acting_for(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Every comparison here is null-proof, and that is the whole point. The bug
  -- this migration fixes was a guard that reasoned about a null `auth.uid()`
  -- as though it meant "trusted"; the same trap sits one level down, because
  -- `auth.uid() = target_user` is null rather than false for an anonymous
  -- caller, `not null` is null, and `if not null then` does not fire. So the
  -- comparison is `is not distinct from`, which is never null, and the whole
  -- expression is wrapped in a coalesce that can only be true or false.
  select coalesce(
    target_user is not null
    and (
      auth.uid() is not distinct from target_user
      -- `nullif` because an unset claim comes back as null but an empty one
      -- comes back as '', and '' is not jsonb. A guard must not be able to
      -- fail with a parse error either.
      or coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb
             ->> 'role',
           ''
         ) = 'service_role'
    ),
    false
  );
$$;

comment on function acting_for(uuid) is
  'True when the caller may write rows belonging to target_user: they are '
  'that user, or they are the service role. Never true for anon.';

/* -------------------------------------------------------- 022_bank_pulls */

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
  if not acting_for(target_user) then
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

/* ------------------------------------------------------- 024_month_reads */

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
  if not acting_for(target_user) then
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
        or month_reads.pending_since
             < now() - make_interval(secs => reservation_seconds)
      )
  returning * into result;

  if result is null then
    select * into result from month_reads
      where user_id = target_user and month = target_month;
  end if;

  return result;
end;
$$;

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
  if not acting_for(target_user) then
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
  if not acting_for(target_user) then
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

/* ------------------------------------------------------------ the grants */

-- `create or replace` on an existing function keeps its privileges, so the
-- default PUBLIC grant from 022 and 024 is still there and has to be taken
-- away by name. Revoking from PUBLIC is what does the work; the revoke from
-- anon is stated too, so that reinstating a PUBLIC grant by accident does not
-- silently hand the anon role back what this migration exists to remove.
revoke execute on function acting_for(uuid) from public, anon;
revoke execute on function record_bank_pull(uuid, boolean, date) from public, anon;
revoke execute on function reserve_month_read(uuid, date, smallint, int, int)
  from public, anon;
revoke execute on function store_month_read(
  uuid, date, jsonb, jsonb, text, smallint, text, smallint, smallint, text
) from public, anon;
revoke execute on function refund_month_read(uuid, date) from public, anon;

grant execute on function acting_for(uuid) to authenticated, service_role;
grant execute on function record_bank_pull(uuid, boolean, date)
  to authenticated, service_role;
grant execute on function reserve_month_read(uuid, date, smallint, int, int)
  to authenticated, service_role;
grant execute on function store_month_read(
  uuid, date, jsonb, jsonb, text, smallint, text, smallint, smallint, text
) to authenticated, service_role;
grant execute on function refund_month_read(uuid, date)
  to authenticated, service_role;
