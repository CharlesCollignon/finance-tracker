-- 066: the tax return page (docs/plans/EVERYDAY_PLAN.md, phase 8).
--
-- Which of the person's categories fill which box of the French income tax
-- return — a donation category in 7UF, a home help one in 7DB — said once
-- and kept. One box a category. The boxes the app fills on its own (a PER's
-- payments, a property's rents) need nothing here.
--
-- A person's own, like the return: a space files none.
--
-- Run after 065. Reverse:
--
--   drop table public.tax_box_categories;

create table if not exists public.tax_box_categories (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  box text not null check (box ~ '^[0-9][A-Z]{2}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

alter table public.tax_box_categories enable row level security;

-- The person's own mapping, of their own categories.
drop policy if exists tax_box_categories_own on public.tax_box_categories;
create policy tax_box_categories_own on public.tax_box_categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and category_id in (
      select id from public.categories where user_id = (select auth.uid())
    )
  );
