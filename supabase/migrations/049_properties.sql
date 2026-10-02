-- 049: properties, the loans behind them, and the recurring templates they
-- bring (docs/plans/REAL_ESTATE_PLAN.md, Phase 1).
--
-- 1. A property is a home or premises the user owns, wholly or in part.
--    Every amount on it is the whole property's — the price on the deed, the
--    notary's fees — and `ownership_share` is the user's part of it, so two
--    people who bought together type the same figures.
--
-- 2. A loan is money borrowed against one property, owed at
--    `borrower_share`. Its schedule is worked out from its terms
--    (`packages/core/src/loan-schedule.ts`) and never stored. The one figure
--    the user may type instead is what their bank says is still owed on a
--    day, after an early repayment or a change of terms, and what the bank
--    kept: the payment, or the end.
--
-- 3. A recurring template may belong to a property: its taxe foncière, its
--    charges de copropriété, the loan's payment. Deleting a property leaves
--    its templates where they were, attached to nothing.
--
-- 4. A flag, `property.track`, off for everyone: the feature is switched on
--    account by account while it is built.
--
-- Every reference is checked against the caller's own rows, as 010 does for
-- transactions: a loan cannot hang off someone else's property, point at
-- someone else's template, and no template can belong to someone else's
-- property. The subqueries run under the caller's RLS, so they only see the
-- caller's own rows.
--
-- Reversible, and nothing else refers to these objects:
--   (restore 010's recurring_insert_own and recurring_update_own)
--   alter table recurring_templates drop column property_id;
--   drop table property_loans;
--   drop table properties;
--   delete from feature_flags where key = 'property.track';
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/049_properties.test.sql`.

/* -------------------------------------------------------------- properties */

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('apartment', 'house', 'other')),
  usage text not null default 'main_home'
    check (usage in ('main_home', 'second_home', 'rental_bare', 'rental_furnished')),

  -- Where it is: the commune's INSEE code (an arrondissement's in Paris,
  -- Lyon and Marseille), and the point its address was geocoded to. The
  -- address as typed is kept only if the user wants it.
  citycode text check (citycode ~ '^[0-9][0-9AB][0-9]{3}$'),
  postcode text check (postcode ~ '^[0-9]{5}$'),
  latitude numeric(8, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  address_label text check (char_length(address_label) <= 200),

  -- Square metres. Required of an apartment or a house by the apps, which
  -- price one by its area; premises may have none that means anything.
  living_area numeric(9, 2) check (living_area > 0 and living_area <= 100000),
  rooms smallint check (rooms between 1 and 100),
  ownership_share numeric(5, 4) not null default 1
    check (ownership_share > 0 and ownership_share <= 1),

  purchased_on date not null,
  purchase_price numeric(14, 2) not null check (purchase_price >= 0),
  notary_fees numeric(14, 2) not null default 0 check (notary_fees >= 0),
  agency_fees numeric(14, 2) not null default 0 check (agency_fees >= 0),
  works numeric(14, 2) not null default 0 check (works >= 0),

  -- The user's own figure for what it is worth, and the day they gave it.
  value_pinned numeric(14, 2) check (value_pinned > 0),
  value_pinned_on date,
  -- How much a year it is assumed to gain in the long view, as a fraction.
  -- Null means the app's default.
  yearly_growth numeric(6, 5) check (yearly_growth between -0.2 and 0.2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check ((value_pinned is null) = (value_pinned_on is null)),
  check ((latitude is null) = (longitude is null))
);

comment on table properties is
  'A home or premises the user owns. Amounts are the whole property''s; ownership_share is the user''s part.';

create index if not exists properties_user_idx on properties (user_id);

alter table properties enable row level security;

create policy "properties_select_own"
  on properties for select
  using (auth.uid() = user_id);

create policy "properties_insert_own"
  on properties for insert
  with check (auth.uid() = user_id);

create policy "properties_update_own"
  on properties for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "properties_delete_own"
  on properties for delete
  using (auth.uid() = user_id);

/* ------------------------------------------------------------------- loans */

create table if not exists property_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  kind text not null default 'amortising'
    check (kind in ('amortising', 'in_fine')),

  principal numeric(14, 2) not null check (principal > 0),
  -- Yearly and nominal, as a fraction: 0.035 for 3.5 %.
  annual_rate numeric(7, 6) not null check (annual_rate between 0 and 0.2),
  -- Every month the loan runs, a deferral included.
  months smallint not null check (months between 1 and 600),
  first_payment_on date not null,

  -- Insurance is either a fixed amount each month (worked out on the
  -- initial capital) or a yearly rate on what is still owed. Not both.
  insurance_monthly numeric(10, 2) not null default 0
    check (insurance_monthly >= 0),
  insurance_rate numeric(7, 6) check (insurance_rate between 0 and 0.05),

  deferral_months smallint not null default 0 check (deferral_months >= 0),
  deferral_kind text not null default 'none'
    check (deferral_kind in ('none', 'partial', 'total')),

  -- Arrangement and guarantee fees: part of what borrowing costs.
  fees numeric(12, 2) not null default 0 check (fees >= 0),
  borrower_share numeric(5, 4) not null default 1
    check (borrower_share > 0 and borrower_share <= 1),

  -- What the bank says is still owed once every payment dated on or before
  -- `known_outstanding_on` was made, and what it kept after an early
  -- repayment: the payment (ending sooner) or the end (paying less).
  known_outstanding numeric(14, 2) check (known_outstanding >= 0),
  known_outstanding_on date,
  known_keeps text check (known_keeps in ('payment', 'term')),

  -- The recurring template that writes the loan's payment, when there is one.
  recurring_template_id uuid
    references recurring_templates (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (insurance_rate is null or insurance_monthly = 0),
  check ((deferral_kind = 'none') = (deferral_months = 0)),
  check (deferral_months < months),
  check (kind = 'amortising' or deferral_kind = 'none'),
  check (
    (known_outstanding is null) = (known_outstanding_on is null)
    and (known_outstanding is null) = (known_keeps is null)
  )
);

comment on table property_loans is
  'Money borrowed against one property. The schedule is computed from these terms, never stored.';

create index if not exists property_loans_property_idx
  on property_loans (property_id);

create index if not exists property_loans_template_idx
  on property_loans (recurring_template_id)
  where recurring_template_id is not null;

alter table property_loans enable row level security;

create policy "property_loans_select_own"
  on property_loans for select
  using (auth.uid() = user_id);

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
  );

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
  );

create policy "property_loans_delete_own"
  on property_loans for delete
  using (auth.uid() = user_id);

/* ------------------------------------------- templates that belong to one */

alter table recurring_templates
  add column if not exists property_id uuid
    references properties (id) on delete set null;

comment on column recurring_templates.property_id is
  'The property this template''s charge or income belongs to, if any.';

create index if not exists recurring_templates_property_idx
  on recurring_templates (property_id)
  where property_id is not null;

-- 010's policies, with the property checked as the category is.
drop policy if exists "recurring_insert_own" on recurring_templates;
create policy "recurring_insert_own"
  on recurring_templates for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
    and (
      property_id is null
      or exists (
        select 1 from properties p
        where p.id = property_id and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "recurring_update_own" on recurring_templates;
create policy "recurring_update_own"
  on recurring_templates for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
    and (
      property_id is null
      or exists (
        select 1 from properties p
        where p.id = property_id and p.user_id = auth.uid()
      )
    )
  );

/* -------------------------------------------------------------------- flag */

insert into feature_flags (key, description)
values (
  'property.track',
  'Properties, their loans and their value: the Immobilier tab (docs/plans/REAL_ESTATE_PLAN.md).'
)
on conflict (key) do nothing;
