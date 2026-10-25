# Plan : se projeter, avec l'histoire pour témoin

October 2026. The owner finds the Plan page too complicated and not relevant
enough. What they want: keep the playful side, calm the motion a little, add
real financial value that rests on what markets have actually done, and let
someone look ahead from the dashboard they have already built — Le point,
the Journal, Récurrents, Placements, Immobilier — without typing anything
new.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges.

## What Plan is today

Ten blocks, about 5 300 lines on the web (`components/finance/plan/`) and
5 200 on the phone (`components/plan/`, `app/(tabs)/planning.tsx`):

1. **Dans un an** (`YearAheadCard`): horizon 6 m / 1 / 2 / 5 years, a gold
   total line in a P10–P90 range, one row per account, « Pourquoi » and
   « Et si… » behind one switch, events (raise, bonus, big expense) as
   draggable markers, « En euros d'aujourd'hui », after-tax line.
2. **Vos paliers** (`MilestonesCard`).
3. **Votre matelas de sécurité** (`CushionCard`).
4. **Patrimoine net**, with a property (`NetWorthCard`).
5. **Votre patrimoine dans N ans** (`LongViewCard`): 1–40 years, stacked
   chart, an editable row per account (today, monthly, return, fees, tax),
   inflation and withdrawal-rate fields.
6. **Immobilier dans N ans** (`PropertyLongViewCard`).
7. **Votre série** (`RunCard`) — and the month close itself
   (`MonthCloseSheet`) is opened from here.
8. **Vos mois** (`MonthsCard`).
9. The close's settings, folded (`CloseDetails`).
10. The bank invitation.

Two numbers carry the page, and neither comes from history. Returns are
presets the user may type over (`ENVELOPE_PRESETS`: 7 % for PEA, CTO and
PER, 4 % for AV, 5 % for crypto), and the range is 400 seeded Gaussian paths
on a fixed volatility (`ACCOUNT_VOLATILITY`: 15 % for shares, 6 % for AV,
65 % for crypto). The income figure uses a fixed 4 % withdrawal rate. So the
page says « 8 chances sur 10 » about a bell curve nobody has seen, and it
says nothing about what a real crash would do to the reader's own money.

Meanwhile the app already knows what that would take: which index each fund
follows (`etf-shortlist.ts`, `look-through.ts`), what goes in every month
(recurring templates, the DCAs), the savings accounts and their kinds, the
current account walked forward by the ledger (`year-ahead.ts`), and the run
of closes.

## Decisions taken (2026-10-25)

The owner chose 1 to 6, taking the recommended option wherever one was
offered; for 3 they kept the editable table.

1. **Three blocks**: « Votre trajectoire », « Face à l'histoire »,
   « Progression ». « Hypothèses » sits folded under them.
2. **History brings four things**, all of them:
   - **Fourchette réelle.** The reader's plan is replayed from every
     starting month since 1970 on real returns, in today's euros. The
     Gaussian range goes.
   - **Crash tests.** 2000, 2008, 2020 and 2022 are replayed on today's
     accounts, with the monthly payments carrying on.
   - **Durée et perte.** For each account, at the chosen horizon: how often
     it has ended below where it started.
   - **Revenu durable.** The withdrawal rate that has held in history, in
     place of the fixed 4 %.
3. **Leaving Plan:**
   - **The events** (raise, bonus, big expense) and their markers.
   - **The month close, « Vos mois » and the close's settings**, which go to
     Le point. Plan keeps the run, inside « Progression ».
   - **The two property cards**, which become a « Avec vos biens » switch on
     the trajectory.
   - **The editable table stays**, folded in « Hypothèses ».
4. **Play is « Progression »**: one card holding the milestones, the
   cushion and the run. The next milestone has a date, and « Et si… » moves
   that date. A new milestone is still celebrated as a moment. No score, no
   goals, no badges: the October retention decisions stand.
5. **Data: monthly series since 1970, kept in git**, as `etf-shortlist.ts`
   is: reviewed in a diff, nothing to poison, nothing fetched at runtime.
   A script refreshes them once a year. The licence of each source is
   settled in Phase 0, before anything ships.
6. **An edited return shifts history; it does not replace it.** The return
   field starts at the account's historical median (« 1970–2025 : 6,8 % »).
   Typing 5 % moves that account's whole history down by the difference.
   The line and the range move together, and the crashes keep their shape.
   The milestones never read edits, as today.

## Assumed (stands unless the owner says otherwise)

7. **Horizons 1 · 5 · 10 · 20 · 30 years, 10 by default.** Thirty is the
   ceiling: with data from 1970, a 30-year window has about 300 starting
   months, and they overlap heavily. Forty would be fiction dressed as
   history.
8. **Today's euros only.** The headline is deflated by French inflation
   (INSEE), because a figure for 2045 in 2045 euros means nothing, and
   because comparing a 1975 start with a 2005 start needs it. The « En
   euros d'aujourd'hui » switch goes. The after-tax line stays under the
   headline (« soit X après impôts si vous vendiez tout »), on 2026 law
   (`FRENCH_TAX_2026`). Past tax rules are not replayed.
9. **The current account** is walked forward by the ledger, as the year
   ahead does now. What the months leave on it stays as cash at 0 %, so in
   today's euros it shrinks with inflation. It is shown as its own row,
   because « l'argent qui dort » is itself one of history's lessons.
10. **Crypto has too little history for a range.** Bitcoin's series starts
    around 2013. A crypto account is replayed only where its data exists:
    in the 2020 and 2022 crash tests, and in the range only for horizons
    its history covers. Beyond that it follows its central path, with no
    range, and one line says why. It never gets a stand-in index.
11. **Each account maps to a series**:
    - funds through `etf-shortlist` (index family → series), weighted by
      position value;
    - a fund the shortlist does not know, by its asset class;
    - anything else in PEA, CTO or PER as world equities, said once in
      « Hypothèses » (« suivi comme les actions mondiales »);
    - AV as the fonds euros series, unless its funds are known;
    - each livret as its own regulated-rate history;
    - a PEL at its contract rate, as today.
    A series that starts after 1970 (emerging, Europe, Nasdaq) uses its
    parent family before its first month (`INDEX_FAMILY_CONTAINS`), and the
    replay records that it did.
12. **The milestones' dates come from the median replay** on the reader's
    real figures, so « Progression » and the trajectory agree. A reached
    milestone is still today's measured wealth, so the milestone push and
    `milestone_seen` do not change.
13. **Motion, calmer** (on top of the fades of 2026-10-25):
    - no scroll reveal (the page is short now and draws at once);
    - a horizon change crossfades the line and the range rather than
      morphing them;
    - one count-up, on the headline;
    - kept: the slider, the scrub, press feedback, haptics on the phone,
      and the milestone moment;
    - removed: the glow's breath on the phone's Plan;
    - the flame moves to Le point with the run's close.
14. **Web first, phone second.** The phone is built once the owner has seen
    the web on a Vercel preview, as with the year ahead. Every calculation
    lives in `@finance/core`.

## The model (`packages/core/src/history/`)

### Series

Monthly, January 1970 to the last full year, as total returns in euros
(dividends reinvested; dollar series converted at the month's rate, francs
and marks before 1999). Stored compactly: basis points in a string per
series, about 660 values each. The phone carries core as source, so size
matters; twelve series stay well under 100 kB.

| Series | Covers | Starts |
| --- | --- | --- |
| `world` | world equities (MSCI World, FTSE All-World, the default) | 1970 |
| `us` | S&P 500 | 1970 |
| `nasdaq` | Nasdaq-100 | 1985 |
| `europe` | STOXX Europe 600 | 1987 |
| `emerging` | emerging markets | 1988 |
| `small-us` | Russell 2000 | 1979 |
| `euro-bonds` | euro government bonds, for bond and mixed funds | 1970 |
| `fonds-euros` | AV fonds euros, a yearly rate applied monthly | 1970 |
| `livret-a`, `ldds`, `lep` | regulated rates (LDDS from Codevi) | 1970 / 1983 / 1982 |
| `cpi-fr` | French consumer prices | 1970 |
| `bitcoin` | BTC in euros | ~2013 |

### Functions

- **`replayPlan(input)`.** Takes the accounts (value today, monthly payment
  indexed to inflation, fees, a series mix, a shift), the horizon, and
  « Et si… » with its target.
  - It runs the plan from every starting month that fits, month by month,
    in real terms.
  - It returns the median path, the P10–P90 band month by month, each
    start's end value, the worst and best start (month and amount), and
    which starts used a stand-in.
  - Cost: about 660 starts × 360 months × a few accounts, a few
    milliseconds. It runs in a `useMemo` on both apps.
- **`crashTest(input, episode)`.**
  - Episodes are fixed in git: 2000 (bulle internet), 2008 (crise
    financière), 2020 (Covid), 2022 (inflation et taux), each with a peak
    and a trough month.
  - It replays today's accounts from the peak, with the monthly payments
    carrying on.
  - It returns the path, the low (euros, percent, month), the months until
    the money is worth what was put in, and the same without the payments.
    That last figure is the DCA lesson, stated as a fact.
- **`lossOdds(series, years)`.** The share of windows of that length, since
  the series began, that ended below the start in today's euros. It reads
  for a livret too: « le Livret A a fait moins que l'inflation X années sur
  Y ».
- **`sustainableWithdrawal(mix)`.** For every 30-year window, the highest
  constant real withdrawal that never emptied the portfolio. It returns the
  lowest of them (« a toujours tenu ») and the median.
- **`historicalReturn(series)`.** The median annualised real return over
  the windows: what « Hypothèses » pre-fills, and the base that an edit's
  shift is measured from.
- **What goes:**
  - from `year-ahead.ts`: `ACCOUNT_VOLATILITY`, the seeded Gaussian range
    and the events;
  - from `future-plan.ts`: `ENVELOPE_PRESETS`' returns, which are replaced
    by the series;
  - knip says what else falls with them.

## The page, block by block

### 1 · Votre trajectoire

- Horizon pills, then the headline: « Dans 10 ans · ≈ 148 000 € », in
  today's euros, counting up on change.
- Under it, two lines:
  - « 8 départs sur 10 depuis 1970 : entre X et Y »;
  - « Pire départ : janvier 2000, Z ».
  The page says *départs*, never *chances*: 300 overlapping windows are not
  300 futures.
- The chart:
  - one gold line (the median) inside a washed band (P10–P90);
  - two to four round amounts as gridlines;
  - a scrub that reads a month (the date, the median, the band).
  No row per account in the chart.
- « Avec vos biens », shown only to someone with a property. It adds the
  homes' net value from `property-future.ts`, which keeps its own model.
- « Et si… »: the slider and where the extra goes. The result reads « +19 400 €
  d'ici 2035 », and the milestone it brings forward appears in
  « Progression ».
- A fold, « D'où vient ce chiffre ». This is where the dashboard shows:
  - each month, on X of income (from Récurrents and the closes);
  - one row per account: today → then, the series it follows, and its
    « Durée et perte » line;
  - the sustainable income: « de quoi retirer environ X €/mois, un rythme
    qui a tenu 30 ans à chaque départ depuis 1970 »;
  - the current account's row, inflation included.

### 2 · Face à l'histoire

- Chips: 2000 · 2008 · 2020 · 2022.
- One sentence of fact per episode (what happened, from when to when).
- A small chart of the episode replayed on today's accounts, which can be
  scrubbed.
- « Au pire −9 800 € (−38 %), en mars 2009 », then « Votre mise retrouvée
  en 22 mois en continuant vos versements (41 sans) ».
- With no investments, the card shows what 2022's inflation did to the
  savings accounts in today's euros. With nothing saved at all, it says
  what one would learn here and links to Placements.

### 3 · Progression

- The next milestone: a progress bar, its date (median), and the month
  « Et si… » brings it to. Milestones already reached sit in a gold row.
  « Nouveau palier ! » keeps its moment.
- The cushion: months covered, rungs at 1, 3 and 6.
- The run: the count and the record, and « Faire le bilan » → Le point.

### Folded: Hypothèses

- The editable table: today, monthly, return (pre-filled from history; an
  edit shifts it), fees, tax; « Revenir à mes chiffres ».
- The inflation and withdrawal-rate fields go, because history supplies
  both.
- The sources, each with its licence's attribution, and the line « Le passé
  ne dit pas l'avenir : ce sont les marchés tels qu'ils ont été, pas une
  promesse. »

The bank invitation stays at the foot of the page.

### Le point takes the close

- `MomentumCard` already shows the run. It gains « Faire le bilan de
  {mois} », which opens `MonthCloseSheet`.
- It also gains « Vos mois », the history with the reading day and the
  allowance (today's `MonthCloseHistory`), in a sheet.
- The flame and the close's moment go with it.
- Every push and link that sent the close to `/plan` is moved (check
  `push-messages.ts`, `push-routes.ts` and `MomentumCard`'s `href`). The
  milestone push still opens `/plan`.

### Saved settings

- `pluclair.plan.year-ahead:v1` (horizon, target, hidden accounts, events)
  becomes `:v2` (horizon, target, with property). Events are dropped,
  hidden accounts too.
- `pluclair.plan.long-view:v2` becomes `:v3`. The envelopes are kept, and
  a typed return becomes a shift from the historical median. `years`,
  `inflation` and `withdrawalRate` are dropped.
- The phone's AsyncStorage keys follow the same path.

## Phases

0. **The data** (`plan-history-data`).
   - Settle the sources with the owner (below), one licence at a time.
   - Write the series into `packages/core/src/history/series/` with
     `scripts/history-refresh.mjs`.
   - Check every series against figures each provider publishes on its own
     site: yearly returns from factsheets, INSEE's annual inflation, the
     Livret A rates in force.
   - No screen changes; `Changelog: none`.
1. **The engine** (`plan-history-core`).
   - `replayPlan`, `crashTest`, `lossOdds`, `sustainableWithdrawal` and
     `historicalReturn`.
   - Accounts mapped to series; the shift; milestones from the median
     replay.
   - Vitest throughout, with fixtures of hand-checkable series.
   - Nothing wired to a screen yet; `Changelog: none`.
2. **The close moves to Le point** (`plan-close-to-bearing`), web and phone
   together, because it is a move, not a design. Plan still shows the old
   page without the close. A « Nouveautés » entry.
3. **The new page, web** (`plan-redesign-web`).
   - The three blocks and « Hypothèses ».
   - The removals, the storage migration and the calmer motion.
   - DESIGN.md « Plan », PRODUCT.md principle 1 (« returns are the user's
     assumption » becomes « history's, which the user can shift »), and
     CONTEXT.md: Long view, What if, Milestone, Track; new terms for the
     replay, the crash test and the sustainable withdrawal.
   - Checked on a Vercel preview with real figures. A « Nouveautés » entry.
4. **The new page, phone** (`plan-redesign-phone`), after the owner has seen
   the web. Its « Nouveautés » entry waits for the APK, as the design pass's
   does.
5. **The site** (`plan-redesign-site`). The landing mock
   (`mocks/planning.tsx`), the feature page's demo (`PlanDemo.tsx`) and
   `year-ahead-sample.ts` are redrawn from the new engine on the sample.
   The copy no longer promises the long view's 40 years.

Phases 0 and 1 hold everything else up; 2 can be taken at any time.

## Sources (Phase 0, the owner's call)

| Series | Candidate | Licence | Standing |
| --- | --- | --- | --- |
| French inflation | INSEE, consumer prices, all households, chained | Licence Ouverte 2.0 | usable, with attribution |
| Livret A, LEP, Codevi/LDDS | Banque de France (Webstat), rates set by arrêté | public | usable |
| Fonds euros | France Assureurs / ACPR yearly averages | published facts; terms to read | to check |
| Dollar, mark, franc rates | Federal Reserve H.10 (via FRED) | US public domain | usable |
| US equities | Robert Shiller's monthly data (price, dividends, CPI since 1871) | no stated licence; widely mirrored, DataHub assumes public domain | the owner decides |
| World equities | MSCI World Net Return | redistributing index values usually needs a paid MSCI licence | probably blocked |
| Europe, emerging, Nasdaq, Russell | their index providers | the same as MSCI | probably blocked |
| Bitcoin | the closes the app already fetches (`market/yahoo.ts`), or Coin Metrics' community data (CC BY-NC) | to check | to check |

If MSCI cannot be licensed, the fallback is a developed-markets series
stitched from free academic data: Shiller's US series before 1990 and
Kenneth French's developed-markets returns after. It is labelled « actions
des pays développés », not « MSCI World », and its terms still have to be
read. Settling this table is the first job of Phase 0. If the world series
has no clean source, the plan changes before any code is written.

## Risks

- **Licences.** The world series is the blocker; see above.
- **Reading history as a promise.** Every figure says « depuis 1970 » or
  « si l'histoire se répétait », and the page names no product, fund or
  provider (advice tiers 0–3, `PLUCLAIR_UPGRADE_PLAN.md` D1). The « Aucun conseil »
  line on the landing stays true.
- **Overlapping windows.** The sample is smaller than it looks, so the
  copy says *départs*, and 30 years is the ceiling.
- **One country's inflation across all assets.** Euro returns deflated by
  French prices are right for a French saver, and this is the stated
  method.
- **Milestone dates move** on the day Phase 3 ships, because they come from
  the median replay, not a 7 % line. Say so in « Nouveautés ».
- **The machine** (about 7.8 GiB under WSL): test the replay
  with vitest, and look at the page on a Vercel preview, not under a local
  `next dev`.
