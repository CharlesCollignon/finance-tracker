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

Still open, with a recommendation: whether principal repaid counts as
_Kept_. Recommended no — Kept is measured from the account's balance, and
mixing a computed figure into it would break that. Principal repaid is shown
on the property and inside net worth instead.

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

## Schema (migration 049)

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
  principal, annual_rate, months, first_payment_on,
  insurance_monthly, insurance_basis ('initial' | 'outstanding'),
  deferral_months, deferral_kind ('none' | 'partial' | 'total'),
  fees, borrower_share,
  known_outstanding (null), known_outstanding_on (null),
  recurring_template_id → recurring_templates (set null)

recurring_templates
  + property_id → properties (set null)

property_market_readings        -- shared, written by the server only
  citycode, kind, scope ('commune' | 'radius'), center (null),
  period_from, period_to, median_m2, q1_m2, q3_m2, sales, read_at

housing_price_index             -- shared, written by the server only
  quarter, zone ('idf' | 'province'), kind, value
```

RLS on the user tables as `savings_accounts` does; the shared tables are
readable by any signed-in user and writable by the service role alone.
« Supprimer toutes mes données » and the `delete-account` edge function
(which deletes a fixed list) take the two user tables.

## Linking a loan to a charge

1. Saving a loan computes its monthly payment and offers « Ajouter la
   mensualité à vos Charges », **checked by default**. It writes a monthly
   template: category « Remboursement de prêt », amount the user's share of
   payment + insurance, day of the first payment, `starts_on` the first
   payment and `ends_on` the last. Linked by `recurring_template_id`.
2. If a template in that category already has a close amount, the sheet
   offers it first (« C'est celle-ci ? Prêt — 1 050 € le 5 »). Proposed,
   never linked without the user's yes — the lesson of _Fulfil_.
3. `ends_on` is the last payment, so the charge stops by itself and the
   projection shows the loan ending with no new mechanism.
4. When charge and schedule disagree (insurance changed, early repayment),
   the property says so — « La charge dit 1 050 €, le tableau 1 042 € » —
   with « Mettre la charge à jour ».
5. Any template can be attached to a property: a « Bien » field in the charge
   form, shown only to someone with a property. Taxe foncière (yearly),
   copropriété, PNO or home insurance, and later rent received (income).
   Attached charges carry a chip in Charges.
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
   single apartment or house per mutation, over 9 m². Median €/m² and Q1–Q3.
   With at least ~20 such sales within 500 m, those; else the commune; with
   too few in the commune, no reading.
3. Carried to the latest quarter by the index.
4. Shown as « ≈ 312 000 € (285 000 – 340 000 €) — d'après 214 ventes
   d'appartements à Lyon 3e, 2023–2025 (DVF), actualisé T1 2026 ». A press
   opens « Votre estimation », which then wins and stays dated.
5. Readings are cached per commune and kind (and per point for radius ones,
   rounded); the nightly cron refreshes those older than the latest DVF
   release. The phone reads the cache and asks the web for a new reading on
   save (bearer token, as for the month read).

## Where it shows

| Surface                                       | Change                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav (web `/property`, phone `(tabs)/property`) | Sixth entry « Immobilier ». The list: one card per property — estimated value, outstanding principal, net value — and « Ajouter un bien ». Empty, it explains in one line and offers the add.                                                               |
| Property (web `/property/[id]`, phone stacked) | Value and unrealised gain · Loans: outstanding, next payment split, end date, total cost, schedule (folded), « Mettre à jour le capital restant dû » · Attached charges, « Ajouter une charge du bien » · Market: reading, spread, sales nearby · Yield (Phase 6) |
| Charges                                       | « Bien » field, chip on attached templates, the payment template written by the loan                                                                                                                                                                          |
| Plan — projection                             | Mechanics unchanged. A loan ending is a dated ingredient: « fin du prêt en mars 2041 : +1 050 €/mois »                                                                                                                                                         |
| Plan — long view                              | A property row: value × chosen yearly growth, less year N's outstanding principal, after the tax on the gain (main home exempt; otherwise 19 % plus social contributions, allowances by years held — rates checked when coded, beside `FRENCH_TAX_2026`)       |
| Plan — new card                               | « Patrimoine net »: savings + investments + property − loans, today                                                                                                                                                                                           |
| Plan — milestones, cushion                    | Unchanged                                                                                                                                                                                                                                                     |
| Placements — Analyse                          | Unchanged: the split and the contribution suggestions stay the liquid accounts'                                                                                                                                                                              |
| Le point                                      | A tile « valeur nette du bien », leading to the property                                                                                                                                                                                                       |
| Notifications                                 | Moments (Phase 7): half the loan repaid, the last payment this month, a new DVF estimate (twice a year), under a new switch in Profile                                                                                                                         |

## Phase 0 — Framing (branch `property-0/framing`)

Nothing user-facing.

- [ ] Spike the DVF reader on three places: a Paris arrondissement, Lyon 3e,
      a village with few sales. Check multi-lot mutations, dependencies,
      outliers, and how many radius readings reach 20 sales.
- [ ] Find the INSEE BDM series for the index and how to read them without a
      key; decide cron-fed table versus a constant revisited each quarter.
- [ ] Vocabulary above into `CONTEXT.md`.
- [ ] Six tabs on the phone: mock the bar at 360 pt with « Immobilier » and
      decide label and icon (`home` / Phosphor `House`).

## Phase 1 — Foundations (branch `property-1/foundations`)

- [ ] Migration 049, RLS, assertion script in `supabase/tests/`,
      `pnpm gen:types`, narrowed types in `core/types/database.ts`.
- [ ] Flag `property.track`, off by default, on for the owner; the phone's
      first flag reader.
- [ ] `core/loan-schedule.ts`: constant payment, partial and total deferral,
      0 % (PTZ), insurance on initial or outstanding capital, cents rounding,
      re-anchoring on a known outstanding. Tested against a real bank
      schedule as a fixture.
- [ ] `core/property.ts`: acquisition cost, estimated value and its source,
      net value, unrealised gain, total cost of credit, payment split.
- [ ] Zod schemas in `core/validations`.
- [ ] `data/properties.ts`: property, loans, and the linked charge written
      together; attach and detach a template; delete with its loans.
- [ ] Delete-all and `delete-account` take the new tables.
- [ ] fr and en strings, added as they are used (the unused-keys test).

## Phase 2 — Web (branch `property-2/web`)

- [ ] `/property` in `APP_NAV_ITEMS`, list page, empty state.
- [ ] Add sheet in three steps: the property (address with autocompletion,
      kind, area, usage, share) → the purchase (price, date, notary fees
      prefilled at ~7–8 % for existing and ~2–3 % for new, editable; agency;
      works) → the loan (optional, payment computed live, « Ajouter aux
      Charges » checked).
- [ ] `/property/[id]`: value (purchase price or the user's own until Phase
      4), loans and schedule, attached charges, edit and delete with undo.
- [ ] Charges: « Bien » field in `RecurringForm`, chip in `RecurringView`.
- [ ] `docs/how-pluclair-works.md` and `PRODUCT.md` surfaces updated.

## Phase 3 — Phone (branch `property-3/mobile`)

- [ ] Sixth tab, list screen, stacked property screen, add sheet.
- [ ] New tables mapped to a data area in `announcingFetch`; screens read
      with `useRefreshable`.
- [ ] Charges: the same field and chip.
- [ ] Bar comment and `apps/mobile/DESIGN.md` updated for six.

## Phase 4 — Market value (branch `property-4/market`)

- [ ] `core/market-reading.ts`: DVF rows to a reading (filters, median, IQR,
      radius selection), pure and tested on fixtures from the spike.
- [ ] Web: geocoding, DVF fetch, cache tables, nightly refresh in the
      existing cron, index table; `POST /api/property/market` for the phone.
- [ ] Estimated value with its spread and source on both apps; « Votre
      estimation » pinned and dated.
- [ ] `docs/legal/registre-des-traitements.md` and `AIPD.md`: a home address
      sent to the IGN geocoder; the privacy policy draft.

## Phase 5 — Plan and net worth (branch `property-5/plan`)

- [ ] « Patrimoine net » card on both apps.
- [ ] Long view: a property row with its growth, outstanding principal by
      year, and the 2026 tax on property gains.
- [ ] Projection: a loan's end as a dated ingredient.
- [ ] Le point: the net-value tile.

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
