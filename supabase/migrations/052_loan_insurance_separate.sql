-- 052: a loan whose insurance the bank debits on its own.
--
-- Many banks take a loan's payment one day and its insurance — often from
-- another insurer, under a « délégation d'assurance » — on another, so the
-- account shows two debits. Migration 049 linked a loan to one recurring
-- template, holding both; such a loan now says its insurance is separate,
-- and links a second template for it. Each template then stands for one
-- debit, and the loan still counts its insurance in what it costs.
--
-- Reversible, and nothing else refers to these columns:
--   alter table property_loans
--     drop column insurance_template_id,
--     drop column insurance_separate;
--   (and the two policies below back to migration 049's)
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/052_loan_insurance_separate.test.sql`.

alter table property_loans
  add column if not exists insurance_separate boolean not null default false,
  add column if not exists insurance_template_id uuid
    references recurring_templates (id) on delete set null;

comment on column property_loans.insurance_separate is
  'The bank debits the insurance apart from the payment: two templates, not one.';
comment on column property_loans.insurance_template_id is
  'The recurring template for the insurance, when it is debited apart.';

create index if not exists property_loans_insurance_template_idx
  on property_loans (insurance_template_id)
  where insurance_template_id is not null;

-- Every reference the caller's own, the insurance's template included.
drop policy if exists "property_loans_insert_own" on property_loans;
create policy "property_loans_insert_own"
  on property_loans for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
    and (
      recurring_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = recurring_template_id and rt.user_id = auth.uid()
      )
    )
    and (
      insurance_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = insurance_template_id and rt.user_id = auth.uid()
      )
    )
  );

drop policy if exists "property_loans_update_own" on property_loans;
create policy "property_loans_update_own"
  on property_loans for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
    and (
      recurring_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = recurring_template_id and rt.user_id = auth.uid()
      )
    )
    and (
      insurance_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = insurance_template_id and rt.user_id = auth.uid()
      )
    )
  );
