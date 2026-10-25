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
   settled in Phase 0, before anything ships. Settled the same day, with
   the owner (see « Sources »):
   - shares are rebuilt rather than licensed from MSCI;
   - each country's market comes from Global Factor Data (CC BY-NC 4.0),
     because Pluclair stays free. It replaced Fama and French, which
     states no licence, the same day;
   - the rebuild is weighted by market size, not GDP, after measuring both;
   - the dividends missing from the OECD's prices are matched to the
     countries' own figures, not to an MSCI factsheet.
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
    Index families with no series of their own follow a broader one:
    Nasdaq-100 and Russell 2000 follow the whole US market, and emerging
    markets follow developed ones, since no open source rebuilds them
    faithfully (see « Sources »). The replay records each stand-in it used.
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
at 6,55957 before 1999). Stored as integers in hundred-thousandths, one row
per calendar year, in `data.generated.ts` (30 kB for six series; the phone
carries core as source, so size matters).

| Series | Covers | Starts | Status |
| --- | --- | --- | --- |
| `world` | developed shares: MSCI World and FTSE All-World funds, the default | 1970 | built |
| `us` | US shares, the whole market: S&P 500, and Nasdaq-100 and Russell 2000 as stand-ins | 1970 | built |
| `europe` | European shares (STOXX Europe 600 funds) | 1970 | built |
| `bonds-fr` | French 10-year government bonds, for bond and mixed funds | 1970 | built |
| `cpi-fr` | French consumer prices | 1970 | built |
| `livret-a` | the Livret A's rate, by quinzaine | 1970 | built |
| `lep` | the LEP's rate, by quinzaine; the LDDS reads `livret-a` | 1982-06 | built |
| `fonds-euros` | AV fonds euros, a yearly average applied monthly, net of management fees | 1970 | built |
| `bitcoin` | BTC in euros | 2014-11 | built |

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

0. **The data** (`plan-history-data`). Shares, bonds, prices and the
   Livret A were built on 2026-10-25 (2ccd0f8), and the shares moved to
   Global Factor Data the same evening:
   - `packages/core/src/history/` holds the series, the sources and tests:
     INSEE's yearly inflation, the Livret A's rates, the rebuild's dates;
   - `scripts/history-refresh.mjs` rebuilds them;
   - no screen changes; `Changelog: none`.
   The LEP, the fonds euros and bitcoin followed the same evening, which
   closes the phase.
1. **The engine** (`plan-history-core`). Built 2026-10-25 (59ca7d0,
   4f091a7):
   - `packages/core/src/history/replay.ts` holds `replayPlan`,
     `crashTest`, `lossOdds`, `sustainableWithdrawal` and
     `historicalReturn`;
   - `mix.ts` holds `walletMixes` and `replayAccount` (accounts to series,
     the shift, AV fees off the units only);
   - vitest on hand-checkable series, plus guards on the real history.
   Nothing is wired to a screen yet; `Changelog: none`.

   **What the engine says**, on a PEA of 20 000 € plus 400 €/month and a
   Livret A of 10 000 € plus 100 €/month:
   - ten years: a median of 132 800 € in today's euros; 8 starts in 10
     between 90 300 € and 180 500 €; the worst start March 1999
     (66 800 €).
   - speed: 553 starts in about 40 ms; thirty years of six accounts in
     about 90 ms.

   **For Phase 3:**
   - `PlanWealth` must carry the positions (wallet, value, ISIN, symbol)
     for `walletMixes`.
   - Milestones read `nominalMedian`.
   - The current account is an account with an empty mix (cash), its
     first year from the year ahead's walk as `schedule`.
   - Crypto's `historicalReturn` is 65 %/yr since 2014: never pre-fill
     « Hypothèses » with it. Crypto holds still in today's euros, as the
     replay does.
   - From its 2000 peak, the PEA's worst month is February 2009, because
     the two falls chain, so the copy says « jusqu'en 2009 ».
   - World shares ended below prices over 1 year in 31 % of starts, over
     10 years in 14 %, over 15 years never. Over thirty years, 3.99 % a
     year has always lasted.
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

## Sources (settled with the owner, 2026-10-25)

`packages/core/src/history/sources.ts` holds the same list for the page.

| Series | Source | Terms |
| --- | --- | --- |
| `cpi-fr` | INSEE: 000008964 (base 1980) to January 1990, then 001759970 (base 2015), chained by monthly change | Licence Ouverte 2.0 |
| `us` | Global Factor Data: the US market, value-weighted, over the Treasury bill, from 1970; the bill added back | CC BY-NC 4.0; Fed H.15 public domain |
| `world` | Global Factor Data's developed countries from 1986, weighted by size (below); rebuilt before | the same, plus OECD and World Bank (CC BY 4.0) |
| `europe` | the same with Europe's countries | the same |
| `bonds-fr` | OECD, France's long-term rate (IRLT), as a 10-year bond at constant maturity | OECD terms: reuse with the source named |
| dollar rates | Federal Reserve H.10 via FRED; in 1970, the OECD's rates and the Bretton Woods parities | US public domain |
| `livret-a` | the arrêtés, as Banque de France's MIR1 series gives them, checked against a second compilation | public decisions |
| `lep` | the same, two compilations of MIR1, recent rates checked against the Banque de France's 2026 annex | public decisions |
| `fonds-euros` | the ACPR's yearly average (individual contracts) from 2009; France Assureurs' for 2000–2008; before 2000, the year's average French 10-year yield, flagged | published figures, cited |
| `bitcoin` | Yahoo's BTC-EUR month-end closes, the quotes the app already shows | Yahoo's terms, as for quotes |

**The LDDS** has no series: its rate has been the Livret A's since 2003
(Banque de France), and the Codevi's, before, was the Livret A's at every
date found (7,5 % at its opening in October 1983, 4,5 % from 1986 to 1996).

**The fonds euros' figure is net of management fees.** Phase 1 must not
take the AV's fees off its fonds euros part a second time.

**Non-commercial.** Global Factor Data is CC BY-NC 4.0, and the owner
confirmed on 2026-10-25 that Pluclair stays free. If Pluclair ever earns
money, the US and the regions need another source: Fama and French with
their written permission (the draft e-mail is in this file's history,
f75e118), or a paid licence.

**From 1986: the countries' own figures, weighted by size.**
- Each developed country's market, dividends in, over the US Treasury
  bill; the three-month bill (H.15) is added back.
- Weighted by its stock market's size at the previous year-end (World Bank),
  carried through the year by its returns. A year the World Bank lacks
  (Euronext's members since about 2015) is the last known size carried by
  the market.
- Hong Kong and Singapore are left out. The World Bank counts every
  company listed there in full, mainland Chinese ones included (Hong Kong
  as large as Japan), where a developed-market fund holds a sliver of
  either.
- Global Factor Data's own regions are not used: they do not weigh
  countries by size, and return 3.2 %/yr over the bill for developed
  markets over 1990–2025, where the United States alone return 7.9 %.

**Before 1986: the rebuild.**
- Each developed country's OECD share price index, in dollars.
- Weighted by its market's size at the end of 1985 (World Bank), carried
  back month by month with its prices. The United States are 63 % of the
  mix in 1970, and Japan passes them in 1989.
- The United States' own return in it is Global Factor Data's.
- Every other country gets the yearly dividend yield that brings the OECD's
  prices level with the countries' own figures over 1986–2025: 2.6 %
  outside the United States, 3.0 % for Europe.

**Checked once against MSCI World's published yearly returns** (kept in a
scratch file, never stored):
- 1970–1989: 13.37 %/yr in dollars, against 13.42 %;
- 1990–2025: 8.16 %/yr, against 8.28 %;
- 1970–2025: 10.00 %/yr, against 10.09 %;
- 2008: −36.0 % in euros.
Weights by full market size, not float, put the United States near 60 %
where a fund today holds about 72 %. In years when US shares lead, the
series lags by a few points (2024: +15.3 % against +19.2 % in dollars).

**Set aside, and why:**
- **Fama and French.** Very close in quality (8.38 %/yr for developed
  markets over 1990–2025), but no licence is stated, so it would have
  needed permission.
- **Emerging markets.** Weighted by the World Bank's figures, China counts
  all its domestic A-shares, which a fund mostly does not hold, and Taiwan
  is missing. The rebuild strays far from any fund (2007: +72 % against
  +40 %; 2015: +4 % against −11 %), so emerging funds follow developed
  ones.
- **The IMF.** It has the S&P 500 monthly since 1970, but only as prices,
  and commercial reuse of its data needs permission.
- **Free market-data APIs** (Yahoo, Stooq, Alpha Vantage, Twelve Data,
  Tiingo). Their free terms cover personal use only, and keeping their
  figures in the app is redistributing them.
- **MSCI.** Its index data and its factsheets « may not be used for
  commercial purposes without prior written permission ».
- **The OECD's US index.** It behaves like the NYSE Composite, without
  the Nasdaq's companies: 7.2 %/yr over 2010–2025, against 14.1 % for the
  whole US market with dividends.
- **Shiller's S&P 500.** It states no licence either, and its monthly
  averages soften the troughs.
- **GDP weights** (the owner's first choice). After measuring, they gave
  8.6 %/yr over 2010–2025, against 9.6 % for market size and 11.3 % for
  the index; the owner switched.

**Each January**, `node scripts/history-refresh.mjs` takes the series to
the last full year. Before it runs:
- add the year's fonds euros figure to `FONDS_EUROS`: France Assureurs'
  estimate in January, replaced by the ACPR's figure when it comes out in
  June;
- add any regulated-rate change to `regulated-rates.ts`;
- from January 2027, add INSEE's base-2025 series to `CPI_SEGMENTS`.

## Risks

- **The shares' licence is non-commercial.** The day Pluclair charges for
  anything, Global Factor Data has to be replaced first; see « Sources ».
- **Emerging funds follow developed ones**, which understates how far they
  have fallen (2008, and Asia in 1997–98). « Hypothèses » says so for any
  account that holds them.
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
