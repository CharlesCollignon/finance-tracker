-- What migration 036 has to be true for.
--
-- Run against a local stack, which is the only place a migration in this repo
-- can be executed before it meets real data:
--
--   supabase start
--   supabase db reset          -- replays 001..036
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/036_soft_delete.test.sql
--
-- Every check raises rather than returns, so the first failure stops the run
-- with a non-zero exit. Silence to the final NOTICE is the pass.
--
-- Deliberately not pgTAP: this repo has no test extension installed and the
-- assertions below are plain enough not to need one.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- fixtures

-- Two users, so every check can also prove the boundary between them.
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into categories (id, user_id, name, type)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Groceries',
    'expense'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Salary',
    'income'
  );

insert into transactions (id, user_id, category_id, occurred_on, amount)
values
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-0000-0000-0000-000000000001',
    date '2026-09-01',
    12.50
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-0000-0000-0000-000000000001',
    date '2026-09-02',
    7.25
  );

-- Become the first user, so RLS is actually exercised rather than bypassed.
-- `supabase db reset` leaves us as a superuser, for whom RLS does not apply
-- at all — a check run in that role passes whatever the policy says.
create or replace function test_become(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;

-- ------------------------------------------------- the policy hides a mark

select test_become('11111111-1111-1111-1111-111111111111');

select test_assert(
  (select count(*) from transactions) = 2,
  'both transactions visible before anything is deleted');

-- Through the function the app will call. A direct `update ... set
-- deleted_at` is refused for the owner too, and rightly: Postgres checks an
-- updated row against the select policy, which hides marked rows, so every
-- mark has to go through the definer functions that also save the undo.
select soft_delete_transactions(
  '11111111-1111-1111-1111-111111111111',
  array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[]);

select test_assert(
  (select count(*) from transactions) = 1,
  'a marked transaction is hidden from an ordinary select');

select test_assert(
  (select count(*) from transactions
    where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
  'and hidden even when asked for by id');

-- This is the check that matters most. Every one of the 41 query sites in
-- apps/web and 37 in apps/mobile relies on the policy rather than on its own
-- filter, so a policy that only hides rows from unqualified selects would
-- leak through every aggregate in the app.
select test_assert(
  (select coalesce(sum(amount), 0) from transactions) = 7.25,
  'a marked transaction is out of the sums too, not just the lists');

-- ------------------------------------------------------ restore finds them

reset role;
select restore_transactions(
  '11111111-1111-1111-1111-111111111111',
  array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[]);

select test_become('11111111-1111-1111-1111-111111111111');
select test_assert(
  (select count(*) from transactions) = 2,
  'restore brings a marked transaction back into view');

-- ------------------------------------------- restore is not a way in

select test_become('22222222-2222-2222-2222-222222222222');
do $$
begin
  perform restore_transactions(
    '11111111-1111-1111-1111-111111111111',
    array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[]);
  raise exception 'FAILED: another user was allowed to restore my rows';
exception
  when insufficient_privilege or raise_exception then
    raise notice '  ok  a restore for somebody else is refused';
end;
$$;

-- ------------------------------------------------- a category still refuses

-- 001 makes categories.id `on delete restrict` from transactions, which is
-- what produces today's "Archive it instead". A soft delete is an update and
-- fires no constraint, so the refusal has to be restated or it is lost.
select test_become('11111111-1111-1111-1111-111111111111');

do $$
begin
  perform soft_delete_category(
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception
    'FAILED: a category with transactions behind it was allowed to be marked';
exception
  when foreign_key_violation then
    raise notice '  ok  a category still in use refuses to be deleted';
end;
$$;

-- ----------------------------------------- the unique slot is given back

-- Groceries still has live transactions, so soft_delete_category refuses it
-- (checked above). This section is about the unique index, not about who may
-- mark, so the mark is made as the superuser.
reset role;
update categories set deleted_at = now()
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select test_become('11111111-1111-1111-1111-111111111111');

-- Without a partial unique index this insert fails: the marked row still
-- holds (user, 'Groceries', 'expense'), so somebody who deleted a category
-- by mistake could not simply make it again.
insert into categories (id, user_id, name, type)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'Groceries',
  'expense'
);

select test_assert(
  (select count(*) from categories where name = 'Groceries') = 1,
  'a name freed by a delete can be used again, and only one is visible');

-- The same question for the recurring slot, which is the one somebody hits
-- straight after deleting a charge by mistake and re-applying the template.
select test_assert(
  (select indexdef like '%deleted_at IS NULL%'
     from pg_indexes
    where indexname = 'transactions_recurring_date_uidx') is true,
  'the recurring-date unique index ignores marked rows');

-- -------------------------------------------------------------- the sweeper

reset role;
update transactions set deleted_at = now() - interval '400 days'
 where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select sweep_deleted(now() - interval '30 days');

select test_assert(
  (select count(*) from transactions
    where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0,
  'the sweeper hard-deletes a mark older than the window');

select test_assert(
  (select count(*) from transactions
    where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 1,
  'and leaves a live row alone');

rollback;

\echo ''
\echo '  036 verified.'
