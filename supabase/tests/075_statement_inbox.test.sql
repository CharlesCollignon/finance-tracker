-- What migration 075 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/075_statements.test.sql
--
-- An address is its person's alone to read, and the server's alone to
-- write; what waits from an e-mail likewise; an alert's line can name the
-- statement line that confirmed it; and the sweep lets go of what is done
-- with, and of a forwarding code a day old.

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

-- ----------------------------------------------- as the server (the webhook)

insert into statement_inboxes (user_id, token, forward_code, forward_code_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'abcdefghij12', '123456789', now() - interval '2 days'),
  ('b2222222-2222-2222-2222-222222222222', 'zyxwvutsrq98', '987654321', now());

select test_assert(
  test_error($q$insert into statement_inboxes (user_id, token)
    values ('a1111111-1111-1111-1111-111111111111', 'Not-A-Token!')$q$) is not null,
  'an address is twelve lower-case letters and digits, once per person');

insert into statement_mail_items (id, user_id, kind, format, statement, status, decided_at, received_at)
values
  ('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111',
    'statement', 'pdf', '{"blocks":[]}', 'waiting', null, now()),
  ('e5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111',
    'alerts', 'email', '{"blocks":[]}', 'imported', now() - interval '40 days', now() - interval '41 days');

insert into bank_feed_items (user_id, provider_id, provider_account_id, occurred_on, amount,
  currency, direction, note, source, confirmed_by)
values ('a1111111-1111-1111-1111-111111111111', 'statement:x:la-0', 'statement:x', '2026-10-11',
  23.50, 'EUR', 'out', 'MONOPRIX', 'email', 'statement:x:ls-0');
select test_assert(
  (select confirmed_by from bank_feed_items where provider_id = 'statement:x:la-0') = 'statement:x:ls-0',
  'an alert''s line names the statement line that confirmed it');

-- ------------------------------------------------------------ as Alice

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select test_assert(
  (select count(*) from statement_inboxes) = 1
    and (select token from statement_inboxes) = 'abcdefghij12',
  'a person reads their own address, and no one else''s');
select test_assert(
  (select count(*) from statement_mail_items) = 2,
  'and what came by e-mail for them');
select test_assert(
  test_error($q$update statement_inboxes set enabled = false$q$) like '%permission denied%',
  'but changes it only through the server');
select test_assert(
  test_error($q$insert into statement_mail_items (user_id, kind, format, statement)
    values ('a1111111-1111-1111-1111-111111111111', 'statement', 'csv', '{}')$q$) like '%permission denied%',
  'nor writes what came by e-mail');
select test_assert(
  test_error($q$select public.sweep_statement_mail()$q$) like '%permission denied%',
  'nor runs the sweep');

reset role;

-- -------------------------------------------------------------- as Bob

select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select test_assert(
  (select count(*) from statement_mail_items) = 0,
  'another person reads none of hers');
reset role;

-- ------------------------------------------------------------ the sweep

select public.sweep_statement_mail();
select test_assert(
  exists (select 1 from statement_mail_items where id = 'd4444444-4444-4444-4444-444444444444')
    and not exists (select 1 from statement_mail_items where id = 'e5555555-5555-5555-5555-555555555555'),
  'the sweep keeps what waits, and lets go of what was imported a month ago');
select test_assert(
  (select forward_code from statement_inboxes where user_id = 'a1111111-1111-1111-1111-111111111111') is null
    and (select forward_code from statement_inboxes where user_id = 'b2222222-2222-2222-2222-222222222222') = '987654321',
  'and of a forwarding code a day old, not of a fresh one');

rollback;
