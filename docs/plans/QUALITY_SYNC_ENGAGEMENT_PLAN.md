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

## Phase 1 — Correct and in sync (branch `phase-1/sync-and-fixes`)

Bugs found by the audits:

- [ ] Phone: the position sheet seeds its fields once and never resyncs, so
      Save can write 0 as the amount put in (`InvestmentPositionSheet`).
- [ ] Phone: five amount fields parse with `.replace(",", ".")`, which breaks
      on « 1 234,56 »; use `parseTypedAmount`.
- [ ] Phone: three mutations build sentences in the default locale, so an
      English reader gets French; return a key and its params.
- [ ] Phone: reminders take today from `toISOString()` (UTC).
- [ ] Phone: `importFeedItem` ignores a failed feed-row update.
- [ ] Phone: the month-open message arrives twice (local 09:00 + server).
- [ ] Web: queries stop at 1 000 rows (`max_rows`) and the web never pages;
      the newest investment rows are the ones lost.
- [ ] Web: "refresh quotes" serves the stale entry (`revalidateTag(…, "max")`
      is stale-while-revalidate); use `updateTag`.
- [ ] Web: the offline outbox overwrites and double-drains across tabs.
- [ ] Server: the review-inbox push is hard-coded English.

Sync, phone:

- [ ] Writes announce themselves: the write layer notifies, not each caller,
      scoped by data area so a screen reloads only for what it reads.
- [ ] A screen that is not in view marks itself stale and reloads when it
      comes back into view, instead of every visited tab refetching on every
      write (~130 requests a tap today).
- [ ] Coming back to the app, a notification arriving or being tapped, and the
      month turning over all reload what is in view.
- [ ] Stale local copies: the inbox sheet's hidden rows, the PEA date field.

Sync, web:

- [ ] One revalidation for every `(app)` surface instead of hand-kept path
      lists (`revalidatePath("/(app)", "layout")`), so a new page cannot be
      forgotten.
- [ ] Live refresh: a tab coming back into view, and a write in another tab
      (BroadcastChannel), refresh the page in view — which is also how the
      phone's and the bank cron's writes reach an open browser.
- [ ] Stale local copies: the refresh label, the inbox's hidden rows,
      arrived charges' answered set, the month read's quota.
- [ ] The app layout's six sequential reads run together.
- [ ] Recurring on/off is optimistic and cannot be double-sent.

## Phase 2 — One codebase, not two (branch `phase-2/refactor`)

- [ ] `packages/data`: Supabase reads and writes taking the client as a
      parameter, shared by both apps. First what has already drifted:
      recurring apply/fill/follow/skip, the template save (the phone's copy
      erases share pricing), fulfilment, the bearing month, savings accounts,
      `importTransactions` (the phone's copy skips the category ownership
      check), `hasBankFeed` ×3, `isMissingSchema` ×20.
- [ ] Pure helpers to core: ledger totals and filters, signed formatting,
      rate formatting, `monthKeyOf`, `shiftDays`, the count-up easing.
- [ ] Split the big files: web `actions/finance.ts`, `TransactionsView`,
      `LookThroughView` (both apps), `BankInbox`, `InvestmentsView`,
      `RecurringForm`, `BearingMonthView`, `LandingMocks`; phone
      `mutations.ts`, `queries.ts`, `transactions.tsx` + `calendar.tsx`
      (shared ledger hooks), `MonthCards`, `import.tsx`, `bank.tsx`,
      `notifications.ts`.
- [ ] One `Result<T>` and one `authedAction(schema, fn)`; zod on every action
      input; no swallowed errors; no raw Postgres text in a toast.
- [ ] Generated database types, which removes ~100 casts.
- [ ] One web component kit (`retroui` + `ui` + layout primitives → `ui`),
      lint re-enabled on it.
- [ ] Bundle: `LandingMocks` as a server component, gsap replaced by motion,
      `DarkVeil` loaded lazily, currency in a cookie so amounts render on the
      server.
- [ ] Phone: stable provider values (refresh, auth), orbs paused off screen,
      counters on the UI thread, `useEffectEvent` for the ref-syncing
      pattern, an error boundary per route group, Expo template leftovers
      deleted.
- [ ] Batch the per-row round trips in bank sync, feed decisions and
      reprices.

## Phase 3 — Notifications that are worth opening (branch `phase-3/notifications`)

- [ ] Per-type switches (stored per user, both apps), quiet hours 21:00–08:00
      Paris, a contextual opt-in on the web.
- [ ] Weekly recap: Monday push + card on Le point, both apps.
- [ ] Overdraft risk before the next income.
- [ ] Close reminder on the reading day; push when a bank closed the month.
- [ ] Big upcoming charge, server-sent; the phone's per-charge local reminders
      retire.
- [ ] Milestone reached, with "seen" stored per user so every device agrees.
- [ ] Spending above normal, inside the recap.

## Phase 4 — Feel (branch `phase-4/feel`)

- [ ] Celebration moments: month closed (Kept counts up, run extended or
      record), inbox emptied ("l'app a appris N commerces"), new milestone.
      DESIGN.md updated on both apps.
- [ ] Feedback on every committed action: haptics on edit/delete (warning on
      delete), Undo on phone toasts and web deletes, optimistic rows on the
      web.
- [ ] Copy pass, plain French: one name for the run, the jargon list from the
      audit, "Ledger" and "migration 0xx" removed from screens, a next step in
      every empty state, « Comment c'est calculé ? » where a figure needs it.
