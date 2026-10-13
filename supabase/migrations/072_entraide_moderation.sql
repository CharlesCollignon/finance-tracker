-- 072: Entraide's moderation — reports, decisions, and who moderates.
--
-- « Signaler » on a question or an answer (`entraide_reports`): one report
-- per person and thing, with a reason from « Les règles d'Entraide », never
-- shown to the person reported, at most 20 a day. When three different
-- members have reported the same thing and nobody has looked yet, it is
-- hidden at once, and the decision says so: automatic, after reports.
--
-- Every measure that restricts someone is a row of `entraide_decisions` —
-- a post or an answer hidden or restored, a pseudonym barred or let back —
-- with what the rules call a statement of reasons (Digital Services Act,
-- art. 17): what was done, the rule it applies, the facts, whether it was
-- automatic, whether a report led to it. Its author reads it on the hidden
-- post itself, from the moment it takes effect; the moderator sends the
-- same by email.
--
-- Moderating is the owner's, behind `community.moderate`, and goes through
-- the service role: the web's moderation actions check the flag, then act
-- with it. Inside one database transaction, three reports hide a post in
-- the same way, by setting `entraide.moderating` for that transaction —
-- a setting no request can set, since only the public schema's functions
-- can be called.
--
-- Run after 071. Reverse: drop table entraide_decisions, entraide_reports;
-- drop function entraide_reports_guard, entraide_reports_tally,
-- entraide_moderating; restore 071's two guards; delete from feature_flags
-- where key = 'community.moderate'.

insert into public.feature_flags (key, description)
values (
  'community.moderate',
  'Moderates Entraide: the queue at /blog/entraide/moderation. The owner''s account only.'
)
on conflict (key) do nothing;

-- Whether this write is a moderator's: the service role, or a decision
-- three reports took inside this very transaction.
create or replace function public.entraide_moderating()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.role()) = 'service_role'
    or coalesce(current_setting('entraide.moderating', true), '') = 'on';
$$;

revoke all on function public.entraide_moderating() from public, anon, authenticated;

create or replace function public.entraide_posts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.entraide_author_guard(
      new.author_id,
      new.title || ' ' || new.body,
      (select count(*) from public.entraide_posts
        where author_id = new.author_id
          and created_at > now() - interval '24 hours'),
      5
    );
    new.status := 'visible';
    new.solved_reply_id := null;
    new.created_at := now();
    new.edited_at := null;
    return new;
  end if;

  -- The account is gone: keep the post in its thread, emptied.
  if new.author_id is null then
    new.title := '';
    new.body := '';
    new.guide_slug := null;
    return new;
  end if;

  -- A moderator's decision, or three reports' (`entraide_moderating`).
  if public.entraide_moderating() then
    return new;
  end if;

  if old.status <> 'visible' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  new.author_id := old.author_id;
  new.kind := old.kind;
  new.created_at := old.created_at;

  if new.status = 'deleted' then
    new.title := '';
    new.body := '';
    new.guide_slug := null;
    new.solved_reply_id := null;
    return new;
  end if;
  if new.status <> 'visible' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if new.solved_reply_id is distinct from old.solved_reply_id
    and new.solved_reply_id is not null
    and (
      old.kind <> 'question'
      or not exists (
        select 1 from public.entraide_replies r
        where r.id = new.solved_reply_id
          and r.post_id = old.id
          and r.status = 'visible'
          and r.author_id is not null
      )
    ) then
    raise exception 'invalid_solution' using errcode = 'P0001';
  end if;

  if new.title is distinct from old.title or new.body is distinct from old.body then
    if (new.title || ' ' || new.body) ~* '(https?://|www\.[a-z0-9-]+\.[a-z])'
      and (select created_at from auth.users where id = old.author_id)
        > now() - interval '24 hours' then
      raise exception 'links_too_soon' using errcode = 'P0001';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.entraide_replies_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.entraide_posts p
      where p.id = new.post_id and p.status = 'visible'
    ) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    perform public.entraide_author_guard(
      new.author_id,
      new.body,
      (select count(*) from public.entraide_replies
        where author_id = new.author_id
          and created_at > now() - interval '24 hours'),
      30
    );
    new.status := 'visible';
    new.created_at := now();
    new.edited_at := null;
    return new;
  end if;

  if new.author_id is null then
    new.body := '';
    return new;
  end if;

  if public.entraide_moderating() then
    return new;
  end if;

  if old.status <> 'visible' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  new.author_id := old.author_id;
  new.post_id := old.post_id;
  new.created_at := old.created_at;

  if new.status = 'deleted' then
    new.body := '';
    return new;
  end if;
  if new.status <> 'visible' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if new.body is distinct from old.body then
    if new.body ~* '(https?://|www\.[a-z0-9-]+\.[a-z])'
      and (select created_at from auth.users where id = old.author_id)
        > now() - interval '24 hours' then
      raise exception 'links_too_soon' using errcode = 'P0001';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ reports

create table if not exists public.entraide_reports (
  id bigint generated always as identity primary key,
  target text not null check (target ~ '^(post|reply):[0-9]{1,18}$'),
  reporter_id uuid references auth.users (id) on delete set null,
  -- Which rule it breaks, as « Les règles d'Entraide » lists them.
  reason text not null check (
    reason in ('kind', 'personal', 'promotion', 'money', 'unlawful',
      'impersonation', 'offtopic', 'other')
  ),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  outcome text check (outcome in ('kept', 'hidden'))
);

create unique index if not exists entraide_reports_once
  on public.entraide_reports (target, reporter_id)
  where reporter_id is not null;
create index if not exists entraide_reports_open
  on public.entraide_reports (created_at)
  where resolved_at is null;
create index if not exists entraide_reports_reporter
  on public.entraide_reports (reporter_id, created_at desc);

alter table public.entraide_reports enable row level security;

drop policy if exists "entraide reports: read own" on public.entraide_reports;
create policy "entraide reports: read own" on public.entraide_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

drop policy if exists "entraide reports: make own" on public.entraide_reports;
create policy "entraide reports: make own" on public.entraide_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid()) and resolved_at is null and outcome is null
  );

-- ---------------------------------------------------------------- decisions

create table if not exists public.entraide_decisions (
  id bigint generated always as identity primary key,
  -- The post or answer; null for a pseudonym barred or let back.
  target text check (target is null or target ~ '^(post|reply):[0-9]{1,18}$'),
  -- Whom it concerns, who reads it.
  author_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('hide', 'restore', 'bar', 'unbar')),
  rule text not null check (
    rule in ('kind', 'personal', 'promotion', 'money', 'unlawful',
      'impersonation', 'offtopic', 'other', 'none')
  ),
  facts text not null default '' check (char_length(facts) <= 2000),
  automatic boolean not null default false,
  from_report boolean not null default false,
  created_at timestamptz not null default now(),
  constraint entraide_decisions_target check (
    (action in ('hide', 'restore')) = (target is not null)
  )
);

create index if not exists entraide_decisions_author
  on public.entraide_decisions (author_id, created_at desc);
create index if not exists entraide_decisions_target
  on public.entraide_decisions (target, created_at desc);

alter table public.entraide_decisions enable row level security;

drop policy if exists "entraide decisions: read own" on public.entraide_decisions;
create policy "entraide decisions: read own" on public.entraide_decisions
  for select to authenticated using (author_id = (select auth.uid()));

-- A report must be about something there to see, not one's own, and not
-- one too many today.
create or replace function public.entraide_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind text := split_part(new.target, ':', 1);
  thing bigint := split_part(new.target, ':', 2)::bigint;
  owner_id uuid;
  shown text;
begin
  if kind = 'post' then
    select author_id, status into owner_id, shown
    from public.entraide_posts where id = thing;
  else
    select author_id, status into owner_id, shown
    from public.entraide_replies where id = thing;
  end if;
  if owner_id is null or shown <> 'visible' or owner_id = new.reporter_id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (
    select count(*) from public.entraide_reports
    where reporter_id = new.reporter_id
      and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists entraide_reports_guard on public.entraide_reports;
create trigger entraide_reports_guard
  before insert on public.entraide_reports
  for each row execute function public.entraide_reports_guard();

-- The third different member's report hides it until it is looked at, and
-- the decision says why: the reason reported most.
create or replace function public.entraide_reports_tally()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind text := split_part(new.target, ':', 1);
  thing bigint := split_part(new.target, ':', 2)::bigint;
  reporters bigint;
  owner_id uuid;
  most text;
begin
  select count(distinct reporter_id) into reporters
  from public.entraide_reports
  where target = new.target and resolved_at is null;
  if reporters < 3 then
    return null;
  end if;

  perform set_config('entraide.moderating', 'on', true);
  if kind = 'post' then
    update public.entraide_posts set status = 'hidden'
    where id = thing and status = 'visible'
    returning author_id into owner_id;
  else
    update public.entraide_replies set status = 'hidden'
    where id = thing and status = 'visible'
    returning author_id into owner_id;
  end if;
  perform set_config('entraide.moderating', 'off', true);

  if owner_id is not null then
    select reason into most
    from public.entraide_reports
    where target = new.target and resolved_at is null
    group by reason
    order by count(*) desc, min(created_at)
    limit 1;
    insert into public.entraide_decisions
      (target, author_id, action, rule, facts, automatic, from_report)
    values (new.target, owner_id, 'hide', most, '', true, true);
  end if;
  return null;
end;
$$;

drop trigger if exists entraide_reports_tally on public.entraide_reports;
create trigger entraide_reports_tally
  after insert on public.entraide_reports
  for each row execute function public.entraide_reports_tally();
