# Immobilier: progress you can see, and pages that stay in step

The Immobilier tab works (docs/plans/REAL_ESTATE_PLAN.md, Phases 0–7). This
plan makes it feel alive without making it louder: progress the owner can
watch grow, interactions that answer, and every page that shows a property
agreeing with the others the moment something changes.

## Decisions (owner, 2026-10-03)

- **Four kinds of progress, all facts, never a score:**
  - « À vous / à la banque »: on each property, the user's part of its value
    that is theirs (value less what is owed) against the bank's;
  - the loan's track: principal repaid, with marks at 25, 50 and 75 % that
    turn gold once passed, and what is left (« 112 échéances, fin en mars
    2048 »);
  - « Ce mois-ci »: this month's payment as one bar, the principal in gold
    (« 735 € de plus sont à vous »), then interest and insurance;
  - a new moment, « La moitié du bien est à vous », pill and push.
- **After adding a property, its page opens**, so the owner sees the
  estimate arrive from the sales around it.

## Constraints kept

- **Moments, not a score** (`engagement-decisions`, DESIGN.md « Moments »):
  no points, levels or badges; gold on the news only; a moment comes once,
  arrives, then rests; reduced motion lands on the final state.
- **The new moment is something the user did.** « La moitié du bien est à
  vous » is crossed by the payments: the day what is owed falls to half the
  user's part of the value, at today's estimate. A new market reading that
  moves the value is not celebrated — the market is not the user's doing —
  and, like every moment, it counts for a month after the day.
- **Minimal.** One bar per idea, no new screen, no confetti; the figures
  already on the page are the ones that move.

## Phase 1 — Links and refreshes (branch `property-polish-1/links`)

- [x] Web: a market reading the 8-second wait gave up on finishes after the
      response (`after()`), and the page says « Lecture des ventes
      alentour… » and refreshes itself until it lands (a minute at most),
      the estimate then counting to its value.
- [x] Phone: the same « lecture en cours » while `requestMarketReading`
      runs, from a small store the property screen listens to.
- [x] After adding a property, its page opens, on both apps.
- [x] Links: the Plan's net worth card opens Immobilier; a « Bien » chip in
      Récurrents opens its property; an entry on a property's page, and a
      loan's payment, open that entry in Récurrents (`?edit=`).
- [x] Phone: the property screens also read `categories`, so a renamed
      category shows on them at once.

Checked against the local stack, with the wait cut to 300 ms for the test:
saving a Lyon 3e apartment showed « Lecture des ventes alentour… » within a
second, the reading finished after the response, and the page picked it up
at 4.7 s, the estimate counting from 215 000 € to 238 000 €. An attached
entry opens it in Récurrents (`/recurring?edit=`); adding a property opens
its page.

## Phase 2 — Progress you can see (branch `property-polish-2/progress`)

- [ ] `core`: the user's part that is theirs, a loan's progress and what is
      left, this month's payment split, and the day half the home became
      the user's (`property-progress.ts`, tested).
- [ ] « À vous / à la banque » on each card of the list and on the
      property's page; the loan's track on each loan; « Ce mois-ci » on each
      running loan. Each bar fills from nothing on arrival.
- [ ] The new moment: pill on the property's page, push under the
      `property` switch (`property:equity-half:<property>`).

## Phase 3 — Interactions and motion (branch `property-polish-3/motion`)

- [ ] The list and a property's sections arrive staggered; cards answer a
      press; saves answer with a haptic on the phone.
- [ ] The add sheet shows where it is (1 · 2 · 3) and moves between steps
      with a short cross-fade.
- [ ] The estimate's arrival: a quiet shimmer while reading, then the figure
      counts and its source fades in.
- [ ] An empty Immobilier tab says in three lines what it will show.
- [ ] Both DESIGN.md files, the guide.
