-- What migration 073 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/073_entraide_authorship.test.sql
--
-- Nobody but the service role reads who wrote what, it outlives a deleted
-- account for its year, and the sweep takes only what is past the year —
-- keeping a decision whose message is still hidden.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at)
values ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now() - interval '3 days')
on conflict (id) do nothing;
insert into entraide_profiles (user_id, handle)
values ('a1111111-1111-1111-1111-111111111111', 'Alice');
insert into entraide_posts (author_id, title)
values ('a1111111-1111-1111-1111-111111111111', 'Une question pour le test');
select id as post from entraide_posts \gset

insert into entraide_authorship (target, operation, user_id, email, ip, created_at)
values
  ('post:' || :post, 'create', 'a1111111-1111-1111-1111-111111111111',
    'alice@example.test', '203.0.113.7', now()),
  ('post:' || :post, 'edit', 'a1111111-1111-1111-1111-111111111111',
    'alice@example.test', '203.0.113.7', now() - interval '13 months');

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
grant execute on function test_assert(boolean, text), test_error(text) to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select test_assert(
  test_error('select count(*) from entraide_authorship') like '%permission denied%',
  'not even its own author reads who wrote what');
select test_assert(
  test_error('select sweep_entraide()') like '%permission denied%',
  'nobody but the service role sweeps');
reset role;

-- A hidden post's decision, a year old, stays while the post stays hidden.
select set_config('entraide.moderating', 'on', true);
update entraide_posts set status = 'hidden' where id = :post;
select set_config('entraide.moderating', 'off', true);
insert into entraide_decisions (target, author_id, action, rule, created_at)
values ('post:' || :post, 'a1111111-1111-1111-1111-111111111111', 'hide', 'promotion',
  now() - interval '13 months');

delete from auth.users where id = 'a1111111-1111-1111-1111-111111111111';
select test_assert(
  (select count(*) from entraide_authorship) = 2,
  'who wrote what outlives the deleted account');

select sweep_entraide();
select test_assert(
  (select count(*) from entraide_authorship) = 1
    and (select operation from entraide_authorship) = 'create',
  'the sweep takes only what is past its year');

rollback;
