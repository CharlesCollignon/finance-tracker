-- 064: Ask Pluclair (docs/plans/EVERYDAY_PLAN.md, phase 7).
--
-- Questions about one's own money, answered with the app's figures: a
-- conversation and its messages, kept thirty days and each one deletable,
-- gone with the account; and how many questions a month were asked on
-- Pluclair's key.
--
-- A person's own, to begin: no space owns a conversation, so the tables
-- point at the person and their rules are the person's alone.
--
-- Run after 063. Reverse:
--
--   drop function public.sweep_ask();
--   drop function public.refund_ask(date);
--   drop function public.reserve_ask(date, int);
--   drop table public.ask_tallies;
--   drop table public.ask_messages;
--   drop table public.ask_conversations;

-- 1. Conversations and their messages.
create table if not exists public.ask_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ask_conversations_user_updated
  on public.ask_conversations (user_id, updated_at desc);

-- `body` is what the screen draws: the question as typed, or the answer —
-- its sentences with `{{fact:id}}` holes and the figures they were written
-- against, never a number of the model's own.
create table if not exists public.ask_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.ask_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('question', 'answer')),
  body jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ask_messages_conversation
  on public.ask_messages (conversation_id, created_at);

alter table public.ask_conversations enable row level security;
alter table public.ask_messages enable row level security;

drop policy if exists ask_conversations_own on public.ask_conversations;
create policy ask_conversations_own on public.ask_conversations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ask_messages_own on public.ask_messages;
create policy ask_messages_own on public.ask_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and conversation_id in (
      select id from public.ask_conversations
      where user_id = (select auth.uid())
    )
  );

-- 2. The month's questions on Pluclair's key: taken before the model is
--    asked, so two presses at once cannot both pass, and handed back when
--    the model could not be reached.
create table if not exists public.ask_tallies (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  questions int not null default 0 check (questions >= 0),
  primary key (user_id, month)
);

alter table public.ask_tallies enable row level security;

drop policy if exists ask_tallies_read_own on public.ask_tallies;
create policy ask_tallies_read_own on public.ask_tallies
  for select to authenticated
  using (user_id = (select auth.uid()));

-- One question taken, if the month has room: the count after, or null when
-- it had none.
create or replace function public.reserve_ask(
  target_month date,
  allowance int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken int;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.ask_tallies (user_id, month, questions)
  values (auth.uid(), target_month, 1)
  on conflict (user_id, month) do update
    set questions = public.ask_tallies.questions + 1
    where public.ask_tallies.questions < allowance
  returning questions into taken;
  return taken;
end;
$$;

-- A question the model never answered, handed back.
create or replace function public.refund_ask(target_month date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ask_tallies
  set questions = greatest(0, questions - 1)
  where user_id = auth.uid() and month = target_month;
$$;

-- 3. Thirty days, then gone: run by the nightly sweep.
create or replace function public.sweep_ask()
returns int
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.ask_conversations
    where updated_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.reserve_ask(date, int) from public, anon;
grant execute on function public.reserve_ask(date, int) to authenticated;
revoke execute on function public.refund_ask(date) from public, anon;
grant execute on function public.refund_ask(date) to authenticated;
revoke execute on function public.sweep_ask() from public, anon, authenticated;
grant execute on function public.sweep_ask() to service_role;
