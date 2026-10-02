-- What migration 051 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/051_property_rental.test.sql
--
-- An energy class is one of seven letters or none; a property's asking
-- rents are its owner's alone and go with the property. Every check raises
-- rather than returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into properties (id, user_id, name, kind, usage, purchased_on, purchase_price, living_area)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Mon studio', 'apartment',
   'rental_furnished', '2019-06-01', 95000, 24),
  ('cccccccc-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Leur maison', 'house',
   'rental_bare', '2020-06-01', 350000, 110);

-- Theirs, written as the superuser, standing in for the cron.
insert into property_rent_references (property_id, user_id, series, rent_m2, low_m2, high_m2, scope, observations, edition)
values
  ('cccccccc-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'mai', 12.60, 8.88, 17.88,
   'commune', 305, 2025);

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

update properties set energy_class = 'F'
where id = 'cccccccc-0000-0000-0000-000000000001';

select test_assert(
  (select energy_class from properties
   where id = 'cccccccc-0000-0000-0000-000000000001') = 'F',
  'a user records their property''s energy class');

select test_assert(
  test_refused($q$
    update properties set energy_class = 'H'
    where id = 'cccccccc-0000-0000-0000-000000000001'
  $q$),
  'an energy class runs from A to G');

insert into property_rent_references (property_id, user_id, series, rent_m2, low_m2, high_m2, scope, observations, edition)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'app12', 15.67, 12.64, 19.43,
   'commune', 34359, 2025);

select test_assert(
  (select count(*) from property_rent_references) = 1,
  'a user sees the asking rents of their own property, and nobody else''s');

select test_assert(
  test_refused($q$
    insert into property_rent_references (property_id, user_id, series, rent_m2, low_m2, high_m2, scope, observations, edition)
    values ('cccccccc-0000-0000-0000-000000000002',
            '11111111-1111-1111-1111-111111111111', 'mai', 1, 1, 1,
            'commune', 1, 2025)
  $q$),
  'a user cannot write asking rents for someone else''s property');

select test_assert(
  test_refused($q$
    update property_rent_references set low_m2 = 20
    where property_id = 'cccccccc-0000-0000-0000-000000000001'
  $q$),
  'an interval runs low to high, around the figure');

select test_assert(
  test_refused($q$
    update property_rent_references set series = 'studio'
    where property_id = 'cccccccc-0000-0000-0000-000000000001'
  $q$),
  'a figure comes from one of the ANIL''s four tables');

delete from properties where id = 'cccccccc-0000-0000-0000-000000000001';

select test_assert(
  (select count(*) from property_rent_references) = 0,
  'a property going takes its asking rents with it');

rollback;

\echo 051 property rental: all checks passed
