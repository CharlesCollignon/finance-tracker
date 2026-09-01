-- What the user intends for each wallet, as opposed to what it currently holds.
--
-- Two things live here because both are statements of intent the app cannot
-- derive from transactions:
--
--   target_weight  the share of the portfolio this wallet should hold, which
--                  turns the allocation chart from a description into a thing
--                  the user can drift away from and be told about.
--
--   opened_on      when the wrapper was opened. For a PEA this starts the
--                  five-year clock; it means nothing for the other wallets but
--                  costs nothing to allow.
--
-- One row per wallet per user, created lazily — a user who never sets a target
-- has no rows and sees no drift, which is the correct default.

create table wallet_plans (
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet investment_wallet not null,
  -- Stored as a fraction (0.60), not a percentage, to match how the app
  -- reasons about weights everywhere else.
  target_weight numeric(5, 4)
    check (target_weight is null or (target_weight >= 0 and target_weight <= 1)),
  opened_on date,
  -- Lifetime contribution cap. Null means "use the statutory default", so a
  -- change in the law does not have to be backfilled into every row.
  contribution_ceiling numeric(12, 2)
    check (contribution_ceiling is null or contribution_ceiling > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, wallet)
);

alter table wallet_plans enable row level security;

create policy "wallet_plans_select_own"
  on wallet_plans for select
  using (auth.uid() = user_id);

create policy "wallet_plans_insert_own"
  on wallet_plans for insert
  with check (auth.uid() = user_id);

create policy "wallet_plans_update_own"
  on wallet_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "wallet_plans_delete_own"
  on wallet_plans for delete
  using (auth.uid() = user_id);
