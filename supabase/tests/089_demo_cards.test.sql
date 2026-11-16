-- What migration 089 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/089_demo_cards.test.sql
--
-- The demo user can't add, change or delete a card; anyone else can; and no
-- public table is left without the demo guard.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at, raw_app_meta_data)
values
  ('a8911111-1111-1111-1111-111111111111', 'alice-089@example.test', now(), '{}'),
  ('d8933333-3333-3333-3333-333333333333', 'demo-089@example.test', now(), '{"demo": true}')
on conflict (id) do nothing;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;

create or replace function test_error(query text) returns text
language plpgsql as $$
begin
  execute query;
  return null;
exception
  when others then
    return coalesce(nullif(sqlerrm, ''), sqlstate);
end;
$$;
grant execute on function test_assert(boolean, text), test_error(text) to authenticated, service_role;

select test_assert(
  not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not exists (
         select 1 from pg_trigger t
          where t.tgrelid = c.oid and t.tgname = 'refuse_demo_write'
       )
  ),
  'every public table has the demo guard');

-- ------------------------------------------------ as the service role: seed

insert into cards (id, user_id, key)
values ('c3333333-3333-3333-3333-333333333391', 'd8933333-3333-3333-3333-333333333333', 'CB *1234');

-- ------------------------------------------------------------ as the demo

select set_config('request.jwt.claims',
  '{"sub":"d8933333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select test_assert(
  (select count(*) from cards) = 1,
  'the demo reads its card');

select test_assert(
  test_error($q$insert into cards (user_id, key)
    values ('d8933333-3333-3333-3333-333333333333', 'CB *5678')$q$) like '%demo_read_only%',
  'the demo cannot add a card');

select test_assert(
  test_error($q$update cards set debit = 'deferred' where id = 'c3333333-3333-3333-3333-333333333391'$q$) like '%demo_read_only%',
  'the demo cannot answer a card''s debit');

select test_assert(
  test_error($q$delete from cards where id = 'c3333333-3333-3333-3333-333333333391'$q$) like '%demo_read_only%',
  'the demo cannot delete a card');

-- ---------------------------------------------------------------- as Alice

select set_config('request.jwt.claims',
  '{"sub":"a8911111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into cards (user_id, key)
values ('a8911111-1111-1111-1111-111111111111', 'CB *4321');

select test_assert(
  (select count(*) from cards where user_id = 'a8911111-1111-1111-1111-111111111111') = 1,
  'anyone else adds a card as before');

rollback;
