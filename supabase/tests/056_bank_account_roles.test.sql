-- What migration 056 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/056_bank_account_roles.test.sql
--
-- The role decides the tick, whoever writes it; a phone build that only
-- knows the tick still says what it meant; a user sets their own accounts'
-- roles and nobody else's. Every check raises rather than returns; silence to
-- the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

-- What the sync writes the first time it sees an account.
insert into bank_accounts (user_id, provider_account_id, label, currency)
values
  ('11111111-1111-1111-1111-111111111111', 'courant', 'Compte courant', 'EUR'),
  ('11111111-1111-1111-1111-111111111111', 'livret', 'Livret A', 'EUR'),
  ('22222222-2222-2222-2222-222222222222', 'theirs', 'Compte', 'EUR');

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
  when insufficient_privilege or check_violation then
    return true;
end;
$$;

select test_assert(
  (select bool_and(role is null and not counts_as_cash) from bank_accounts),
  'a new account has no role and does not count');

select test_become('11111111-1111-1111-1111-111111111111');

update bank_accounts set role = 'spending' where provider_account_id = 'courant';
update bank_accounts set role = 'savings' where provider_account_id = 'livret';

select test_assert(
  (select counts_as_cash from bank_accounts where provider_account_id = 'courant')
    and not (select counts_as_cash from bank_accounts
             where provider_account_id = 'livret'),
  'a current account counts, a savings account does not');

-- What the sync's upsert does on every run: label and balance, never the role.
update bank_accounts set label = 'Compte chèques', reported_balance = 120
where provider_account_id = 'courant';

select test_assert(
  (select role = 'spending' and counts_as_cash from bank_accounts
   where provider_account_id = 'courant'),
  'a sync leaves the role alone');

-- A phone build from before roles, unticking then ticking.
update bank_accounts set counts_as_cash = false
where provider_account_id = 'courant';

select test_assert(
  (select role = 'ignored' from bank_accounts
   where provider_account_id = 'courant'),
  'an untick from an older phone stops following the account');

update bank_accounts set counts_as_cash = true
where provider_account_id = 'livret';

select test_assert(
  (select role = 'spending' and counts_as_cash from bank_accounts
   where provider_account_id = 'livret'),
  'and a tick makes it a current account');

-- Both at once: the role wins.
update bank_accounts set role = 'ignored', counts_as_cash = true
where provider_account_id = 'livret';

select test_assert(
  (select role = 'ignored' and not counts_as_cash from bank_accounts
   where provider_account_id = 'livret'),
  'when both are written, the role decides the tick');

select test_assert(
  test_refused($q$
    update bank_accounts set role = 'joint'
    where provider_account_id = 'courant'
  $q$),
  'a role is one of the three');

update bank_accounts set role = 'spending' where provider_account_id = 'theirs';

reset role;

select test_assert(
  (select role is null from bank_accounts where provider_account_id = 'theirs'),
  'nobody sets someone else''s account');

rollback;

\echo 056 bank account roles: all checks passed
