-- What migration 061 has to be true for.
--
-- Run against a local stack, after 060:
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/061_joint_account.test.sql
--
-- Alice files one of her accounts « Compte commun » for the space she shares
-- with Bob: Bob reads it, Carol does not; nobody names a space they are not
-- in; a joint account without a space waits; leaving takes it out. Every
-- check raises rather than returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', '{"full_name": "Bob"}'),
  ('c3333333-3333-3333-3333-333333333333', 'carol@example.test', '{"full_name": "Carol"}')
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

create or replace function test_refused(query text) returns boolean
language plpgsql as $$
begin
  execute query;
  return false;
exception
  when insufficient_privilege or check_violation or raise_exception then
    return true;
end;
$$;

create temporary table ids (name text primary key, id uuid, token text)
  on commit drop;
grant all on ids to authenticated;

select test_become('a1111111-1111-1111-1111-111111111111');
insert into bank_accounts (user_id, provider_account_id, label, currency, iban_hash)
values
  ('a1111111-1111-1111-1111-111111111111', 'acc-joint', 'Compte joint', 'EUR', 'hash-joint'),
  ('a1111111-1111-1111-1111-111111111111', 'acc-own', 'Compte courant', 'EUR', 'hash-own');
insert into ids (name, id) values ('space', public.create_space('Commun'));
update ids set token = public.create_space_invite(id) where name = 'space';

select test_become('b2222222-2222-2222-2222-222222222222');
select public.join_space((select token from ids where name = 'space'));

select test_become('a1111111-1111-1111-1111-111111111111');
update bank_accounts
set role = 'joint', space_id = (select id from ids where name = 'space')
where provider_account_id = 'acc-joint';
select test_assert(
  (select role = 'joint' and not counts_as_cash
   from bank_accounts where provider_account_id = 'acc-joint'),
  'an account is filed « Compte commun », not counted as its owner''s cash');

update bank_accounts set role = 'joint' where provider_account_id = 'acc-own';
select test_assert(
  (select role is null from bank_accounts where provider_account_id = 'acc-own'),
  'a joint account with no space waits to be told what it is');

update bank_accounts set role = 'spending' where provider_account_id = 'acc-own';

select test_become('b2222222-2222-2222-2222-222222222222');
select test_assert(
  (select count(*) from bank_accounts) = 1
    and (select provider_account_id from bank_accounts) = 'acc-joint',
  'the partner reads the joint account, and not the other''s own');
select test_assert(
  test_refused($q$
    update bank_accounts set label = 'Pris' where provider_account_id = 'acc-joint'
  $q$) or (select label from bank_accounts where provider_account_id = 'acc-joint') = 'Compte joint',
  'and does not change it');

select test_become('c3333333-3333-3333-3333-333333333333');
insert into bank_accounts (user_id, provider_account_id, label, currency)
values ('c3333333-3333-3333-3333-333333333333', 'acc-carol', 'Carol', 'EUR');
select test_assert(
  (select count(*) from bank_accounts) = 1,
  'someone outside the space reads none of it');
select test_assert(
  test_refused(format($q$
    update bank_accounts set role = 'joint', space_id = %L
    where provider_account_id = 'acc-carol'
  $q$, (select id from ids where name = 'space'))),
  'nor names a space they are not in');

select test_become('a1111111-1111-1111-1111-111111111111');
select public.leave_space((select id from ids where name = 'space'));
select test_assert(
  (select role is null and space_id is null
   from bank_accounts where provider_account_id = 'acc-joint'),
  'leaving takes one''s joint account out of the space');

rollback;

\echo 061_joint_account: all assertions passed
