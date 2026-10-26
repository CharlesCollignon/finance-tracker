-- What migration 079 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/079_splits_receipts.test.sql
--
-- A split's parts carry one group; a receipt's path is bounded; a receipt
-- file goes under its owner's folder and nobody else's.

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

-- ------------------------------------------------------------ as Alice

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

insert into categories (id, user_id, name, type)
values ('ca111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
  'Courses', 'expense');

insert into transactions (id, user_id, category_id, occurred_on, amount, note, split_group, receipt_path)
values
  ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
    'ca111111-1111-1111-1111-111111111111', '2026-10-02', 30, 'Carrefour',
    'f1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111/e1111111-1111-1111-1111-111111111111/ticket.jpg'),
  ('e1111111-1111-1111-1111-111111111112', 'a1111111-1111-1111-1111-111111111111',
    'ca111111-1111-1111-1111-111111111111', '2026-10-02', 12.5, 'Carrefour',
    'f1111111-1111-1111-1111-111111111111', null);

select test_assert(
  (select count(*) from transactions
   where split_group = 'f1111111-1111-1111-1111-111111111111') = 2,
  'a split is two rows carrying one group');

select test_assert(
  test_error($q$update transactions set receipt_path = ''
    where id = 'e1111111-1111-1111-1111-111111111112'$q$) is not null,
  'a receipt path is never empty');

insert into storage.objects (bucket_id, name, owner)
values ('receipts',
  'a1111111-1111-1111-1111-111111111111/e1111111-1111-1111-1111-111111111111/ticket.jpg',
  'a1111111-1111-1111-1111-111111111111');

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'receipts') = 1,
  'Alice puts a receipt under her own folder, and reads it');

select test_assert(
  test_error($q$insert into storage.objects (bucket_id, name, owner)
    values ('receipts', 'b2222222-2222-2222-2222-222222222222/x/ticket.jpg',
      'a1111111-1111-1111-1111-111111111111')$q$) is not null,
  'Alice cannot put a receipt under Bob''s folder');

-- ------------------------------------------------------------ as Bob

select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'receipts') = 0,
  'Bob reads none of Alice''s receipts');

rollback;
