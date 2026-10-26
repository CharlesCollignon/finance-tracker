-- What migration 080 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/080_investment_events.test.sql
--
-- An event is its owner's alone; a line read from a file is known again by
-- its fingerprint; a kind, an ISIN and an amount are what they say.

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

insert into investment_events (user_id, wallet, kind, occurred_on, instrument_name, isin, quantity, amount, source, fingerprint)
values
  ('a1111111-1111-1111-1111-111111111111', 'pea', 'buy', '2026-03-02', 'Amundi MSCI World',
    'FR0014003I54', 10, 254.30, 'file', '2026-03-02|buy|254.30|FR0014003I54|0'),
  ('a1111111-1111-1111-1111-111111111111', 'pea', 'dividend', '2026-06-15', 'Amundi MSCI World',
    'FR0014003I54', null, 3.20, 'manual', null);

select test_assert(
  (select count(*) from investment_events) = 2,
  'Alice reads her own events');

select test_assert(
  test_error($q$insert into investment_events (user_id, wallet, kind, occurred_on, amount, source, fingerprint)
    values ('a1111111-1111-1111-1111-111111111111', 'pea', 'buy', '2026-03-02', 254.30, 'file',
      '2026-03-02|buy|254.30|FR0014003I54|0')$q$) like '%investment_events_fingerprint%',
  'a line read from a file is one line, however many times the file is read');

select test_assert(
  test_error($q$insert into investment_events (user_id, wallet, kind, occurred_on, amount)
    values ('a1111111-1111-1111-1111-111111111111', 'pea', 'gift', '2026-03-02', 1)$q$) is not null,
  'a kind is a buy, a sell, a dividend or a fee');

select test_assert(
  test_error($q$insert into investment_events (user_id, wallet, kind, occurred_on, amount, isin)
    values ('a1111111-1111-1111-1111-111111111111', 'pea', 'buy', '2026-03-02', 1, 'not-an-isin')$q$) is not null,
  'an ISIN has the shape of one');

select test_assert(
  test_error($q$insert into investment_events (user_id, wallet, kind, occurred_on, amount)
    values ('a1111111-1111-1111-1111-111111111111', 'pea', 'fee', '2026-03-02', -1)$q$) is not null,
  'an amount is what moved, never signed');

-- ------------------------------------------------------------ as Bob

select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select test_assert(
  (select count(*) from investment_events) = 0,
  'Bob reads none of Alice''s events');

select test_assert(
  test_error($q$insert into investment_events (user_id, wallet, kind, occurred_on, amount)
    values ('a1111111-1111-1111-1111-111111111111', 'cto', 'buy', '2026-03-02', 1)$q$) is not null,
  'Bob cannot write an event as Alice');

rollback;
