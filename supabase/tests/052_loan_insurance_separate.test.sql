-- What migration 052 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/052_loan_insurance_separate.test.sql
--
-- A loan says whether its insurance is debited apart, and may link a second
-- template for it — the caller's own, never another's. Every check raises
-- rather than returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into categories (id, user_id, name, type, icon)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Remboursement de prêt', 'expense', 'bank'),
  ('aaaaaaaa-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Remboursement de prêt', 'expense', 'bank');

insert into recurring_templates (id, user_id, category_id, amount, recurrence, day_of_month)
values
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 990, 'monthly', 5),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 40, 'monthly', 6),
  ('bbbbbbbb-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 40, 'monthly', 6);

insert into properties (id, user_id, name, kind, purchased_on, purchase_price, living_area)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Mon appartement', 'apartment',
   '2023-03-15', 250000, 52);

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

select test_become('11111111-1111-1111-1111-111111111111');

insert into property_loans (id, user_id, property_id, label, kind, principal, annual_rate, months, first_payment_on, insurance_monthly, recurring_template_id)
values
  ('dddddddd-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
   'Prêt principal', 'amortising', 200000, 0.034, 300, '2023-04-05', 40,
   'bbbbbbbb-0000-0000-0000-000000000001');

select test_assert(
  (select insurance_separate from property_loans
   where id = 'dddddddd-0000-0000-0000-000000000001') = false,
  'a loan''s insurance goes with its payment unless it says otherwise');

update property_loans
set insurance_separate = true,
    insurance_template_id = 'bbbbbbbb-0000-0000-0000-000000000002'
where id = 'dddddddd-0000-0000-0000-000000000001';

select test_assert(
  (select insurance_template_id from property_loans
   where id = 'dddddddd-0000-0000-0000-000000000001')
    = 'bbbbbbbb-0000-0000-0000-000000000002',
  'a loan links its own template for the insurance debited apart');

select test_assert(
  test_refused($q$
    update property_loans
    set insurance_template_id = 'bbbbbbbb-0000-0000-0000-000000000003'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'and never someone else''s');

delete from recurring_templates where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select test_assert(
  (select insurance_template_id from property_loans
   where id = 'dddddddd-0000-0000-0000-000000000001') is null,
  'a template going leaves the loan, without its insurance''s link');

rollback;

\echo 052 loan insurance separate: all checks passed
