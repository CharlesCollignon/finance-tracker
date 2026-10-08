-- What migration 062 has to be true for.
--
-- Run against a local stack, after 060:
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/062_space_share.test.sql
--
-- Alice sets her part before Bob joins; Bob takes the rest; either of them
-- changes it for both; nobody outside does; the parts always make the
-- whole. Every check raises rather than returns; silence to the final echo
-- is the pass.

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
  when insufficient_privilege or invalid_parameter_value or raise_exception then
    return true;
end;
$$;

create temporary table ids (name text primary key, id uuid, token text)
  on commit drop;
grant all on ids to authenticated;

create or replace function test_shares() returns text
language sql as $$
  select string_agg(share::text, ',' order by joined_at)
  from public.space_members
  where space_id = (select id from ids where name = 'space');
$$;

select test_become('a1111111-1111-1111-1111-111111111111');
insert into ids (name, id) values ('space', public.create_space('Commun'));
select test_assert(test_shares() = '0.5000', 'half each until someone says otherwise');

select public.set_space_share((select id from ids where name = 'space'), 0.6);
update ids set token = public.create_space_invite(id) where name = 'space';

select test_become('b2222222-2222-2222-2222-222222222222');
select public.join_space((select token from ids where name = 'space'));
select test_assert(test_shares() = '0.6000,0.4000', 'whoever joins takes the rest');

select public.set_space_share((select id from ids where name = 'space'), 0.3);
select test_assert(test_shares() = '0.7000,0.3000', 'either partner sets it for both');

select test_assert(
  test_refused(format('select public.set_space_share(%L, 1.5)', (select id from ids where name = 'space'))),
  'a part is between nothing and the whole');

select test_become('c3333333-3333-3333-3333-333333333333');
select test_assert(
  test_refused(format('select public.set_space_share(%L, 0.9)', (select id from ids where name = 'space'))),
  'nobody outside the space sets it');

rollback;

\echo 062_space_share: all assertions passed
