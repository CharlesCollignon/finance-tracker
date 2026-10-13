# Vos opérations, sans connexion bancaire

October 2026. open-banking.io answered on 12 October that its customers may
not give their access to an app that reads on their behalf, so the bank
connection is the owner's alone (`bankOpenTo`). Every other licensed way to
read a bank for someone — Enable Banking, Powens, Bridge — needs a signed
contract, business checks and a monthly minimum, and GoCardless Bank Account
Data no longer takes new sign-ups. On 2026-10-13 the owner asked for the way
with **no contract at all**: « make it as easy as possible to the user,
friendly interactions, make it automatic if there is a way, and accept as
many formats as possible ».

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges. Each phase
updates `docs/how-pluclair-works.md`, `CONTEXT.md`, `apps/web/PRODUCT.md`,
both `DESIGN.md` files and the legal texts wherever it changes what they say,
and adds its « Nouveautés » entry (`AGENTS.md`). New motion is playful, as
the owner asked of every new screen: Motion on the web, Reanimated on the
phone.

## The line we stay behind

Pluclair never reaches into a bank. Everything here is data **the person
hands over themselves**: a file they downloaded, a table they copied, an
e-mail they forward, a notification their own phone shows them. Reading
someone's account *for* them is the regulated service (« information sur
les comptes », Code monétaire et financier); being given what they already
hold is not — the same reasoning that already covers today's CSV import.
This is a reading of the rules, not a lawyer's opinion, and the plan avoids
anything that would blur it:

- no bank password is ever asked for, stored or typed into anything;
- no screen of a bank's website or app is read by Pluclair (no scraping,
  no tool that does it for the user);
- every automatic source is one the person switches on, can see working,
  and can switch off; what it brought can be undone.

The privacy policy and the register (`docs/legal/registre-des-traitements.md`)
are updated in the phase that adds each new way in.

## What is there today

From the survey of 2026-10-13:

- **One wizard on each app** — choose, map the columns, review, write:
  `apps/web/components/finance/ImportView.tsx` (`/import`, reached only from
  the Journal's header) and `apps/mobile/src/app/import.tsx` (from the
  Journal's options). Parsing is shared and runs where the file is:
  `packages/core/src/statement-file.ts` (decoding, OFX, header search) and
  `packages/core/src/csv-import.ts` (CSV, amounts, dates, mapping, rows).
- **Formats:** CSV with `, ; tab`, decimal comma or point, Windows-1252,
  junk lines above the header, split debit/credit columns; OFX/QFX reading
  only date, amount, name and memo. No bank presets, no remembered mapping,
  no Excel, QIF, CAMT, MT940, CFONB or PDF.
- **Every row needs a category** before anything is written.
- **Duplicates** are caught only by an exact `date|amount|merchant` key: a
  hand-typed coffee, a charge written by a recurring template or a bank-feed
  row with other words are imported again; two real coffees in one file
  collapse into one.
- **No account** on an imported row, **no undo** of an import, **nothing
  after it**: no matching, no inbox, no month close.
- **The bank feed already does all of that** for the owner: lines kept by
  their own id (`bank_feed_items`), a pure matcher in core
  (`planFeed`, `decide`, `findLedgerMatch`: amount to the cent, ±5 days,
  same direction), the « À vérifier » inbox, a role per account (Courant /
  Épargne / Ne pas suivre), own transfers counted once, the ledger marked by
  bank, month closes anchored on balances.

## The idea: a bank feed you bring by hand

Every way in — a file, a paste, a share, an e-mail, a notification — becomes
the same thing the bank used to send: **statement lines with an id of their
own, on an account**, and goes through the **same pipeline** as the bank
feed. So everything the bank connection does for the owner, an import does
for everyone: known charges are recognised and filed, the rest waits in
« À vérifier », an account has its role, a transfer to one's own Livret
counts once, a closing balance anchors the month, and the Journal says which
bank a line came from.

- **Lines** go into `bank_feed_items` with a `source`
  (`bank | file | email | notification`). `hasBankFeed` counts the bank
  alone, so recurring templates keep writing charges on their day for
  someone who imports at the end of the month — the import then confirms
  them instead of adding them twice.
- **The line's id** is the file's own when it has one (OFX `FITID`, CAMT
  `AcctSvcrRef`, MT940 reference), otherwise a fingerprint of account, date,
  amount and words **plus its rank among identical lines that day**: two
  real coffees stay two, and the same export downloaded again, or two
  exports that overlap by a month, add nothing twice.
- **Accounts** are `bank_accounts` rows with `provider = 'file'`, named from
  the file (bank, IBAN or the last digits of the number) and remembered:
  the next file from the same account goes to it without a question.
- **An import** is one row in `statement_imports` (who, source, format,
  bank, account, period, how many added / recognised / already there) and
  can be **undone as a whole for 30 days**, as the Journal's deletions are.

## Formats

Read in `packages/core/src/statement/`, pure TypeScript shared by both apps,
each reader turning bytes into lines plus what the file says about itself
(bank, account, period, opening and closing balances). Detected from the
content, never from the file's name alone.

| Format | Who exports it | Notes |
| --- | --- | --- |
| **CSV / TXT / TSV** | every bank and néobanque | `; , tab |`, UTF-8/16, Windows-1252, ISO-8859-15; decimal comma; thousands with spaces, NBSP, points; signed amount, debit/credit columns or a D/C column; dates `dd/mm/yyyy`, `dd/mm/yy`, ISO, « 12 oct. 2026 », Excel serials; preamble and totals lines |
| **Bank presets** | BoursoBank, Crédit Agricole, BNP Paribas, Société Générale, LCL, Caisse d'Épargne, Banque Populaire, Crédit Mutuel / CIC, La Banque Postale, Fortuneo, Hello bank!, Monabanq, Revolut, N26, Qonto, Shine, Nickel, Sumeria | recognised by their header, mapped without a question; any other CSV is understood by its columns' contents, and asks only when it truly cannot tell |
| **Excel** `.xls`, `.xlsx`, **`.ods`** | Fortuneo, LCL, Société Générale, Qonto | read on the server |
| **OFX / QFX** 1.x (SGML) and 2.x (XML) | most banks (« Money », « Quicken ») | now with `FITID`, the account and the balances |
| **QIF** | most banks (« Money ») | day-first dates as the bank writes them |
| **CAMT.053 / .052** (ISO 20022 XML) | business accounts, Qonto | balances and references included |
| **MT940** | Qonto, business accounts | |
| **CFONB 120** | French banks' « relevé de compte » for businesses and accountants | fixed-width lines |
| **PDF statements** (text) | every bank, and often the only thing a bank's app offers | read on the server from the text's positions, with a layout per bank; the statement's own totals check the reading |
| **Scanned PDFs, screenshots** | the bank app's list, a photo of a paper statement | AI extraction, only if the owner agrees (question 2), with the person's consent each time |
| **A copied table** | the operations page of any bank's website | pasted as text or HTML |

Fixtures: one anonymised file per bank and format in
`packages/core/fixtures/statements/` (the anonymising script is already
there), each with a test of what it must read. Real exports from the owner
or friends, anonymised, are the best fixtures; synthetic ones fill the gaps.

## The friendly path

Written for someone who has never exported anything.

1. **« Ajoutez vos opérations »** — one place, reachable from the Journal,
   from Le point when the month is empty, from onboarding (« Comment
   voulez-vous ajouter vos opérations ? ») and from the account menu.
2. **« Où trouver l'export de ma banque ? »** — pick your bank from its
   logo; Pluclair shows, in three short steps, where that bank puts its
   export on its website and in its app, and which format to choose. A link
   opens the bank's own page. Nothing to understand about formats.
3. **Give the file** however is easiest: drop it, pick it, share it to
   Pluclair from the bank's app or from Files, paste the table.
4. **Pluclair says what it understood**, in one card that assembles itself:
   « Relevé BoursoBank · compte ••4821 · 142 opérations du 1er juillet au
   30 septembre ». No column picker unless the file truly cannot be read
   alone.
5. **One summary, one button**: « 128 nouvelles · 11 déjà là · 3 reliées à
   ce que vous aviez saisi » — numbers that roll in — and « Importer ».
   Lines whose category is known (merchant memory, the recurring charges,
   the rules) are filed; the rest wait in « À vérifier », one tap each, as
   the bank's did. No line is ever blocked for want of a category.
6. **After**: a toast says what happened and offers « Annuler »; the
   closing balance, when the file has one, anchors the month; the month
   closes itself when it can. The next file from the same account asks
   nothing at all.

## Automatic, without a contract

Three ways for lines to arrive with nothing to do, each switched on by the
person, each visible in the Profile with what it brought last and a switch
to stop it:

- **Partager vers Pluclair** (Android). The bank's app or Files shares a
  statement, an export or a screenshot straight to Pluclair, which opens on
  the import with the file already read — several files at once if wanted.
  `expo-sharing` receives shares in SDK 57 (marked experimental by Expo),
  with `app/+native-intent.ts` routing them; a new APK.
- **Par e-mail.** A personal address, e.g. `a8f3k2@releves.pluclair.com`.
  Set once in Gmail or Outlook to forward the bank's e-mails there — the
  forwarding service's confirmation code is shown in the app the moment it
  arrives, so the setup is a copy and a paste. Statement attachments (CSV,
  OFX, PDF) are imported; per-operation alert e-mails (« Paiement par carte
  de 23,50 € chez … »), which many banks offer, become lines the
  day they happen. The e-mail itself is read and thrown away; only the
  lines are kept. Needs an inbound-mail service and one DNS record on a
  subdomain at Namecheap (question 3).
- **Notifications de votre banque** (Android). With the permission Android
  calls « Accès aux notifications », Pluclair reads, **on the phone only**,
  the notifications of the bank apps the person picks — « Paiement de
  12,30 € chez Monop' » — and nothing else; each becomes a line in « À
  vérifier » the moment it happens. The closest thing to a live connection
  that needs no one's permission but the person's. A native module and a
  new APK (question 4).
- **A nudge**: once a month, on the day the person's bank publishes its
  statement, « Votre relevé de septembre est prêt ? Partagez-le à
  Pluclair » — off as soon as an automatic way is on.

## Phases

0. **One engine** (`statements-engine`). The readers above in core, bank
   detection, stable line ids, fixtures and tests; migration 074
   (`bank_feed_items.source`, `statement_imports`, file accounts on
   `bank_accounts`, `hasBankFeed` counting the bank alone); the feed's
   planner taking lines from any source. No screen changes.
1. **The new import** (`statements-import`), web and phone together: the
   friendly path, per-bank export guides, the one-card reading, the
   summary, the shared inbox, balances, undo; the old wizard goes. Server
   reading for Excel; the 1 MB server-action limit lifted for it.
2. **Anywhere in one tap** (`statements-share`): Partager vers Pluclair on
   Android, drop anywhere and paste a table on the web, the entry points
   (Le point, onboarding, account menu), the monthly nudge. New APK.
3. **PDF and screenshots** (`statements-pdf`): text PDFs per bank layout,
   checked against the statement's totals; scanned PDFs and screenshots by
   AI if question 2 says so.
4. **By e-mail** (`statements-email`): the personal address, attachments,
   alert e-mails per bank with a careful fallback, the Gmail and Outlook
   guides, the confirmation code in the app.
5. **Bank notifications** (`statements-notifications`), Android: the
   native listener, per-bank-app parsing on the phone, the queue, the
   inbox. New APK.

Phases 0–2 make the import as easy as a file can be; 3–5 each add a way in
and can be taken or left on their own.

## Decided, and assumed

The owner chose 1 to 4 on 2026-10-13, each the recommended option; 5 to 7
stand as written unless they say otherwise.

1. **Decided — imports go through the bank's pipeline**: recognised lines filed,
   the rest in « À vérifier », as the bank feed does — rather than every
   row written straight into the Journal with a category picked by hand.
2. **Decided — AI for scanned PDFs and screenshots**: through an EU provider
   (Mistral), only when a file cannot be read otherwise, with the person's
   consent each time; the file is sent, read and not kept.
3. **Decided — e-mail import**: the owner signs up to an inbound-mail service (a
   click-through free tier; I propose one in Phase 4) and adds one DNS
   record at Namecheap; I guide both.
4. **Decided — bank notifications on Android**: acceptable to ask for « Accès aux
   notifications », read only the bank apps chosen, on the phone only.
5. **The old wizard goes**; column mapping survives only as the fallback
   for a CSV nobody can read alone.
6. **Undo for 30 days**, an import at a time.
7. **The order** above — files first, then the automatic ways.

## Risks

- **Bank formats change** without notice: presets fall back to reading the
  columns' contents, and a file read badly is caught by its own balances
  where it has them.
- **Overlaps and doubles** are the heart of trust here: the line ids and
  the matcher are tested on overlapping exports, identical same-day lines,
  hand-typed and template-written rows before any screen is built.
- **Alert e-mails and notifications** vary by bank and change: each bank's
  pattern is tested on real examples, and anything not understood goes to
  « À vérifier » with its raw words rather than being guessed.
- **Phones**: `expo-sharing`'s receiving is experimental; the notification
  listener is Android-only and may need justifying to a store later.
- **Memory on the build machine**: the phone's web bundle can no longer be
  checked here (about 4 GiB); phone screens are checked by tests, types and
  on the owner's phone.
