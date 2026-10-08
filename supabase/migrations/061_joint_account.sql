-- 061: the joint account (docs/plans/SHARED_SPACE_DESIGN.md, « The bank »).
--
-- An account a partner's open-banking.io connection shows can be filed
-- « Compte commun »: its movements and its balance go to their shared space
-- instead of to them. The account itself stays the person's — it is their
-- connection that reads it — and names the space it feeds in `space_id`
-- (migration 060). The same account connected by the other partner is told
-- apart by `iban_hash`, so it feeds the space once; which copy feeds is the
-- apps' rule, the first one seen.
--
-- Run after 060. Reverse:
--
--   drop trigger joint_accounts_follow_member on public.space_members;
--   drop function public.joint_accounts_follow_member();
--   drop policy bank_accounts_select_joint on public.bank_accounts;
--   drop policy bank_accounts_joint_space_is_mine on public.bank_accounts;
--   update public.bank_accounts set role = null where role = 'joint';
--   alter table public.bank_accounts drop constraint bank_accounts_role_check,
--     add constraint bank_accounts_role_check
--       check (role in ('spending', 'savings', 'ignored'));
--   -- and `bank_accounts_counts_from_role` as 056 wrote it.

-- 1. The fourth role.
alter table public.bank_accounts
  drop constraint if exists bank_accounts_role_check;
alter table public.bank_accounts
  add constraint bank_accounts_role_check
    check (role in ('spending', 'savings', 'ignored', 'joint'));

-- 2. A joint account names its space, and nothing else names one. One whose
--    space is gone — left, or emptied — waits to be told again what it is,
--    rather than feeding nobody under a role that says it feeds someone.
--    The tick still follows the role: a joint account is not the person's
--    spending money, so it is not counted as theirs.
create or replace function public.bank_accounts_counts_from_role()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and new.role is not distinct from old.role
    and new.counts_as_cash is distinct from old.counts_as_cash then
    new.role := case when new.counts_as_cash then 'spending' else 'ignored' end;
  end if;
  if new.role = 'joint' and new.space_id is null then
    new.role := null;
  elsif new.role is distinct from 'joint' then
    new.space_id := null;
  end if;
  new.counts_as_cash := coalesce(new.role = 'spending', false);
  return new;
end;
$$;

-- 3. The partner reads a joint account — its name, its bank, the space it
--    feeds and its fingerprint — for the space's balance and to leave their
--    own copy of it out. Never its connection, which stays the person's.
drop policy if exists bank_accounts_select_joint on public.bank_accounts;
create policy bank_accounts_select_joint on public.bank_accounts
  for select to authenticated
  using (space_id in (select public.my_spaces()));

-- And only a space one is in can be named: a restrictive rule, added to the
-- owner's own.
drop policy if exists bank_accounts_joint_space_is_mine on public.bank_accounts;
create policy bank_accounts_joint_space_is_mine on public.bank_accounts
  as restrictive
  for all to authenticated
  using (true)
  with check (space_id is null or space_id in (select public.my_spaces()));

-- 4. Leaving a space takes one's joint accounts out of it at once: they stop
--    feeding it, and wait to be told what they are. The rows they brought
--    stay with the space.
create or replace function public.joint_accounts_follow_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bank_accounts
  set space_id = null
  where user_id = old.user_id
    and space_id = old.space_id;
  return old;
end;
$$;

drop trigger if exists joint_accounts_follow_member on public.space_members;
create trigger joint_accounts_follow_member
  after delete on public.space_members
  for each row execute function public.joint_accounts_follow_member();

revoke execute on function public.joint_accounts_follow_member()
  from public, anon, authenticated;
