-- 083: A position's totals have a date, and purchases after it add to them.
--
-- « Total versé », the shares held and a typed value are what the broker
-- said on the day they were typed. Until now they stayed that way: a DCA
-- confirmed as bought (« C'est passé ») or debited by the bank went into
-- the ledger and never reached Placements. Now each purchase made after
-- `balance_as_of` adds to them, as they are read (`investment-positions.ts`).
--
-- The date moves by itself whenever any of the three figures changes, from
-- either app or any client, so typing the broker's figures again is all it
-- takes to start over without counting a purchase twice.
--
-- Existing positions are dated from their last save: their figures were
-- true then, and purchases since then are the ones they lack.
--
-- Reverse:
--   drop trigger if exists investment_positions_rebase on public.investment_positions;
--   drop function if exists public.rebase_investment_position();
--   alter table public.investment_positions drop column if exists balance_as_of;

alter table public.investment_positions
  add column if not exists balance_as_of date;

update public.investment_positions
set balance_as_of = (updated_at at time zone 'Europe/Paris')::date
where balance_as_of is null;

alter table public.investment_positions
  alter column balance_as_of set default ((now() at time zone 'Europe/Paris')::date),
  alter column balance_as_of set not null;

create or replace function public.rebase_investment_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.initial_balance is distinct from old.initial_balance
    or new.share_count is distinct from old.share_count
    or new.current_value is distinct from old.current_value then
    new.balance_as_of := (now() at time zone 'Europe/Paris')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists investment_positions_rebase on public.investment_positions;
create trigger investment_positions_rebase
  before update on public.investment_positions
  for each row execute function public.rebase_investment_position();
