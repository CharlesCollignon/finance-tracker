-- 063: a home owned together (docs/plans/EVERYDAY_PLAN.md, 6c).
--
-- A property can be the shared space's (migration 060 made it ownable by a
-- space): its loans then are the space's charges, paid from the joint
-- account. What each partner owns of it is the deed's to say — a share each,
-- the two making the whole, the space's split (062) until set — and each
-- partner's net worth counts theirs.
--
-- And the Immobilier tab, built behind `property.track` since 049, opens to
-- everyone.
--
-- Run after 062. Reverse:
--
--   drop function public.set_property_share(uuid, numeric);
--   drop table public.property_shares;
--   update public.feature_flags set enabled_by_default = false
--     where key = 'property.track';

-- 1. Each partner's part of a joint property, from the deed. No row: the
--    space's split.
create table if not exists public.property_shares (
  property_id uuid not null
    references public.properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  share numeric(5, 4) not null check (share >= 0 and share <= 1),
  primary key (property_id, user_id)
);

alter table public.property_shares enable row level security;

-- Read by whoever can read the property: its partners. Written only through
-- the function below, which keeps the two parts the whole.
drop policy if exists property_shares_select on public.property_shares;
create policy property_shares_select on public.property_shares
  for select to authenticated
  using (property_id in (select id from public.properties));

-- 2. Set from either side: my part of the deed, the partner's the rest.
create or replace function public.set_property_share(
  target_property uuid,
  my_share numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  space uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select p.user_id into space
  from public.properties p
  join public.space_members m on m.space_id = p.user_id
  where p.id = target_property and m.user_id = auth.uid();
  if space is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if my_share is null or my_share < 0 or my_share > 1 then
    raise exception 'share out of range' using errcode = '22023';
  end if;
  insert into public.property_shares (property_id, user_id, share)
  select target_property, m.user_id,
    case when m.user_id = auth.uid() then my_share else 1 - my_share end
  from public.space_members m
  where m.space_id = space
  on conflict (property_id, user_id) do update set share = excluded.share;
end;
$$;

revoke execute on function public.set_property_share(uuid, numeric)
  from public, anon;
grant execute on function public.set_property_share(uuid, numeric)
  to authenticated;

-- 3. Immobilier for everyone.
update public.feature_flags
set enabled_by_default = true
where key = 'property.track';
