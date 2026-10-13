-- What migration 072 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/072_entraide_moderation.test.sql
--
-- A member reports once, never their own words, and sees only their own
-- reports; the third different member's report hides the post at once,
-- with its reason written for its author to read; nobody but a moderator
-- (the service role) touches what was hidden.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now() - interval '3 days'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', now() - interval '3 days'),
  ('c3333333-3333-3333-3333-333333333333', 'carol@example.test', now() - interval '3 days'),
  ('d4444444-4444-4444-4444-444444444444', 'dan@example.test', now() - interval '3 days')
on conflict (id) do nothing;

insert into entraide_profiles (user_id, handle) values
  ('a1111111-1111-1111-1111-111111111111', 'Alice'),
  ('b2222222-2222-2222-2222-222222222222', 'Bob'),
  ('c3333333-3333-3333-3333-333333333333', 'Carol'),
  ('d4444444-4444-4444-4444-444444444444', 'Dan');

insert into entraide_posts (author_id, title, body)
values ('a1111111-1111-1111-1111-111111111111',
  'Un code de parrainage pour une banque', 'Utilisez mon code ABC123 !');
select id as post from entraide_posts \gset

create or replace function test_become(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
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

grant execute on function test_become(uuid), test_assert(boolean, text),
  test_error(text) to authenticated;

-- ---------------------------------------------------------------- reports

select test_become('a1111111-1111-1111-1111-111111111111');
select test_assert(
  test_error(format($q$insert into entraide_reports (target, reporter_id, reason)
    values ('post:%s', 'a1111111-1111-1111-1111-111111111111', 'promotion')$q$,
    :post)) = 'not_allowed',
  'nobody reports their own words');

select test_become('b2222222-2222-2222-2222-222222222222');
insert into entraide_reports (target, reporter_id, reason, note)
values ('post:' || :post, 'b2222222-2222-2222-2222-222222222222', 'promotion',
  'Un code de parrainage');
select test_assert(
  test_error(format($q$insert into entraide_reports (target, reporter_id, reason)
    values ('post:%s', 'b2222222-2222-2222-2222-222222222222', 'other')$q$,
    :post)) like '%entraide_reports_once%',
  'a member reports the same thing once');
select test_assert(
  test_error(format($q$insert into entraide_reports (target, reporter_id, reason, outcome)
    values ('post:%s', 'b2222222-2222-2222-2222-222222222222', 'other', 'hidden')$q$,
    :post)) is not null,
  'a member does not decide their own report');

select test_become('c3333333-3333-3333-3333-333333333333');
insert into entraide_reports (target, reporter_id, reason)
values ('post:' || :post, 'c3333333-3333-3333-3333-333333333333', 'promotion');
select test_assert(
  (select count(*) from entraide_reports) = 1,
  'a member sees only their own reports');
select test_assert(
  (select count(*) from entraide_list()) = 1,
  'two reports hide nothing');

-- ------------------------------------------------- the third one hides it

select test_become('d4444444-4444-4444-4444-444444444444');
insert into entraide_reports (target, reporter_id, reason)
values ('post:' || :post, 'd4444444-4444-4444-4444-444444444444', 'money');
select test_assert(
  (select count(*) from entraide_list()) = 0,
  'the third different member''s report hides it at once');
select test_assert(
  (select count(*) from entraide_decisions) = 0,
  'a reporter does not read the decision');

select test_become('a1111111-1111-1111-1111-111111111111');
select test_assert(
  (select status from entraide_thread(:post)) = 'hidden',
  'its author still sees it, hidden');
select test_assert(
  (select action = 'hide' and automatic and from_report and rule = 'promotion'
    from entraide_decisions where target = 'post:' || :post),
  'its author reads why: automatic, after reports, the reason reported most');
select test_assert(
  test_error(format($q$update entraide_posts set status = 'visible' where id = %s$q$,
    :post)) = 'not_allowed',
  'its author does not undo it');
select test_assert(
  test_error($q$select entraide_moderating()$q$) like '%permission denied%',
  'nobody asks whether they are moderating');

-- --------------------------------------------------------- the moderator

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update entraide_posts set status = 'visible' where id = :post;
update entraide_reports set resolved_at = now(), outcome = 'kept'
where target = 'post:' || :post;
select test_assert(
  (select status from entraide_posts where id = :post) = 'visible',
  'the moderator restores it');

rollback;
