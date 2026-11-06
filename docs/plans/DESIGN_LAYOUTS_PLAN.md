# Designs that change the layout, not only the colours

November 2026. « Apparence » (merged 2026-11-06, `795f517f`) lets a person
read Pluclair in four designs — « Nuit », « Papier », « Bento », « Console » —
but each one only restates colours, faces and corners: every screen keeps
« Nuit »'s layout. The owner expected the designs to change layouts too, as
the four directions on the design canvas did
(https://claude.ai/artifact/7pwhuXZ2mXtHr1PRfdN6HU), and chose:

- **every screen** gets its own layout in « Papier », « Bento » and
  « Console »;
- **web first**, checked on Vercel previews, then the phone.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges. Each phase
that someone can see adds its « Nouveautés » entry (`AGENTS.md`).

## What never moves

- **The logo.** The orb and the « Pluclair » wordmark (Orbit) are the same
  object in all four designs, well set in every header: the light designs
  keep the orb's near-black base (`.pc-orb` in `globals.css`, `Orb.tsx`).
- **What a screen says.** A design changes where things sit and how they
  are framed, never which figures, actions or warnings a screen shows. No
  feature exists in one design and not another.
- **« Nuit ».** It stays the default and stays exactly as it is.

## How it is built: three layers

Writing every screen four times would make every later change four
changes. So a design is a layout _system_, applied in three layers, and
the third is kept to the screens where a shared shape cannot do:

1. **The shell** — the navigation around every screen. One component per
   design behind `AppShell`, chosen from the design the root layout already
   reads (`getDesign()` / `useDesign()`).
2. **The shared blocks** — `Card` / `Card.Bezel`, `PageHeader`,
   `PageContainer`, `ListSection` / `ListRow`, `SurfaceTabs`,
   `SegmentedControl`, `Button`, `MobileSheet`, `EmptyState`, the hero
   figure. Each block carries a `data-slot` and takes its design's shape in
   CSS under `[data-design=…]`; a structural difference (a ruled section
   instead of a box, a bracketed tab) is a prop-free variant inside the
   block. Every screen built from them changes with no code of its own.
3. **Screen arrangements** — where a design rearranges a screen rather
   than reframes it (Bento's tile grid on « Le point », Console's table on
   the Journal list), a per-design arrangement of the _same_ cards and
   rows, chosen by one switch at the top of the screen.

## The three layout systems

|             | « Papier »                                                                           | « Bento »                                                                                        | « Console »                                                                                            |
| ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Idea        | a ledger, printed                                                                    | tiles, one figure each                                                                           | dense, exact, keyboard                                                                                 |
| Desktop nav | masthead: date line, logo, serif text tabs underlined, « Noter » in ink, double rule | dark rounded sidebar: logo, icon + label tabs, « Moi · Commun » pill, lime « Noter » at the foot | command bar (⌘K field opening the palette), left list of surfaces with their shortcuts (`g p`, `g j`…) |
| Narrow nav  | compact masthead, text tabs on a rule at the bottom                                  | floating dark pill bar, round « + » in the middle                                                | command field over numbered square tabs (`1 POINT`…)                                                   |
| Card        | no box: a ruled section, ink rule on top, hairlines between rows                     | white tile, 28px corners, no border, roomy                                                       | square panel, 1px border, uppercase mono title bar                                                     |
| Page title  | serif display, date under it, rule                                                   | heavy grotesque, chips beside it                                                                 | breadcrumb `PLUCLAIR / LE POINT`, mono uppercase                                                       |
| Rows        | dotted leaders from label to amount                                                  | 36px icon squares, amount bold right                                                             | 40px rows, uppercase labels, mono values                                                               |
| Tabs        | underlined words                                                                     | pills on a grey track                                                                            | `[1] CALENDRIER`                                                                                       |
| Buttons     | square, ink or sienna                                                                | pills                                                                                            | square, bordered or orange                                                                             |
| Sheets      | paper, top rule                                                                      | 32px corners                                                                                     | square panel with a title bar                                                                          |
| Hero figure | italic lede (« Il vous reste ») over a serif figure                                  | extra-bold, inside the accent tile                                                               | mono, cents muted                                                                                      |

## Screens

Every screen below is checked in all four designs at desktop and phone
widths; the list says which get an arrangement of their own (layer 3)
beyond the shell and the blocks.

- **Le point** (`/bearing`) — own arrangement in all three: Papier a front
  page (lead figure and sentence, then columns: the week's journal, what is
  due before payday with leaders, placements, the month close as a quote);
  Bento a tile grid (the « reste à vivre » tile large in the accent, solde
  and dépensé small, placements wide, upcoming as a list tile); Console a
  stat strip over two columns of panels.
- **Journal** — Calendrier (ruled grid with serif day numbers / day tiles /
  mono grid), Liste (ruled ledger with a date column / days as tiles /
  dense table with running balance and `j`/`k`), Par catégorie, Par
  commerce: own arrangements.
- **Placements** — tiles, Analyse, Transparence: own arrangements (ledger
  table / large tiles / table).
- **Plan** — own arrangement for the trajectory and « Vos comptes ».
- **Récurrent, Immobilier, Demander, Profil, Catégories, Règles, Banque,
  Import, Année, Bienvenue, connexion et inscription** — shell and blocks,
  then a pass of targeted fixes from the screenshots.

## Phases

Web:

1. **Foundation and navigation** — the design available to every server
   and client component that needs it; the three shells (desktop and
   narrow); Console's shortcuts.
2. **Shared blocks** — every block in layer 2, in all three designs.
3. **Le point** — its three arrangements.
4. **Journal** — its four views.
5. **Placements and Plan.**
6. **Every other screen**, and a full pass: 20 screens × 4 designs × 2
   widths, screenshots read, misses fixed.

Phone, after the web is merged, in the same order (7–12), Expo's own
components rather than ports of the web's: tab bar and headers, blocks,
then the same screens.

## Checking

Each phase is checked on its Vercel preview: `/demo` (the read-only sample
account) with the `pc-design` cookie set, headless Chromium at 1280 and 390
wide, every screen the phase touches in all four designs, read as a contact
sheet. Previews are protected: the owner gives the bypass secret for the
session. The phone phases are checked on an APK, in all four designs,
before it is published.

## Upkeep

After this, a new screen or card is built from the shared blocks and so
works in every design without more code. A screen that needs its own
arrangement in a design says so in its file, beside the switch.
