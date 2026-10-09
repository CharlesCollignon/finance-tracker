-- What migration 066 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/066_tax_boxes.test.sql
--
-- Alice files her donations category in 7UF; Bob reads none of it and cannot
-- file one of her categories; a box is a box.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test')
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
  when insufficient_privilege or check_violation then
    return true;
end;
$$;

select test_become('a1111111-1111-1111-1111-111111111111');
insert into categories (user_id, name, type)
values ('a1111111-1111-1111-1111-111111111111', 'Dons', 'expense');
insert into tax_box_categories (user_id, category_id, box)
select user_id, id, '7UF' from categories where name = 'Dons';
select test_assert(
  (select box from tax_box_categories) = '7UF',
  'a person files a category in a box');
select test_assert(
  test_refused($q$
    update tax_box_categories set box = 'dons'
  $q$),
  'a box is a box''s code');

select test_become('b2222222-2222-2222-2222-222222222222');
select test_assert(
  (select count(*) from tax_box_categories) = 0,
  'nobody else reads it');
select test_assert(
  test_refused($q$
    insert into tax_box_categories (user_id, category_id, box)
    select 'b2222222-2222-2222-2222-222222222222', id, '7DB'
    from categories where name = 'Dons'
  $q$) or (select count(*) from categories where name = 'Dons') = 0,
  'nor files someone else''s category');

rollback;

\echo 066_tax_boxes: all assertions passed
