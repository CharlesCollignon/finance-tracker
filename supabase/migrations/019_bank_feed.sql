-- What the bank said, before anyone has agreed it belongs in the ledger.
--
-- The app's premise is that a transaction is something the user decided to
-- write down. A feed breaks that premise usefully — the restaurants and the
-- rounds of drinks finally appear — and dangerously, because a feed inserts
-- rows nobody looked at, and a ledger you have stopped trusting is worse than
-- one with gaps in it.
--
-- So the feed lands here first. A row the user's own history already answers
-- for is written straight through to `transactions` and marked imported; the
-- rest wait to be looked at. Either way the bank's version is kept, which is
-- what makes a sync idempotent and what lets a mistaken import be undone
-- without going back to the bank.

create table bank_feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The provider's own id for this transaction. Deduplication has to be on
  -- this and nothing derived: two identical coffees on the same day at the
  -- same counter are two transactions, and a key built from date, amount and
  -- merchant would silently collapse them into one.
  provider_id text not null,
  -- Which connected account it came from, as the provider names it.
  provider_account_id text not null,

  occurred_on date not null,
  -- Positive, with `direction` carrying the sign — the same shape as
  -- `transactions`, where the category's type says which way money went.
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null,
  direction text not null check (direction in ('in', 'out')),

  -- Merchant for money out, payer for money in.
  counterparty text,
  note text not null,
  -- The card network's own guess at what kind of place this is.
  merchant_category_code text,

  status text not null default 'pending'
    check (status in ('pending', 'imported', 'ignored')),
  -- Set once the row becomes a transaction. Null while pending, and null
  -- again if that transaction is later deleted, which is what lets the item
  -- come back into the inbox rather than vanish with it.
  transaction_id uuid references transactions (id) on delete set null,
  -- Why it was written through unasked, or why it is waiting.
  decided_by text,

  created_at timestamptz not null default now(),

  unique (user_id, provider_id)
);

create index bank_feed_items_user_status_idx
  on bank_feed_items (user_id, status, occurred_on desc);

alter table bank_feed_items enable row level security;

create policy "bank_feed_items_select_own"
  on bank_feed_items for select using (auth.uid() = user_id);

create policy "bank_feed_items_insert_own"
  on bank_feed_items for insert with check (auth.uid() = user_id);

create policy "bank_feed_items_update_own"
  on bank_feed_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bank_feed_items_delete_own"
  on bank_feed_items for delete using (auth.uid() = user_id);
