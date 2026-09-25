-- What migration 039 has to be true for.
--
--   npx supabase db reset
--   docker exec -i supabase_db_finance-tracker psql -U postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/039_feature_flags.test.sql
--
-- Every check raises rather than returns; silence to the final echo is the
-- pass.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- fixtures

-- An account from before any cut-off, and one from after.
insert into auth.users (id, email, created_at)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'early@example.test',
    timestamptz '2026-01-15 09:00+00'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'late@example.test',
    timestamptz '2026-07-15 09:00+00'
  )
on conflict (id) do nothing;

insert into feature_flags (key, description, enabled_by_default, enabled_from)
values
  ('test.off', 'Off for everyone.', false, null),
  ('test.on', 'On for everyone.', true, null),
  (
    'test.new_accounts',
    'On for accounts created from June.',
    false,
    timestamptz '2026-06-01 00:00+00'
  );

insert into user_feature_flags (user_id, flag_key, enabled)
values
  ('11111111-1111-1111-1111-111111111111', 'test.off', true),
  ('22222222-2222-2222-2222-222222222222', 'test.on', false);

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

-- One flag's answer for whoever the session is. Null: no such row.
create or replace function test_flag(flag text) returns boolean
language sql as $$
  select enabled from evaluated_feature_flags() where key = flag;
$$;

-- --------------------------------------------------- the early account

select test_become('11111111-1111-1111-1111-111111111111');

select test_assert(
  test_flag('tags.manage') is false,
  'tags.manage is seeded, and off');

select test_assert(
  test_flag('test.on') is true,
  'a flag on by default is on');

select test_assert(
  test_flag('test.off') is true,
  'an override turns a flag on for one account');

select test_assert(
  test_flag('test.new_accounts') is false,
  'an account older than the cut-off stays off');

select test_assert(
  test_flag('no.such_flag') is null,
  'a flag the database does not know has no row');

-- ---------------------------------------------------- the late account

select test_become('22222222-2222-2222-2222-222222222222');

select test_assert(
  test_flag('test.off') is false,
  'another account''s override is not mine');

select test_assert(
  test_flag('test.on') is false,
  'an override turns a default-on flag off');

select test_assert(
  test_flag('test.new_accounts') is true,
  'an account from after the cut-off is on');

-- ------------------------------------------------ nobody reads the tables

select test_assert(
  (select count(*) from feature_flags) = 0,
  'no session reads the flag table itself');

select test_assert(
  (select count(*) from user_feature_flags) = 0,
  'nor anybody''s overrides, its own included');

do $$
begin
  insert into user_feature_flags (user_id, flag_key, enabled)
  values ('22222222-2222-2222-2222-222222222222', 'test.off', true);
  raise exception 'FAILED: a session switched a flag for itself';
exception
  when insufficient_privilege then
    raise notice '  ok  a session cannot switch a flag for itself';
end;
$$;

-- ---------------------------------------------------------- no session

reset role;
select set_config('request.jwt.claims',
  json_build_object('role', 'anon')::text, true);
select set_config('role', 'anon', true);

do $$
begin
  perform evaluated_feature_flags();
  raise exception 'FAILED: anon was allowed to ask';
exception
  when insufficient_privilege then
    raise notice '  ok  anon cannot ask at all';
end;
$$;

rollback;

\echo 'migration 039: all checks passed'
