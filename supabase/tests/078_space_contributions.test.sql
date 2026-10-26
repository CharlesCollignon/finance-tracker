-- What migration 078 has to be true for.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/078_space_contributions.test.sql
--
-- A member reads what each partner put into the joint account over a span,
-- by the transfer category's name; a deleted row and another category count
-- for nothing; someone outside the space reads nothing.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, created_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.test', now()),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.test', now()),
  ('c3333333-3333-3333-3333-333333333333', 'carol@example.test', now())
on conflict (id) do nothing;

insert into public.owners (id, kind)
values
  ('a1111111-1111-1111-1111-111111111111', 'person'),
  ('b2222222-2222-2222-2222-222222222222', 'person'),
  ('c3333333-3333-3333-3333-333333333333', 'person'),
  ('d4444444-4444-4444-4444-444444444444', 'space')
on conflict (id) do nothing;

insert into public.spaces (id, name, created_by)
values ('d4444444-4444-4444-4444-444444444444', 'Commun',
  'a1111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into public.space_members (space_id, user_id)
values
  ('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111'),
  ('d4444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222')
on conflict do nothing;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;
grant execute on function test_assert(boolean, text) to authenticated;

-- Each partner's own ledger: a transfer category, a row in it, a deleted
-- row in it, a row elsewhere.
insert into public.categories (id, user_id, name, type)
values
  ('ca111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
    'Versement au compte commun', 'expense'),
  ('ca111111-1111-1111-1111-111111111112', 'a1111111-1111-1111-1111-111111111111',
    'Courses', 'expense'),
  ('cb222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
    'Transfer to the joint account', 'expense');

insert into public.transactions (user_id, category_id, occurred_on, amount, note, deleted_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111',
    '2026-10-02', 600, 'VIR COMPTE COMMUN', null),
  ('a1111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111',
    '2026-10-20', 100, 'VIR COMPTE COMMUN', now()),
  ('a1111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111112',
    '2026-10-05', 40, 'LIDL', null),
  ('a1111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111',
    '2026-09-28', 600, 'VIR COMPTE COMMUN', null),
  ('b2222222-2222-2222-2222-222222222222', 'cb222222-2222-2222-2222-222222222222',
    '2026-10-03', 400, 'VIR COMPTE COMMUN', null);

-- ------------------------------------------------------------ as Alice

select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select test_assert(
  (select total from space_contributions('d4444444-4444-4444-4444-444444444444',
    '2026-10-01', '2026-10-31',
    array['versement au compte commun', 'transfer to the joint account'])
   where user_id = 'a1111111-1111-1111-1111-111111111111') = 600,
  'Alice put 600 in October: the deleted row, the other category and September count for nothing');

select test_assert(
  (select total from space_contributions('d4444444-4444-4444-4444-444444444444',
    '2026-10-01', '2026-10-31',
    array['versement au compte commun', 'transfer to the joint account'])
   where user_id = 'b2222222-2222-2222-2222-222222222222') = 400,
  'Alice reads what Bob put in, by the category''s English name');

select test_assert(
  (select count(*) from space_contributions('d4444444-4444-4444-4444-444444444444',
    '2026-10-01', '2026-10-31', array['versement au compte commun'])) = 2,
  'one row a member, with nothing as zero');

-- ------------------------------------------------------------ as Carol

select set_config('request.jwt.claims',
  '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select test_assert(
  (select count(*) from space_contributions('d4444444-4444-4444-4444-444444444444',
    '2026-10-01', '2026-10-31', array['versement au compte commun'])) = 0,
  'someone outside the space reads nothing');

rollback;
