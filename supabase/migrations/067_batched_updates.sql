-- 067: two updates made in one statement rather than a request per row
-- (docs/plans/QUALITY_SYNC_ENGAGEMENT_PLAN.md, "Batch the per-row round
-- trips in the bank sync and reprices").
--
-- PostgREST updates one set of values per request, so bringing a month of
-- forecast occurrences back in line with their quotes, or setting the balance
-- the bank printed after each movement, cost a request for every row — inside
-- a cron with a minute to run in. Each function takes the rows as JSON and
-- updates them in one statement.
--
-- Security invoker: row level security applies to a signed-in caller exactly
-- as it did to the updates these replace, and the cron's service role names
-- the user it is working for. A row that is not the user's is left alone.
-- The apps fall back to a row at a time while this is not applied, and when
-- the database refuses a batch, so one bad row costs only itself.
--
-- Reverse:
--
--   drop function public.reprice_occurrences(uuid, jsonb);
--   drop function public.set_feed_balances(uuid, jsonb);

-- A forecast occurrence is entirely its template's: amount, note and
-- category come back in line together (`writeReprices`).
create or replace function public.reprice_occurrences(
  target_user uuid,
  updates jsonb
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with changed as (
    update public.transactions as t
    set amount = u.amount, note = u.note, category_id = u.category_id
    from jsonb_to_recordset(updates)
      as u(id uuid, amount numeric, note text, category_id uuid)
    where t.id = u.id
      and t.user_id = target_user
    returning 1
  )
  select count(*)::integer from changed;
$$;

-- The balance the bank printed after each movement, and its place in the
-- day, on rows the feed already holds — nothing else of them is touched:
-- they carry the decisions already made about them (`refreshBalances`).
create or replace function public.set_feed_balances(
  target_user uuid,
  updates jsonb
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with changed as (
    update public.bank_feed_items as f
    set balance_after = u.balance_after, intraday_index = u.intraday_index
    from jsonb_to_recordset(updates)
      as u(provider_id text, balance_after numeric, intraday_index smallint)
    where f.user_id = target_user
      and f.provider_id = u.provider_id
    returning 1
  )
  select count(*)::integer from changed;
$$;

revoke execute on function public.reprice_occurrences(uuid, jsonb)
  from public, anon;
grant execute on function public.reprice_occurrences(uuid, jsonb)
  to authenticated, service_role;
revoke execute on function public.set_feed_balances(uuid, jsonb)
  from public, anon;
grant execute on function public.set_feed_balances(uuid, jsonb)
  to authenticated, service_role;
