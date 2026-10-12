-- 070: reactions to « Nouveautés », and votes for what comes next.
--
-- One row per person, thing and kind: « J'adore », « Utile » or « Enfin ! »
-- on a shipped change (`changelog:<entry id>`), « J'attends ça » on an item
-- of « Bientôt » (`roadmap:<item id>`). The entries live in the code
-- (`packages/core/src/changelog-entries.ts`), not in the database, so the
-- target is their stable id as text; Entraide's posts will join later under
-- prefixes of their own.
--
-- A person reads, adds and takes back their own rows only; nobody reads
-- anyone else's. Everyone may read the counts, through `reaction_counts`,
-- which hands out numbers and never a user id. A person who deletes their
-- account takes their reactions with them (`on delete cascade`). A burst of
-- more than 120 in an hour from one account is refused, which is far past
-- any honest use of three buttons per change.
--
-- Run after 069. Reverse: drop function reaction_counts(text[]); drop
-- function reactions_rate_limit() cascade; drop table reactions;

create table if not exists public.reactions (
  target text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (target, user_id, kind),
  constraint reactions_target_kind check (
    (target ~ '^changelog:[a-z0-9-]{1,80}$' and kind in ('love', 'useful', 'finally'))
    or (target ~ '^roadmap:[a-z0-9-]{1,80}$' and kind = 'want')
  )
);

create index if not exists reactions_user_created
  on public.reactions (user_id, created_at desc);

alter table public.reactions enable row level security;

drop policy if exists "reactions: read own" on public.reactions;
create policy "reactions: read own" on public.reactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "reactions: add own" on public.reactions;
create policy "reactions: add own" on public.reactions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reactions: take back own" on public.reactions;
create policy "reactions: take back own" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.reactions_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.reactions
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 120 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reactions_rate_limit on public.reactions;
create trigger reactions_rate_limit
  before insert on public.reactions
  for each row execute function public.reactions_rate_limit();

-- The counts, for anyone, as numbers only.
create or replace function public.reaction_counts(targets text[])
returns table (target text, kind text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.target, r.kind, count(*)
  from public.reactions r
  where r.target = any (targets)
  group by r.target, r.kind;
$$;

revoke all on function public.reaction_counts(text[]) from public;
grant execute on function public.reaction_counts(text[]) to anon, authenticated;
