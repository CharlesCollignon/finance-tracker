-- What migration 058 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/058_audience_measurement.test.sql
--
-- A signed-in user's day is counted under a name that is not theirs, and
-- nothing for someone who turned it off; no client reads the rows; an
-- account deleted takes its rows with it. Every check raises rather than
-- returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'counted@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'optedout@example.test')
on conflict (id) do nothing;

insert into user_preferences (user_id, measure_audience)
values ('22222222-2222-2222-2222-222222222222', false)
on conflict (user_id) do update set measure_audience = false;

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

create or replace function test_refused(query text) returns boolean
language plpgsql as $$
begin
  execute query;
  return false;
exception
  when insufficient_privilege or undefined_table or invalid_schema_name then
    return true;
end;
$$;

select test_become('11111111-1111-1111-1111-111111111111');
select public.record_activity();
select public.record_activity('add');
select public.record_activity('add');
select public.record_activity('close');
select public.record_activity('a shop name');
select test_assert(
  test_refused('select * from insights.activity_days'),
  'no client reads the rows');

select test_become('22222222-2222-2222-2222-222222222222');
select public.record_activity('add');

reset role;
select test_assert(
  (select count(*) from insights.activity_days) = 1,
  'one row for the counted user, none for the one who turned it off');
select test_assert(
  (select events from insights.activity_days) = '{"add": 2, "close": 1}'::jsonb,
  'the counted things, and nothing that is not on the list');
select test_assert(
  (select actor from insights.activity_days)
    !~ '11111111-1111-1111-1111-111111111111',
  'the row does not carry the account id');
select test_assert(
  (select habit_pct from insights.figures) = 0
    and (select closed_pct from insights.figures) = 100,
  'the figures read the rows');

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select test_assert(
  (select count(*) from insights.activity_days) = 0,
  'an account deleted takes its rows with it');

rollback;

\echo 058_audience_measurement: all assertions passed
