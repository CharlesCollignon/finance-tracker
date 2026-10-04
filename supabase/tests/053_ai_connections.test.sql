-- What migration 053 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/053_ai_connections.test.sql
--
-- A user sees and deletes their own AI connection and changes its model;
-- they cannot create one, change anything else on it, see anyone else's, or
-- reach the sealed key or a round trip in progress at all. Every check
-- raises rather than returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

-- What the server writes, with the service role, after a verified round trip.
insert into ai_connections (user_id, model)
values
  ('11111111-1111-1111-1111-111111111111', 'mistralai/mistral-medium-3-5'),
  ('22222222-2222-2222-2222-222222222222', 'openai/gpt-6-sol');

insert into ai_connection_secrets (user_id, ciphertext, key_id)
values
  ('11111111-1111-1111-1111-111111111111', 'iv.tag.body', 'abc123'),
  ('22222222-2222-2222-2222-222222222222', 'iv.tag.body', 'abc123');

insert into ai_connect_flows (state, user_id, verifier_ciphertext, key_id, mode, expires_at)
values
  ('state-1', '11111111-1111-1111-1111-111111111111', 'iv.tag.body', 'abc123',
   'redirect', now() + interval '10 minutes');

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

select test_assert(
  (select count(*) from ai_connections) = 1
    and (select model from ai_connections) = 'mistralai/mistral-medium-3-5',
  'a user sees their own connection, and only theirs');

update ai_connections set model = 'anthropic/claude-sonnet-5.5', updated_at = now()
where user_id = '11111111-1111-1111-1111-111111111111';

select test_assert(
  (select model from ai_connections) = 'anthropic/claude-sonnet-5.5',
  'and changes its model');

select test_assert(
  test_refused($q$
    update ai_connections set provider = 'openrouter', connected_at = now()
    where user_id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'but nothing else on it');

select test_assert(
  test_refused($q$
    insert into ai_connections (user_id, model)
    values ('11111111-1111-1111-1111-111111111111', 'x')
  $q$),
  'and cannot create one: only a verified round trip does');

select test_assert(
  test_refused($q$ select ciphertext from ai_connection_secrets $q$),
  'the sealed key is out of reach');

select test_assert(
  test_refused($q$ select state from ai_connect_flows $q$),
  'and so is a round trip in progress');

delete from ai_connections where user_id = '22222222-2222-2222-2222-222222222222';
delete from ai_connections where user_id = '11111111-1111-1111-1111-111111111111';

reset role;

select test_assert(
  (select count(*) from ai_connections
   where user_id = '22222222-2222-2222-2222-222222222222') = 1,
  'nobody deletes someone else''s connection');

select test_assert(
  not exists (select 1 from ai_connection_secrets
              where user_id = '11111111-1111-1111-1111-111111111111'),
  'deleting a connection takes its key with it');

select test_assert(
  exists (select 1 from feature_flags where key = 'ai.account'
          and not enabled_by_default),
  'the flag exists, off for everyone');

rollback;

\echo 053 ai connections: all checks passed
