-- 051: letting a property (docs/plans/REAL_ESTATE_PLAN.md, Phase 6).
--
-- 1. A property's energy class, from its DPE: what decides whether it may
--    still be let, and from when. Optional, and never guessed.
--
-- 2. A property's asking rents: what homes like it are advertised for per
--    square metre around it, unfurnished and charges included, from the
--    ANIL's « Carte des loyers » (one edition a year, public). One row per
--    property, the owner's alone, as its market reading is (migration 050),
--    and only for a property let out. Kept only when the ANIL deems its
--    figure reliable there (enough listings in the commune, a model that
--    fits): no row is no figure, never a rent of zero.
--
-- The rent itself needs nothing new: it is an income template attached to
-- the property (`recurring_templates.property_id`, migration 049).
--
-- Reversible, and nothing else refers to these objects:
--   drop table property_rent_references;
--   alter table properties drop column energy_class;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/051_property_rental.test.sql`.

/* ------------------------------------------------------ the energy class */

alter table properties
  add column if not exists energy_class text
    check (energy_class in ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

comment on column properties.energy_class is
  'The class on its DPE, A to G; null when the user has not said.';

/* ------------------------------------------------------ its asking rents */

create table if not exists property_rent_references (
  property_id uuid primary key references properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which of the ANIL's four tables: apartments, of one or two rooms, of
  -- three or more, or houses.
  series text not null check (series in ('app', 'app12', 'app3', 'mai')),
  -- € per square metre, charges included, and the 95 % prediction interval.
  rent_m2 numeric(6, 2) not null check (rent_m2 > 0),
  low_m2 numeric(6, 2) not null check (low_m2 > 0),
  high_m2 numeric(6, 2) not null,
  -- Where the ANIL's model was fitted: the commune itself, its
  -- intercommunality, or a group of neighbouring communes.
  scope text not null check (scope in ('commune', 'epci', 'maille')),
  -- Listings in the commune behind the figure.
  observations integer not null check (observations >= 0),
  -- The map's edition: « 2025 » is listings of the third quarter of 2025.
  edition integer not null check (edition between 2018 and 2100),
  read_at timestamptz not null default now(),
  check (low_m2 <= rent_m2 and rent_m2 <= high_m2)
);

comment on table property_rent_references is
  'What homes like a let property are advertised for per m² around it (ANIL « Carte des loyers »). The user''s own.';

create index if not exists property_rent_references_user_idx
  on property_rent_references (user_id);

alter table property_rent_references enable row level security;

create policy "property_rent_references_select_own"
  on property_rent_references for select
  using (auth.uid() = user_id);

create policy "property_rent_references_insert_own"
  on property_rent_references for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create policy "property_rent_references_update_own"
  on property_rent_references for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create policy "property_rent_references_delete_own"
  on property_rent_references for delete
  using (auth.uid() = user_id);
