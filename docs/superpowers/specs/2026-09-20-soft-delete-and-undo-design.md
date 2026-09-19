# Taking a delete back

**Date:** 2026-09-20
**Status:** Design for review — **not implemented**, and see "What cannot be
verified here" before approving.

## What this changes

Deleting a transaction or a category stops being final. The row is marked
`deleted_at` instead of being removed, the toast that reports the deletion
carries an **Undo** button, and a sweeper hard-deletes anything still marked
after a retention window.

The toast half of this already exists: `ToastProvider` gained an
`actionLabel`/`onAction` shape, and anything actionable stays on screen for
eight seconds rather than three and a half. What is missing is something for
the button to call.

## Why

`transaction.deleted` and `categories.deleted` are the two toasts in the app
that report an irreversible thing having happened, and they report it in the
one moment the reader is looking at the right place to be offered it back.
Today the offer cannot be made, because there is nothing left to restore.

## What the shape of this turned out to be

This section exists because the work is substantially larger than "add a
column". Four discoveries, none of them optional.

### 1. The filtering belongs in the policy, not in the queries

`transactions` is read from 41 places across 20 files in `apps/web`, and
`categories` from 16 across 9 — plus 37 more in `apps/mobile`. Filtering
`deleted_at is null` at each site is 94 edits and a permanent hazard: one
missed site shows deleted rows, and nothing fails loudly when a new one is
written.

So the `select` policies carry it:

```sql
create policy "transactions_select_own"
  on transactions for select
  using (auth.uid() = user_id and deleted_at is null);
```

Every existing query then stops seeing deleted rows with no edit at all, in
both apps at once. Restoring needs to see a hidden row, so it goes through a
`security definer` function — which is already this repo's convention for
every privileged write (`024_month_reads` sets out the argument at length,
and `032`, `033` and `035` all follow it).

### 2. Two unique constraints break

Both hold a slot that a soft-deleted row would keep occupying.

- `categories`: `unique (user_id, name, type)` — a deleted "Groceries"
  expense would block creating a new one under the same name.
- `transactions`: `transactions_recurring_month_uidx` on
  `(user_id, recurring_template_id, month)` — a deleted recurring charge
  would block re-applying that template for that month, which is exactly what
  someone does after deleting one by mistake.

Both become partial: `where deleted_at is null`.

### 3. Soft-deleting a category would silently drop a guard

`deleteCategory` today cannot delete a category that any transaction or
recurring template points at: both FKs are `on delete restrict`, and the
action turns the error into _"This category is used by transactions or
recurring items. Archive it instead."_

A soft delete is an `update`, so the restrict never fires and that refusal
disappears — leaving live transactions pointing at an invisible category. The
refusal therefore has to be re-stated explicitly in the function, so the
behaviour is exactly what it is today and only the successful case becomes
undoable.

### 4. Eleven foreign keys change meaning

A hard delete fires cascades and set-nulls. An update fires none of them, so
each relationship needs an answer for soft-delete and for restore.

**Pointing at `transactions`:**

| Table                            | Today    | On soft delete                                                     | On restore         |
| -------------------------------- | -------- | ------------------------------------------------------------------ | ------------------ |
| `transaction_tags`               | cascade  | leave — invisible with its transaction, and intact for the restore | nothing to do      |
| `recurring_fulfilments` (×2)     | cascade  | **must clear** — see below                                         | **must re-assert** |
| `bank_feed_items.transaction_id` | set null | **must null** — see below                                          | **must re-point**  |

The two marked ones are the real work. `recurring_fulfilments` is read
directly (`.from("recurring_fulfilments")`), not only through a join on
transactions, so RLS hiding the transaction does _not_ make the charge read
unsettled — it would keep reading as settled with nothing behind it. And a
`bank_feed_items` row whose `transaction_id` still points at a hidden
transaction stays out of the inbox, so the feed entry is neither matched nor
offered for matching.

Both therefore need the link broken on soft delete and restored on undo,
which means the "what was deleted" record has to carry more than an id.

**Pointing at `categories`:** `transactions` and `recurring_templates` are
`restrict` and handled by (3). `investment_positions`, `budgets` and
`category_reads` are cascade or set-null; today deleting a category destroys
them, so surviving a soft delete and coming back on restore is strictly
better. The sweeper's hard delete fires the same cascades today's delete
does, just later.

## Design

### Schema (`036_soft_delete.sql`)

- `deleted_at timestamptz` on `transactions` and `categories`, both null.
- Partial indexes `(user_id, deleted_at)` where `deleted_at is not null`, for
  the sweeper.
- The two unique constraints above rebuilt as partial.
- `select` policies rewritten to require `deleted_at is null`.
- `update` policies left alone: a visible row may be marked deleted by its
  owner directly.

### Functions (`security definer`, owner-checked)

- `restore_transactions(target_user uuid, ids uuid[])` — clears `deleted_at`,
  re-points the `bank_feed_items` rows and re-asserts the fulfilments
  recorded at delete time.
- `soft_delete_category(target_user uuid, target_category uuid)` — refuses
  with the same message as today if any live transaction or recurring
  template points at it, otherwise marks it.
- `restore_category(target_user uuid, target_category uuid)` — refuses if the
  name/type slot has been taken since.
- `sweep_deleted(before timestamptz)` — hard-deletes in FK-safe order.

### Actions

`deleteTransaction`, `deleteTransactions` and `deleteCategory` become soft,
and return enough to undo: the ids, and for transactions the bank-feed and
fulfilment links they broke. Three new actions call the restore functions.

### Surfaces

Undo appears on the four existing delete toasts: `TransactionForm`,
`TransactionsView`, `CalendarView`, `CategoriesView`. All four words go
through the en/fr catalogues.

### The sweeper

`vercel.json` already runs six crons; a seventh at `/api/cron/sweep` matches
how `read-instruments` and `notify` are already arranged, and keeps the
retention window in code rather than in a database schedule.

## What cannot be verified here

**This repo has no way to run a migration.** There is no
`supabase/config.toml`, no Docker on this machine, and no database tests —
all 63 test files in `packages/core` are pure functions. The migrations in
`supabase/migrations` are applied to a hosted project.

So a migration written here is unexecuted until it is applied to the real
database, and this one rewrites the `select` policies on the two central
tables of a finance app. The two failure modes are that the app shows nothing
at all, or that it shows deleted rows — and the first arrives as "my data is
gone".

That is the reason this document stops at a design. What it needs before
implementation is a decision about where it gets applied and tested first.

## Open decisions

1. **Retention window** before the sweeper hard-deletes. 30 days is the
   suggestion: long enough to cover "I deleted that last month", short enough
   that the tables do not carry a year of debris.
2. **Where it is proved.** A staging Supabase project, a local stack added to
   this repo (`supabase/config.toml` plus Docker), or applied straight to
   production with a tested rollback.
3. **Whether the narrower version is enough.** Capturing the deleted rows in
   the action and re-inserting them on undo needs no migration, no RLS change
   and no sweeper, and is testable today. It covers the ordinary mistake. It
   does not survive a page reload, and it restores tags and fulfilments only
   as well as the capture recorded them.
