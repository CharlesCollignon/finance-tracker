-- 075: Statements by e-mail — a personal address, and what arrives there.
--
-- Phase 4 of `docs/plans/STATEMENTS_PLAN.md`. Each person who wants it has
-- an address of their own (`<token>@releves.pluclair.com`); their mail
-- service forwards their bank's e-mails there, and the inbound-mail service
-- (Brevo) hands each one to the web app, which reads it and throws it away:
-- only the lines are kept, as for a file.
--
-- 1. `statement_inboxes`: the address (its random `token`), whether it is
--    on, the account a bank's alert e-mails go to once the person has said
--    which, what has come so far, and — for a few minutes — the code a mail
--    service sends to confirm forwarding, shown in the app so that setting
--    it up is a copy and a paste.
-- 2. `statement_mail_items`: a statement or alerts that came for an account
--    not known yet — read, waiting for the person to say which account
--    (its lines in `statement`, nothing of the e-mail). Swept after a month.
-- 3. `bank_feed_items.confirmed_by`: an alert's line is provisional; the
--    statement line that later confirms it is named here, so the month's
--    statement adds nothing twice (`confirmProvisional`).
--
-- Read by the person; written by the server alone (the webhook, and the
-- person's requests through it), with the service role.
--
-- Run after 074. Reverse:
--   drop function public.sweep_statement_mail();
--   drop table public.statement_mail_items;
--   drop table public.statement_inboxes;
--   alter table public.bank_feed_items drop column confirmed_by;

create table if not exists public.statement_inboxes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The address's own part: random, lower case, and the only thing that
  -- ties an e-mail to its person.
  token text not null unique check (token ~ '^[a-z0-9]{12}$'),
  enabled boolean not null default true,
  -- Where alert e-mails go (`bank_accounts.provider_account_id`).
  alert_account text check (char_length(alert_account) <= 200),
  created_at timestamptz not null default now(),
  last_mail_at timestamptz,
  -- E-mails read (a statement or an alert in them), e-mails that held
  -- nothing Pluclair understood, and the lines they brought.
  mails_read integer not null default 0 check (mails_read >= 0),
  mails_ignored integer not null default 0 check (mails_ignored >= 0),
  lines_brought integer not null default 0 check (lines_brought >= 0),
  -- A mail service's forwarding confirmation (Gmail's): its code and link.
  forward_code text check (char_length(forward_code) <= 20),
  forward_link text check (char_length(forward_link) <= 600),
  forward_code_at timestamptz
);

create table if not exists public.statement_mail_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  received_at timestamptz not null default now(),
  kind text not null check (kind in ('statement', 'alerts')),
  format text not null check (char_length(format) <= 12),
  bank text check (char_length(bank) <= 40),
  file_name text check (char_length(file_name) <= 200),
  -- The statement as `@finance/core/statement` read it: lines, account,
  -- period. Never the e-mail.
  statement jsonb not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'imported', 'dismissed')),
  decided_at timestamptz
);

create index if not exists statement_mail_items_user_waiting
  on public.statement_mail_items (user_id, received_at desc)
  where status = 'waiting';

alter table public.bank_feed_items
  add column if not exists confirmed_by text
    check (char_length(confirmed_by) <= 300);

alter table public.statement_inboxes enable row level security;
alter table public.statement_mail_items enable row level security;

drop policy if exists statement_inboxes_select_own on public.statement_inboxes;
create policy statement_inboxes_select_own on public.statement_inboxes
  for select using (user_id = (select auth.uid()));

drop policy if exists statement_mail_items_select_own on public.statement_mail_items;
create policy statement_mail_items_select_own on public.statement_mail_items
  for select using (user_id = (select auth.uid()));

revoke insert, update, delete on table public.statement_inboxes from anon, authenticated;
revoke insert, update, delete on table public.statement_mail_items from anon, authenticated;

-- The nightly sweep's part: what was decided a month ago, what has waited
-- two, and a forwarding code a day old.
create or replace function public.sweep_statement_mail()
returns int
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.statement_mail_items
    where (status <> 'waiting' and decided_at < now() - interval '30 days')
       or received_at < now() - interval '60 days'
    returning 1
  ), cleared as (
    update public.statement_inboxes
    set forward_code = null, forward_link = null, forward_code_at = null
    where forward_code_at < now() - interval '1 day'
    returning 1
  )
  -- A data-modifying WITH runs whether or not it is read: `cleared` too.
  select count(*)::int from gone;
$$;

revoke execute on function public.sweep_statement_mail() from public, anon, authenticated;
grant execute on function public.sweep_statement_mail() to service_role;
