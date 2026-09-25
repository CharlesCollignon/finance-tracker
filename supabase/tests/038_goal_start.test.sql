-- What migration 038 has to be true for.
--
--   npx supabase db reset
--   docker exec -i supabase_db_finance-tracker psql -U postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/038_goal_start.test.sql
--
-- Every check raises rather than returns; silence to the final NOTICE is the
-- pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

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

select test_assert(
  (select is_nullable = 'NO'
     from information_schema.columns
    where table_name = 'savings_goals' and column_name = 'starts_on'),
  'starts_on exists and is not null'
);

select test_assert(
  (timestamptz '2026-03-15 23:30:00+00' at time zone 'Europe/Paris')::date
    = date '2026-03-16',
  'the backfill expression reads the Paris date, not the UTC one'
);

select test_become('11111111-1111-1111-1111-111111111111');

insert into savings_goals (id, user_id, name, target_amount)
values (
  'cccccccc-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Holidays',
  1200
);

select test_assert(
  (select starts_on from savings_goals
    where id = 'cccccccc-0000-0000-0000-000000000001')
    = (now() at time zone 'Europe/Paris')::date,
  'a goal created without a start counts from today'
);

update savings_goals
   set starts_on = date '2026-01-01'
 where id = 'cccccccc-0000-0000-0000-000000000001';

select test_assert(
  (select starts_on from savings_goals
    where id = 'cccccccc-0000-0000-0000-000000000001') = date '2026-01-01',
  'the owner can move the start'
);

select test_become('22222222-2222-2222-2222-222222222222');

select test_assert(
  (select count(*) from savings_goals) = 0,
  'another user still sees none of it'
);

rollback;

\echo 'migration 038: all checks passed'
