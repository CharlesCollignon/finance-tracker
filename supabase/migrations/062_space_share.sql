-- 062: each partner's part of the shared space (docs/plans/EVERYDAY_PLAN.md,
-- 6b « Ma part »).
--
-- `space_members.share` (migration 060) is what of the joint spending is
-- each partner's: 50/50 until one of them says otherwise, set once for the
-- two, and seen by both. Nothing proportional to income: the partner's
-- income stays theirs. The two parts always make the whole.
--
-- Run after 060. Reverse:
--
--   drop trigger space_member_takes_the_rest on public.space_members;
--   drop function public.space_member_takes_the_rest();
--   drop function public.set_space_share(uuid, numeric);

-- Set from either side: my part, and the partner's is what is left.
create or replace function public.set_space_share(
  target_space uuid,
  my_share numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.space_members
    where space_id = target_space and user_id = auth.uid()
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if my_share is null or my_share < 0 or my_share > 1 then
    raise exception 'share out of range' using errcode = '22023';
  end if;
  update public.space_members
  set share = case when user_id = auth.uid() then my_share else 1 - my_share end
  where space_id = target_space;
end;
$$;

-- Whoever joins takes what the other has not: a space set at 60/40 before
-- the partner arrived stays 60/40.
create or replace function public.space_member_takes_the_rest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  others numeric;
begin
  select sum(share) into others
  from public.space_members
  where space_id = new.space_id;
  if others is not null then
    new.share := greatest(0, least(1, 1 - others));
  end if;
  return new;
end;
$$;

drop trigger if exists space_member_takes_the_rest on public.space_members;
create trigger space_member_takes_the_rest
  before insert on public.space_members
  for each row execute function public.space_member_takes_the_rest();

revoke execute on function public.set_space_share(uuid, numeric)
  from public, anon;
grant execute on function public.set_space_share(uuid, numeric)
  to authenticated;
revoke execute on function public.space_member_takes_the_rest()
  from public, anon, authenticated;
