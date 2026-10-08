# Plan du quotidien

October 2026. The owner wants Pluclair useful enough, on the phone and the
web, that an ordinary French user opens it every day: by adding features and
by improving the ones there are. Decided in one session on 2026-10-08.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges. Each phase
updates `docs/how-pluclair-works.md`, and `CONTEXT.md`, `apps/web/PRODUCT.md`
and both `DESIGN.md` files wherever it changes what they say.

This plan sits beside `PLUCLAIR_UPGRADE_PLAN.md`. It now owns that plan's
onboarding v2 (its Phase 2), analytics (§4.10), the subscription detector (its
Phase 7) and Ask Pluclair (its Phase 9); its Goals v2 (Phase 5) is on hold.

## What is there today

- **Le point** has 13 blocks in a fixed order. Nothing on it answers "how much
  can I still spend": « Prévu en fin de mois » leaves out the everyday spending
  still to come, « Reste chaque mois » is only on Récurrents, and « il vous
  reste » only in the month-close sheet.
- **First run**: `/welcome` and the phone's `onboarding` ask currency, income
  and charges, all skippable. There is no sample data, and the notification
  permission is never asked there (only from Récurrents and Profile), so most
  new users would never get the recap or the warnings.
- **Adding** on the phone takes 4 to 8 taps. The shop autocomplete, which fills
  the category and the amount, sits in the note field below the category.
- **No quick actions, widget or Shortcuts** on the phone. The web is
  installable with an « Add » shortcut, but its manifest is still in English.
- **Bank connection** is behind `bank.connect`, off by default and switched on
  by SQL; `/bank` lists four steps in text. On open-banking.io the user signs
  up, tops up a prepaid wallet, connects their bank, then on Développeurs
  creates a key and downloads `credentials.json` — and the « Clé de
  chiffrement » card downloads a file with the same name and no key.
- **Import** is a generic CSV reader: no bank presets, no OFX, and only the
  first row is checked for a header.
- **Search** covers the month on screen only. There is no subscription watch,
  year in review, tax-time page or free question.
- **No analytics**, and the draft privacy policy promises « aucune mesure
  d'audience » (`components/marketing/legal-copy.fr.ts`).
- **« Bientôt »** on the landing: bank connection, property, the AI of one's
  choice, the phone app.

## Decisions taken (2026-10-08)

- **Who.** An ordinary salaried person and an investor like the owner; the app
  adapts to what each has set up rather than to a declared profile.
- **Habit comes from use alone.** Real moments as today; no score, no goals,
  no challenges, no advice. Budgets and goals stay out of the interface.
- **Parity.** Every feature on the web and the phone, each through its own
  platform's surfaces (a phone widget's web counterpart is the installed app's
  shortcut).
- **Measured, first-party.** A salted pseudonymous id, one row per active day
  and a few counts, no amounts, deleted after 13 months, an opt-out in
  Profile. The privacy policy says exactly that.
- **Bank connection opens to everyone, self-serve**, through the user's own
  open-banking.io account, with no waitlist. The owner's sign-off on the
  privacy policy and terms comes before the flag goes on.
- **Property, the AI of one's choice and the phone app open to everyone too.**
  The « Bientôt » list empties in this plan.
- **A shared space for a couple**, with a joint account. This ends "one
  person's money" as the product's scope: `CONTEXT.md` and `PRODUCT.md` change
  with phase 6.
- **New features**: search across every month, a subscription watch, « Votre
  année », « Puis-je me permettre ? », a tax-time page, and Ask Pluclair.
  Refunds-to-come was considered and left out.

## The figure: « Il vous reste »

The first thing on Le point, on the Android widget, and the base of « Puis-je
me permettre ? ».

- **What it is**: what the Courant accounts hold, minus the charges due before
  the next income, minus the « marge » (spending never recorded) for the days
  until then.
- **Until when**: the next payment of the largest recurring income, normally
  the salary — « Il vous reste 412 € jusqu'au 28 ». With no income set (a
  freelancer, or nobody entered one), the end of the month: « jusqu'à la fin
  du mois ».
- **Per day**: « soit 21 €/jour », the figure over the days left.
- **Below zero**: « Il vous manque 80 € d'ici le 28 », in neutral colours; the
  overdraft warning already carries the alarm.
- **With no balance known**, no figure. The setup card asks for one. A balance
  typed there counts as a reading, like a close: the rows recorded after it
  move it until the first close, and it turns the overdraft warning on.
- It reads the personal space only.

## Phase 1 — The daily figure (branch `everyday-figure`) — done

- [x] Measurement: a table of active days and event counts under a salted
      pseudonymous id (the salt a server secret), written from the server, no
      amounts, shops or text; nothing written for a user who opted out; rows
      older than 13 months deleted by the nightly sweep, and a user's rows on
      deleting the account. An owner-only SQL view gives day-30 retention, the
      share of active users opening on 3 or more days a week, and the share
      closing their month (or emptying the inbox, bank connected).
- [x] « Mesure d'audience » switch in Profile, both apps; the privacy policy's
      « aucune mesure d'audience » rewritten to the purpose, the legal basis
      (legitimate interest), what is kept, for how long, that nothing is
      shared or cross-checked, and how to object.
- [x] Core, tested: the figure above, its next income and its per-day amount.
      `CONTEXT.md` gains the term.
- [x] Le point, both apps: the figure on top. Blocks for what is not set up
      are hidden, not invited.
- [x] Setup cards, one at a time, « Plus tard » hides it for good: connect
      the bank where it is offered (the wizard of phase 2; until then the
      current `/bank`), or « Sans banque » → the balance → the salary → the
      charges → the first close on the reading day. Investments and property
      never get a card.
      Replaces the SetUpCard.
- [x] Add sheet, both apps: a shop field just under the amount; a known shop
      fills its category and last amount.
- [x] Notification permission asked in context, right after the first saved
      transaction: « Recevoir le récap du lundi et une alerte avant un
      découvert ? » — web push on the web, the system prompt on the phone.
- [x] Phone quick actions on a long press of the icon, iOS and Android:
      « Ajouter une dépense » (the add sheet) and « Le point », through our
      own config plugin (`expo-quick-actions` has no SDK 57 release yet).
- [x] Web manifest in French.
- [x] « Puis-je me permettre ? », both apps: tapping the figure opens it; an
      amount, « une fois » or « chaque mois »; it shows the figure after it,
      the next low point and, for « chaque mois », « Reste chaque mois »
      after it. Nothing is saved: the add sheet stays the one way to write.

Done on 2026-10-08, with three things the plan did not say:

- The balance typed on the setup card is a row of its own
  (`balance_readings`, migration 057), carried until any close is newer —
  not only the month before's.
- The setup cards' salary and charges open the welcome steps on their own
  (`?from=income`, `?from=recurring`), the one place those are set up from.
- Measurement is a database function both apps call as the signed-in user
  (migration 058), since the phone writes to Supabase directly; it counts
  the visit, a transaction added, a month closed and the question asked.

Not checked on a device: the quick actions and their iOS module.

## Phase 2 — Money in, bank open (branch `everyday-money-in`)

- [x] Bank wizard, both apps: one screen per step with French screenshots of
      open-banking.io and a « C'est fait »; the cost said on the first step
      (3 € a month and 1 € per extra account, paid to them); the « Clé de
      chiffrement » trap with its own picture; the step remembered across
      devices; a refused file sends the user back to the step behind it (no
      bank connected yet → step 2). On the phone, open-banking.io in the
      in-app browser and the file picked from Downloads.
- [x] Import: an OFX reader (BNP, Banque Populaire and Caisse d'Épargne, LCL,
      La Banque Postale and BoursoBank export it), and the import accepts
      `.ofx`.
- [x] Import: the CSV reader finds the header row below an export's account
      lines.
- [x] Import: a script that strips names, IBANs and addresses from a real
      export and keeps its layout; the results become test files in
      `packages/core`.
- [ ] Import: CSV presets for the banks that export CSV only — Crédit
      Agricole, Société Générale, Revolut, N26 — each added only once its
      anonymised export exists, with « comment exporter depuis ma banque ».
- [ ] Launch, gated by the owner's sign-off of the privacy policy and terms:
      `bank.connect` on by default; the landing moves bank connection out of
      « Bientôt » into the present tense; `PRODUCT.md`'s "until launch"
      paragraphs rewritten; the remaining items of `BANK_CONNECT_PLAN.md`'s
      launch checklist.

Built on 2026-10-08, with what the plan did not say:

- The wizard's pictures are not screenshots: they need an open-banking.io
  account to take, and are the owner's to add. The « Clé de chiffrement »
  trap is drawn instead, two cards side by side.
- The step reached is kept among the prompts put away (`bank-wizard:<step>`),
  so no migration.
- Files are read as bytes, Windows-1252 when they are not UTF-8: many French
  banks' CSVs are, and their accents came out as question marks.

Waiting: the presets (each on a real export, anonymised) and the launch (on
the owner's sign-off of the privacy policy and terms).

## Phase 3 — The phone in the stores (branch `everyday-stores`)

- [ ] Android home-screen widget with `react-native-android-widget`: the
      figure and a « + » that opens the add sheet (`pluclair://`). With the
      privacy blur on, the widget shows only « + » and « Le point ». Updated
      after each write and at least every 30 minutes. The phone's entry
      changes from `expo-router/entry` to an `index.ts` that registers it.
- [ ] Store releases, App Store and Google Play: the listings in French,
      screenshots, Apple's privacy labels and Google's data-safety form,
      review.
- [ ] The landing moves the phone app out of « Bientôt », with the store
      links.

## Phase 4 — Find and watch (branch `everyday-search`) — done

- [x] Search across every month, both apps: notes, shops, categories and
      amounts.
- [x] Core, tested: the subscription watch — a price that went up, a new
      subscription, two of a kind (two music services), one that stopped.
- [x] Its findings as « constats » in the Monday recap, and an « Abonnements »
      block on Récurrents listing each subscription and its changes. No push
      of its own.

Done on 2026-10-08. A subscription is a shop charged about every month or
year at about the same price — two charges for a service known by name or
the same amount on about the same day, three otherwise. A bill that moves
every month (electricity) is never a price rise. « Two of a kind » knows
music, video, online storage, mobile plans and gyms by name.

## Phase 5 — « Votre année » (branch `everyday-year`), merged by mid-December — done

- [x] Early January, both apps: a few full-screen cards — the year's
      « gardé », the months closed, the série, the category that moved most,
      the milestones passed. Personal space only.
- [x] An image to share, with no amounts: percentages and counts only.
- [x] One push when it is ready, under a new kind with its own switch.

Built on 2026-10-08. Nothing recorded when a milestone was reached, so the
Plan now dates each tier it celebrates after the first (migration 059):
« Votre année » 2026 shows the ones reached from October. The shared image
shows the longest run rather than the months closed, and the year's kept as
a share of its income.

## Phase 6 — The shared space

Three branches, in order. The phase starts with a written design of how a row
belongs to a space and how the access rules follow, agreed before any code;
the space setting goes in at the data layer, so search, the recap and the
subscription watch take it as a parameter.

### 6a — A space for two (branch `shared-space`) — built, waiting on the owner

Built 2026-10-09 to `docs/plans/SHARED_SPACE_DESIGN.md` and its decisions
(a space is an owner; a link, not an e-mail; « Commun »; the month read in
the space on its own quota). Migrations 060 and 061 are to be applied on
the hosted project, after a backup; nothing of it has been tried in a
browser or on a phone yet.

- [x] A space and its members: a members table (two in the interface, more
      possible later without a migration). Not a personal space each: a
      person is an owner as a space is (migration 060).
- [x] Inviting by a link the inviter sends; the partner needs their own
      account.
- [x] Each partner sees only the joint space, never the other's personal one.
- [x] « Moi · Commun » at the top of the screens both spaces have; the tabs
      the joint space does not have are hidden while it is on.
- [x] The joint space has Le point, Journal, Récurrents, the month close, the
      review inbox (shared: the first answer counts), the subscription watch,
      and its own categories, copied from the creator's to start; and the
      month read, on its own quota.
- [x] The « Compte commun » account role, one tap like the others: its rows go
      to the joint space. The same account connected by the second partner is
      recognised by its IBAN and its copy ignored. Without a bank, either
      partner types or imports into the space. (Closes
      `MULTI_ACCOUNT_PLAN.md`'s third open point.)
- [x] In the personal ledger, the money sent to the joint account is a
      transfer out, « Versement au compte commun ».
- [x] Alerts: both partners get the joint account's (overdraft, big charge,
      the reading day) under their own switches, and the Monday recap of the
      space as its own message; either partner closes the joint month; each
      row shows the initial of who added it.
- [x] Leaving — a separation, or deleting one's account: access ends at once,
      with a CSV export of the space offered first; the space stays with the
      other, who can invite someone else.
- [x] `CONTEXT.md` and `PRODUCT.md`: the scope is one person's money and, for
      a couple, what they share.

### 6b — My share (branch `shared-share`) — built, waiting on the owner

Built 2026-10-09: migration 062 to apply after 060–061; not tried in a
browser or on a phone yet.

- [x] A share per space, set once, 50/50 by default, seen by both. Nothing
      proportional to income: the partner's income stays private.
- [x] « Avec ma part du commun », a switch on Le point and on « Où c'est
      parti »: the versement leaves your spending and your share of each joint
      category comes in. Balances, the figure and the closes do not change.

### 6c — A home owned together (branch `shared-property`) — built, waiting on the owner

Built 2026-10-09: migration 063 to apply after 062; not tried in a browser
or on a phone yet. Milestones still leave property out: the real-estate
plan decided so, and 6c keeps to it — each partner's « Patrimoine net »
counts their part.

- [x] A property in the joint space, its loans paid from the joint account.
- [x] A share per partner from the deed, the space's share by default; each
      partner's net worth counts their share of its net value (milestones
      leave property out, as for any home).
- [x] Property opens to everyone: `property.track` on by default, the
      brand promises checked, the landing moves it out of « Bientôt ».

## Phase 7 — Ask Pluclair (branch `everyday-ask`) — built, one question open

Built 2026-10-09: migration 064 to apply; not tried in a browser, on a phone
or against a live model yet.

- [x] A « Questions » screen, both apps, reached from a link under the
      month read on Le point and, on the web, from the sheet Cmd+K opens
      (Cmd+K was already the quick add's; the sheet now offers the
      question too).
- [x] The model sees aggregates only — the month, spending by month and
      category, charges, the cushion, wallets, loans — through families it
      asks for by name, and the app writes every number. A question about a
      shop is answered by the search, not the model. The question itself
      goes to the model as typed, and the privacy policy draft says so.
- [x] Never advice: an advice question gets the facts and a line saying
      Pluclair does not advise; a check drops any recommending sentence
      (« vous devriez », « je vous conseille », « you should »…).
- [x] About 20 questions a month on Pluclair's key; unlimited with the
      user's own AI account.
- [x] Conversations kept 30 days, each one deletable, swept nightly, gone
      with the account. Personal space only, to begin.
- [ ] « L'IA de votre choix » opens to everyone — **not done, waiting on the
      owner.** Under the AI-account plan's decision (2026-10-04), turning
      `ai.account` on means the reads run only on the person's own
      connected account and Pluclair's key stops writing them; on for
      everyone, nobody without a connection would have AI at all, which
      contradicts the 20 questions on Pluclair's key above. Either the flag
      becomes « the person's account if connected, Pluclair's otherwise »,
      or the AI goes account-only for everyone.

## Phase 8 — Tax time and PDF statements (branch `everyday-tax-pdf`)

- [ ] By April 2027, both apps: a « Déclaration de revenus » page from April.
      Each relevant box with its amount, each amount opening its rows:
      donations (7UF, 7UD), home help (7DB), childcare (7GA–7GG), PER
      payments (6NS–6NU) from the wallets, rents (4BE, or micro-BIC for
      furnished lets) from the property's rental. The user maps their
      categories to the boxes once.
- [ ] The boxes, rates and ceilings in a yearly table like `FRENCH_TAX_2026`,
      checked each April when the forms come out (the 2027 forms are not out
      as of 2026-10-08).
- [ ] PDF statements read on the server without AI — text extracted, each
      bank's layout — for the five biggest groups: Crédit Agricole, Crédit
      Mutuel–CIC, BPCE, BNP Paribas, Société Générale. The file is never
      kept. Each layout added only once its anonymised export exists.

## The owner's part

- Signing off the privacy policy and terms: needed before phase 1's
  measurement ships, and the gate of phase 2's launch.
- The Apple developer account and the Google Play console, for phase 3.
- Real exports from their own banks, and friends' and family's, for phase 2's
  presets and phase 8's layouts.
- Confirming the reading of the CNIL rules below.

## Open points

1. **The « marge » in the figure** is counted for the days until the next
   income, pro rata, as built in phase 1. Taking it whole would be simpler
   and lower; the owner's to change.
2. **The CNIL's exemption** is written for trackers on a device. Measuring on
   the server for signed-in users is our reading of it (salted pseudonymous
   id, statistics only, 13 months, an opt-out), not a CNIL ruling.
3. **The joint space's reading day** starts as the creator's; either partner
   can change it.
4. **Success targets** for the three figures are set after the first month of
   data, not guessed now.
