-- A target share for savings accounts.
--
-- The split on Placements now covers every account the user keeps — a
-- Livret A beside a PEA — so a savings account can carry a target share of
-- the whole, as a wallet does in `wallet_plans.target_weight`. Stored as a
-- fraction (0.20), like the wallets' targets. Null means no target.

alter table savings_accounts
  add column if not exists target_weight numeric(5, 4)
    check (target_weight is null or (target_weight >= 0 and target_weight <= 1));
