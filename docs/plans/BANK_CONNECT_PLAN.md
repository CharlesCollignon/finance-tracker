# Bank sync for every user — plan

> Refines **Phase 1** (and the "Bring your money in" step of **Phase 2**) of
> [`PLUCLAIR_UPGRADE_PLAN.md`](./PLUCLAIR_UPGRADE_PLAN.md), and answers its
> **H2** (aggregator choice): open-banking.io, through its Partner Connect
> OAuth flow, paid by each user directly. Sections 1 to 3 of the master plan
> (rules, stop-and-ask, locked decisions) still apply to every task here.
>
> Start a session with: _"Read `docs/plans/BANK_CONNECT_PLAN.md` in full. We
> are on step Pn. Produce the phase plan and wait for my go."_

---

## 0. Status (1 October 2026)

**The connect step changed: each user uploads their own credentials file.**
open-banking.io closed its partner programme on 30 September 2026 ("cancelled
all partner access until further notice", on its dashboard's Partner page), so
the Partner Connect flow this plan describes cannot happen. The other
providers were compared in [`BANK_PROVIDERS.md`](./BANK_PROVIDERS.md) and not
pursued. Instead each user does what the owner did: signs up at open-banking.io,
pays it, connects their bank there, downloads `credentials.json` from the
Developers page, and drops it on `/bank` (or picks it on the phone). Sections
3.2–3.4 and 5.4 below describe the abandoned OAuth flow; everything after the
connect step — first import, grouped inbox, health, renewal, invitations,
disconnect — is as described.

What that changed in the code:

- `lib/bank/credentials.ts` parses the file strictly (16 KB at most, both keys
  present, the API address pinned to `https://open-banking.io` so a file can
  never send the key elsewhere), tries it by listing the accounts, and keeps
  only the two keys, sealed, in `bank_connection_secrets`.
- `lib/bank/connect.ts`, `lib/bank/partner.ts` and the `connect` and
  `callback` routes are gone; migration 042 drops `bank_connect_flows`.
- Renewing a consent and topping up a wallet link to the user's own
  open-banking.io account. "Upload a new file" replaces a file whose API key
  stopped working. Disconnecting deletes the file and tells the user to delete
  the API key at open-banking.io, since Pluclair cannot revoke it.
- Setup is offered only where `BANK_SECRETS_KEY` is set **and** the
  `bank.connect` flag is on for the account (migration 042, off by default).

**Legal footing (1 October 2026).** Researched for French law: the model is
grey rather than clearly illegal — reading data the user exported is the
defensible part, and the ACPR's own fintech page names budgeting apps reading
accounts through an API as needing a status. Done in response: Pluclair no
longer refreshes from the bank on a schedule (only when the user presses
Refresh); a dated, versioned consent is required before a file is accepted
(migration 044); server functions run in Paris; a legal notice
(`/mentions-legales`) joins the privacy policy and terms; and French drafts of
the AIPD and the record of processing are in `docs/legal/`. Still the owner's:
ask the ACPR (`fintech-innovation@acpr.banque-france.fr`), get open-banking.io's
written agreement (ideally a read-only key), and a French fintech lawyer's
review — before opening `bank.connect` to everyone.

What only you can do, in order:

1. **Apply `042_bank_credentials_file.sql`.**
2. **Set `BANK_SECRETS_KEY`** in Vercel (production and preview): 32 random
   bytes, `openssl rand -base64 32`. Keep a copy with your other secrets —
   losing it means every user uploads their file again.
3. **Turn `bank.connect` on for your own account** (the SQL is in the
   migration's header), open `/bank`, and drop your `credentials.json` — the
   same file as `OPEN_BANKING_CREDENTIALS`. Your stored connection then wins
   over the environment, and the two environment variables can go.
4. **Open it to a few people** the same way, one account at a time.
5. **Before opening it to everyone**: fill and check the legal drafts (every
   `[[…]]` in `apps/web/components/marketing/legal-copy.ts` and `.fr.ts`, then
   `LEGAL_DRAFT = false`); ask open-banking.io whether they are fine with users
   giving Pluclair their credentials file (their terms forbid only reselling
   and white-labelling, but their integrations keep the file on the user's
   machine); and get a lawyer's view on the setup's legal footing. Then
   `update feature_flags set enabled_by_default = true where key = 'bank.connect';`
6. **Sign off the public promises** (D6): the landing page's privacy points and
   footer still say nothing is read from a bank, which is true of a visitor
   until the flag is on for everyone.

Known gaps, deliberately left:

- Deleted entries are never erased: `sweep_deleted` exists and nothing calls
  it. The privacy policy's retention line is a blank until it is scheduled
  (the retention window is the open decision in the soft-delete design).
- The sync budget (40 s of the refresh cron's 60) has not been measured with
  more than one connected user.

---

## 1. Decisions (30 September 2026)

| Topic                       | Decision                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How a user links their bank | **Partner Connect** (OAuth 2.0 + PKCE, `form_post`). One button, a consent page on open-banking.io, back in Pluclair connected. No credentials file.                                                                                                               |
| Partner status              | **Not applied yet.** Everything is built so that only the client ID and secret are missing (step P0).                                                                                                                                                              |
| Who can connect             | **Everyone who signs up**, from launch. A feature flag (`bank.connect`) stays as a kill switch, not as a gate.                                                                                                                                                     |
| What Pluclair charges       | **Nothing.** The user pays open-banking.io directly: €3/month for the first bank account, €1/month for each additional one, VAT included, from a prepaid wallet. Pluclair never collects or resells it (their terms forbid reselling without a written agreement). |
| The owner's env-var feed    | **Retired.** The owner reconnects once through the new flow; `OPEN_BANKING_CREDENTIALS` stays for local development only.                                                                                                                                          |
| History on connecting       | **Everything the bank gives**, backfilled into the ledger, with a **reworked review inbox** so a big first import is quick to clear.                                                                                                                               |
| Mobile                      | **Web and phone in v1**: same button, in-app browser, deep link back.                                                                                                                                                                                              |
| Invitations to connect      | **Bearing balance card, `/welcome`, Ledger, Plan / month close.**                                                                                                                                                                                                  |
| Consent renewal reminders   | **Push + in-app banner**, using the web and Expo push the app already has. No email in v1.                                                                                                                                                                         |
| Legal                       | **Drafted by Claude** (privacy policy + terms, EN and FR, from what the app actually does); the owner fills in the legal identity and has them checked before launch.                                                                                              |
| Disconnect                  | **Ask, keep by default**: stop syncing and delete the stored key; offer to also delete the imported transactions.                                                                                                                                                  |
| Review inbox style          | **Grouped by shop**: one decision files a whole merchant.                                                                                                                                                                                                          |

---

## 2. Is it possible? What we know, and what to confirm

**Yes.** What is established:

- **The consumer plan is self-serve and user-paid**: €3/month first account, €1/month each extra, VAT included, prepaid wallet topped up by €10 or €20, a 7-day grace period after which syncing is suspended. Read-only (AIS), PSD2-regulated, with Enable Banking as the licensed AISP underneath. ([open-banking.io](https://open-banking.io/en), [terms](https://open-banking.io/en/terms))
- **Partner Connect exists and the SDK already implements it**: `buildAuthorizeUrl`, `createPkce`, `createState`, `discover`, `parseRelay`, `exchangeCode`, `revokeToken`, `userinfo`, and `OpenBankingClient.fromTokenResponse(token, privateKey)`. The consent page form-posts a code plus the user's private key; the code is exchanged server to server for a delegated key. (`node_modules/@open-banking-io/client/README.md`)
- **Data stays zero-knowledge**: open-banking.io stores ciphertext; decryption needs the user's private key, which Partner Connect relays to us. So **we store a key that decrypts someone's bank history** — the single most sensitive thing this app will ever hold (see 5.3).
- **Two expiries, both visible**: the delegated key has an `expiresIn` (no refresh token — renewing means running the flow again), and each bank connection has a `validUntil` (PSD2 consent, typically 180 days), readable through `getConnections()`.
- **The pipeline after the connection mostly exists**: `bank_feed_items`, `bank_accounts` (with `counts_as_cash`), balances, pulls (the four unattended reads a day), the merchant matcher, duplicate matching against typed rows (`lib/bank/duplicates.ts`), swallowed-row recovery, fulfilment, auto-close and recurring detection. It is all keyed by `user_id` already; what is single-user is **where the credentials come from** (`lib/bank/client.ts`) and **who the cron syncs** (`bankFeedOwnerId()`).

**To confirm with open-banking.io before P2** (the partner docs page renders client-side and could not be read here):

1. How to apply, what they review, how long it takes, and whether partners pay anything.
2. Whether a user can **sign up, top up and connect a bank inside the consent flow**, or must already have an account.
3. The delegated key's real lifetime (`expiresIn`) and whether it survives a bank-consent renewal.
4. Whether bank-consent **renewal** can be started from a partner, or only in open-banking.io's app (decides what our "Renew" button opens).
5. Allowed **redirect URIs** (https only? several?) — decides how the phone gets back.
6. A **test environment** or sandbox bank, and rate limits per partner.
7. French coverage (banks, neobanks, deferred-debit cards), since D4 is France-first.

---

## 3. The journey

### 3.1 Invitations (CTAs)

One component, `ConnectBankInvite`, in two sizes (card and line), shown only to users with no connection, each dismissible per surface (remembered per user, not per device). Copy says the mechanism and the price; never "free".

| Surface              | Size                                                      | Promise (EN intent)                                                                     |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Bearing balance card | card, inside the hero where "Enter your balance" is today | "See your real balance, read from your bank four times a day."                          |
| `/welcome`           | full step after charges, skippable                        | "Let your bank fill this in." Cost stated: "about €3 a month, paid to open-banking.io". |
| Ledger               | quiet line above the list                                 | "Stop typing: connect your bank and entries arrive on their own."                       |
| Plan / month close   | line beside the close                                     | "Your balance gets read for you, and months close themselves."                          |

Rules: never on a surface the user dismissed; never more than one invitation per screen; gone the moment a connection exists; a user with an **expired** connection sees "Reconnect" instead (3.5).

### 3.2 Before leaving: the explainer sheet

Opened by every invitation. One screen, three numbered steps and the facts that decide trust:

1. **You'll open open-banking.io**, create an account (or sign in) and top up its wallet. About **€3/month** for one bank account, €1 for each extra, paid to them, not us.
2. **You connect your bank there**, through your bank's own login. Pluclair never sees your bank password.
3. **You come back here**, and your history comes in.

Beneath: _read-only_ (nothing can move money), _what we store_ (an encrypted key that lets us read your accounts, deletable any time), _consent lasts about 180 days and we remind you before it ends_, _past months will be filled in from your bank, so their totals may change_. Button: **Continue to open-banking.io**. Links: privacy policy, how it works.

### 3.3 On open-banking.io (not ours)

Sign-up or sign-in, wallet top-up, bank selection and bank authentication, then Pluclair's consent screen. Desktop: popup (`challenge: "pin_code"`); phone and narrow screens: full redirect / in-app browser.

### 3.4 Coming back

1. **Connected** — a short success state with the bank's name.
2. **Which accounts are your spending money?** Every account listed; current accounts on, savings off by default (sets `counts_as_cash`). One tap to continue.
3. **Bringing in your history** — progress by account ("Boursorama · 1,240 of ~2,000 entries"), resumable if the tab closes; figures fill in as it goes.
4. **Review** — straight into the grouped inbox (section 4), with a headline like "Most of this filed itself. 12 groups need you."
5. **Bearing** — with the real balance and the curve anchored to the bank.

From this point the account is **bank-fed**: charges stop writing rows (the bank is the record; they forecast), fulfilment and auto-close take over.

### 3.5 Living with it

- **Syncing**: four unattended reads a day, plus the refresh button (attended). Push when new entries need a category (exists today, owner-only).
- **Health** in **Profile → Bank**: each bank and account, last sync, consent valid until, key status, and actions (Renew, Reconnect, Disconnect).
- **Renewal**: push seven days before the earliest `validUntil`, and a Bearing banner from then until renewed. The banner turns into "Your bank stopped sharing — renew" after expiry.
- **Failures, told plainly**: open-banking.io wallet empty (their grace period passed) → "Syncing is paused by open-banking.io until its wallet is topped up", with a link; key expired or revoked → "Reconnect"; bank error → retry later, say so once.

### 3.6 Disconnect

From Profile → Bank: confirmation sheet → revoke the key (`revokeToken`), delete the stored secrets, mark the connection revoked → a choice: **keep the imported transactions** (default) or **delete them too**. The account stops being bank-fed only once no feed rows remain, so keeping them keeps the bank-fed behaviour for past months; the plan for charges writing again after a disconnect is a P1 design point (7.1).

### 3.7 What connecting unlocks — the honest list

Only things that already exist for bank-fed accounts: the real balance and a curve anchored to it; entries arriving on their own, filed by the user's own history; "Did these arrive?" confirmations; recurring charges noticed from the statement; months that close themselves on the reading day; a push when something needs a category. Nothing on this list may be promised before it ships.

---

## 4. The review inbox, reworked (grouped by shop)

**Why:** a full-history import can bring hundreds of unfiled rows. Row-by-row review does not scale; the matcher already knows that a shop is the unit of habit.

**Core (`packages/core`, pure, tested):** `groupPendingFeed(items, merchantIndex, categories)` → groups keyed by `bankMerchantKey`, each with: display name, count, total, date span, a suggested category (merchant memory first, then MCC), and a `mixed` flag when the user's own history files that merchant in more than one category (Amazon). Sorted by count × amount, so the first few groups clear most of the pile.

**UI (web sheet and phone sheet):**

- Header: "12 groups · 214 entries", with the count animating down as groups are filed, and a done state.
- A group row: name, count, total, the suggested category in a picker, **File all**, and **Leave out all**. Expanding shows its rows; a `mixed` group opens expanded, with a category per row.
- Filing a group writes every row, teaches the matcher once, and slides the group away; **Undo** in the toast (web) or the recently-decided list (both).
- Keyboard on web: arrows move between groups, Enter files, L leaves out. Swipe on the phone.

**Server:** batch versions of the existing actions (`importFeedItems(ids, categoryId)`, `ignoreFeedItems(ids)`) so a group is one request and one revalidation.

---

## 5. Architecture

### 5.1 Configuration

`OPEN_BANKING_ISSUER` (default `https://open-banking.io`), `OPEN_BANKING_CLIENT_ID`, `OPEN_BANKING_CLIENT_SECRET`, `BANK_SECRETS_KEY` (32 random bytes, base64), `BANK_SECRETS_KEY_PREVIOUS` (rotation). Server-only; never `NEXT_PUBLIC_`. `bankFeedConfigured()` becomes "the partner credentials are set".

### 5.2 Data model (migration `041_bank_connections.sql`, additive)

- **`bank_connections`** — one row per user: `status` (`active` · `expired` · `revoked` · `error` · `paused`), `connected_at`, `key_expires_at`, `consent_valid_until`, `last_synced_at`, `last_error`, `backfill_cursor` (jsonb, for the resumable first import). RLS: the user may **select** their own row (for status screens); no client writes.
- **`bank_connection_secrets`** — `user_id`, `ciphertext`, `key_version`, `created_at`. RLS **enabled with no policies**: readable and writable only by the service role, so neither app's Supabase client can ever select it.
- **`bank_connect_flows`** — `state` (PK), `user_id`, `verifier_ciphertext`, `mode` (`popup` · `redirect` · `app`), `expires_at` (10 minutes). Service role only. Needed because the phone's in-app browser shares no cookies with the app.
- Reused unchanged: `bank_accounts`, `bank_feed_items`, `bank_balances`, `bank_pulls`, fulfilments, proposals, dismissals.

### 5.3 Secrets

AES-256-GCM, a fresh nonce per write, `key_version` for rotation; the plaintext bundle (`{ token, privateKey }`) exists only in memory inside a server request or the cron. Never logged, never returned from an action, never in an error message; Sentry/console scrubbing for `privateKey`, `accessToken`, `apiKey`. Account deletion and disconnect both revoke the key and delete the row. A test asserts no route or action serialises a secret.

### 5.4 The connect flow

- `POST /api/bank/connect` — authenticated by the web session or, from the phone, a Supabase bearer token. Creates PKCE + state, stores the flow, returns the authorize URL.
- `POST /api/bank/callback` — the consent page's `form_post`. Takes the flow by state first (so a cancel consumes it), `parseRelay` (constant-time state and issuer checks), `exchangeCode`, encrypts and stores `{ token, privateKey }`, upserts `bank_connections`, starts the backfill, then finishes by mode: redirect to `/welcome/bank?connect=connected`, a popup page that posts to a `BroadcastChannel` and closes, or a deep link `pluclair://bank?outcome=connected` for the phone.
- `access_denied` is an ordinary outcome ("Cancelled — nothing was connected").

### 5.5 Per-user client

`getBankConnection(userId)` becomes async: read and decrypt the secrets with the admin client, `OpenBankingClient.fromTokenResponse(...)`. `bankFeedStatus` gains `expired`, `revoked`, `paused`. The env-var bundle answers only when `NODE_ENV !== "production"` and `OPEN_BANKING_DEV_OWNER` is set.

### 5.6 Syncing at scale

- The refresh cron walks **every active connection**, stalest first, within the function's time budget (60 s on Vercel Hobby), carrying the rest to the next run; the per-user pull allowance (four unattended reads a day) already exists in `bank_pulls`.
- The **first import** is chunked: one account page per step, cursor in `backfill_cursor`, continued by the cron and by the client while the progress screen is open. It must never need one long request.
- Scale note: past a few hundred active users, Hobby's 60 s × 4 runs will not reach everyone; the fix is Vercel Pro (longer functions, more crons) or a Supabase queue. Measure in P1, decide before launch.

### 5.7 Health

After every sync: `getConnections()` → the earliest `validUntil` into `consent_valid_until`; a 401 from `userinfo` or any read → `expired`; a suspended wallet → `paused`. The daily notify cron sends the renewal push (dedupe key `bank-consent:<yyyy-mm-dd>` in `notification_log`); the Bearing reads the status for its banner.

### 5.8 Switching a manual user to bank-fed

- The backfill runs the existing matcher against what is already in the ledger — typed rows, CSV imports and rows charges wrote — inside `MATCH_WINDOW_DAYS`, linking instead of duplicating. **Add fixture tests** for a month with auto-filled charges plus the same movements from the bank.
- From the first feed row, `hasBankFeed` is true: charges stop writing and forecast only; planned rows stay drawn as they are today.
- Past closes are replayed against the new rows and become accurate: unrecorded spending for those months falls toward zero. Said up front in the explainer (3.2); the close history shows it plainly rather than silently.

### 5.9 Mobile

Same button and explainer; `WebBrowser.openAuthSessionAsync(authorizeUrl, "pluclair://bank")`, with the start call made from the app using its session token. Profile → Bank screen, renewal banner, grouped inbox. All bank calls stay on the web server; the phone never holds a secret.

### 5.10 Security and privacy checklist

Secrets table unreadable by clients (a test with the anon and user clients); encryption at rest; no secrets in logs or errors; revoke on disconnect and on account deletion; the flow bound to the session that started it; CSRF safe (`form_post` + state); rate limit on `/api/bank/connect`; the explainer and privacy policy state what is stored and for how long.

---

## 6. Steps

Each step is shippable behind `bank.connect` and ends with a checkpoint.

**P0 — You: apply for Partner Connect.** Send open-banking.io: app name (Pluclair), website, one-paragraph description (read-only personal finance, the user pays you directly, zero-knowledge key stored encrypted server-side), redirect URIs (`https://<domain>/api/bank/callback`, plus a staging one), logo, privacy policy URL (from P6 — a draft is fine for the application), support contact. Ask the seven questions in section 2.

**P1 — Foundations (no UI).** Migration 041; secrets module with rotation; a `BankConnect` interface over the SDK with a fake implementation for tests; async per-user `getBankConnection`; the cron walking all connections with the time budget; resumable backfill; health updates; the owner's connection migrated by reconnecting (data untouched: feed rows are already keyed by user). Acceptance: fake-provider end-to-end tests; the owner's past closes unchanged.

**P2 — Connect on the web.** Explainer sheet, connect and callback routes, popup and redirect modes, account selection, import progress, Profile → Bank, disconnect with keep/delete. Acceptance: a real connection end to end once P0 lands (fake provider before).

**P3 — Review inbox, grouped.** Core grouping with tests, batch actions, the new web sheet, keyboard support. Acceptance: a 200-row fixture cleared in under a minute.

**P4 — Phone.** In-app browser connect and deep-link return, Profile → Bank, renewal banner, the grouped inbox with swipe.

**P5 — Invitations and renewal.** `ConnectBankInvite` on the four surfaces with per-surface dismissal, the `/welcome` step, the renewal push and banner, the "Reconnect" states.

**P6 — Launch.** Privacy policy and terms pages (EN/FR, drafted by Claude, completed and checked by you), footer and signup links; update `PRODUCT.md` (both apps), `CONTEXT.md`, the marketing copy (which today says no one can connect a bank), and the brand promises (D6, needs your sign-off); then turn the flag on.

---

## 7. Open points (defaults proposed)

1. **Charges after a disconnect.** Default: while imported rows remain, the account stays bank-fed (charges forecast); if the user deletes them, charges write again from the next day.
2. **Several banks.** Default: yes — open-banking.io connects several; Pluclair shows them together, and the explainer's cost line counts accounts.
3. **Deferred-debit cards and transfers between the user's own accounts** (master plan Phase 1, tasks 4–5). Default: after launch, because the owner's feed works without them today; the first user report of a double-counted card settles it.
4. **Where the backfill starts when the bank gives years.** Default: everything given, capped at 24 months to bound the first review.

---

## 8. Launch checklist

- [ ] Partner Connect approved; production client ID and secret set.
- [ ] `BANK_SECRETS_KEY` generated and stored; rotation tested.
- [ ] Secrets unreadable from both apps' clients (test).
- [ ] Privacy policy and terms checked, blanks filled, `LEGAL_DRAFT` off; linked from signup, the explainer and the footer.
- [ ] Renewal push and banner verified with a consent near expiry.
- [ ] Owner reconnected through the flow; env-var mode off in production.
- [ ] Sync budget measured with realistic user counts; hosting plan decided.
- [ ] Marketing copy, `PRODUCT.md` and D6 promises updated and signed off.
