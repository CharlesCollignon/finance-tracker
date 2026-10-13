-- 071: Entraide — questions, answers and pseudonyms, in « Le blog ».
--
-- The first rows anyone can read, signed in or not, so they are read only
-- through the functions at the end, which hand out a pseudonym and never a
-- user id. A person writes, edits and deletes their own questions and
-- answers (the tables' policies); a trigger holds what they may not change:
-- the author, the kind, the date, a moderator's decision. What a person may
-- post is what « Les règles d'Entraide » says
-- (apps/web/components/marketing/entraide-rules-copy.ts) and
-- packages/core/src/entraide.ts repeats for the forms:
--
--   - a pseudonym first (`entraide_profiles`), 3 to 24 letters, digits and
--     . _ - inside, unique whatever its case, and none passing for Pluclair
--     but the one marked « Pluclair » (`is_pluclair`, set by hand for the
--     owner's account);
--   - at most 5 questions and 30 answers per account over 24 hours, and no
--     link from an account less than a day old;
--   - nothing from a barred pseudonym (`banned_at`, set by moderation).
--
-- Deleting an account keeps its questions and answers, emptied, in their
-- threads (`on delete set null`, and the trigger erases the text): the page
-- shows « Message supprimé », as the rules promise. A person deleting one
-- post marks it 'deleted' and its text goes the same way. 'hidden' is a
-- moderator's (service role) and is not the author's to undo.
--
-- Reactions on a question or an answer (`post:<id>`, `reply:<id>`) are
-- « Utile » and « Merci », in the `reactions` table of 070.
--
-- Run after 070. Reverse: drop function entraide_list, entraide_thread,
-- entraide_replies, entraide_search, entraide_handle_taken; drop table
-- entraide_replies, entraide_posts, entraide_profiles cascade; drop
-- function entraide_posts_guard, entraide_replies_guard,
-- entraide_profiles_guard, entraide_author_guard; and restore 070's
-- reactions_target_kind.

-- ------------------------------------------------------------------ profiles

create table if not exists public.entraide_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  is_pluclair boolean not null default false,
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint entraide_profiles_handle check (
    char_length(handle) between 3 and 24
    and handle ~ '^[A-Za-z0-9À-ÖØ-öø-ÿŒœ]([A-Za-z0-9À-ÖØ-öø-ÿŒœ._-]*[A-Za-z0-9À-ÖØ-öø-ÿŒœ])?$'
  )
);

create unique index if not exists entraide_profiles_handle_unique
  on public.entraide_profiles (lower(handle));

alter table public.entraide_profiles enable row level security;

drop policy if exists "entraide profiles: read own" on public.entraide_profiles;
create policy "entraide profiles: read own" on public.entraide_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- Chosen once, by its owner, unmarked and not barred.
drop policy if exists "entraide profiles: choose own" on public.entraide_profiles;
create policy "entraide profiles: choose own" on public.entraide_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not is_pluclair and banned_at is null
  );

create or replace function public.entraide_profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_pluclair
    and regexp_replace(lower(new.handle), '[._-]', '', 'g') like '%pluclair%' then
    raise exception 'handle_reserved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists entraide_profiles_guard on public.entraide_profiles;
create trigger entraide_profiles_guard
  before insert or update on public.entraide_profiles
  for each row execute function public.entraide_profiles_guard();

-- -------------------------------------------------------- posts and replies

create table if not exists public.entraide_posts (
  id bigint generated always as identity primary key,
  author_id uuid references auth.users (id) on delete set null,
  kind text not null default 'question' check (kind in ('question', 'share')),
  title text not null,
  body text not null default '',
  -- The guide it was asked from, if any (`GUIDE_SLUGS`).
  guide_slug text check (guide_slug is null or guide_slug ~ '^[a-z0-9-]{1,80}$'),
  status text not null default 'visible'
    check (status in ('visible', 'hidden', 'deleted')),
  solved_reply_id bigint,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('french', title), 'A')
      || setweight(to_tsvector('french', body), 'B')
  ) stored,
  -- Emptied once deleted, or once its author's account is gone.
  constraint entraide_posts_text check (
    author_id is null
    or status = 'deleted'
    or (char_length(title) between 8 and 140 and char_length(body) <= 5000)
  )
);

create table if not exists public.entraide_replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.entraide_posts (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  status text not null default 'visible'
    check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint entraide_replies_text check (
    author_id is null
    or status = 'deleted'
    or char_length(body) between 2 and 3000
  )
);

alter table public.entraide_posts
  drop constraint if exists entraide_posts_solved;
alter table public.entraide_posts
  add constraint entraide_posts_solved
  foreign key (solved_reply_id) references public.entraide_replies (id)
  on delete set null;

create index if not exists entraide_posts_status_created
  on public.entraide_posts (status, created_at desc);
create index if not exists entraide_posts_author_created
  on public.entraide_posts (author_id, created_at desc);
create index if not exists entraide_posts_search
  on public.entraide_posts using gin (search);
create index if not exists entraide_replies_post_created
  on public.entraide_replies (post_id, created_at);
create index if not exists entraide_replies_author_created
  on public.entraide_replies (author_id, created_at desc);

alter table public.entraide_posts enable row level security;
alter table public.entraide_replies enable row level security;

drop policy if exists "entraide posts: read own" on public.entraide_posts;
create policy "entraide posts: read own" on public.entraide_posts
  for select to authenticated using (author_id = (select auth.uid()));
drop policy if exists "entraide posts: write own" on public.entraide_posts;
create policy "entraide posts: write own" on public.entraide_posts
  for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "entraide posts: edit own" on public.entraide_posts;
create policy "entraide posts: edit own" on public.entraide_posts
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "entraide replies: read own" on public.entraide_replies;
create policy "entraide replies: read own" on public.entraide_replies
  for select to authenticated using (author_id = (select auth.uid()));
drop policy if exists "entraide replies: write own" on public.entraide_replies;
create policy "entraide replies: write own" on public.entraide_replies
  for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "entraide replies: edit own" on public.entraide_replies;
create policy "entraide replies: edit own" on public.entraide_replies
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- What every new question or answer must pass, whoever writes it: a
-- pseudonym, not barred, under the day's limit, and no link before the
-- account is a day old. Definer, to read the account's age in auth.users.
create or replace function public.entraide_author_guard(
  author uuid,
  written text,
  recent bigint,
  limit_per_day integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  barred timestamptz;
begin
  select banned_at into barred
  from public.entraide_profiles where user_id = author;
  if not found then
    raise exception 'no_handle' using errcode = 'P0001';
  end if;
  if barred is not null then
    raise exception 'banned' using errcode = '42501';
  end if;
  if recent >= limit_per_day then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if written ~* '(https?://|www\.[a-z0-9-]+\.[a-z])'
    and (select created_at from auth.users where id = author)
      > now() - interval '24 hours' then
    raise exception 'links_too_soon' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.entraide_author_guard(uuid, text, bigint, integer)
  from public, anon, authenticated;

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

  -- Moderation, in 5c, goes through the service role.
  if (select auth.role()) = 'service_role' then
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

drop trigger if exists entraide_posts_guard on public.entraide_posts;
create trigger entraide_posts_guard
  before insert or update on public.entraide_posts
  for each row execute function public.entraide_posts_guard();

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

  if (select auth.role()) = 'service_role' then
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

drop trigger if exists entraide_replies_guard on public.entraide_replies;
create trigger entraide_replies_guard
  before insert or update on public.entraide_replies
  for each row execute function public.entraide_replies_guard();

-- ---------------------------------------------------------------- reactions

alter table public.reactions drop constraint if exists reactions_target_kind;
alter table public.reactions add constraint reactions_target_kind check (
  (target ~ '^changelog:[a-z0-9-]{1,80}$' and kind in ('love', 'useful', 'finally'))
  or (target ~ '^roadmap:[a-z0-9-]{1,80}$' and kind = 'want')
  or (target ~ '^(post|reply):[0-9]{1,18}$' and kind in ('useful', 'thanks'))
);

-- ------------------------------------------------------------------- reading
--
-- For anyone. A post or an answer is « gone » once deleted or once its
-- author's account is: its text is already empty, and the page says
-- « Message supprimé ». A hidden one is shown to its author only.

-- The list: questions and shares with their activity, filtered (all,
-- unanswered, solved, shares) and sorted (recent, useful). A gone question
-- stays listed while it has answers to read.
create or replace function public.entraide_list(
  p_filter text default 'all',
  p_sort text default 'recent',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id bigint,
  kind text,
  title text,
  excerpt text,
  handle text,
  is_pluclair boolean,
  gone boolean,
  created_at timestamptz,
  last_activity_at timestamptz,
  reply_count bigint,
  solved boolean,
  useful_count bigint,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with listed as (
    select
      p.id,
      p.kind,
      p.title,
      left(p.body, 240) as excerpt,
      pr.handle,
      coalesce(pr.is_pluclair, false) as is_pluclair,
      (p.status = 'deleted' or p.author_id is null) as gone,
      p.created_at,
      (select count(*) from public.entraide_replies r
        where r.post_id = p.id and r.status = 'visible'
          and r.author_id is not null) as reply_count,
      greatest(p.created_at, (select max(r.created_at)
        from public.entraide_replies r
        where r.post_id = p.id and r.status = 'visible')) as last_activity_at,
      exists (select 1 from public.entraide_replies r
        where r.id = p.solved_reply_id and r.status = 'visible'
          and r.author_id is not null) as solved,
      (select count(*) from public.reactions x
        where x.target = 'post:' || p.id and x.kind = 'useful') as useful_count,
      coalesce(p.author_id = auth.uid(), false) as is_mine
    from public.entraide_posts p
    left join public.entraide_profiles pr on pr.user_id = p.author_id
    where p.status in ('visible', 'deleted')
  )
  select
    l.id, l.kind, l.title, l.excerpt, l.handle, l.is_pluclair, l.gone,
    l.created_at, l.last_activity_at, l.reply_count, l.solved,
    l.useful_count, l.is_mine
  from listed l
  where (not l.gone or l.reply_count > 0)
    and case p_filter
      when 'unanswered' then l.kind = 'question' and l.reply_count = 0
      when 'solved' then l.solved
      when 'shares' then l.kind = 'share'
      else true
    end
  order by
    case when p_sort = 'useful' then l.useful_count end desc nulls last,
    l.last_activity_at desc,
    l.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

-- One question or share, as its page shows it.
create or replace function public.entraide_thread(p_id bigint)
returns table (
  id bigint,
  kind text,
  title text,
  body text,
  guide_slug text,
  handle text,
  is_pluclair boolean,
  status text,
  gone boolean,
  created_at timestamptz,
  edited_at timestamptz,
  solved_reply_id bigint,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.kind,
    p.title,
    p.body,
    p.guide_slug,
    pr.handle,
    coalesce(pr.is_pluclair, false),
    p.status,
    (p.status = 'deleted' or p.author_id is null),
    p.created_at,
    p.edited_at,
    (select r.id from public.entraide_replies r
      where r.id = p.solved_reply_id and r.status = 'visible'
        and r.author_id is not null),
    coalesce(p.author_id = auth.uid(), false)
  from public.entraide_posts p
  left join public.entraide_profiles pr on pr.user_id = p.author_id
  where p.id = p_id
    and (p.status <> 'hidden' or p.author_id = auth.uid());
$$;

-- Its answers, oldest first.
create or replace function public.entraide_replies(p_post_id bigint)
returns table (
  id bigint,
  body text,
  handle text,
  is_pluclair boolean,
  status text,
  gone boolean,
  created_at timestamptz,
  edited_at timestamptz,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.body,
    pr.handle,
    coalesce(pr.is_pluclair, false),
    r.status,
    (r.status = 'deleted' or r.author_id is null),
    r.created_at,
    r.edited_at,
    coalesce(r.author_id = auth.uid(), false)
  from public.entraide_replies r
  left join public.entraide_profiles pr on pr.user_id = r.author_id
  where r.post_id = p_post_id
    and (r.status <> 'hidden' or r.author_id = auth.uid())
  order by r.created_at, r.id;
$$;

-- « Déjà demandé ? »: the open threads closest to what is being typed.
create or replace function public.entraide_search(
  p_query text,
  p_limit integer default 5
)
returns table (
  id bigint,
  kind text,
  title text,
  reply_count bigint,
  solved boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select websearch_to_tsquery('french', p_query) as query)
  select
    p.id,
    p.kind,
    p.title,
    (select count(*) from public.entraide_replies r
      where r.post_id = p.id and r.status = 'visible'
        and r.author_id is not null),
    exists (select 1 from public.entraide_replies r
      where r.id = p.solved_reply_id and r.status = 'visible'
        and r.author_id is not null)
  from public.entraide_posts p, q
  where p.status = 'visible'
    and p.author_id is not null
    and numnode(q.query) > 0
    and p.search @@ q.query
  order by ts_rank(p.search, q.query) desc, p.created_at desc
  limit least(greatest(p_limit, 1), 10);
$$;

-- Whether a pseudonym is already someone's, whatever its case.
create or replace function public.entraide_handle_taken(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entraide_profiles
    where lower(handle) = lower(btrim(p_handle))
  );
$$;

revoke all on function public.entraide_list(text, text, integer, integer) from public;
revoke all on function public.entraide_thread(bigint) from public;
revoke all on function public.entraide_replies(bigint) from public;
revoke all on function public.entraide_search(text, integer) from public;
revoke all on function public.entraide_handle_taken(text) from public, anon;
grant execute on function public.entraide_list(text, text, integer, integer) to anon, authenticated;
grant execute on function public.entraide_thread(bigint) to anon, authenticated;
grant execute on function public.entraide_replies(bigint) to anon, authenticated;
grant execute on function public.entraide_search(text, integer) to anon, authenticated;
grant execute on function public.entraide_handle_taken(text) to authenticated;
