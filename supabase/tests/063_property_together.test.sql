-- What migration 063 has to be true for.
--
-- Run against a local stack, after 062:
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/063_property_together.test.sql
--
-- Alice and Bob own a flat through their space: either sets the deed's
-- split for both, the two parts make the whole, Carol neither reads nor
-- sets it, and Immobilier is on for a new account. Every check raises
-- rather than returns; silence to the final echo is the pass.

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

select test_become('a1111111-1111-1111-1111-111111111111');
insert into ids (name, id) values ('space', public.create_space('Commun'));
update ids set token = public.create_space_invite(id) where name = 'space';
select test_become('b2222222-2222-2222-2222-222222222222');
select public.join_space((select token from ids where name = 'space'));

insert into properties (user_id, name, kind, usage, purchase_price, purchased_on)
select id, 'Appartement', 'apartment', 'main_home', 300000, '2024-05-01'
from ids where name = 'space';
insert into ids (name, id)
select 'flat', id from properties where name = 'Appartement';
select test_assert(
  (select count(*) from properties where name = 'Appartement') = 1,
  'a partner adds a home to the space');

select public.set_property_share((select id from ids where name = 'flat'), 0.3);
select test_assert(
  (select string_agg(share::text, ',' order by share)
   from property_shares where property_id = (select id from ids where name = 'flat'))
    = '0.3000,0.7000',
  'either partner sets the deed''s split for both');

select test_become('a1111111-1111-1111-1111-111111111111');
select test_assert(
  (select share from property_shares
   where property_id = (select id from ids where name = 'flat')
     and user_id = 'a1111111-1111-1111-1111-111111111111') = 0.7,
  'and the other reads their part');

select test_become('c3333333-3333-3333-3333-333333333333');
select test_assert(
  (select count(*) from property_shares) = 0,
  'someone outside reads none of it');
select test_assert(
  test_refused(format('select public.set_property_share(%L, 0.5)', (select id from ids where name = 'flat'))),
  'nor sets it');
select test_assert(
  (select enabled from evaluated_feature_flags() where key = 'property.track'),
  'Immobilier is on for everyone');

rollback;

\echo 063_property_together: all assertions passed
