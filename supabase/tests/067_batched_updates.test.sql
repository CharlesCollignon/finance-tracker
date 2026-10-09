-- What migration 067 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/067_batched_updates.test.sql
--
-- One call updates every row it names, and only the caller's: Alice's batch
-- that names Bob's row leaves it as it was, whoever she says she is.

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

insert into categories (id, user_id, name, type)
values
  ('c1111111-1111-1111-1111-111111111111',
   'a1111111-1111-1111-1111-111111111111', 'Bourse', 'investment'),
  ('c1111111-1111-1111-1111-222222222222',
   'a1111111-1111-1111-1111-111111111111', 'PEA', 'investment'),
  ('c2222222-2222-2222-2222-222222222222',
   'b2222222-2222-2222-2222-222222222222', 'Bourse', 'investment');

insert into transactions (id, user_id, category_id, occurred_on, amount, note)
values
  ('11111111-0000-0000-0000-000000000001',
   'a1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111', '2026-10-15', 100, 'old'),
  ('11111111-0000-0000-0000-000000000002',
   'a1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111', '2026-10-20', 200, 'old'),
  ('22222222-0000-0000-0000-000000000001',
   'b2222222-2222-2222-2222-222222222222',
   'c2222222-2222-2222-2222-222222222222', '2026-10-15', 300, 'bob');

insert into bank_feed_items
  (user_id, provider_id, provider_account_id, occurred_on, amount, currency,
   direction, note)
values
  ('a1111111-1111-1111-1111-111111111111', 'tx-a1', 'acc-a', '2026-10-01',
   12.5, 'EUR', 'out', 'CARREFOUR'),
  ('a1111111-1111-1111-1111-111111111111', 'tx-a2', 'acc-a', '2026-10-01',
   4, 'EUR', 'out', 'BOULANGERIE'),
  ('b2222222-2222-2222-2222-222222222222', 'tx-a1', 'acc-b', '2026-10-01',
   9, 'EUR', 'out', 'BOB');

select test_become('a1111111-1111-1111-1111-111111111111');

select test_assert(
  public.reprice_occurrences(
    'a1111111-1111-1111-1111-111111111111',
    '[{"id": "11111111-0000-0000-0000-000000000001", "amount": 101.37,
       "note": "new", "category_id": "c1111111-1111-1111-1111-222222222222"},
      {"id": "11111111-0000-0000-0000-000000000002", "amount": "202.5",
       "note": null, "category_id": "c1111111-1111-1111-1111-111111111111"}]'
  ) = 2,
  'a batch of reprices is one call');
select test_assert(
  (select amount = 101.37 and note = 'new'
     and category_id = 'c1111111-1111-1111-1111-222222222222'
   from transactions where id = '11111111-0000-0000-0000-000000000001')
  and (select amount = 202.5 and note is null
       from transactions where id = '11111111-0000-0000-0000-000000000002'),
  'each row takes its own amount, note and category');

select test_assert(
  public.reprice_occurrences(
    'b2222222-2222-2222-2222-222222222222',
    '[{"id": "22222222-0000-0000-0000-000000000001", "amount": 1,
       "note": "taken", "category_id": "c2222222-2222-2222-2222-222222222222"}]'
  ) = 0,
  'naming another user changes nothing of theirs');

select test_assert(
  public.set_feed_balances(
    'a1111111-1111-1111-1111-111111111111',
    '[{"provider_id": "tx-a1", "balance_after": "1250.40", "intraday_index": 1},
      {"provider_id": "tx-a2", "balance_after": "1246.40", "intraday_index": 2}]'
  ) = 2,
  'a batch of balances is one call');
select test_assert(
  (select balance_after = 1250.40 and intraday_index = 1
   from bank_feed_items where provider_id = 'tx-a1')
  and (select status = 'pending' and note = 'CARREFOUR'
       from bank_feed_items where provider_id = 'tx-a1'),
  'the balance and its place change, nothing else of the row');

reset role;
select test_assert(
  (select amount = 300 and note = 'bob'
   from transactions where id = '22222222-0000-0000-0000-000000000001')
  and (select balance_after is null
       from bank_feed_items
       where user_id = 'b2222222-2222-2222-2222-222222222222'),
  'Bob''s rows are as they were');

rollback;

\echo 067_batched_updates: all assertions passed
