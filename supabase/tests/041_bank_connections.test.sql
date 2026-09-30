-- What migration 041 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/041_bank_connections.test.sql
--
-- The point of the migration is one property: the sealed bank secrets are
-- reachable by the service role and by nobody else — not by another user,
-- and not by the user they belong to either. (041 also made a table for
-- consent flows in progress; 042 dropped it with the partner flow.) Every
-- check raises rather than returns; silence to the final NOTICE is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

-- Written as the superuser, standing in for the service role.
insert into bank_connections (user_id, status)
values
  ('11111111-1111-1111-1111-111111111111', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'active');

insert into bank_connection_secrets (user_id, ciphertext, key_id)
values
  ('11111111-1111-1111-1111-111111111111', 'sealed-mine', 'k1'),
  ('22222222-2222-2222-2222-222222222222', 'sealed-theirs', 'k1');

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

-- A select the role is not granted at all raises rather than returning no
-- rows, so each is tried and the refusal is what passes.
create or replace function test_refused(query text) returns boolean
language plpgsql as $$
begin
  execute query;
  return false;
exception when insufficient_privilege then
  return true;
end;
$$;

select test_become('11111111-1111-1111-1111-111111111111');

select test_assert(
  (select count(*) from bank_connections) = 1,
  'a user sees their own connection status and nobody else''s');

select test_assert(
  (select status from bank_connections) = 'active',
  'and can read what it says');

select test_assert(
  test_refused('select * from bank_connection_secrets'),
  'the sealed secrets are refused to the user they belong to');

select test_assert(
  test_refused(
    'update bank_connections set status = ''revoked'''
  ) or (select count(*) from bank_connections where status = 'revoked') = 0,
  'a user cannot rewrite their own connection status');

rollback;

\echo 041 bank connections: all checks passed
