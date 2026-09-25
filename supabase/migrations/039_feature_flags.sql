-- 039: feature flags, evaluated where both clients can ask the same question.
--
-- Every user-facing change in the upgrade plan ships behind a flag, off for
-- existing accounts unless its phase says otherwise. A flag has a global
-- default and an optional moment from which newly created accounts get it;
-- a per-account override wins over both.
--
-- ## Why no session can read the tables
--
-- Every table in this schema is readable by its owner alone, and 032 set out
-- why the first table readable across accounts would be the expensive one.
-- Flags do not need to be it: the only question a client ever asks is "which
-- flags are on for me", and `evaluated_feature_flags()` answers it as a
-- definer function. So both tables have RLS on and no policy at all. The
-- service role and the dashboard write them; no session reads a row.
--
-- ## Why a definer function
--
-- The cut-off compares the account's `auth.users.created_at`, which no
-- session may read. The function reads it for `auth.uid()` alone, and a
-- caller with no session gets no rows (and anon cannot call it).
--
-- Switched with SQL or the Supabase dashboard; there is no admin screen. The
-- statements are in "Feature flags" in docs/how-pluclair-works.md.
--
-- Reversible, and nothing else refers to these objects:
--   drop function evaluated_feature_flags();
--   drop table user_feature_flags;
--   drop table feature_flags;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/039_feature_flags.test.sql`.

/* -------------------------------------------------------------- the flags */

create table if not exists feature_flags (
  key text primary key
    check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  description text not null,
  enabled_by_default boolean not null default false,
  -- Null: no cut-off. Otherwise on for every account created at or after it.
  enabled_from timestamptz,
  created_at timestamptz not null default now()
);

comment on table feature_flags is
  'One row per flag. Read only through evaluated_feature_flags().';

/* ---------------------------------------------------------- the overrides */

create table if not exists user_feature_flags (
  user_id uuid not null references auth.users (id) on delete cascade,
  flag_key text not null
    references feature_flags (key) on delete cascade on update cascade,
  enabled boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, flag_key)
);

comment on table user_feature_flags is
  'A per-account answer that wins over the flag''s default and cut-off.';

alter table feature_flags enable row level security;
alter table user_feature_flags enable row level security;

-- No policies, deliberately: see the header.

/* ----------------------------------------------------------- the question */

create or replace function evaluated_feature_flags()
returns table (key text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.key,
    coalesce(
      o.enabled,
      -- `coalesce` because a null cut-off, or a null created_at, compares to
      -- null, and a flag is on or off: never unknown.
      f.enabled_by_default or coalesce(u.created_at >= f.enabled_from, false)
    )
  from feature_flags f
  join auth.users u on u.id = auth.uid()
  left join user_feature_flags o
    on o.flag_key = f.key and o.user_id = u.id
  order by f.key;
$$;

comment on function evaluated_feature_flags() is
  'Every flag with its answer for auth.uid(). No session, no rows.';

/* ------------------------------------------------------------- the grants */

-- Postgres grants EXECUTE to PUBLIC by default, so the grant alone would
-- restrict nothing (see 025).
revoke execute on function evaluated_feature_flags() from public, anon;
grant execute on function evaluated_feature_flags() to authenticated, service_role;

/* ----------------------------------------------------------- first flags */

insert into feature_flags (key, description)
values (
  'tags.manage',
  'Rename, merge and delete tags on the Plan page (Phase 0, T6).'
)
on conflict (key) do nothing;
