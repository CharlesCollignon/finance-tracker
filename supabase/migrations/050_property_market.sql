-- 050: what a property is worth by its location
-- (docs/plans/REAL_ESTATE_PLAN.md, Phase 4).
--
-- 1. A property's market reading: what homes of its kind sold for per square
--    metre around it, or across its commune, read from the public record of
--    sales (DVF) and carried to the latest quarter by the price index. One
--    row per property, the user's own, like the property itself.
--
--    The plan first drew a cache shared by every user, keyed by place. It is
--    per property instead: a table every session could read, keyed by a
--    500 m cell, would have told anyone signed in which neighbourhoods some
--    user owns a home in. Reading the same commune twice for two people
--    costs a few megabytes of public files; that is the cheaper trade.
--
--    No reading is not a reading of zero: a commune with too few sales gets
--    no row, and the app says the value is the purchase price, carried.
--
-- 2. The INSEE–Notaires price index of existing homes, quarter by quarter
--    and series by series (one series per area and kind, by its INSEE
--    idbank). Public statistics: every signed-in session may read it, and
--    only the service role writes it, from the weekly market cron.
--
-- Reversible, and nothing else refers to these objects:
--   drop table property_market_readings;
--   drop table housing_price_index;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/050_property_market.test.sql`.

/* ------------------------------------------------- a property's reading */

create table if not exists property_market_readings (
  property_id uuid primary key references properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sales within 500 m of the property, or across its commune.
  scope text not null check (scope in ('radius', 'commune')),
  -- € per square metre, each sale carried to `quarter` before the median.
  median_m2 numeric(10, 2) not null check (median_m2 > 0),
  q1_m2 numeric(10, 2) not null check (q1_m2 > 0),
  q3_m2 numeric(10, 2) not null check (q3_m2 >= q1_m2),
  sales integer not null check (sales > 0),
  -- The first and last sale the reading stands on.
  period_from date not null,
  period_to date not null check (period_to >= period_from),
  -- The quarter the figures are carried to: « 2026-Q2 ».
  quarter text not null check (quarter ~ '^[0-9]{4}-Q[1-4]$'),
  read_at timestamptz not null default now(),
  check (q1_m2 <= median_m2 and median_m2 <= q3_m2)
);

comment on table property_market_readings is
  'What homes like a property sold for around it (DVF), per square metre, carried to a quarter. The user''s own.';

create index if not exists property_market_readings_user_idx
  on property_market_readings (user_id);

alter table property_market_readings enable row level security;

create policy "property_market_readings_select_own"
  on property_market_readings for select
  using (auth.uid() = user_id);

create policy "property_market_readings_insert_own"
  on property_market_readings for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create policy "property_market_readings_update_own"
  on property_market_readings for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create policy "property_market_readings_delete_own"
  on property_market_readings for delete
  using (auth.uid() = user_id);

/* ------------------------------------------------------- the price index */

create table if not exists housing_price_index (
  -- INSEE's idbank for the series: « 010567013 » is Paris, apartments.
  series text not null check (series ~ '^[0-9]{9}$'),
  quarter text not null check (quarter ~ '^[0-9]{4}-Q[1-4]$'),
  value numeric(8, 2) not null check (value > 0),
  updated_at timestamptz not null default now(),
  primary key (series, quarter)
);

comment on table housing_price_index is
  'The INSEE–Notaires index of existing-home prices (CVS), by series and quarter. Written by the service role.';

alter table housing_price_index enable row level security;

-- Readable by any signed-in session; no insert, update or delete policy, so
-- only the service role, which bypasses RLS, writes it.
create policy "housing_price_index_select_signed_in"
  on housing_price_index for select
  to authenticated
  using (true);
