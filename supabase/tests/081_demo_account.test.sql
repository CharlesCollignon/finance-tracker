-- What migration 081 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/081_demo_account.test.sql
--
-- The demo user reads and writes nothing; anyone else is untouched; the
-- service role, which seeds the demo, writes as before.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at, raw_app_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now(), '{}'),
  ('d3333333-3333-3333-3333-333333333333', 'demo@example.test', now(), '{"demo": true}')
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

-- ------------------------------------------------ as the service role: seed

insert into categories (id, user_id, name, type)
values ('c3333333-3333-3333-3333-333333333331', 'd3333333-3333-3333-3333-333333333333', 'Courses', 'expense');

select test_assert(
  (select count(*) from categories where user_id = 'd3333333-3333-3333-3333-333333333333') = 1,
  'the seed, under no user, writes the demo''s rows');

select test_assert(
  public.is_demo_user('d3333333-3333-3333-3333-333333333333')
  and not public.is_demo_user('a1111111-1111-1111-1111-111111111111'),
  'is_demo_user reads the app metadata');

set local role service_role;
select test_assert(
  public.demo_user_id() = 'd3333333-3333-3333-3333-333333333333',
  'the service role finds the demo user');
reset role;

-- ------------------------------------------------------------ as the demo

select set_config('request.jwt.claims',
  '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select test_assert(
  (select count(*) from categories) = 1,
  'the demo reads its rows');

select test_assert(
  test_error($q$insert into categories (user_id, name, type)
    values ('d3333333-3333-3333-3333-333333333333', 'Loisirs', 'expense')$q$) like '%demo_read_only%',
  'the demo cannot add a row');

select test_assert(
  test_error($q$update categories set name = 'Autre' where id = 'c3333333-3333-3333-3333-333333333331'$q$) like '%demo_read_only%',
  'the demo cannot change a row');

select test_assert(
  test_error($q$delete from categories where id = 'c3333333-3333-3333-3333-333333333331'$q$) like '%demo_read_only%',
  'the demo cannot delete a row');

select test_assert(
  test_error($q$insert into transactions (user_id, category_id, occurred_on, amount)
    values ('d3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333331', '2026-03-02', 12)$q$) like '%demo_read_only%',
  'nor on any other table');

select test_assert(
  not public.receipt_folder_is_mine('d3333333-3333-3333-3333-333333333333/receipt.jpg'),
  'the demo has no receipt folder');

-- ---------------------------------------------------------------- as Alice

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into categories (user_id, name, type)
values ('a1111111-1111-1111-1111-111111111111', 'Courses', 'expense');

select test_assert(
  (select count(*) from categories where user_id = 'a1111111-1111-1111-1111-111111111111') = 1,
  'anyone else writes as before');

select test_assert(
  public.receipt_folder_is_mine('a1111111-1111-1111-1111-111111111111/receipt.jpg'),
  'and keeps their receipt folder');

rollback;
