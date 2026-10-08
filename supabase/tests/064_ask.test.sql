-- What migration 064 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/064_ask.test.sql
--
-- Alice's conversations are hers alone; the month's questions stop at the
-- allowance and a refund hands one back; the sweep takes what is older than
-- thirty days and nothing younger.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test')
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

select test_become('a1111111-1111-1111-1111-111111111111');
insert into ask_conversations (user_id, title)
values ('a1111111-1111-1111-1111-111111111111', 'Mes courses');
insert into ask_messages (conversation_id, user_id, role, body)
select id, user_id, 'question', '{"text": "Combien en courses ?"}'
from ask_conversations;
select test_assert(
  (select count(*) from ask_messages) = 1,
  'a person keeps a conversation and its messages');

select test_assert(
  public.reserve_ask('2026-10-01', 2) = 1
    and public.reserve_ask('2026-10-01', 2) = 2
    and public.reserve_ask('2026-10-01', 2) is null,
  'the month''s questions stop at the allowance');
select public.refund_ask('2026-10-01');
select test_assert(
  public.reserve_ask('2026-10-01', 2) = 2,
  'and a question the model never answered is handed back');

select test_become('b2222222-2222-2222-2222-222222222222');
select test_assert(
  (select count(*) from ask_conversations) = 0
    and (select count(*) from ask_messages) = 0
    and (select count(*) from ask_tallies) = 0,
  'nobody else reads any of it');
select test_assert(
  test_refused($q$
    insert into ask_messages (conversation_id, user_id, role, body)
    select id, 'b2222222-2222-2222-2222-222222222222', 'answer', '{}'
    from ask_conversations
  $q$) or (select count(*) from ask_conversations) = 0,
  'nor writes into it');

reset role;
insert into ask_conversations (user_id, title, updated_at)
values ('b2222222-2222-2222-2222-222222222222', 'Ancienne', now() - interval '31 days');
create temporary table swept on commit drop as select public.sweep_ask() as n;
select test_assert(
  (select n from swept) = 1
    and (select count(*) from ask_conversations) = 1,
  'the sweep takes what is past thirty days, and nothing younger');

rollback;

\echo 064_ask: all assertions passed
