-- What migration 040 has to be true for.
--
--   npx supabase db reset
--   docker exec -i supabase_db_finance-tracker psql -U postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/040_merge_tags.test.sql
--
-- Every check raises rather than returns; silence to the final echo is the
-- pass.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- fixtures

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into categories (id, user_id, name, type)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Groceries',
  'expense'
);

insert into transactions (id, user_id, category_id, occurred_on, amount)
select
  ('bbbbbbbb-0000-0000-0000-00000000000' || n)::uuid,
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000001',
  date '2026-09-01' + n,
  10 * n
from generate_series(1, 4) as n;

-- Holiday and Trip are to be merged; Flatmate is to be deleted; Theirs
-- belongs to somebody else.
insert into tags (id, user_id, name)
values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Holiday'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Trip'),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Flatmate'),
  ('cccccccc-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Theirs');

-- Transaction 2 carries both Holiday and Trip. Transaction 3 is about to go
-- in the bin still carrying Holiday.
insert into transaction_tags (transaction_id, tag_id)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003');

update transactions
   set deleted_at = now()
 where id = 'bbbbbbbb-0000-0000-0000-000000000003';

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

-- ------------------------------------------------------------- the merge

select test_become('11111111-1111-1111-1111-111111111111');

-- Transaction 1 gains Trip, transaction 3 (in the bin) gains Trip, and
-- transaction 2 already had it: two moved.
select test_assert(
  merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002') = 2,
  'a merge moves every transaction the tag was on, the one in the bin included');

select test_assert(
  (select count(*) from tags
    where id = 'cccccccc-0000-0000-0000-000000000001') = 0,
  'the merged tag is gone');

select test_assert(
  (select count(*) from transaction_tags
    where transaction_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1,
  'a transaction that carried both keeps exactly one link');

select test_assert(
  (select count(*) from transaction_tags
    where tag_id = 'cccccccc-0000-0000-0000-000000000002') = 2,
  'what the owner can see carries the kept tag');

reset role;

select test_assert(
  (select count(*) from transaction_tags
    where transaction_id = 'bbbbbbbb-0000-0000-0000-000000000003'
      and tag_id = 'cccccccc-0000-0000-0000-000000000002') = 1,
  'the transaction in the bin carries the kept tag, ready for a restore');

select test_assert(
  (select count(*) from transaction_tags
    where tag_id = 'cccccccc-0000-0000-0000-000000000001') = 0,
  'no link to the merged tag survives');

-- ---------------------------------------------------------- the refusals

select test_become('11111111-1111-1111-1111-111111111111');

do $$
begin
  perform merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000002');
  raise exception 'FAILED: a tag was merged into itself';
exception
  when invalid_parameter_value then
    raise notice '  ok  a tag cannot be merged into itself';
end;
$$;

do $$
begin
  perform merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000009');
  raise exception 'FAILED: my tag was merged into somebody else''s';
exception
  when insufficient_privilege then
    raise notice '  ok  a merge into somebody else''s tag is refused';
end;
$$;

select test_become('22222222-2222-2222-2222-222222222222');

do $$
begin
  perform merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000003',
    'cccccccc-0000-0000-0000-000000000002');
  raise exception 'FAILED: another user merged my tags';
exception
  when insufficient_privilege then
    raise notice '  ok  a merge for somebody else is refused';
end;
$$;

reset role;

select test_assert(
  (select count(*) from tags
    where id in (
      'cccccccc-0000-0000-0000-000000000002',
      'cccccccc-0000-0000-0000-000000000003',
      'cccccccc-0000-0000-0000-000000000009')) = 3,
  'a refused merge leaves every tag where it was');

-- ------------------------------------------- delete and rename, unchanged

select test_become('11111111-1111-1111-1111-111111111111');

delete from tags where id = 'cccccccc-0000-0000-0000-000000000003';

reset role;

select test_assert(
  (select count(*) from transaction_tags
    where transaction_id = 'bbbbbbbb-0000-0000-0000-000000000004') = 0
  and (select count(*) from transactions
    where id = 'bbbbbbbb-0000-0000-0000-000000000004') = 1,
  'deleting a tag takes it off its transactions and leaves them');

select test_become('11111111-1111-1111-1111-111111111111');

insert into tags (id, user_id, name)
values (
  'cccccccc-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'Spare'
);

do $$
begin
  update tags set name = 'Trip'
   where id = 'cccccccc-0000-0000-0000-000000000004';
  raise exception 'FAILED: two tags share a name';
exception
  when unique_violation then
    raise notice '  ok  a rename onto a name in use is refused (the app offers the merge)';
end;
$$;

rollback;

\echo 'migration 040: all checks passed'
