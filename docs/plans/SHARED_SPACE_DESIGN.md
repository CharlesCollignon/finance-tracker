# Shared space — design

Phase 6 of `docs/plans/EVERYDAY_PLAN.md`, written before any code, for the
owner to agree (2026-10-08). The product decisions are the plan's: a couple,
a members table so more is possible later, each partner sees only the joint
space, a « Compte commun » role, « Moi · Commun » on the screens both spaces
have, a "my share" view, leaving with an export, a jointly owned property.
This is how a row comes to belong to a space, and how the access rules
follow.

## What is there today

- **44 tables carry a `user_id`**, 41 of them a foreign key to `auth.users`
  with `on delete cascade`.
- **125 row-level policies**, nearly all `auth.uid() = user_id`.
- **281 reads filter `.eq("user_id", …)`**, across 81 files of
  `packages/data`, the web's queries and the phone's; 32 writes set
  `user_id: userId`. None of them asks who is signed in: each is handed the
  id to use.
- The crons go **person by person**: the notify cron over people with a
  device, the fill over the owners of recurring templates.
- **Bank accounts keep no IBAN**; nothing can yet tell that two people's
  connections show the same joint account.
- **No e-mail is sent** by the app itself: Supabase sends its own auth mails,
  nothing else.

## The choice: a space is an owner

Two ways to make a row a joint one.

**A. A `space_id` on every row.** Every money table gains a column, every
person a personal space, and the 281 reads and 32 writes move from
`user_id` to `space_id`. The cleanest schema, and a rewrite of the data
layer touching every screen.

**B. A space is an owner** — recommended. The column stays `user_id`, read
as _owner_: a person's id for their own money, a space's id for the joint
money. The joint space's rows are the same rows in the same tables under
another owner. Every read and write keeps working as written, handed the
space's id instead of the person's; what changes is who may pass which id,
and that is the access rules' to say.

B is chosen below. What it costs: the foreign keys can no longer point at
`auth.users` (a space is not a user), and every policy on a table a space
can own is rewritten. Both happen once, in one migration.

## Schema (migration 060)

```
owners         id uuid pk, kind 'person' | 'space', created_at
               — one row per person (filled from auth.users, and by a
                 trigger on sign-up) and one per space. Deleting an
                 auth user deletes its owner row (trigger).
spaces         id uuid pk → owners(id) on delete cascade,
               name text default 'Commun', created_by uuid → auth.users,
               created_at
space_members  space_id → spaces on delete cascade,
               user_id → auth.users on delete cascade,
               share numeric(5,4) default 0.5   — « ma part », phase 6b
               joined_at, primary key (space_id, user_id)
               — two at most for now, checked by the join function
space_invites  token text pk (random, 32 bytes), space_id → spaces,
               created_by → auth.users, created_at, expires_at (7 days),
               accepted_by uuid null, accepted_at null
```

On the tables a space can own, `user_id` keeps its name and its meaning
widens to _owner_: the foreign key moves from `auth.users(id)` to
`owners(id)`, still `on delete cascade`, so deleting a person still takes
their rows and deleting a space takes the joint ones.

`transactions` and `recurring_templates` gain `created_by uuid default
auth.uid()` — who added the row, shown as an initial in the joint space.

`bank_accounts` gains `iban_hash text` (SHA-256 of the IBAN, never the IBAN)
and `space_id uuid null`: an account whose role is « Compte commun » names
the space its rows go to.

### Which tables a space can own

| A space can own (joint rows)                                                                                                                        | Always a person's                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| transactions, categories, recurring_templates, recurring_skips, recurring_fulfilments, recurring_fulfilment_refusals, recurring_proposal_dismissals | user_preferences, expo_push_tokens, push_subscriptions, notification_log                                         |
| month_closes, month_close_settings, balance_readings, deletion_undo                                                                                 | bank_connections, bank_connection_secrets, bank_pulls, bank_accounts (it says which space a joint account feeds) |
| bank_feed_items (a joint account's rows)                                                                                                            | ai_connections, ai_connect_flows, ai_connection_secrets, the AI reads and tallies                                |
| properties, property_loans, property_market_readings, property_rent_references (phase 6c)                                                           | wallets and positions, savings accounts, instrument readings, feature flags, budgets, tags, savings goals        |

## Access rules

One rule for every table on the left: a row is yours to read and write when
its owner is you, or a space you are a member of.

```sql
using (
  user_id = auth.uid()
  or user_id in (select space_id from space_members where user_id = auth.uid())
)
```

Written with the sub-select so Postgres evaluates the membership once per
statement, not once per row. The insert and update checks are the same. The
deleted-row conditions on `transactions` and `categories` (migration 036)
stay as they are, added to it. The tables on the right keep
`auth.uid() = user_id`.

What this guarantees, and the assertion script will check each:

- a partner reads and writes the joint rows, never the other's own;
- someone outside the space reads nothing of it, even knowing its id;
- a person cannot make a space owner of a row unless they are its member;
- leaving the space takes the access with it at once, the rows staying;
- deleting a space deletes its rows; deleting a person removes them from the
  space and deletes their own rows, never the joint ones.

The database functions that are `security definer` and take a user id
(`restore_deletion`, `sweep_deleted`, the fill's) are checked one by one: any
that accepts an owner checks membership itself.

## The apps: the owner on screen

Every screen both spaces have — Le point, the Journal and its calendar and
categories, Récurrents, the month close, the review inbox, Abonnements, and
Immobilier from 6c — reads and writes **as the owner on screen**: the person's
id under « Moi », the space's under « Commun ». The rest — Plan, Placements,
Profile, the bank's own page, notifications — stays the person's.

- **Web.** The switch sets a cookie, `owner=<space id>`. A helper,
  `getOwner()`, returns it when the signed-in person is a member of that
  space, and their own id otherwise — a cookie naming a space they left
  falls back to them. The shared pages pass `getOwner()` where they pass
  `user.id` today; their actions go through `asOwner`, the twin of `asUser`
  that hands the work the owner on screen as well as who is asking. The
  other pages and actions are not touched.
- **Phone.** An `OwnerProvider` holds the owner on screen, remembered on the
  device, with the same fallback; the shared screens take it from there.
  Writes announce themselves as today, and a switch reloads the screens in
  view.
- **The switch** is drawn only for someone in a space, at the top of the
  shared screens. In « Commun », the tabs the joint space does not have are
  hidden.
- **Who added it.** In the joint space, each row shows the initial of
  `created_by`, from the members' names.

Nothing else in `packages/data` changes: its functions already take the
owner as an argument and filter on it.

## Joining and leaving

- **Creating** the space: from Profile, « Créer un espace commun ». It creates
  the owner, the space, the membership, and the joint categories, copied from
  the creator's.
- **Inviting** — needs the owner's say, below. Without an e-mail service of
  its own, the app gives the inviter a link (`/join/<token>`) to send the way
  they like: the share sheet, a message. Valid seven days, for one person.
- **Joining**: the partner, signed in, opens the link; a database function
  checks the token, that the space has room, and adds them.
- **Leaving** — a separation, or deleting one's account: the membership goes
  at once; before it, a CSV of the space's rows is offered (the Journal's
  export, over the joint rows). The space stays with the other partner, who
  can invite someone else. The last member to leave deletes the space and
  its rows.

## The bank

- A joint account seen by a person's open-banking.io connection is offered
  the role « Compte commun », with the space to feed. Its rows go into the
  space (`bank_feed_items.user_id` = the space), and its balance into the
  space's Le point and close.
- The same account connected by the second partner is recognised by
  `iban_hash` and its copy left out: one account feeds the space once.
- The review inbox of the joint space is shared; the first answer files the
  shop for both.
- Without a bank, either partner types or imports into the space, as on
  their own.

## The crons and the notifications

- **Fill.** It already finds owners by their recurring templates, so a
  space's charges fill on their day with no change, the rows owned by the
  space.
- **Notify.** For each person with a device, after their own messages, the
  same messages computed for each space they are in — overdraft, big charge,
  the reading day — keyed per space (`space:<id>:overdraft:<month>`) in that
  person's log, under that person's switches. The Monday recap gains a
  « Compte commun » section.
- **Refresh.** Unchanged: it reads a person's connection, and the joint
  account's rows land in the space by its role.
- **Measurement** stays per person.

## Phasing

- **6a — A space for two** (`shared-space`): migration 060 and its assertion
  script; owners, spaces, invites, the rules; `getOwner`/`asOwner` and the
  phone's provider; the switch on both apps; creating, inviting, joining,
  leaving with the export; the joint categories; initials; the « Compte
  commun » role and the IBAN check; the notify cron's joint messages and the
  recap's section; `CONTEXT.md` and `PRODUCT.md`.
- **6b — My share** (`shared-share`): the share per member, « Avec ma part
  du commun » on Le point and « Où c'est parti ».
- **6c — A home owned together** (`shared-property`): properties owned by
  the space, a share per partner from the deed, each partner's net worth
  counting theirs; property tracking opened to everyone.

## Risks

- **The migration is the riskiest change yet**: forty foreign keys repointed
  and some sixty policies rewritten on the live database. It runs in one
  transaction, is replayed locally from scratch first (`supabase db reset`),
  comes with a reverse script, and the hosted project should be backed up
  just before.
- **A missed read**: a shared screen passing the person's id where the
  owner's is meant shows the person's money under « Commun ». Each shared
  page and screen is listed and checked; an assertion script cannot see the
  apps, so this is the part to look at with care.
- **The AI reads** are per person (their quota, their account): in the joint
  space, the month read is left out in 6a.

## Decisions for the owner

1. **"A space is an owner"** (B above) rather than a `space_id` on every row
   (A). Recommended: the same safety from the access rules, a fraction of
   the code changed.
2. **Inviting by a link the inviter sends**, since the app sends no e-mail
   of its own. Recommended. The other way is to add an e-mail service
   (Resend, Brevo), a new processor for the privacy policy.
3. **The space's name**: « Commun », renameable by either partner.
   Recommended.
4. **No month read (AI) in the joint space** in 6a. Recommended: whose
   quota, and whose AI account, is a question of its own.
