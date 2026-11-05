-- 084: a monthly template can fall in some months only.
--
-- Monthly, weekly and yearly were the only rhythms, which left out a salary
-- or a bill paid every quarter, a charge every two months, the tax taken ten
-- months out of twelve, a grant paid from September to June
-- (docs/plans/CARDS_CADENCE_PLAN.md, phase 5). One column covers them all:
-- the months a monthly template falls in, null for every month.
--
-- Kept in one shape so two rows that mean the same thing are the same: the
-- months in order, each once, between 1 and 11 of them. Every month is null,
-- never all twelve. Weekly and yearly templates never carry it; a yearly one
-- already has its month.
--
-- Reverse:
--   alter table public.recurring_templates drop constraint if exists recurring_months_check;
--   alter table public.recurring_templates drop column if exists months;
--   drop function if exists public.is_month_set(smallint[]);

create or replace function public.is_month_set(months smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(months) between 1 and 11
    and array_position(months, null) is null
    and months[1] >= 1
    and months[cardinality(months)] <= 12
    and not exists (
      select 1
      from generate_subscripts(months, 1) as i
      where i > 1 and months[i] <= months[i - 1]
    );
$$;

alter table public.recurring_templates
  add column if not exists months smallint[];

alter table public.recurring_templates
  add constraint recurring_months_check check (
    months is null
    or (recurrence::text = 'monthly' and public.is_month_set(months))
  );
