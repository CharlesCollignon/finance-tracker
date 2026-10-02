# Real estate plan

October 2026. A property the user owns — what it cost, the loans that paid
for it, the charges it brings, and what it is worth today by its location —
on both apps. Written from a read of the repository and the owner's answers
to four questions. One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges.

## Decisions taken (2026-10-02)

- **Its own tab, « Immobilier ».** Not a third group inside Placements. The
  web nav (`APP_NAV_ITEMS`) and the phone's bar each gain a sixth entry. The
  phone's bar was deliberately held at five (the comment over `TABS` in
  `(tabs)/_layout.tsx`); six has to be checked at 360 pt wide, with the
  comment and both `DESIGN.md` files updated in the same change.
- **Net worth stands apart; milestones do not move.** A milestone stays
  savings and investments together, judged on real figures as today. A new
  « Patrimoine net » card on the Plan adds the property's net value and takes
  away what is still owed. A purchase or a new market reading can therefore
  never pass a milestone at once.
- **A precise address.** Typed with autocompletion, geocoded, and used to
  price against the sales nearby when there are enough of them. The commune
  and the coordinates are kept; the address label is optional.
- **Renting comes later (Phase 6).** The first version is the property, its
  loans, its charges and its value. The schema carries the usage from the
  start, so a rental needs no migration of its own.

- **Principal repaid is not Kept.** Kept is measured from the account's
  balance, and adding a computed figure to it would break that. Principal
  repaid is shown on the property and inside net worth instead.
- **Six tabs, with labels that shrink rather than truncate** (Phase 0's
  measurements). On the phone, each label shrinks on one line down to about
  85 %. On the web at phone width, the account menu moves to the header, as
  on the phone, so the bar stays at six targets.

## Constraints this plan keeps

- **No market value in the forward projection** (`CONTEXT.md`, _Forward
  projection_). A property's value appears in net worth and the long view,
  never in the month-to-month curve. The loan's monthly payment is already
  in the projection because it is a charge.
- **No advice, no score.** Yield, outstanding principal, an estimated value
  with its source: facts. Never « vous devriez renégocier » or « vendez ».
- **Never guessed.** A market reading is dated, sourced and counted (how many
  sales); a commune without enough sales has no reading, which is not the
  same as a reading of zero. The user's own estimate wins over the app's.
- **One person's money.** A property bought by two is held at a share, and a
  joint loan is owed at a share; every figure is the user's part.
- **France only.** DVF, the INSEE–Notaires index, IGN geocoding, the ANIL
  rent map, French tax on property gains.

## Vocabulary (to add to `CONTEXT.md` in Phase 0)

**Property** — _En français_ : bien. One apartment, house or other premises,
with a usage (résidence principale, secondaire, locatif nu, locatif meublé),
a living area, a location and the share the user holds. _Avoid_: asset, real
estate investment, home.

**Loan** — _En français_ : prêt. Money borrowed against a property, with its
own amortisation schedule; a property has none, one or several (main loan,
PTZ, Action Logement). _Avoid_: mortgage, credit line, debt.

**Outstanding principal** — _En français_ : capital restant dû. What is still
owed on a loan on a date. Computed from the schedule, never stored — except
one anchor the user gives from their bank after an early repayment or a
renegotiation, from which the schedule is worked forward again (the savings
accounts' balance-on-a-day pattern). _Avoid_: balance, remaining debt.

**Market reading** — _En français_ : relevé du marché. The median price per
square metre of one kind of home in one commune (or around one point) over a
dated period, with its spread and the number of sales behind it. Shared by
every user, like an instrument reading. _Avoid_: valuation, estimate, price.

**Estimated value** — _En français_ : valeur estimée. The user's own figure
when they gave one (dated); else the market reading × the living area,
carried to today by the index; else the purchase price carried by the index;
else the purchase price. Always shown with which of these it is.

**Net value** — _En français_ : valeur nette. The estimated value × the share
held, less each loan's outstanding principal × the share owed.

**Net worth** — _En français_ : patrimoine net. Savings, investments and
property net values together. Distinct from what milestones count.

## What already exists to build on

- `savings_accounts` (migration 046): a declared thing with a balance on a
  day. A loan's outstanding anchor follows the same shape.
- `investment_positions.value_pinned` (migration 034): the user's own value
  over the app's. A property's own estimate follows it.
- Default categories « Remboursement de prêt », « Taxe foncière » and
  « Charges de copropriété » are already seeded: a property's charges are
  ordinary recurring templates, attached to it.
- `transactions.recurring_template_id`: what was actually paid for a
  property is found through its charges, and through fulfilments when a bank
  feeds the ledger.
- Feature flags (migration 039): the work ships behind one.

## Schema (migrations 049 and 050)

```
properties
  id, user_id, name, kind ('apartment' | 'house' | 'other'),
  usage ('main_home' | 'second_home' | 'rental_bare' | 'rental_furnished'),
  citycode, postcode, latitude, longitude, address_label (null),
  living_area, rooms (null), ownership_share (1 = all of it),
  purchased_on, purchase_price, notary_fees, agency_fees, works,
  value_pinned (null), value_pinned_on (null),
  yearly_growth (null: the long view's default)

property_loans
  id, user_id, property_id → properties (cascade), label,
  kind ('amortising' | 'in_fine'),
  principal, annual_rate, months, first_payment_on,
  insurance_monthly, insurance_rate (null; not both),
  deferral_months, deferral_kind ('none' | 'partial' | 'total'),
  fees, borrower_share,
  known_outstanding (null), known_outstanding_on (null),
  known_keeps ('payment' | 'term', null),
  recurring_template_id → recurring_templates (set null)

recurring_templates
  + property_id → properties (set null)

-- 050, with Phase 4:
property_market_readings        -- shared, written by the server only
  citycode, kind, scope ('commune' | 'radius'), center (null),
  period_from, period_to, median_m2, q1_m2, q3_m2, sales, read_at

housing_price_index             -- shared, written by the server only
  quarter, zone ('idf' | 'province'), kind, value
```

RLS on the user tables as `savings_accounts` does, with every reference
checked against the caller's own rows; the shared tables are readable by
any signed-in user and writable by the service role alone. « Supprimer
toutes mes données » takes the two user tables; deleting the account needs
nothing, since both cascade from `auth.users`.

## Linking a loan to a charge

The French screens never say « charge » for a recurring template: it is an
« opération récurrente », on the « Récurrents » tab (`CONTEXT.md`). The copy
below follows that; "Charges" in this plan is the section's English name.

1. Saving a loan computes its monthly payment and offers « Ajouter la
   mensualité aux opérations récurrentes », **checked by default**. It
   writes a monthly template: category « Remboursement de prêt », amount
   what leaves the user's account (their share of payment + insurance by
   default, editable — see the edge cases), day of the first payment,
   `starts_on` the first payment and `ends_on` the last. Linked by
   `recurring_template_id`.
2. If a template in that category already has a close amount, the sheet
   offers it first (« C'est celle-ci ? Prêt — 1 050 € le 5 »). Proposed,
   never linked without the user's yes — the lesson of _Fulfil_.
3. `ends_on` is the last payment, so the charge stops by itself and the
   projection shows the loan ending with no new mechanism.
4. When charge and schedule disagree (insurance changed, early repayment),
   the property says so — « L'opération récurrente dit 1 050 €, le tableau
   1 042 € » — with « La mettre à jour ».
5. Any template can be attached to a property: a « Bien » field in the
   recurring form, shown only to someone with a property. Taxe foncière
   (yearly), copropriété, PNO or home insurance, and later rent received
   (income). Attached templates carry a chip on « Récurrents ».
6. Each month's payment is split on the property: « 1 050 € = 612 € de
   capital · 378 € d'intérêts · 60 € d'assurance ».

With a bank connected nothing changes: the template forecasts, the bank's
row is confirmed against it.

## Market value by location

Sources, all free and keyless, checked 2026-10-02:

- **DVF** (Etalab, `files.data.gouv.fr/geo-dvf/latest/csv/{year}/communes/{dep}/{citycode}.csv`):
  every sale of the last five years per commune — price, area, kind,
  coordinates. Lyon 3e is about 4,600 rows for 2025. Published twice a year,
  about six months behind.
- **IGN geocoder** (`data.geopf.fr/geocodage/search`): autocompletion,
  INSEE code (arrondissement included) and coordinates.
- **INSEE–Notaires index of existing-home prices**: quarterly, apartments and
  houses, Île-de-France and province. Carries a DVF reading to today, and a
  purchase price from its quarter to today.
- **ANIL rent map** (« Carte des loyers », 2025 edition, data.gouv.fr): asking
  rent per m² by commune. Phase 6.

Method, on the web server, no model involved:

1. The address is geocoded to a commune and a point.
2. Three years of DVF for the commune are read. Kept: sales (« Vente ») of a
   single apartment or house per mutation, with or without dependencies,
   one disposition, 9 m² or more (the Phase 0 findings say why).
3. Each sale is carried to the latest quarter by the most local index, then
   trimmed to a third to three times the median. Median €/m² and Q1–Q3.
4. With at least 30 such sales within 500 m, those; else the commune with
   at least 20; else five years of the commune; else no reading.
5. Shown as « ≈ 312 000 € (285 000 – 340 000 €) — d'après 214 ventes
   d'appartements à Lyon 3e, 2023–2025 (DVF), ramenées au T2 2026 ». A press
   opens « Votre estimation », which then wins and stays dated.
6. Readings are cached per commune and kind (and per point for radius ones,
   rounded); the nightly cron refreshes those older than the latest DVF
   release. The phone reads the cache and asks the web for a new reading on
   save (bearer token, as for the month read).

## Where it shows

| Surface                                        | Change                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav (web `/property`, phone `(tabs)/property`) | Sixth entry « Immobilier ». The list: one card per property — estimated value, outstanding principal, net value — and « Ajouter un bien ». Empty, it explains in one line and offers the add.                                                                                     |
| Property (web `/property/[id]`, phone stacked) | Value and unrealised gain · Loans: outstanding, next payment split, end date, total cost, schedule (folded), « Mettre à jour le capital restant dû » · Attached templates, « Ajouter une opération récurrente au bien » · Market: reading, spread, sales nearby · Yield (Phase 6) |
| Charges                                        | « Bien » field, chip on attached templates, the payment template written by the loan                                                                                                                                                                                              |
| Plan — projection                              | Mechanics unchanged. A loan ending is a dated ingredient: « fin du prêt en mars 2041 : +1 050 €/mois »                                                                                                                                                                            |
| Plan — long view                               | A property row: value × chosen yearly growth, less year N's outstanding principal, after the tax on the gain (main home exempt; otherwise 19 % plus social contributions, allowances by years held — rates checked when coded, beside `FRENCH_TAX_2026`)                          |
| Plan — new card                                | « Patrimoine net »: savings + investments + property − loans, today                                                                                                                                                                                                               |
| Plan — milestones, cushion                     | Unchanged                                                                                                                                                                                                                                                                         |
| Placements — Analyse                           | Unchanged: the split and the contribution suggestions stay the liquid accounts'                                                                                                                                                                                                   |
| Le point                                       | A tile « valeur nette du bien », leading to the property                                                                                                                                                                                                                          |
| Notifications                                  | Moments (Phase 7): half the loan repaid, the last payment this month, a new DVF estimate (twice a year), under a new switch in Profile                                                                                                                                            |

## Phase 0 — Framing (branch `property-0/framing`)

Nothing user-facing.

- [x] Spike the DVF reader on three places: a Paris arrondissement, Lyon 3e,
      a village with few sales. Check multi-lot mutations, dependencies,
      outliers, and how many radius readings reach 20 sales.
- [x] Find the INSEE BDM series for the index and how to read them without a
      key; decide cron-fed table versus a constant revisited each quarter.
- [x] Vocabulary above into `CONTEXT.md`.
- [x] Six tabs on the phone: measure the bar at 360 pt with « Immobilier »
      and propose label and icon. Confirmed by the owner.

### Findings (2026-10-02)

**DVF.** Paris 11e (75111), Lyon 3e (69383) and Gordes (84050), 2023–2025,
read from the Etalab per-commune files. The files ran to 31 December 2025:
the April release, three to nine months behind.

- Within a mutation the price is the same on every row (no exception in
  ~15,000 mutations), and a mutation with more than one disposition is rare
  (22 in Paris 11e, 2 in Lyon 3e); those are left out.
- A home repeats once per parcel it sits on (388 mutations in Paris 11e, 634
  in Lyon 3e, 96 in Gordes): deduplicate by kind, area, rooms and lot.
- Most homes sell with a cellar or a parking space (Lyon 3e: 3,853 sales
  with or without, 603 without), and keeping them moves the median by 2 % at
  most (Paris 10,000 against 9,815 €/m²; Lyon 4,615 against 4,700). Kept.
- New builds (VEFA), exchanges, auctions and building land are left out.
- About 2 % of Paris sales fall outside 1,000–30,000 €/m² (family sales,
  life annuities): trimmed at a third and three times the median.
- Carrying each sale to today **before** taking the median lines the years
  up: Paris 9,735 / 9,856 / 9,901 €/m² carried, against 10,231 / 9,750 /
  9,896 raw. The most local series fits best: Lyon 3e carried by the Lyon
  agglomeration's series gives 4,322 / 4,369 / 4,386, by the region's 4,650
  / 4,500 / 4,455.
- Readings at 2026-Q2: Paris 11e apartments ≈ 9,890 €/m² (8,740–11,010,
  6,614 sales); Lyon 3e apartments ≈ 4,370 (3,770–4,970, 3,807); Gordes
  houses ≈ 6,730 (4,840–8,160, 110). Gordes apartments (5 sales over three
  years, 1,770 to 6,680 €/m²) get no reading.
- Within 500 m: 996 apartment sales in Paris 11e, 404 in Lyon 3e, but a
  single house in Lyon 3e and none in Gordes. Hence 30 within 500 m, else
  20 in the commune, else five years, else nothing. The 300 m circle is
  already noisy (Lyon 3e: 5,394 against 4,733 at 500 m).
- The circle only sees the commune's own file, so a point near an
  arrondissement boundary sees one side. Accepted for now: the Paris 11e
  point, a few hundred metres from the 3e, still had 996 sales.
- Size: about 1 MB a year for Paris 11e, so 3.5 MB for a reading. Fine for a
  server function with a cache in front of it.

**Index.** `bdm.insee.fr/series/sdmx` answers without a key: dataflow
`IPLA-IPLNA-2015`, or series by idbank
(`/data/SERIES_BDM/010567013+010567063?startPeriod=2023-Q1`). Latest point
2026-Q2, updated 2026-09-08. Use the seasonally adjusted (CVS) series; the
most specific available wins:

1. The agglomeration's, for its central city: Lyon apartments `010567011`,
   Marseille apartments `010567007`, Lille houses `010567009`.
2. Île-de-France by département: Paris apartments `010567013` (no Paris
   house series: use Île-de-France houses `010567091`), and apartments,
   houses or all homes for each of 77, 78, 91, 92, 93, 94, 95.
3. Region: Île-de-France, Hauts-de-France, Auvergne-Rhône-Alpes, Provence-
   Alpes-Côte d'Azur (by kind).
4. Province apartments `010567063`, Province houses `010567075`.
5. France métropolitaine.

This needs a département → region map in core. **Decided: a table fed by
the cron** (one request for every series, weekly), not a constant — 69
series, a release date that moves, and nobody remembering each quarter.

**Six tabs.** Measured with Instrument Sans Medium at 10 pt: at six, a label
gets 50.7 pt on a 360 pt screen, 53.2 at 375 and 55.7 at 390. « Immobilier »
(50.2) fits; « Placements » (55.5) and « Récurrents » (51.8) do not at 360,
and « Placements » not at 375 either. English is worse: « Investments »
(58.1) already overflows at 320 with five. The web's phone-width bar
already has six targets (five surfaces and the account menu), about 47 px a
label at 360, so « Placements » is already truncated there today; a seventh
would leave 39 px.

Proposed, and confirmed by the owner:

- Phone: six tabs; labels shrink to fit on one line (down to ~85 %) rather
  than truncate. Icon `home` / `home-outline`.
- Web at phone width: the account menu moves to the header, as on the phone,
  so the bar stays at six targets; same shrink-to-fit labels. Icon Phosphor
  `House`.

**Edge cases Phase 1 must cover.**

- What leaves the account is not always the share owed: a couple owning
  half each, where the user pays the whole payment. The template's amount is
  what leaves the user's account (their share by default, editable); net
  value uses the share owed.
- Interest-only loans (_in fine_), common for a rental: a kind of loan, not
  a deferral.
- Stepped payments (_prêt lissé_ with a PTZ): the main loan's payment
  changes on given dates, and a template has one amount. One template per
  step, or the PDF import later.
- Selling: deletion with undo first; a « vendu » state with the realised
  gain only if wanted.
- Bought long before the app: the schedule from the first payment gives
  today's outstanding principal with no history.

The spike's scripts are not kept in the repository; Phase 4 rewrites the
reader in `core/market-reading.ts` with fixtures cut from these files.

## Phase 1 — Foundations (branch `property-1/foundations`)

- [x] Migration 049, RLS, assertion script in `supabase/tests/` (18
      checks), `pnpm gen:types`, narrowed types in `core/types/database.ts`.
- [x] The `property.track` flag row, off. Its key in `core/flags.ts` and the
      phone's first flag reader come with Phase 2 and 3: `flags.ts` takes a
      key in the change that reads it.
- [x] `core/loan-schedule.ts`: constant payment and interest-only (_in
      fine_), partial and total deferral, 0 % (PTZ), insurance fixed or on
      what is owed, rounding half away from zero, re-anchoring on a known
      outstanding keeping the payment or the end.
- [ ] Tested against a real bank schedule as a fixture — waiting for one
      from the owner; until then against figures worked out independently
      (200 000 € at 3.5 % over 20 years: 1 159,92 €).
- [x] `core/property.ts`: acquisition cost, estimated value and its source
      (own or purchase; market and index in Phase 4), net value, unrealised
      gain, principal repaid, payment split. Total cost of credit is
      `loanTotals` in the schedule.
- [x] Zod schemas in `core/validations/property.ts`, with their messages.
- [x] Delete-all takes the new tables.
- [x] fr and en strings, added as they are used.

Moved to Phase 2: `data/properties.ts`. The reachability gate fails on a
`packages/data` export that neither app calls, and the web is its first
caller.

## Phase 2 — Web (branch `property-2/web`)

- [x] `data/properties.ts`: property, loans, and the linked template written
      together; attach and detach a template; delete with its loans.
- [x] `property.track` in `core/flags.ts`; the tab and pages only for an
      account that has it (anyone else gets « Page introuvable »).
- [x] `/property` in the nav, list page, empty state.
- [x] The phone-width bar: the account menu to the header, labels that
      shrink to fit (measured from 320 to 414 px); the comments in
      `BottomNav` and `apps/web/DESIGN.md`. With six surfaces the desktop
      notch shows idle labels from `xl`.
- [x] Add sheet in three steps: the property (address with autocompletion,
      asked of the IGN geocoder by the server; kind, area, usage, share) →
      the purchase (price, date, notary fees prefilled at 7.5 % for existing
      and 2.5 % for new, editable; agency; works) → the loan (optional,
      payment computed live, « Ajouter la mensualité aux opérations
      récurrentes » checked).
- [x] `/property/[id]`: value (purchase price or the user's own until Phase
      4), loans with the next payment split and the schedule by year, the
      bank's figure, the payment template checked against the schedule
      (amount and end) and brought in line, attached templates, editing the
      property, adding and editing loans, deleting both.
- [ ] Delete with undo. Not done: deleting asks on the spot, as removing a
      savings account does; the property's templates stay, so the money
      side is never lost. Undo, if wanted, needs the property and its loans
      kept aside as `deletion_undo` does for transactions.
- [x] Charges: « Bien » field in `RecurringForm` (the edit sheet; the Add
      sheet does not offer it), chip in `RecurringView`.
- [x] `docs/how-pluclair-works.md` and `PRODUCT.md` surfaces updated.

Found on the way: the app veil's WebGL threw out of its effect when a
context hands out no program (a browser without a working GPU), replacing
every page with the error screen. Fixed in this phase.

## Phase 3 — Phone (branch `property-3/mobile`)

- [x] The phone's first flag reader, beside the first flag it needs
      (`property.track`, `hooks/useFlag.ts`), and the write announcer told
      that this RPC is a read.
- [x] Sixth tab with labels that shrink to fit (to 80 %), list screen,
      property screen pushed over the tabs, the add sheet in three steps,
      editing a property, adding and editing loans — the web's, drawn
      natively over the same `@finance/data` writes.
- [x] Addresses asked through `GET /api/property/addresses` on the web, so
      the geocoder never sees the phone's address either.
- [x] `properties` and `property_loans` are their own data area; the
      screens read it with `templates`.
- [x] Charges: the same field (edit sheet) and chip.
- [x] Bar comment and `apps/mobile/DESIGN.md` updated for six.
- [x] Run in the Expo web build against the local stack: adding a property
      with its loan wrote the property, the loan and a 1 204,92 € template;
      the list, the property's screen and the chip in Récurrents draw with
      the right figures.
- [ ] On a device: the tab labels shrinking (`adjustsFontSizeToFit` is
      native-only), button fills and screen margins, which the web build
      does not draw on any screen.

Before the phone could share it, the web's « add a property with its loan »
moved into `@finance/data` (`addPropertyWithLoan`), and the form's readings
into core (`property-form.ts`).

## Phase 4 — Market value (branch `property-4/market`)

- [x] `core/market-reading.ts`: DVF rows to a reading (filters, median, IQR,
      radius selection), pure and tested; on the Phase 0 files it gives the
      spike's figures (Paris 11e 9 891 €/m², Lyon 3e 4 370, Gordes 6 728).
- [x] `core/price-index.ts`: the 46 Notaires–INSEE series, the most local
      one for a place, and carrying a price from a quarter to the latest.
- [x] Migration 050: `property_market_readings` and `housing_price_index`.
      **Changed from the plan:** the reading is per property, the owner's
      alone, not a cache shared by place — a table any session could read,
      keyed by a 500 m cell, would have told anyone signed in which
      neighbourhoods some user owns a home in. The index is shared.
- [x] Web: DVF and INSEE fetched on the server, the reading kept when a
      property is added or changed (8-second wait, then the cron's);
      `POST /api/property/market` for the phone; `/api/cron/market` weekly,
      not folded into an existing cron, because DVF and INSEE move by
      quarters and halves, not days.
- [x] Estimated value with its spread and source on both apps, and the
      price per m² around it; « Votre estimation » still wins.
- [x] `docs/legal/registre-des-traitements.md` (section 7) and `AIPD.md`:
      the home's location, reduced to commune and point, and the address
      sent to the IGN geocoder from the server; the privacy policy draft in
      both languages.

Checked end to end against the local stack: a Lyon 3e apartment of 52 m²
added at its address read in 3.7 s as 235 000 € (198 000 – 277 000 €), « D'après
394 ventes à moins de 500 m, 2023–2025 (DVF), ramenées au T2 2026 »; a house
without an address bought 300 000 € in 2019 carries to 348 000 € by the
France houses series. The phone's screens were typechecked, not run, this
phase.

## Phase 5 — Plan and net worth (branch `property-5/plan`)

- [x] `core/property-future.ts`: a property year by year to the horizon
      (value grown at its own rate, what its loans still owe, the 2026 tax
      on a sale's gain with its allowances for years held), net worth, and
      the loans still running. Pure and tested.
- [x] « Patrimoine net » card on both apps, under the cushion: savings and
      investments as the milestones count them, the properties' estimated
      value, what the loans still owe. The milestones are unchanged.
- [x] Long view: a card of its own under the long view's, one row per
      property with its growth (kept on `properties.yearly_growth`, 2 % by
      default), what is still owed at the horizon, the tax, the net and the
      net in today's euros, and the total with the long view's net. It
      follows the long view's horizon and inflation; it is never in the
      monthly income.
- [x] A loan's end: **changed from the plan**, it is a line in the net
      worth card — « Prêt principal se termine en mars 2048 et libère
      1 031 € par mois » — not an ingredient of the projection, which looks
      twelve months ahead and would only show it in its last year.
- [x] Le point's net-value tile: **dropped.** The web's Le point is about
      the month, and the phone's has no tile to match; net worth lives on
      the Plan on both apps.

Checked against the local stack on both apps (the phone through its web
build): a Lyon 3e main home and a Grenoble studio let furnished, with their
loans and a Livret A, read 119 303 € of net worth; at 20 years and 2 % the
studio's sale owes 2 238 € (held 27 years: no income tax, 73 % off the
contributions), at 10 years and 3.5 % it owes 7 613 €, both as worked by
hand. A growth typed on one app is kept when the field is left and read by
the other.

## Phase 6 — Renting (branch `property-6/rental`)

- [ ] Rent received as an income template attached to the property.
- [ ] Gross and net yield, monthly cash flow after the loan and charges.
- [ ] ANIL reference rent beside the actual one.
- [ ] Energy class (DPE) and the legal calendar for letting: G barred since
      2025, F from 2028, E from 2034.

## Phase 7 — Moments and notifications (branch `property-7/moments`)

- [ ] Half the loan repaid; the last payment this month — celebrated where
      they show, with a push.
- [ ] A new market reading after a DVF release, at most twice a year.
- [ ] New kind in `notification-kinds.ts`, its switch in Profile, the table
      in `how-pluclair-works.md`.

## Later, if wanted

- « Et si j'achète ? »: price, deposit, rate, length → payment, debt ratio
  against the HCSF's 35 %, effect on the projection. Never saved, like
  _What if_.
- Import the bank's amortisation schedule from its PDF (Mistral OCR) — exact
  figures, but a document sent to Mistral: legal first.
- Outstanding principal read from the bank when open banking exposes the
  loan account (as `savings_accounts.bank_account_id`).
- A yearly recap in May for the tax return: rent received, interest paid,
  taxe foncière.
- One-off works attached to a property.
- SCPI stay an instrument inside a wallet, not a property.
