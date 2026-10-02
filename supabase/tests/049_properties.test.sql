-- What migration 049 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/049_properties.test.sql
--
-- A user's properties and loans are theirs alone; nothing they write can
-- reach someone else's property or template; a property going takes its
-- loans with it and leaves its templates attached to nothing; and the terms
-- a schedule is worked out from cannot contradict each other. Every check
-- raises rather than returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into categories (id, user_id, name, type)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Remboursement de prêt', 'expense'),
  ('aaaaaaaa-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Remboursement de prêt', 'expense');

insert into recurring_templates (id, user_id, category_id, amount, recurrence, day_of_month)
values
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 1159.92, 'monthly', 5),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-0000-0000-0000-000000000002', 900, 'monthly', 10);

-- Theirs, written as the superuser.
insert into properties (id, user_id, name, kind, purchased_on, purchase_price, living_area)
values
  ('cccccccc-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Leur maison', 'house',
   '2020-06-01', 350000, 110);

insert into property_loans (user_id, property_id, label, principal, annual_rate, months, first_payment_on)
values
  ('22222222-2222-2222-2222-222222222222',
   'cccccccc-0000-0000-0000-000000000002', 'Prêt principal', 280000, 0.012, 300,
   '2020-08-10');

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

-- A write a policy or a check refuses raises; the refusal is what passes.
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

select test_become('11111111-1111-1111-1111-111111111111');

insert into properties (id, user_id, name, kind, purchased_on, purchase_price, notary_fees, living_area, ownership_share)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Appartement Lyon 3e', 'apartment',
   '2025-01-01', 250000, 18000, 52, 0.5);

insert into property_loans (id, user_id, property_id, label, principal, annual_rate, months, first_payment_on, insurance_monthly, recurring_template_id)
values
  ('dddddddd-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'cccccccc-0000-0000-0000-000000000001', 'Prêt principal', 200000, 0.035, 240,
   '2025-01-05', 45, 'bbbbbbbb-0000-0000-0000-000000000001');

update recurring_templates
set property_id = 'cccccccc-0000-0000-0000-000000000001'
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select test_assert(
  (select count(*) from properties) = 1
    and (select count(*) from property_loans) = 1,
  'a user sees their own property and loan, and nobody else''s');

select test_assert(
  test_refused($q$
    insert into properties (user_id, name, kind, purchased_on, purchase_price)
    values ('22222222-2222-2222-2222-222222222222', 'Pas à moi', 'house', '2024-01-01', 1)
  $q$),
  'a user cannot write a property for someone else');

select test_assert(
  test_refused($q$
    insert into property_loans (user_id, property_id, label, principal, annual_rate, months, first_payment_on)
    values ('11111111-1111-1111-1111-111111111111',
            'cccccccc-0000-0000-0000-000000000002', 'Sur leur maison', 1000, 0.01, 12, '2025-01-01')
  $q$),
  'a loan cannot hang off someone else''s property');

select test_assert(
  test_refused($q$
    update property_loans
    set recurring_template_id = 'bbbbbbbb-0000-0000-0000-000000000002'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'a loan cannot point at someone else''s template');

select test_assert(
  test_refused($q$
    update recurring_templates
    set property_id = 'cccccccc-0000-0000-0000-000000000002'
    where id = 'bbbbbbbb-0000-0000-0000-000000000001'
  $q$),
  'a template cannot belong to someone else''s property');

select test_assert(
  test_refused($q$
    update property_loans set insurance_rate = 0.0036
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'insurance is a monthly amount or a rate, not both');

select test_assert(
  test_refused($q$
    update property_loans set deferral_months = 12
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'a deferral has a kind');

select test_assert(
  test_refused($q$
    update property_loans set kind = 'in_fine', deferral_months = 6, deferral_kind = 'partial'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'an in fine loan has no deferral');

select test_assert(
  test_refused($q$
    update property_loans set deferral_months = 240, deferral_kind = 'partial'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'a deferral leaves at least one payment to make');

select test_assert(
  test_refused($q$
    update property_loans set known_outstanding = 150000
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'what the bank says is owed comes with its day and what it kept');

select test_assert(
  test_refused($q$
    update properties set value_pinned = 300000
    where id = 'cccccccc-0000-0000-0000-000000000001'
  $q$),
  'the user''s own value comes with its day');

select test_assert(
  test_refused($q$
    update properties set ownership_share = 0
    where id = 'cccccccc-0000-0000-0000-000000000001'
  $q$),
  'a share is more than nothing');

select test_assert(
  coalesce(
    (select enabled from evaluated_feature_flags() where key = 'property.track'),
    true
  ) = false,
  'the flag exists and is off');

-- The template goes: the loan stays and points at nothing.
delete from recurring_templates where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select test_assert(
  (select recurring_template_id from property_loans
   where id = 'dddddddd-0000-0000-0000-000000000001') is null,
  'a loan whose template is deleted points at nothing');

insert into recurring_templates (id, user_id, category_id, amount, recurrence, day_of_month, property_id)
values
  ('bbbbbbbb-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 1200, 'monthly', 15,
   'cccccccc-0000-0000-0000-000000000001');

-- The property goes: its loans with it, its templates stay.
delete from properties where id = 'cccccccc-0000-0000-0000-000000000001';

select test_assert(
  (select count(*) from property_loans) = 0,
  'a property going takes its loans with it');

select test_assert(
  (select property_id from recurring_templates
   where id = 'bbbbbbbb-0000-0000-0000-000000000003') is null,
  'and leaves its templates attached to nothing');

reset role;

select test_assert(
  (select count(*) from properties
   where user_id = '22222222-2222-2222-2222-222222222222') = 1,
  'nothing the user did reached someone else''s property');

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select test_assert(
  (select count(*) from properties
   where user_id = '22222222-2222-2222-2222-222222222222') = 0
    and (select count(*) from property_loans
         where user_id = '22222222-2222-2222-2222-222222222222') = 0,
  'deleting an account deletes its properties and loans');

rollback;

\echo 049 properties: all checks passed
