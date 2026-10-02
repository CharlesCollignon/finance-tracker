-- What migration 050 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/050_property_market.test.sql
--
-- A property's market reading is its owner's alone and goes with the
-- property; the price index is readable by any signed-in session and
-- writable by none. Every check raises rather than returns; silence to the
-- final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into properties (id, user_id, name, kind, purchased_on, purchase_price, living_area)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Mon appartement', 'apartment',
   '2025-01-01', 250000, 52),
  ('cccccccc-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Leur maison', 'house',
   '2020-06-01', 350000, 110);

-- Theirs, written as the superuser, standing in for the cron.
insert into property_market_readings (property_id, user_id, scope, median_m2, q1_m2, q3_m2, sales, period_from, period_to, quarter)
values
  ('cccccccc-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'commune', 6700, 4800, 8200, 110,
   '2023-01-08', '2025-12-23', '2026-Q2');

insert into housing_price_index (series, quarter, value)
values ('010567013', '2026-Q2', 120.6);

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
  when insufficient_privilege or check_violation then
    return true;
end;
$$;

select test_become('11111111-1111-1111-1111-111111111111');

insert into property_market_readings (property_id, user_id, scope, median_m2, q1_m2, q3_m2, sales, period_from, period_to, quarter)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'radius', 4733, 3963, 5673, 404,
   '2023-01-03', '2025-12-30', '2026-Q2');

select test_assert(
  (select count(*) from property_market_readings) = 1,
  'a user sees the reading of their own property, and nobody else''s');

select test_assert(
  test_refused($q$
    insert into property_market_readings (property_id, user_id, scope, median_m2, q1_m2, q3_m2, sales, period_from, period_to, quarter)
    values ('cccccccc-0000-0000-0000-000000000002',
            '11111111-1111-1111-1111-111111111111', 'commune', 1, 1, 1, 1,
            '2025-01-01', '2025-01-01', '2026-Q2')
  $q$),
  'a user cannot write a reading for someone else''s property');

select test_assert(
  test_refused($q$
    update property_market_readings set q1_m2 = 9000
    where property_id = 'cccccccc-0000-0000-0000-000000000001'
  $q$),
  'a spread runs low to high, around the median');

select test_assert(
  (select count(*) from housing_price_index) = 1,
  'any signed-in session reads the price index');

select test_assert(
  test_refused($q$
    insert into housing_price_index (series, quarter, value)
    values ('010567063', '2026-Q2', 131.6)
  $q$),
  'and none can write it');

delete from properties where id = 'cccccccc-0000-0000-0000-000000000001';

select test_assert(
  (select count(*) from property_market_readings) = 0,
  'a property going takes its reading with it');

rollback;

\echo 050 property market: all checks passed
