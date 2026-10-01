# Phone vs web — audit (1 October 2026)

> Read-only audit after the owner tried the October Android build. Three
> passes: screens, design system, wording. Paths: **m/** = `apps/mobile/src/`,
> **w/** = `apps/web/`, **core/** = `packages/core/src/`. Nothing here is done
> yet; the plan at the end is a proposal.

## 0. In one paragraph

The phone received the shared add sheet, planned rows, the charge-scope radio
cards and the Bank page, and **none of the web's later layout reworks**: the
one-month Bearing, the compact month picker, the picker panels, the lighter
Ledger top and the single Charges card. Most of what feels "off" comes from
three causes: **(1)** the language is optional on ~70 shared formatters and
falls back to English, plus hard-coded English strings; **(2)** the two apps
keep separate design tokens that have drifted (mono amounts, larger figures,
gold everywhere, unrenderable font weights); **(3)** screens the web rebuilt
were never ported.

## 1. Fix first — the phone erases share pricing

Saving a share-priced charge from the phone (e.g. "CTO weekly DCA · NVIDIA")
turns it into a plain fixed amount: `m/components/RecurringFormModal.tsx:238`
always sends `pricingType: "fixed"` with no instrument, and
`m/lib/mutations.ts:587-595` then clears `share_count` and the instrument. The
phone form has no shares, instrument or tracked-fund fields at all.

## 2. Three root causes

1. **Locale optional, English by default.** `FALLBACK_LOCALE = "en"`
   (`core/i18n/locale.ts:38`) is the default on ~70 helpers
   (`formatShortDate`, `relativeDayLabel`, `categoryTypeLabels`,
   `formatAnnualRate`, …); 16 phone and 11 web call sites omit it. Making
   `locale` required turns each into a compile error.
2. **English typed straight in.** Screens load `t` and don't use it
   (`investments.tsx`, `transactions.tsx`, `calendar.tsx`,
   `WalletPlanPanel.tsx`, `InvestmentPositionSheet.tsx`, `import.tsx`…);
   ~40 phone and ~78 web action messages are English literals shown raw
   ("Back in the inbox", "Left out"…); seeded categories are English
   (`core/constants.ts:5`: Salary, Groceries, CTO weekly DCA…) — note
   `bank-mcc.ts` and migration 002 match on those names.
3. **Two token sets.** Palette and spacing match; type, figures, fonts,
   surfaces and gold usage don't (§4).

## 3. Screens

| Surface               | Web                                                                                                                                                                                                                       | Phone                                                                                       | Gap                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Bearing / Cap**     | One month (`w/components/finance/bearing/BearingMonthView.tsx:90-169`): month picker → bank banner → attention → arrived charges → balance card + curve → spent vs cap → upcoming → momentum → where it went → month read | Old design (`m/app/(tabs)/index.tsx:170-187`): Headline → BearingCards → panels             | Everything deleted on web in f285d1c still renders on the phone; no month change, no curve |
| **Journal list**      | `w/…/TransactionsView.tsx:525-989` (light top since ea0cff9)                                                                                                                                                              | `m/app/(tabs)/transactions.tsx:584-1086`                                                    | See §5                                                                                     |
| **Calendar**          | +/− amounts per day, shares the month                                                                                                                                                                                     | Dots only, English weekday letters (`calendar.tsx:369`), ISO date (`:417`), own month state | Old cells                                                                                  |
| **Charges**           | One `WhereItGoes` card (`w/…/RecurringView.tsx:289-376`), one card per kind                                                                                                                                               | 2×2 tiles (`m/app/(tabs)/recurring.tsx:272-306`), one card per charge                       | See §5                                                                                     |
| **Plan**              | Budgets (collapsed add, by category, editable) → goals → tags; then cash accounts, close, projection, history                                                                                                             | Reversed order (`planning.tsx`), forms always open, global caps only, no edit               | Old                                                                                        |
| **Portefeuilles**     | Hero → funding chips → wallet chips → wallet card with positions → plan → fees                                                                                                                                            | Positions come 8th (`investments.tsx:173-365`)                                              | See §5; no look-through on phone                                                           |
| **Categories**        | Badges, visible actions                                                                                                                                                                                                   | No badges, English strings                                                                  | Old rows                                                                                   |
| **Profile**           | —                                                                                                                                                                                                                         | Close to web; ~10 English strings                                                           | Small                                                                                      |
| **Bank**              | —                                                                                                                                                                                                                         | Same as web                                                                                 | In sync                                                                                    |
| **Welcome**           | Back control                                                                                                                                                                                                              | No Back; leftover "done" step                                                               | Small                                                                                      |
| **Add sheet**         | Picker panel for categories                                                                                                                                                                                               | Full list; "Another day", "Note", "Tags" in English                                         | Pickers                                                                                    |
| **Charge form**       | Shares × price, instrument, tracked fund                                                                                                                                                                                  | Fixed amount only; weekday/month typed as numbers                                           | §1 bug                                                                                     |
| **Planned-row sheet** | Bottom sheet with Undo                                                                                                                                                                                                    | Centred pop-up, no Undo                                                                     | Minor                                                                                      |
| **Month picker**      | Compact, tappable label → year grid, "Ce mois-ci" chip floats, remembered across screens                                                                                                                                  | Wide bar, label not tappable, chip shifts centre, absent from Bearing                       | Old                                                                                        |
| **Navigation**        | Phone widths: glass header (orb left), floating glass tab bar                                                                                                                                                             | Flat docked tab bar, centred orb, gold active tint                                          | Old style                                                                                  |
| **Review inbox**      | All groups at once, lasting "recently decided", Fetch everything                                                                                                                                                          | One card at a time, session-only undo                                                       | Partial                                                                                    |
| **Month close**       | Plan footer, streak chip, bank note                                                                                                                                                                                       | Top of Plan, no streak                                                                      | Small                                                                                      |

## 4. Design system

### Tokens

| Token                                                | Status                                                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette, status colours, hairlines, charts, spacing  | Identical                                                                                                                                                                                      |
| Card surface                                         | Web glass (card/60 + blur); phone card/70, no blur                                                                                                                                             |
| Bezel                                                | Phone lacks the inset top highlight                                                                                                                                                            |
| Fonts                                                | Phone's Instrument Sans is a **variable** file React Native can't weight: its 198 medium/semibold/bold uses render Regular or faux-bold — bundle static weights                                |
| Row amounts                                          | Web: sans, tabular digits. Phone: **IBM Plex Mono** (`m/components/ui/Text.tsx:39`, 39 `font-mono` sites) — the "20 €" look; Plex's no-break space is 3× wider, and no bundled font has U+202F |
| Card figure                                          | Web 24→30 px; phone 32 px, no `numberOfLines` — the wrapping "1 281,84 / €"                                                                                                                    |
| Hero figure                                          | Web 44→60 px; phone 56 px                                                                                                                                                                      |
| Body tracking, header weight, section-label tracking | Small mismatches                                                                                                                                                                               |
| Gold                                                 | 89 phone references vs 12 web: badge `surface`, list icons, tab tint and dot, success toast                                                                                                    |
| Shadows                                              | Web none; phone real shadows on the "+" and SelectionBar                                                                                                                                       |

### Components

Buttons (phone has no 44/48 px minimum), chips (no shared phone component;
`flex-wrap` rows), segmented control (no ring, different timing), pickers (no
phone equivalent), month picker (above), sheets, inputs (darker fill, no focus
state), badges (gold `surface`), toasts (gold success, not swipeable),
skeletons, privacy (dots instead of blur), floating "+" (covers the last 56 px
of every list: clearance `m/theme/chrome.ts:37-39` vs button
`QuickAddProvider.tsx:145`).

### Motion

Shared timings in `core/motion.ts` work. Web-only: the balance curve drawing
in, bars growing, the breathing "today" dot, the nav pill sliding.
`react-native-svg` is installed, so the curve can be built on the phone.

### Formatting bugs (both apps unless noted)

- **"+34.7+ a year"**: `formatAnnualRate` uses `signDisplay: "exceptZero"`
  (`core/xirr.ts:246-253`), which Hermes on Android appears to mangle; format
  the absolute value and prepend the sign. Same in `formatSignedPercent`
  (`core/instrument-price-series.ts:263`).
- **"0.45%"**: `formatCharge` (`core/fund-costs.ts:232-240`) and
  `formatWeight` (`core/allocation.ts:244-249`) use `toFixed` + "%"; route
  through `formatPercent` + `units.percent` ("0,45 %").
- **"871,1 €"**: `formatCurrency` allows zero/one decimals
  (`core/constants.ts:130-135`).
- **"TUE 27 OCT"**: `relativeDayLabel` without locale
  (`transactions.tsx:887`, `StillToCome.tsx`, `RecentOnAccount.tsx`,
  `ArrivedCharges.tsx` on both apps).
- Phone hand-built percentages: `WalletPerformance.tsx:335`,
  `MoneyOnHand.tsx:197,337`, `ProgressRing.tsx:90`, `panel-blocks.tsx`.

## 5. The three screens the owner flagged

**Journal** — fixed header of 11 blocks before the list (tabs, wide month bar,
full-width Ajouter, Select/Import row, search, English type chips, category
chips, skipped card, In/Out count, inbox bar, "Left at month end"). Add appears
twice (the button and the "+"). The web's ea0cff9 already solved it: no Add on
phones, search + one "filters and actions" button (category, tags, select,
export, import), type chips on one scrolling line, one translated summary line,
bank strip above the list, no card around the list. French keys exist
(`ledger.in`, `ledger.out`, `ledger.leftAtMonthEnd`, `ledger.shownOfTotal`).

**Charges** — reminder prompt, 2×2 tiles with 32 px figures in half-width
cards, a centred "Ajouter une charge" pill duplicating the "+", wrapping chips,
one card per charge, "Actif" on every row (gold on the phone). The web's c1a5900
replaced the tiles with `WhereItGoes`: one "left each month" figure, "of
3 440 € income", a stacked bar and a one-line legend; its helpers
(`allocationSegments`, `ALLOCATION_COLORS`) are already in core.

**Portefeuilles** — hero (English suffixes), return card (English, "+34.7+"),
the fee table with every fund, the plan panel, one "Send to X" card per wallet,
performance, **then** the positions, then an English transfers form the web
doesn't have.

## 6. Wording

Principles proposed by the audit:

1. Say what the money does in everyday verbs (verser, payer, recevoir,
   rester, économiser), not finance nouns (engagé, détention, valorisé,
   pondéré, latent).
2. Number first, one plain line second; the method belongs in the detail,
   never in the label.
3. No English or unexplained acronyms in French (DCA, Ledger, P/L, +/-, 1Y,
   "l'app"); spell out AV, CTO, PER, DIC, ISIN on first use.
4. One name per concept, in both apps and both languages — add a French
   column to `CONTEXT.md`.
5. Borrow the words French banks use: opérations, entrées/sorties, reste à
   vivre, budget, versement, solde.
6. Never one word for two things (today "modèle", "enveloppe", "cap",
   "lecture" each mean two).
7. The locale is never optional; every number and percent goes through Intl.
8. Labels stand alone — no fragments that only work next to a figure.

Most visible proposals (full list of ~50 in the audit transcript):

| Today                               | Proposed FR                                  | EN                                    |
| ----------------------------------- | -------------------------------------------- | ------------------------------------- |
| Cap (tab)                           | Le point                                     | At a glance                           |
| Charges (tab)                       | Récurrents                                   | Charges                               |
| Portefeuilles                       | Placements                                   | Investments                           |
| Transparence                        | Composition                                  | What's inside                         |
| Plafonds                            | Budgets                                      | Budgets                               |
| Engagé                              | Dépenses fixes                               | Fixed costs                           |
| Mis de côté                         | Épargne et placements                        | Saved & invested                      |
| Reste                               | Reste à vivre                                | Left to live on                       |
| Valeur de marché                    | Valeur aujourd'hui                           | Worth today                           |
| Investi                             | Versé                                        | Paid in                               |
| DCA                                 | versements programmés                        | scheduled payments in                 |
| Rendement pondéré par les flux      | Rendement par an                             | Yearly return                         |
| Ce que coûte la détention · pondéré | Frais des fonds · par an en moyenne          | Fund fees                             |
| +/- latent                          | Gain ou perte (si vous vendiez aujourd'hui)  | Gain or loss                          |
| Clôturer {mois}                     | Faire le bilan de {mois}                     | Wrap up {month}                       |
| Gardé                               | Économisé                                    | Kept                                  |
| Dépenses non enregistrées           | Dépenses non notées                          | Spending you didn't log               |
| Enveloppe / marge                   | marge (partout)                              | allowance                             |
| Écritures                           | Opérations                                   | Transactions                          |
| Prévu                               | À venir                                      | Upcoming                              |
| Entré / Sorti                       | Entrées / Sorties                            | In / Out                              |
| AV, CTO, PER                        | Assurance-vie, Compte-titres, PER (retraite) | Life insurance, Brokerage, Retirement |

## 7. Proposed plan

| Phase                     | What                                                                                                                                                                                                                                                                                                                      | Size         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **0**                     | Fix the share-pricing loss on the phone (add shares × price, instrument, tracked fund to the phone form, or keep pricing untouched when it can't be edited)                                                                                                                                                               | Small        |
| **1 — Foundations**       | Shared design tokens in core + a parity test; `locale` required on core formatters; the percent/sign/decimal bugs; phone text: sans amounts with tabular digits, static font weights, figure scale; gold cut back to where the web uses it; "+" clearance; a shared chip row; every English string through the catalogues | Medium       |
| **2 — The three screens** | Journal top as on the web; Charges with `WhereItGoes` (count-up figure, bar filling in, one-line legend) and one card per kind; Portefeuilles reordered (positions first, fees last)                                                                                                                                      | Medium       |
| **3 — Bearing**           | Rebuild the phone's home on the one-month view, with the balance curve in `react-native-svg` and the month picker                                                                                                                                                                                                         | Large        |
| **4 — Wording**           | The plain-French rewrite across both apps (tab names, ~50 terms, action messages as keys, French seed categories with a name map)                                                                                                                                                                                         | Medium–large |
| **5 — Rest**              | Picker panels, Plan forms, calendar amounts, review inbox, Back in Welcome, look-through on phone, web's own fixes (empty state, card radius)                                                                                                                                                                             | Medium       |

## 8. Status (October 2026)

Done:

- **Phase 0**: the phone's charge form keeps a share-priced charge
  share-priced — share count, fund, price per share.
- **Phase 1**:
  - the parity test (`packages/core/src/design-parity.test.ts`);
  - `locale` required on core formatters, every percent through Intl, French
    typography in the catalogue;
  - Instrument Sans in four static weights, sans amounts with tabular digits,
    the web's hero and figure sizes;
  - gold cut back, no shadows, the "+" clearance;
  - `ChipRow`;
  - every user-facing English string on the phone through the catalogues.
- **Phase 2**:
  - Journal: one scrolling header, no Add, search plus one "Filtres et
    actions" button, a three-figure summary, signed amounts, no card around
    the list, the skipped charges folded to one line;
  - Récurrents: `WhereItGoes` with a count-up figure, a ring for the share
    kept and a bar growing in, then one card per kind;
  - Placements: value → monthly contributions → account chips → positions →
    performance → return → plan → fees → transfers (folded).
- **Phase 4, in part**:
  - the tab names;
  - "opération", "opération récurrente", "placements", "Dépenses fixes",
    "Épargne et placements", "Reste à vivre", "Valeur aujourd'hui", "Versé",
    "Gain ou perte", "Rendement par an", acronyms spelled out;
  - every action message as a key (`actions.*`), on both apps and in the bank
    routes.

Then, in a second pass:

- **Phase 3**: Le point rebuilt on the web's one-month Bearing, with the
  balance curve in `react-native-svg` (draw-in, breathing today dot, a finger
  reads the day out); the old panels, spine and their core modules removed.
- **Phase 4, the rest**:
  - "Budgets", "Faire le bilan de {mois}", "Économisé", "Dépenses non
    notées", "marge", "Composition";
  - the AI readers' glossaries moved to the same words;
  - the default categories in French with both names kept
    (`DEFAULT_CATEGORIES`, `categoryNameVariants`);
  - a French name for every term in `CONTEXT.md`.
- **Phase 5**:
  - the picker panels (`components/pickers/`) in the add sheet and the forms;
  - weekday and month chosen by name;
  - Plan in the web's order with per-category budgets and the month close in
    its footer;
  - the review inbox showing every shop, with a lasting "recently decided";
  - the planned-row sheet from the bottom with Undo;
  - signed amounts in the calendar cells;
  - Back in the welcome flow;
  - badges and visible actions on categories;
  - the look-through on the phone;
  - the web's EmptyState and Card on the card radius.
- **Chrome**:
  - the floating glass tab bar and the orb beside the title;
  - the month shared by Le point, the Journal and the calendar
    (`MonthProvider`).
- **Removed**: the phone's transfers form, at the owner's request, with the
  create/delete code behind it on both apps. The month close still counts
  transfers already recorded.
