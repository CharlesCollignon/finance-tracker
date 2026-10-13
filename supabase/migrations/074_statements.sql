-- 074: Statements — the bank's lines, brought by the person themselves.
--
-- open-banking.io may read no one's bank but the owner's (October 2026), so
-- everyone else brings their bank's lines themselves: a file they
-- downloaded, a table they copied, and later an e-mail they forward or a
-- notification their own phone shows (`docs/plans/STATEMENTS_PLAN.md`).
-- Those lines go through the bank feed's own pipeline — its matcher, its
-- « À vérifier » inbox, its account roles — so they are kept where the
-- bank's are, marked by where they came from.
--
-- 1. `bank_feed_items.source`: 'bank' for the connection's lines (every row
--    so far), 'file' for a file or a paste, 'email' and 'notification' for
--    the automatic ways to come. Only the bank's count as a bank feed
--    (`hasBankFeed`): someone who imports at the end of the month still has
--    their recurring charges written on their day, and the import then
--    confirms them rather than adding them twice.
-- 2. `bank_accounts.source` and `statement_key`: an account known from its
--    files rather than from a connection, and what recognises it in the
--    next file — its IBAN or its number, as the import normalises them —
--    so the second file of an account asks nothing. One account per key.
-- 3. `statement_imports`: one row per import, what it brought, so that it
--    can be said and undone as a whole; each line points at its import
--    (`bank_feed_items.import_id`). An import undone keeps its row, marked,
--    for the screen that lists them.
--
-- Run after 073. Reverse:
--   drop table statement_imports cascade;
--   alter table bank_feed_items drop column source, drop column import_id;
--   alter table bank_accounts drop column source, drop column statement_key;

alter table public.bank_feed_items
  add column if not exists source text not null default 'bank'
    check (source in ('bank', 'file', 'email', 'notification'));

alter table public.bank_accounts
  add column if not exists source text not null default 'bank'
    check (source in ('bank', 'file')),
  add column if not exists statement_key text;

create unique index if not exists bank_accounts_statement_key
  on public.bank_accounts (user_id, statement_key)
  where statement_key is not null;

create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  -- Whose lines: the person's, or their shared space's for a joint account,
  -- as the lines themselves (`bank_feed_items.user_id`).
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_account_id text not null,
  source text not null
    check (source in ('file', 'paste', 'share', 'email', 'notification')),
  -- What the file was: csv, ofx, qif, camt, mt940, cfonb, xlsx, ods, html,
  -- pdf… as `@finance/core` read it.
  format text not null check (char_length(format) <= 12),
  bank text check (char_length(bank) <= 40),
  file_name text check (char_length(file_name) <= 200),
  period_from date,
  period_to date,
  -- Lines in the file; new to the account; already there from an earlier
  -- import; filed on their own (a known charge, a match); waiting in the
  -- inbox. Said on the import's summary, and in its list.
  lines_total integer not null default 0 check (lines_total >= 0),
  lines_new integer not null default 0 check (lines_new >= 0),
  lines_known integer not null default 0 check (lines_known >= 0),
  lines_filed integer not null default 0 check (lines_filed >= 0),
  lines_waiting integer not null default 0 check (lines_waiting >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create index if not exists statement_imports_user_created
  on public.statement_imports (user_id, created_at desc);

alter table public.bank_feed_items
  add column if not exists import_id uuid
    references public.statement_imports (id) on delete set null;

create index if not exists bank_feed_items_import
  on public.bank_feed_items (import_id)
  where import_id is not null;

alter table public.statement_imports enable row level security;

-- The person's own imports, and their space's: who may read the lines may
-- read where they came from.
drop policy if exists statement_imports_select_owner on public.statement_imports;
create policy statement_imports_select_owner on public.statement_imports
  for select using (
    user_id = (select auth.uid()) or user_id in (select public.my_spaces())
  );

drop policy if exists statement_imports_insert_owner on public.statement_imports;
create policy statement_imports_insert_owner on public.statement_imports
  for insert with check (
    user_id = (select auth.uid()) or user_id in (select public.my_spaces())
  );

drop policy if exists statement_imports_update_owner on public.statement_imports;
create policy statement_imports_update_owner on public.statement_imports
  for update
  using (user_id = (select auth.uid()) or user_id in (select public.my_spaces()))
  with check (
    user_id = (select auth.uid()) or user_id in (select public.my_spaces())
  );

-- Not deleted: undone, which keeps the row and says when.
revoke delete on table public.statement_imports from anon, authenticated;
