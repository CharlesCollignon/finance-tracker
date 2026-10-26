-- What migration 077 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/077_filing_rules.test.sql
--
-- A rule is its owner's alone, names a category of the same owner, exists
-- once per words and direction, counts what it filed, and goes with its
-- category.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now()),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', now())
on conflict (id) do nothing;

insert into public.owners (id, kind)
values
  ('a1111111-1111-1111-1111-111111111111', 'person'),
  ('b2222222-2222-2222-2222-222222222222', 'person')
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
grant execute on function test_assert(boolean, text), test_error(text) to authenticated;

-- ------------------------------------------------------------ as Bob

select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

insert into categories (id, user_id, name, type)
values ('cb222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
  'Courses', 'expense');

-- ------------------------------------------------------------ as Alice

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into categories (id, user_id, name, type)
values ('ca111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
  'Transports', 'expense');

insert into filing_rules (id, user_id, words, category_id, direction, created_from)
values ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
  'NAVIGO', 'ca111111-1111-1111-1111-111111111111', 'out', 'PRLV NAVIGO ANNUEL');

select test_assert(
  (select count(*) from filing_rules) = 1,
  'Alice reads her own rule');

select test_assert(
  test_error($q$insert into filing_rules (user_id, words, category_id)
    values ('a1111111-1111-1111-1111-111111111111', 'LIDL',
      'cb222222-2222-2222-2222-222222222222')$q$) is not null,
  'a rule cannot name another owner''s category');

select test_assert(
  test_error($q$insert into filing_rules (user_id, words, category_id)
    values ('a1111111-1111-1111-1111-111111111111', ' navigo ',
      'ca111111-1111-1111-1111-111111111111')$q$) like '%filing_rules_words%',
  'the same words, whatever their case, are one rule');

select test_assert(
  test_error($q$insert into filing_rules (user_id, words, category_id)
    values ('a1111111-1111-1111-1111-111111111111', 'x',
      'ca111111-1111-1111-1111-111111111111')$q$) is not null,
  'a rule needs two characters');

select bump_filing_rule('d1111111-1111-1111-1111-111111111111', 3);
select bump_filing_rule('d1111111-1111-1111-1111-111111111111', -5);

select test_assert(
  (select applied_count from filing_rules
   where id = 'd1111111-1111-1111-1111-111111111111') = 3,
  'a rule counts what it filed, and never less');

-- ------------------------------------------------------------ as Bob

select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select test_assert(
  (select count(*) from filing_rules) = 0,
  'Bob reads none of Alice''s rules');

select bump_filing_rule('d1111111-1111-1111-1111-111111111111', 10);

select test_assert(
  test_error($q$delete from filing_rules
    where id = 'd1111111-1111-1111-1111-111111111111'$q$) is null,
  'Bob deleting Alice''s rule touches nothing');

-- ------------------------------------------------------------ as Alice

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select test_assert(
  (select applied_count from filing_rules
   where id = 'd1111111-1111-1111-1111-111111111111') = 3,
  'Bob bumping Alice''s rule changed nothing');

-- ------------------------------------------------------- as the server

reset role;

delete from categories where id = 'ca111111-1111-1111-1111-111111111111';

select test_assert(
  (select count(*) from filing_rules
   where id = 'd1111111-1111-1111-1111-111111111111') = 0,
  'a rule goes with its category');

rollback;
