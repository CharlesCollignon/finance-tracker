-- 077: Filing rules — « règles de rangement », the rules a person writes.
--
-- The feed files a line on its own only where the person's own history
-- answers for it (`@finance/core/bank-feed`): the same shop, filed the same
-- way, twice. That memory is learned and invisible — nobody can read it,
-- and nobody can say « tout ce qui contient NAVIGO va dans Transports »
-- before the second time. A filing rule is that sentence, written down:
-- words to find in a line, the category it goes to, and the way the money
-- went. The planner asks the rules before the learned matcher
-- (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 3), and a line a rule files
-- says so (`bank_feed_items.decided_by = 'auto:rule'`).
--
-- Owned like the money tables (060): a person's, or their space's, so a
-- joint account's lines have rules of their own. A rule names a category of
-- the same owner, checked on write; it goes with its category.
--
-- Run after 076. Reverse:
--   drop function public.bump_filing_rule(uuid, integer);
--   drop table public.filing_rules;

create table if not exists public.filing_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.owners (id) on delete cascade,
  -- The words to find in a line, as typed; matched without case or accents,
  -- as whole words (`@finance/core/filing-rules`).
  words text not null check (char_length(trim(words)) between 2 and 80),
  category_id uuid not null references public.categories (id) on delete cascade,
  direction text not null default 'out' check (direction in ('in', 'out')),
  -- The line that gave the rule, for the list to say where it came from.
  created_from text check (char_length(created_from) <= 200),
  -- How many lines it filed, bumped by the sync and the import.
  applied_count integer not null default 0 check (applied_count >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One rule per words and direction: the second « navigo » would only ask
-- which of the two wins.
create unique index if not exists filing_rules_words
  on public.filing_rules (user_id, direction, lower(trim(words)));

create index if not exists filing_rules_user
  on public.filing_rules (user_id, created_at desc);

alter table public.filing_rules enable row level security;

-- The person's own rules, and their space's: who may read the lines may
-- read what files them.
drop policy if exists filing_rules_select_owner on public.filing_rules;
create policy filing_rules_select_owner on public.filing_rules
  for select using (
    user_id = (select auth.uid()) or user_id in (select public.my_spaces())
  );

-- A rule's category is the same owner's: a joint rule files under a joint
-- category. The subquery runs under the categories' own policy, which
-- already limits it to what the writer may see.
drop policy if exists filing_rules_insert_owner on public.filing_rules;
create policy filing_rules_insert_owner on public.filing_rules
  for insert with check (
    (user_id = (select auth.uid()) or user_id in (select public.my_spaces()))
    and category_id in (
      select c.id from public.categories c where c.user_id = filing_rules.user_id
    )
  );

drop policy if exists filing_rules_update_owner on public.filing_rules;
create policy filing_rules_update_owner on public.filing_rules
  for update
  using (user_id = (select auth.uid()) or user_id in (select public.my_spaces()))
  with check (
    (user_id = (select auth.uid()) or user_id in (select public.my_spaces()))
    and category_id in (
      select c.id from public.categories c where c.user_id = filing_rules.user_id
    )
  );

drop policy if exists filing_rules_delete_owner on public.filing_rules;
create policy filing_rules_delete_owner on public.filing_rules
  for delete using (
    user_id = (select auth.uid()) or user_id in (select public.my_spaces())
  );

-- How many lines a rule filed, bumped after a sync or an import wrote them.
-- Security invoker: a person bumps their own rules under the policy above;
-- the sync, on the service role, bumps anyone's. Postgres grants EXECUTE to
-- PUBLIC by default (the lesson of 025), so it is revoked before it is
-- granted.
create or replace function public.bump_filing_rule(rule uuid, by integer)
returns void
language sql
set search_path = ''
as $$
  update public.filing_rules
  set applied_count = applied_count + greatest(coalesce(by, 0), 0)
  where id = rule;
$$;

revoke all on function public.bump_filing_rule(uuid, integer) from public;
grant execute on function public.bump_filing_rule(uuid, integer)
  to authenticated, service_role;
