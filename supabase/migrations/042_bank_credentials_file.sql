-- Bank connections by credentials file, behind a flag.
--
-- open-banking.io closed its partner programme (September 2026), so the
-- Partner Connect flow 041 was built for cannot happen. Each user now brings
-- their own open-banking.io account instead and uploads the credentials file
-- it lets them download: the same file the deployment's owner keeps in the
-- environment. It is sealed into `bank_connection_secrets` exactly as the
-- partner bundle would have been, and `bank_connections` keeps its meaning,
-- so both tables stay as 041 made them.
--
-- Two changes:
--
--   1. `bank_connect_flows` goes. It held a PKCE verifier for the ten minutes
--      of an OAuth round trip, and there is no round trip any more.
--
--   2. The `bank.connect` flag, off for everyone, so the setup can be opened
--      one account at a time before it is opened to all:
--
--        -- for one account
--        insert into user_feature_flags (user_id, flag_key, enabled)
--        values ('<user id>', 'bank.connect', true)
--        on conflict (user_id, flag_key) do update set enabled = excluded.enabled;
--
--        -- for everyone
--        update feature_flags set enabled_by_default = true
--        where key = 'bank.connect';

drop table if exists bank_connect_flows;

insert into feature_flags (key, description)
values (
  'bank.connect',
  'Connect a bank by uploading the credentials file of one''s own open-banking.io account: the Bank page setup and every invitation to it.'
)
on conflict (key) do nothing;
