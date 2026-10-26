-- 078: « Équilibre » — what each partner put into the joint account.
--
-- The shared space counts what it spent (its own rows) and knows each
-- partner's part of it (`space_members.share`, 062). What it could not say
-- is what each partner put in: their transfers to the joint account are
-- rows of their own ledger — « Versement au compte commun », filed there
-- by the sync or by hand — which the partner may never read. This function
-- answers that one sum and nothing else: for a member of the space, the
-- total of each member's rows in the transfer category over a span, by
-- the category's name in either language (handed in, so the database
-- carries no copy). A partner learns what the other put into the account
-- they share, never anything else of theirs.
--
-- Run after 077. Reverse:
--   drop function public.space_contributions(uuid, date, date, text[]);

create or replace function public.space_contributions(
  target_space uuid,
  from_day date,
  to_day date,
  category_names text[]
)
returns table (user_id uuid, total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, coalesce(sum(t.amount), 0)::numeric as total
  from public.space_members m
  left join public.transactions t
    on t.user_id = m.user_id
    and t.deleted_at is null
    and t.occurred_on between from_day and to_day
    and t.category_id in (
      select c.id from public.categories c
      where c.user_id = m.user_id
        and lower(trim(c.name)) = any (category_names)
    )
  where m.space_id = target_space
    and exists (
      select 1 from public.space_members me
      where me.space_id = target_space and me.user_id = auth.uid()
    )
  group by m.user_id;
$$;

revoke all on function public.space_contributions(uuid, date, date, text[])
  from public, anon;
grant execute on function public.space_contributions(uuid, date, date, text[])
  to authenticated;
