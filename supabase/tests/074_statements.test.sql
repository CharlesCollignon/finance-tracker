-- What migration 074 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/074_statements.test.sql
--
-- Lines a person brings are kept beside the bank's, marked; they do not make
-- a bank feed; an account is known again by its key, once per person; and
-- an import is the person's own to read and undo, never to erase.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now()),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', now())
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

insert into bank_accounts (user_id, provider_account_id, label, currency, source, statement_key, role)
values ('a1111111-1111-1111-1111-111111111111', 'statement:FR7630004000031234567890143',
  'Compte courant', 'EUR', 'file', 'FR7630004000031234567890143', 'spending');

select test_assert(
  test_error($q$insert into bank_accounts (user_id, provider_account_id, label, currency, source, statement_key)
    values ('a1111111-1111-1111-1111-111111111111', 'statement:other', 'Doublon', 'EUR', 'file',
      'FR7630004000031234567890143')$q$) like '%bank_accounts_statement_key%',
  'an account is known once by its key');

insert into statement_imports (id, user_id, provider_account_id, source, format, bank, lines_total, lines_new)
values ('c3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111',
  'statement:FR7630004000031234567890143', 'file', 'csv', 'bnp-paribas', 2, 2);

insert into bank_feed_items (user_id, provider_id, provider_account_id, occurred_on, amount,
  currency, direction, note, source, import_id)
values ('a1111111-1111-1111-1111-111111111111', 'statement:FR76…:labc-0',
  'statement:FR7630004000031234567890143', '2026-10-02', 23.45, 'EUR', 'out', 'CB MONOP',
  'file', 'c3333333-3333-3333-3333-333333333333');

select test_assert(
  (select source from bank_feed_items where provider_id = 'statement:FR76…:labc-0') = 'file',
  'a line brought by hand says so');
select test_assert(
  not exists (select 1 from bank_feed_items where user_id = 'a1111111-1111-1111-1111-111111111111' and source = 'bank'),
  'and is not a bank feed');
select test_assert(
  test_error($q$insert into bank_feed_items (user_id, provider_id, provider_account_id, occurred_on,
    amount, currency, direction, note, source)
    values ('a1111111-1111-1111-1111-111111111111', 'x', 'y', '2026-10-02', 1, 'EUR', 'out', 'z',
      'scraping')$q$) like '%bank_feed_items_source_check%',
  'only the ways in this plan bring lines');

update statement_imports set undone_at = now()
where id = 'c3333333-3333-3333-3333-333333333333';
select test_assert(
  (select undone_at is not null from statement_imports where id = 'c3333333-3333-3333-3333-333333333333'),
  'its owner undoes an import');
select test_assert(
  test_error($q$delete from statement_imports
    where id = 'c3333333-3333-3333-3333-333333333333'$q$) like '%permission denied%',
  'nobody erases one');

reset role;

-- -------------------------------------------------------------- as Bob

select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select test_assert(
  (select count(*) from statement_imports) = 0,
  'another person reads none of them');
select test_assert(
  test_error($q$insert into statement_imports (user_id, provider_account_id, source, format)
    values ('a1111111-1111-1111-1111-111111111111', 'statement:x', 'file', 'csv')$q$) is not null,
  'nor writes one in her name');
-- The same key is another person's to use.
insert into bank_accounts (user_id, provider_account_id, label, currency, source, statement_key)
values ('b2222222-2222-2222-2222-222222222222', 'statement:FR7630004000031234567890143',
  'Compte courant', 'EUR', 'file', 'FR7630004000031234567890143');
select test_assert(true, 'a key is unique per person, not across people');
reset role;

rollback;
