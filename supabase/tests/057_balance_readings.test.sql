-- What migration 057 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/057_balance_readings.test.sql
--
-- A user types, reads and replaces their own balance, and nobody else's. One
-- row each. Every check raises rather than returns; silence to the final echo
-- is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into balance_readings (user_id, read_on, amount)
values ('22222222-2222-2222-2222-222222222222', '2026-10-01', 500);

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
  when insufficient_privilege or check_violation or unique_violation then
    return true;
end;
$$;

select test_become('11111111-1111-1111-1111-111111111111');

insert into balance_readings (user_id, read_on, amount)
values ('11111111-1111-1111-1111-111111111111', '2026-10-08', -42.5);
select test_assert(
  (select amount from balance_readings) = -42.5,
  'a user types their balance, below zero too, and sees only theirs');

insert into balance_readings (user_id, read_on, amount)
values ('11111111-1111-1111-1111-111111111111', '2026-10-09', 812)
on conflict (user_id) do update
  set read_on = excluded.read_on, amount = excluded.amount;
select test_assert(
  (select count(*) from balance_readings) = 1
    and (select amount from balance_readings) = 812,
  'typing it again replaces it: one row each');

select test_assert(
  test_refused($q$
    insert into balance_readings (user_id, read_on, amount)
    values ('22222222-2222-2222-2222-222222222222', '2026-10-09', 1)
  $q$),
  'nobody types someone else''s balance');

update balance_readings set amount = 0
  where user_id = '22222222-2222-2222-2222-222222222222';
delete from balance_readings
  where user_id = '22222222-2222-2222-2222-222222222222';
reset role;
select test_assert(
  (select amount from balance_readings
    where user_id = '22222222-2222-2222-2222-222222222222') = 500,
  'nor changes or deletes it');

rollback;

\echo 057_balance_readings: all assertions passed
