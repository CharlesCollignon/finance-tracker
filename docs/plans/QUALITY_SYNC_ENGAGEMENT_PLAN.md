# Quality, sync and engagement plan

October 2026. Written from five audits of the repository (mobile sync, web
sync, web + core quality, mobile quality, engagement inventory) and the
owner's answers to four questions. One branch per phase, one concern per
commit, every gate in `.github/workflows/ci.yml` green at each commit; the
owner merges.

## Decisions taken (2026-10-01)

- **Gamification is moments, not a score.** Real events are celebrated
  wherever they happen — a month closed, the run extended or a new record, the
  review inbox emptied, a new milestone — with motion, a haptic and, where it
  is news, a push. No XP, levels or score: the landing page's « Aucun conseil.
  Aucun score. » stays true. Changes DESIGN.md's "only the Plan celebrates"
  rule (both apps) when Phase 4 lands.
- **Weekly recap: a Monday push and a card, on by default.** Facts only, each
  notification type with its own switch, quiet hours 21:00–08:00 Paris.
  Changes the "a change, not a state" rule in `push-digest.ts` for this one
  kind, said so where the rule is written.
- **Four warnings:** overdraft risk before the next income (only when the
  balance was read — bank or close — never inferred), the reading-day close
  reminder (and a push when a bank closed the month on its own), a big upcoming
  charge (server-sent, so the web gets it, replacing the phone's
  every-charge reminders), and spending above normal (inside the recap, a
  _constat_, never its own push).

## Phase 1 — Correct and in sync (branch `phase-1/sync-and-fixes`) — done

Bugs found by the audits:

- [x] Phone: the position sheet seeds its fields once and never resyncs, so
      Save can write 0 as the amount put in (`InvestmentPositionSheet`).
- [x] Phone: five amount fields parse with `.replace(",", ".")`, which breaks
      on « 1 234,56 »; use `parseTypedAmount`.
- [x] Phone: three mutations build sentences in the default locale, so an
      English reader gets French; return a key and its params.
- [x] Phone: reminders take today from `toISOString()` (UTC).
- [x] Phone: `importFeedItem` ignores a failed feed-row update.
- [x] Phone: the month-open message arrives twice (local 09:00 + server).
- [x] Web: queries stop at 1 000 rows (`max_rows`) and the web never pages;
      the newest investment rows are the ones lost.
- [x] Web: "refresh quotes" serves the stale entry (`revalidateTag(…, "max")`
      is stale-while-revalidate); use `updateTag`.
- [x] Web: the offline outbox overwrites and double-drains across tabs.
- [x] Server: the review-inbox push is hard-coded English.

Sync, phone:

- [x] Writes announce themselves: the write layer notifies, not each caller,
      scoped by data area so a screen reloads only for what it reads.
- [x] A screen that is not in view marks itself stale and reloads when it
      comes back into view, instead of every visited tab refetching on every
      write (~130 requests a tap today).
- [x] Coming back to the app, a notification arriving or being tapped, and the
      month turning over all reload what is in view.
- [x] Stale local copies: the inbox sheet's hidden rows, the PEA date field.

Sync, web:

- [x] One revalidation for every `(app)` surface instead of hand-kept path
      lists (`revalidatePath("/(app)", "layout")`), so a new page cannot be
      forgotten.
- [x] Live refresh: a tab coming back into view, and a write in another tab
      (BroadcastChannel), refresh the page in view — which is also how the
      phone's and the bank cron's writes reach an open browser.
- [x] Stale local copies: the refresh label, the inbox's hidden rows,
      arrived charges' answered set, the month read's quota.
- [x] The app layout's six sequential reads run together.
- [x] Recurring on/off is optimistic and cannot be double-sent.

Also done on the way: the Journal loads in two stages rather than four; taking
back "record it now" says so when only half of it worked; a push with no
address opens `/bearing` rather than the retired `/dashboard`; a phone's
review link opens the review every time it is followed.

## Phase 2 — One codebase, not two (branch `phase-2/refactor`) — done, with the rest below deferred

Done:

- [x] `packages/data`: the Supabase reads and writes both apps make, each
      handed the caller's client. Recurring fill/follow/skips and templates,
      occurrences, transactions (`ledger`), categories, fulfilment reads and
      decisions, the month close and its writes, moved rows, review-inbox
      decisions and the duplicate lookup, savings accounts, wallet plans and
      targets, delete-all. Every copy that had drifted now runs the stricter
      rules: the phone's import checks category ownership, its savings writes
      read the linked bank's balance and un-archive a category, its PEA date
      no longer wipes the target, and a whole inbox group rolls back a
      transaction whose bank row could not be marked filed.
- [x] One result type (`ActionResult`/`FormState` in core), `asUser` on the
      web and its twin on the phone; database refusals and auth failures
      reach a reader as catalogue keys (`dbError`, `signInErrorKey`,
      `signUpErrorKey`), never as Postgres' or Supabase's English.
- [x] Generated database types (`pnpm gen:types`), narrowed in
      `types/database.ts`.
- [x] One web component kit, `components/ui`, linted.
- [x] gsap gone; `DarkVeil` loaded after the page.
- [x] Phone: Expo template leftovers deleted; the refresh clock and token
      refreshes no longer re-render every screen; orbs pause off screen.
- [x] `formatSigned`, `formatRate`, `isSavingsKind` in core.
- [x] `actions/finance.ts` 1 175 → ~420 lines, the phone's `mutations.ts`
      2 521 → ~500, `queries.ts` 1 592 → ~1 060.

Deferred (worth doing, none of it a bug):

- [ ] The screen loaders — the bearing month (the phone still draws the
      earlier five-card Bearing, so this waits on that screen's parity),
      the Plan's and Placements' — and the position writes, which do
      different jobs on each app.
- [ ] Splitting the big screen components: web `TransactionsView`,
      `LookThroughView`, `BankInbox`, `InvestmentsView`, `RecurringForm`,
      `BearingMonthView`, `LandingMocks` (and rendering it on the server);
      phone `transactions.tsx` + `calendar.tsx`, `MonthCards`, `import.tsx`,
      `bank.tsx`, `LookThroughView`.
- [ ] Currency in a cookie, so amounts render on the server.
- [ ] Phone: counters on the UI thread, `useEffectEvent` for the
      ref-syncing pattern, an error boundary per route group, one
      `ScreenError` with a retry.
- [ ] Batch the per-row round trips in the bank sync and reprices.
- [ ] The casts the generated types make unnecessary, as files are touched.

Working note: the machine has ~7.8 GiB; two parallel agents running
typechecks and builds crashed the terminal twice. Work sequentially.

## Phase 3 — Notifications that are worth opening (branch `phase-3/notifications`)

- [x] Per-type switches (stored per user, both apps), quiet hours 21:00–08:00
      Paris, a contextual opt-in on the web (on the recap card).
- [x] Weekly recap: Monday push + card on Le point, both apps.
- [x] Overdraft risk before the next income (a dip below zero on a day still
      ahead this month, on a bank or close balance only).
- [x] Close reminder on the reading day; push when a bank closed the month.
- [x] Big upcoming charge, server-sent; the phone's per-charge local reminders
      retire (kept only for a phone with no push token).
- [x] Milestone reached, with "seen" stored per user so every device agrees.
      Pushed since Phase 5, once the reads it needed were shared.
- [x] Spending above normal, inside the recap.

## Phase 4 — Feel (branch `phase-4/feel`)

- [x] Celebration moments: month closed (Kept counts up, run extended or
      record), inbox emptied ("l'app a appris N commerces"), new milestone
      (the Plan's, now once per account). DESIGN.md updated on both apps:
      moments, not only Plan, with the pop and the flame shared in
      `components/motion/moments.module.css`.
- [x] Feedback on every committed action: haptics on edit/delete (warning on
      delete), Undo on phone toasts and web deletes (migration 036's soft
      delete, finally wired, with a nightly sweep), optimistic rows on the
      web's Journal and calendar.
- [x] Copy pass, plain French: one name for the run (« série »), the jargon
      list from the audit, "Ledger" and "migration 0xx" removed from screens,
      a next step in the empty states the audit named, « Comment c'est
      calculé ? » under Le point's balance.

## Phase 5 — Robustness and one codebase, continued (branch `phase-5/robustness`)

Taken from Phase 2's deferred list and what Phases 3–4 left open.

- [x] Phone: one `ScreenError` with a retry on the eight screens that printed
      a failed load as red text, and a screen error boundary in the root
      layout that every screen inherits, so the tab bar stays up.
- [x] Phone: its own reminders (for a phone the server cannot reach) follow
      the notification switches.
- [x] Bank sync: feed rows, automatic transactions and their links in a few
      batched writes instead of two or three round trips per row, with a
      row-at-a-time retry when a batch is refused. Reprices ten at a time.
- [x] One codebase: the Journal's filters, totals and days (`ledger-view` in
      core); the review inbox reads, the investment and savings history, the
      month's rows and summary, category seeding, positions and wallet plans,
      instrument readings (`@finance/data`); quote fetching and four small
      helpers (core).
- [x] The milestone push, with its switch back in Profile: the daily run
      works out the Plan's own figure at today's prices
      (`@finance/data/plan-wealth`) for someone who wants it and has had a
      milestone celebrated, and announces a new one without marking it
      seen, so the Plan still celebrates it.
- [x] Bugs found on the way, all on the phone: its merchant suggestions and
      recurring detection only saw the latest 1 000 transactions, its
      investment and savings history stopped at 1 000 rows, it valued a
      pinned position at its quote, a taken category name failed sign-in
      seeding, and a review read error reached a toast in Supabase's English.
- [x] Also: the Journal's CSV export defuses formulas a bank note could
      carry and writes French readers the shape French Excel opens; a bank
      balance is dated on the Paris calendar, not UTC's; the web's
      allowance field reads « 1 200 », as the phone's already did; four
      double casts and one hand-synced ref (`useEffectEvent`) are gone.
- Not done: the display currency in a cookie — EUR is what the server
  already renders, so only a USD reader would gain, and the product is
  French first.
- Still deferred: splitting the big screen components beyond the logic
  moved out of them; the Plan's and Placements' loaders.
