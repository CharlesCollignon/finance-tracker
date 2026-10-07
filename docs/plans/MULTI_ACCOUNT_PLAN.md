# Several bank accounts — plan

October 2026. The owner wants one or several bank accounts to be easy, on the
web and the phone, still through the user's own open-banking.io account.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges.

## What already works

One credentials file opens the user's whole open-banking.io account, and that
account can hold several banks: open-banking.io bills 3 € a month for the
first account and 1 € for each one after. Every sync already reads every
account in it (`syncBankFeed` walks `getAccounts()`), and `bank_accounts`
already keeps one row per account. So adding a bank never needs a second
file: the user connects it on open-banking.io, and the next sync sees it.

## What goes wrong with more than one

1. **Nothing says a second bank is possible**, or how to add one.
2. **A bank added after the first import gets 90 days**, not its history:
   `backfilled_at` is one date per user, so the import never runs again
   (`BankImport.tsx` says so in its own comment).
3. **Every readable account fills the ledger**, whatever it is — a Livret, a
   joint account, a card. The tick (`counts_as_cash`) only decides whether its
   balance counts.
4. **Saving into one's own Livret can vanish.** When the bank gives the
   Livret's IBAN, a transfer between the user's own accounts is dropped from
   both sides (`ownIbans`), so it never counts as kept. And the first import,
   walking one account at a time, sees only that account's IBAN, so the same
   transfer is kept there and dropped on later syncs.
5. **The month an account is ticked, its whole balance counts as kept.** The
   close's opening figure is last month's stored close, which did not include
   it.
6. **A Livret can be ticked and linked at once**, counting twice: in the
   balance on Le point and as savings on Placements.
7. **The balance read shares one 400-row cap across accounts**
   (`readCashBalance`), so a quiet account behind a busy one can read as
   empty and hold every close.
8. **The manual close's suggestion sums every readable account**, Livrets
   included (`getBankBalanceSuggestion`).
9. **One consent date for all banks**, the earliest of them, so a bank the
   user stopped caring about keeps the renewal banner on.

## Decisions taken (2026-10-07)

- **A role per account, confirmed in one tap.** Courant, Épargne or Ne pas
  suivre, pre-filled from what the bank says the account is; new accounts are
  shown together and one « C'est bon » confirms them all. Nothing from an
  account enters the ledger until its role is decided.
- **A transfer to one's own Livret counts once, as savings**, on the current
  account's side. The Livret's own movements stay out: it gives its balance.
- **One ledger, marked by bank.** Once there are two Courant accounts, each
  bank row says its bank, and the ledger can be filtered by account.

## The rules

|                            | Courant         | Épargne                       | Ne pas suivre | Not decided |
| -------------------------- | --------------- | ----------------------------- | ------------- | ----------- |
| Movements in the ledger    | yes             | no                            | no            | no          |
| Balance on Le point, close | yes             | no — its Livret on Placements | no            | no          |
| Whole history brought in   | on becoming one | —                             | —             | —           |
| Consent reminders          | yes             | yes                           | no            | no          |

Transfers between the user's own accounts:

- **Courant ↔ Courant**: the same money moving. Dropped on both sides.
- **Courant → Épargne**: money set aside. Kept on the Courant side, where the
  matcher files it like any savings; never brought in on the Livret's.
- **Épargne → Courant**: savings taken back, on the Courant side, as today.
- **Courant → Ne pas suivre** (a joint account): money that left, like any
  payment.

The guess that pre-fills a role:

- **Épargne** when the bank says `SVGS`, or the name says livret, LDDS, LEP,
  PEL, CEL or épargne. Which Livret it is comes from the name too, else
  « Autre livret ».
- **Ne pas suivre** for a card (`CARD`), whose spending reaches the current
  account as its monthly debit, and for a loan (`LOAN`), which belongs on
  Immobilier.
- **Courant** otherwise.

## Phase 1 — Roles under the hood (branch `accounts-roles`) — done

Works with today's screens: the tick reads as Courant, no tick as Ne pas
suivre, and linking a Livret on Placements as Épargne.

- [x] Migration 056: `bank_accounts` gains `role` (null until decided),
      `bank_name`, `account_type`, `product`, `history_imported_at` and
      `consent_valid_until`; `month_closes` gains `bank_accounts`, the
      accounts a bank close summed, and `opening_balance`, set only when
      those differ from the last close's. Seeded from today's state: ticked →
      Courant, linked to a Livret → Épargne, history in where the first import
      finished. `counts_as_cash` follows the role through a trigger, so every
      reader keeps working, and so do phone builds that still write the tick.
- [x] Sync: only Courant accounts are brought in; the own-transfer IBANs are
      the Courant accounts' alone, whichever accounts a request walks; each
      account's bank and type are kept.
- [x] History per account: the import walks the Courant accounts whose
      history is not in yet, and the Bank page, web and phone, offers it
      whenever one is waiting — not only before the first import.
- [x] Linking a Livret to a bank account makes that account Épargne.
- [x] The balance is read account by account.
- [x] A close compares like with like: when the accounts it sums differ from
      the last close's, the opening adds or takes away those accounts'
      balances on the last close's day.
- [x] The manual close's suggestion sums the Courant accounts only.
- [x] Consent per bank, from `getConnections`, matched by bank name; the
      reminder counts only banks with an account that is Courant or Épargne.
- [x] CONTEXT.md: bank account and its role.

## Phase 2 — Web: your accounts, and adding a bank (branch `accounts-web`) — done

- [x] Core, tested: `guessAccountRole`, `guessSavingsKind` (written in
      phase 1, held back until a screen calls them: the reachability gate
      fails on a core export no app uses).
- [x] `/bank`: the accounts grouped by bank, each bank with its consent line;
      each account with its balance and its role (Courant · Épargne · Ne pas
      suivre). Épargne says which Livret it feeds and lets the user change it.
- [x] « Nouveaux comptes trouvés »: the readable accounts with no role yet,
      pre-filled, and one « C'est bon ». It saves the roles, creates or links
      the Livrets, then brings in the new Courant accounts' history with the
      existing progress list.
- [x] A first connection goes through the same card before anything is
      imported.
- [x] « Ajouter une banque »: a sheet saying to connect it on open-banking.io
      (1 € a month per extra account, paid to them) and to come back. When
      the tab is back in front, Pluclair looks for new accounts on its own;
      « Vérifier maintenant » does the same. Looking lists accounts and
      imports nothing.
- [x] Ne pas suivre says open-banking.io still bills the account until it is
      removed there.
- [x] Le point: one line while a new account waits for its role, to `/bank`.
- [x] Also: the status card names the bank whose consent ends first, once
      several are followed; a bank nobody follows is never asked to be
      renewed; an unreadable account nobody answered for waits, unasked,
      until it can be read.

## Phase 3 — Phone (branch `accounts-phone`) — done

- [x] The Bank screen as on the web: grouped list, roles, the new-accounts
      card, and « Ajouter une banque » through the in-app browser, looking
      again when the app comes back to the front.
- [x] Le point's line.
- [x] Looking for accounts through a route, `/api/bank/accounts`, since the
      server holds the file; roles saved through the phone's own client.

## Phase 4 — Living with several accounts (branch `accounts-everyday`) — done

- [x] Ledger, both apps: with two or more Courant accounts, a bank row says
      its bank (« BoursoBank »), and a filter by account.
- [x] Le point: the balance is the Courant accounts' total; tapping it shows
      each one.
- [x] A month that waits names the account and bank it cannot read, and
      why, on the Plan's run card where the close is offered.

## Open points

1. **Deferred-debit card accounts** are pre-filled Ne pas suivre. Following a
   card's purchases instead of its monthly debit is a later rule.
2. **Two logins at the same bank**: the consent is matched by bank name, and
   the earliest wins.
3. **A joint account followed as Courant** brings the partner's deposits in as
   money arriving. Ne pas suivre is simpler; the picker could say so when the
   owner name reads « M OU MME ».
