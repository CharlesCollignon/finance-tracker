-- Bank connections for every user, not only the deployment's owner.
--
-- Until now one environment variable held one credentials bundle, and one
-- user id said whose it was. Partner Connect (open-banking.io's OAuth flow)
-- hands each user's delegated key and private key to the server instead, so
-- they have to live somewhere per user — and the private key decrypts that
-- person's whole bank history, which makes it the most sensitive value this
-- database will ever hold.
--
-- So three tables, split by who may read them:
--
--   bank_connections        status only. The user may read their own row, so
--                           both apps can say "connected", "renew" or
--                           "paused" without a server round trip.
--   bank_connection_secrets the encrypted bundle. Row level security is on
--                           and there is no policy at all: only the service
--                           role reaches it, and neither app's client can
--                           select it even for its own user.
--   bank_connect_flows      a consent flow in progress, for the ten minutes
--                           between leaving for open-banking.io and coming
--                           back. Service role only, like the secrets: it
--                           holds the PKCE verifier.
--
-- Everything the sync writes (bank_accounts, bank_feed_items, balances,
-- pulls) is already keyed by user and is untouched.

create table bank_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- active: syncing. expired: the delegated key lapsed or was revoked at
  -- open-banking.io, and only a new consent brings it back. paused:
  -- open-banking.io suspended syncing (an unpaid wallet). revoked: the user
  -- disconnected here. error: the last sync failed for another reason.
  status text not null default 'active'
    check (status in ('active', 'expired', 'paused', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  -- When the delegated key stops working, if open-banking.io says.
  key_expires_at timestamptz,
  -- The earliest bank consent among the user's connections: what the
  -- renewal reminder counts down to.
  consent_valid_until timestamptz,
  last_synced_at timestamptz,
  -- Why the last sync did not work, in words a screen may show. Never a
  -- secret, never a stack trace.
  last_error text,
  -- When the first import of the whole history finished. Null while it has
  -- not, which is what the import screen resumes from.
  backfilled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table bank_connections enable row level security;

create policy "bank_connections_select_own"
  on bank_connections for select using (auth.uid() = user_id);

create table bank_connection_secrets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- AES-256-GCM over the JSON bundle { token, privateKey }, sealed by the web
  -- server with BANK_SECRETS_KEY. The database never sees the plaintext.
  ciphertext text not null,
  -- Which server key sealed it, so a rotated key can still open old rows.
  key_id text not null,
  created_at timestamptz not null default now()
);

alter table bank_connection_secrets enable row level security;
-- Deliberately no policy. Belt and braces: the grants go too.
revoke all on bank_connection_secrets from anon, authenticated;

create table bank_connect_flows (
  -- The OAuth state: random, single use, and what binds the callback to the
  -- user who started the flow.
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The PKCE verifier, sealed like the secrets.
  verifier_ciphertext text not null,
  key_id text not null,
  -- How the flow should finish: close a popup, redirect a tab, or hand
  -- control back to the phone app through its deep link.
  mode text not null check (mode in ('popup', 'redirect', 'app')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table bank_connect_flows enable row level security;
revoke all on bank_connect_flows from anon, authenticated;

create index bank_connect_flows_expires_idx
  on bank_connect_flows (expires_at);

-- The invitations to connect a bank, each dismissible on its own surface and
-- remembered per user rather than per device: dismissing it on the laptop
-- should not bring it back on the phone.
alter table user_preferences
  add column if not exists dismissed_prompts text[] not null default '{}';
