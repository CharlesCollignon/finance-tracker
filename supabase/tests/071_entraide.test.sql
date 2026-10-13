-- What migration 071 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/071_entraide.test.sql
--
-- A pseudonym before a post, unique and never Pluclair's; anyone reads the
-- threads and nobody reads a user id; only the asker marks an answer
-- « Résolu »; the day's limits, the day-old account's links and a bar hold;
-- a deleted answer and a deleted account leave « Message supprimé ».

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now() - interval '3 days'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', now() - interval '3 days'),
  ('c3333333-3333-3333-3333-333333333333', 'carol@example.test', now())
on conflict (id) do nothing;

create or replace function test_become(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function test_become_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;

-- The error a statement raises, or null if it goes through.
create or replace function test_error(query text) returns text
language plpgsql as $$
begin
  execute query;
  return null;
exception
  when others then
    return coalesce(nullif(sqlerrm, ''), sqlstate);
end;
$$;

grant execute on function test_become(uuid), test_become_anon(),
  test_assert(boolean, text), test_error(text) to anon, authenticated;

-- ------------------------------------------------------------- pseudonyms

select test_become('a1111111-1111-1111-1111-111111111111');
select test_assert(
  test_error($q$insert into entraide_posts (author_id, title, body)
    values ('a1111111-1111-1111-1111-111111111111',
      'Comment choisir son jour de lecture ?', '')$q$) = 'no_handle',
  'no post before a pseudonym');

insert into entraide_profiles (user_id, handle)
values ('a1111111-1111-1111-1111-111111111111', 'Léa_75');
select test_assert(
  (select handle from entraide_profiles) = 'Léa_75',
  'a person chooses an accented pseudonym');

select test_become('b2222222-2222-2222-2222-222222222222');
select test_assert(
  test_error($q$insert into entraide_profiles (user_id, handle)
    values ('b2222222-2222-2222-2222-222222222222', 'léa_75')$q$) like '%unique%',
  'a pseudonym is taken whatever its case');
select test_assert(
  test_error($q$insert into entraide_profiles (user_id, handle)
    values ('b2222222-2222-2222-2222-222222222222', 'Plu.Clair_fan')$q$) = 'handle_reserved',
  'no one passes for Pluclair');
select test_assert(
  test_error($q$insert into entraide_profiles (user_id, handle, is_pluclair)
    values ('b2222222-2222-2222-2222-222222222222', 'Bob', true)$q$) like '%row-level security%',
  'no one gives themself the « Pluclair » mark');
select test_assert(
  test_error($q$insert into entraide_profiles (user_id, handle)
    values ('a1111111-1111-1111-1111-111111111111', 'Bob')$q$) like '%row-level security%',
  'no one chooses a pseudonym for someone else');
insert into entraide_profiles (user_id, handle)
values ('b2222222-2222-2222-2222-222222222222', 'Bob');
select test_assert(entraide_handle_taken('BOB'), 'a taken pseudonym says so');

-- ---------------------------------------------------- asking and reading

select test_become('a1111111-1111-1111-1111-111111111111');
insert into entraide_posts (author_id, title, body)
values ('a1111111-1111-1111-1111-111111111111',
  'Comment choisir son jour de lecture ?',
  'Ma carte est à débit différé, le prélèvement tombe le 3.');

select test_become('b2222222-2222-2222-2222-222222222222');
select test_assert(
  (select count(*) from entraide_posts) = 0,
  'nobody reads another person''s rows directly');
select test_assert(
  (select handle from entraide_list()) = 'Léa_75'
    and not (select is_mine from entraide_list()),
  'the list says who asked by pseudonym, and that it is not mine');

select test_become_anon();
select test_assert(
  (select count(*) from entraide_list()) = 1
    and (select title from entraide_thread(
      (select id from entraide_list() limit 1)))
      = 'Comment choisir son jour de lecture ?',
  'a visitor reads the list and the thread');
select test_assert(
  test_error($q$insert into entraide_profiles (user_id, handle)
    values ('c3333333-3333-3333-3333-333333333333', 'Visiteur')$q$) is not null,
  'a visitor writes nothing');
select test_assert(
  (select id from entraide_search('jour de lecture') limit 1)
    = (select id from entraide_list() limit 1),
  '« Déjà demandé ? » finds the thread by its words');

-- ----------------------------------------------------- answering, solving

select test_become('b2222222-2222-2222-2222-222222222222');
insert into entraide_replies (post_id, author_id, body)
select id, 'b2222222-2222-2222-2222-222222222222',
  'Le lendemain du prélèvement, par exemple le 4.'
from entraide_list();

update entraide_posts
set solved_reply_id = (select id from entraide_replies limit 1);
select test_assert(
  not (select solved from entraide_list()),
  'only the asker marks an answer « Résolu »');

select test_become('a1111111-1111-1111-1111-111111111111');
update entraide_posts
set solved_reply_id = (
  select id from entraide_replies(
    (select id from entraide_list() limit 1)) limit 1);
select test_assert(
  (select solved from entraide_list())
    and (select reply_count from entraide_list()) = 1
    and (select solved from entraide_list(p_filter => 'solved')),
  'the asker marks it, and the thread is solved');
select test_assert(
  test_error($q$update entraide_posts set status = 'hidden'$q$) = 'not_allowed',
  'an author does not hide their own post as a moderator would');
update entraide_posts set kind = 'share',
  author_id = 'a1111111-1111-1111-1111-111111111111';
select test_assert(
  (select kind from entraide_posts) = 'question',
  'an author does not change what their post is');
update entraide_posts set title = 'Comment choisir son jour de lecture ? (carte)';
select test_assert(
  (select edited_at is not null from entraide_posts),
  'an edit is dated');

-- ------------------------------------------------------------- the limits

insert into entraide_posts (author_id, title)
select 'a1111111-1111-1111-1111-111111111111', 'Une autre question n° ' || n
from generate_series(1, 4) n;
select test_assert(
  test_error($q$insert into entraide_posts (author_id, title)
    values ('a1111111-1111-1111-1111-111111111111', 'Une question de trop')$q$)
    = 'rate_limited',
  'five questions a day, not six');

select test_become('c3333333-3333-3333-3333-333333333333');
insert into entraide_profiles (user_id, handle) values
  ('c3333333-3333-3333-3333-333333333333', 'Carol');
select test_assert(
  test_error($q$insert into entraide_posts (author_id, title, body)
    values ('c3333333-3333-3333-3333-333333333333',
      'Un lien vers mon site', 'https://exemple.fr')$q$) = 'links_too_soon',
  'no link from an account less than a day old');
insert into entraide_posts (author_id, title, body)
values ('c3333333-3333-3333-3333-333333333333',
  'Une question sans lien', 'Bonjour à tous.');
select test_assert(
  (select count(*) from entraide_posts) = 1,
  'the same account posts without a link');

reset role;
update entraide_profiles set banned_at = now()
where user_id = 'c3333333-3333-3333-3333-333333333333';
select test_become('c3333333-3333-3333-3333-333333333333');
select test_assert(
  test_error($q$insert into entraide_posts (author_id, title)
    values ('c3333333-3333-3333-3333-333333333333',
      'Une question malgré tout')$q$) = 'banned',
  'a barred pseudonym posts nothing');

-- ------------------------------------------------------------- reactions

select test_become('b2222222-2222-2222-2222-222222222222');
insert into reactions (target, user_id, kind)
select 'post:' || id, 'b2222222-2222-2222-2222-222222222222', 'useful'
from entraide_list() where title like 'Comment choisir%';
select test_assert(
  (select useful_count from entraide_list(p_sort => 'useful') limit 1) = 1,
  '« Utile » counts, and « Les plus utiles » puts it first');
select test_assert(
  test_error($q$insert into reactions (target, user_id, kind)
    values ('post:1', 'b2222222-2222-2222-2222-222222222222', 'love')$q$)
    like '%reactions_target_kind%',
  'a post takes « Utile » and « Merci », not « J''adore »');

-- ------------------------------------------- « Message supprimé », twice

update entraide_replies set status = 'deleted';
select test_assert(
  (select body from entraide_replies) = ''
    and not (select solved from entraide_list() where title like 'Comment choisir%')
    and (select reply_count from entraide_list() where title like 'Comment choisir%') = 0,
  'a deleted answer is emptied, and no longer solves the thread');

reset role;
select min(id) as first_post from entraide_posts \gset
delete from auth.users where id = 'a1111111-1111-1111-1111-111111111111';
select test_become_anon();
select test_assert(
  (select gone and title = '' and handle is null
    from entraide_thread(:first_post)) is not distinct from true,
  'a deleted account leaves its questions emptied, without a pseudonym');

rollback;
