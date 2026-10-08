-- What migration 060 has to be true for.
--
-- Run against a local stack:
--
--   supabase start
--   supabase db reset          -- replays every migration
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/060_shared_space.test.sql
--
-- Two partners share a space; a third person is outside it. Each partner
-- reads and writes the joint rows and never the other's own; the outsider
-- reaches nothing of it; a full space takes nobody else; leaving takes the
-- access at once; the last one out takes the space and its rows. Every
-- check raises rather than returns; silence to the final echo is the pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', '{"full_name": "Bob"}'),
  ('c3333333-3333-3333-3333-333333333333', 'carol@example.test', '{"full_name": "Carol"}')
on conflict (id) do nothing;

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

create or replace function test_refused(query text) returns boolean
language plpgsql as $$
begin
  execute query;
  return false;
exception
  when insufficient_privilege or check_violation or raise_exception
    or foreign_key_violation then
    return true;
end;
$$;

create temporary table ids (name text primary key, id uuid, token text)
  on commit drop;
grant all on ids to authenticated;

select test_assert(
  (select count(*) from public.owners where kind = 'person'
     and id in ('a1111111-1111-1111-1111-111111111111',
                'b2222222-2222-2222-2222-222222222222',
                'c3333333-3333-3333-3333-333333333333')) = 3,
  'every person signed up is an owner');

-- Alice's own money.
select test_become('a1111111-1111-1111-1111-111111111111');
insert into categories (user_id, name, type)
values ('a1111111-1111-1111-1111-111111111111', 'Courses', 'expense');
insert into transactions (user_id, category_id, amount, occurred_on, note)
select 'a1111111-1111-1111-1111-111111111111', id, 42, '2026-10-01', 'Alice seule'
from categories where name = 'Courses';

-- Alice makes the space; her categories are copied into it.
insert into ids (name, id) values ('space', public.create_space('Commun'));
select test_assert(
  (select count(*) from categories where user_id = (select id from ids where name = 'space')) = 1,
  'the joint categories start as the creator''s');
select test_assert(
  test_refused('select public.create_space(''Encore'')'),
  'one space a person');

insert into transactions (user_id, category_id, amount, occurred_on, note)
select s.id, c.id, 80, '2026-10-02', 'Courses du samedi'
from ids s join categories c on c.user_id = s.id and c.name = 'Courses'
where s.name = 'space';
select test_assert(
  (select created_by from transactions where note = 'Courses du samedi')
    = 'a1111111-1111-1111-1111-111111111111',
  'a joint row says who added it');
select test_assert(
  test_refused($q$
    insert into transactions (user_id, category_id, amount, occurred_on)
    select (select id from ids where name = 'space'), id, 1, '2026-10-03'
    from categories where user_id = 'a1111111-1111-1111-1111-111111111111'
  $q$),
  'a joint row cannot take one of its partner''s own categories');

update ids set token = public.create_space_invite(id) where name = 'space';

-- Bob joins with the link.
select test_become('b2222222-2222-2222-2222-222222222222');
select test_assert(
  (select usable and space_name = 'Commun' and invited_by = 'Alice'
   from public.peek_space_invite((select token from ids where name = 'space'))),
  'the link says what it is before it is used');
select public.join_space((select token from ids where name = 'space'));
select test_assert(
  (select count(*) from transactions) = 1
    and (select note from transactions) = 'Courses du samedi',
  'a partner reads the joint rows, and not the other''s own');
insert into transactions (user_id, category_id, amount, occurred_on, note)
select s.id, c.id, 30, '2026-10-04', 'Pain'
from ids s join categories c on c.user_id = s.id
where s.name = 'space';
select test_assert(
  (select created_by from transactions where note = 'Pain')
    = 'b2222222-2222-2222-2222-222222222222',
  'and writes them, as himself');
select test_assert(
  public.acting_for((select id from ids where name = 'space')),
  'a member acts for the space in the definer functions');
select test_assert(
  (select count(*) from space_members) = 2,
  'and sees who else is in it');

-- Carol is outside.
select test_become('c3333333-3333-3333-3333-333333333333');
select test_assert(
  test_refused(format('select public.join_space(%L)', (select token from ids where name = 'space'))),
  'a used link takes nobody else');
select test_assert(
  (select count(*) from transactions) = 0
    and (select count(*) from spaces) = 0
    and (select count(*) from space_members) = 0,
  'someone outside the space reads nothing of it');
select test_assert(
  not public.acting_for((select id from ids where name = 'space')),
  'nor acts for it');
select test_assert(
  test_refused(format($q$
    insert into categories (user_id, name, type) values (%L, 'Intrus', 'expense')
  $q$, (select id from ids where name = 'space'))),
  'nor writes into it');

select test_become('a1111111-1111-1111-1111-111111111111');
update ids set token = public.create_space_invite(id) where name = 'space';
select test_become('c3333333-3333-3333-3333-333333333333');
select test_assert(
  test_refused(format('select public.join_space(%L)', (select token from ids where name = 'space'))),
  'a full space takes nobody else, even with a new link');

-- Bob leaves: his access goes at once, the rows stay.
select test_become('b2222222-2222-2222-2222-222222222222');
select public.leave_space((select id from ids where name = 'space'));
select test_assert(
  (select count(*) from transactions) = 0,
  'leaving takes the access at once');
select test_become('a1111111-1111-1111-1111-111111111111');
select test_assert(
  (select count(*) from transactions where user_id = (select id from ids where name = 'space')) = 2,
  'and leaves the rows to the one who stays');

-- Alice leaves last: the space and its rows go.
select public.leave_space((select id from ids where name = 'space'));
reset role;
select test_assert(
  (select count(*) from spaces where id = (select id from ids where name = 'space')) = 0
    and (select count(*) from transactions where note in ('Courses du samedi', 'Pain')) = 0,
  'the last one out takes the space and its rows');
select test_assert(
  (select count(*) from transactions where note = 'Alice seule') = 1,
  'and never a person''s own');

delete from auth.users where id = 'a1111111-1111-1111-1111-111111111111';
select test_assert(
  (select count(*) from transactions where note = 'Alice seule') = 0
    and (select count(*) from owners where id = 'a1111111-1111-1111-1111-111111111111') = 0,
  'a person deleted takes their own money');

rollback;

\echo 060_shared_space: all assertions passed
