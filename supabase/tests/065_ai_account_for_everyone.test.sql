-- What migration 065 has to be true for: a new account has `ai.account` on.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/065_ai_account_for_everyone.test.sql

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values ('a1111111-1111-1111-1111-111111111111', 'alice@example.test')
on conflict (id) do nothing;

select set_config('request.jwt.claims',
  json_build_object('sub', 'a1111111-1111-1111-1111-111111111111',
    'role', 'authenticated')::text, true);
set local role authenticated;

do $$
begin
  if not (select enabled from evaluated_feature_flags() where key = 'ai.account') then
    raise exception 'FAILED: the AI account is on for everyone';
  end if;
  raise notice '  ok  the AI account is on for everyone';
end;
$$;

rollback;

\echo 065_ai_account_for_everyone: all assertions passed
