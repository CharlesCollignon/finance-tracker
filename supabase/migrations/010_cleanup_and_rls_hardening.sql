-- Cleanup: drop the legacy coarse wallet model (superseded by
-- investment_positions in 008) and harden RLS so foreign keys can only
-- reference rows owned by the same user.

-- 1. Drop legacy investment_wallets table + enum

drop table if exists investment_wallets;
drop type if exists wallet_id;

-- 2. Missing foreign-key indexes

create index if not exists transactions_category_idx
  on transactions (category_id);

create index if not exists transactions_recurring_template_idx
  on transactions (recurring_template_id)
  where recurring_template_id is not null;

create index if not exists recurring_templates_category_idx
  on recurring_templates (category_id);

-- 3. RLS: verify FK ownership on insert/update
--
-- Previous policies only checked the row's own user_id, which allowed a
-- client to point category_id / recurring_template_id at another user's
-- rows. Subqueries below run under the caller's RLS, so they only see
-- the caller's own rows.

-- transactions

drop policy if exists "transactions_insert_own" on transactions;
create policy "transactions_insert_own"
  on transactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
    and (
      recurring_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = recurring_template_id and rt.user_id = auth.uid()
      )
    )
  );

drop policy if exists "transactions_update_own" on transactions;
create policy "transactions_update_own"
  on transactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
    and (
      recurring_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = recurring_template_id and rt.user_id = auth.uid()
      )
    )
  );

-- recurring_templates

drop policy if exists "recurring_insert_own" on recurring_templates;
create policy "recurring_insert_own"
  on recurring_templates for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
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
  );

-- investment_positions

drop policy if exists "investment_positions_insert_own" on investment_positions;
create policy "investment_positions_insert_own"
  on investment_positions for insert
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
    and (
      recurring_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = recurring_template_id and rt.user_id = auth.uid()
      )
    )
  );

drop policy if exists "investment_positions_update_own" on investment_positions;
create policy "investment_positions_update_own"
  on investment_positions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
    and (
      recurring_template_id is null
      or exists (
        select 1 from recurring_templates rt
        where rt.id = recurring_template_id and rt.user_id = auth.uid()
      )
    )
  );
