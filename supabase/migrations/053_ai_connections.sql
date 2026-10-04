-- 053: a user's own AI account (docs/plans/AI_ACCOUNT_PLAN.md, Phase 1).
--
-- The written reads move to an account the user connects and pays for,
-- through OpenRouter, in one press: an OAuth round trip with PKCE at the end
-- of which OpenRouter hands the server an API key created for that user.
-- Three tables, in the shape migration 041 gave the bank connection:
--
--   ai_connections         what the user may see and change: which service,
--                          which model, since when, the last error. No
--                          secret here.
--   ai_connection_secrets  the key, sealed by the web server with
--                          AI_SECRETS_KEY (AES-256-GCM). No client role can
--                          touch it.
--   ai_connect_flows       one row per round trip in progress: the OAuth
--                          state that binds the callback to the user who
--                          started it, and the PKCE verifier, sealed. Single
--                          use, ten minutes.
--
-- Rows are written by the server with the service role, after it has
-- verified who is asking; a user may read their own connection, change its
-- model and delete it — which takes the secret with it.
--
-- And the `ai.account` flag, off for everyone, so the connection can be
-- opened one account at a time before it is opened to all:
--
--   insert into user_feature_flags (user_id, flag_key, enabled)
--   values ('<user id>', 'ai.account', true);
--
-- Reversible:
--   drop table ai_connect_flows, ai_connection_secrets, ai_connections;
--   delete from feature_flags where key = 'ai.account';
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/053_ai_connections.test.sql`.

create table if not exists ai_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- One service in the first version. A check rather than an enum, so the
  -- next one is a one-line change.
  provider text not null default 'openrouter'
    check (provider in ('openrouter')),
  -- The service's own id for the model the reads are written with.
  model text not null check (length(model) between 1 and 120),
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Why the last call did not work, in words a screen may show. Never a
  -- secret, never a response body.
  last_error text,
  updated_at timestamptz not null default now()
);

comment on table ai_connections is
  'The AI account a user connected: service, model and state. The key is in ai_connection_secrets.';

alter table ai_connections enable row level security;

drop policy if exists "ai_connections_select_own" on ai_connections;
create policy "ai_connections_select_own"
  on ai_connections for select
  using (auth.uid() = user_id);

drop policy if exists "ai_connections_update_own" on ai_connections;
create policy "ai_connections_update_own"
  on ai_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ai_connections_delete_own" on ai_connections;
create policy "ai_connections_delete_own"
  on ai_connections for delete
  using (auth.uid() = user_id);

-- A user changes the model, nothing else: which service and since when are
-- the server's to say, and an insert only follows a verified round trip.
revoke insert, update on ai_connections from anon, authenticated;
grant update (model, updated_at) on ai_connections to authenticated;

create table if not exists ai_connection_secrets (
  user_id uuid primary key
    references ai_connections (user_id) on delete cascade,
  -- AES-256-GCM over the key, sealed by the web server. The database never
  -- sees the plaintext.
  ciphertext text not null,
  -- Which server key sealed it, so a rotated key can still open old rows.
  key_id text not null,
  created_at timestamptz not null default now()
);

alter table ai_connection_secrets enable row level security;
-- Deliberately no policy. Belt and braces: the grants go too.
revoke all on ai_connection_secrets from anon, authenticated;

create table if not exists ai_connect_flows (
  -- The OAuth state: random, single use, and what binds the callback to the
  -- user who started the round trip.
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The PKCE verifier, sealed like the key.
  verifier_ciphertext text not null,
  key_id text not null,
  -- How the round trip ends: back to the web's Profile, or back to the phone
  -- app through its deep link.
  mode text not null check (mode in ('redirect', 'app')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table ai_connect_flows enable row level security;
revoke all on ai_connect_flows from anon, authenticated;

create index if not exists ai_connect_flows_expires_idx
  on ai_connect_flows (expires_at);

insert into feature_flags (key, description)
values (
  'ai.account',
  'Connect one''s own AI account through OpenRouter, and write the reads with it (docs/plans/AI_ACCOUNT_PLAN.md).'
)
on conflict (key) do nothing;
