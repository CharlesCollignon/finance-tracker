---
name: Pluclair Mobile
description: The ledger on glass — the same dark system and the same translucent material as the web, paying for its edges differently.
colors:
  cool-near-black: "#0a0a10"
  card-surface: "#131320"
  raised-surface: "#1c1c2b"
  accent-wash: "#262015"
  lamplit-gold: "#e0be7a"
  lamplit-gold-hover: "#eacb8f"
  foreground: "#ececf1"
  muted-foreground: "#9b9bad"
  success: "#34d399"
  info: "#22d3ee"
  warning: "#fb923c"
  destructive: "#f87171"
  hairline: "rgba(236, 236, 241, 0.10)"
  hairline-strong: "rgba(236, 236, 241, 0.16)"
  chart-1: "#d8a041"
  chart-2: "#b05645"
  chart-3: "#9fd08b"
  chart-4: "#43acc7"
  chart-5: "#968d88"
typography:
  hero:
    fontFamily: "Fraunces-SemiBold"
    fontSize: "56px"
    letterSpacing: "-2px"
    fontFeature: "tabular-nums"
  figure:
    fontFamily: "Fraunces-SemiBold"
    fontSize: "32px"
    letterSpacing: "-0.6px"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "InstrumentSans-Regular"
    fontSize: "24px"
    fontWeight: 700
  head:
    fontFamily: "InstrumentSans-Regular"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "InstrumentSans-Regular"
    fontSize: "16px"
    fontWeight: 400
  muted:
    fontFamily: "InstrumentSans-Regular"
    fontSize: "14px"
  label:
    fontFamily: "InstrumentSans-Regular"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.015em"
  amount:
    fontFamily: "IBMPlexMono-Regular"
    fontSize: "16px"
    fontFeature: "tabular-nums"
  micro:
    fontFamily: "InstrumentSans-Regular"
    fontSize: "11px"
  logo:
    fontFamily: "Orbit"
rounded:
  control: "10px"
  card: "20px"
  shell: "26px"
  pill: "999px"
spacing:
  row: "12px"
  card: "20px"
  icon-xs: "12px"
  icon-sm: "14px"
  icon-md: "16px"
  icon-lg: "18px"
  icon-xl: "20px"
  icon-hero: "28px"
components:
  button-primary:
    backgroundColor: "{colors.lamplit-gold}"
    textColor: "{colors.cool-near-black}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.raised-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "48px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "48px"
  button-pill:
    backgroundColor: "{colors.lamplit-gold}"
    textColor: "{colors.cool-near-black}"
    rounded: "{rounded.pill}"
    padding: "6px 6px 6px 20px"
    height: "48px"
  card:
    backgroundColor: "rgba(19, 19, 32, 0.7)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  card-bezel:
    backgroundColor: "rgba(236, 236, 241, 0.06)"
    rounded: "{rounded.shell}"
    padding: "6px"
  list-row:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    padding: "14px 20px"
    height: "56px"
---

# Design System: Pluclair Mobile

## Overview

**Creative North Star: "The Quiet Ledger, on glass"**

The phone runs the same ledger as the web, on the same material. Both clients
put translucent surfaces over a lit ground, so both read as panes of glass laid
over something rather than as panels printed on something. If anything the
phone is the more solid of the two: its cards sit at 70% where the web's glass
card sits at 60%. Everything else — the calm, the exactness, the refusal to
decorate a figure — carries over unchanged.

The palette is shared deliberately, hex for hex, with `apps/web`. One amount
should look like one amount whichever screen the user picked up, and that is a
commitment rather than a coincidence: the mobile token file and the web
stylesheet state the same values, and neither may drift alone.

Where this system departs from the web, it departs because the platform
requires it, not because the phone wanted its own taste. Display type carries
no line height because Tailwind's size utilities set one and Android clipped
the font's taller glyphs. Font weights are asked for by their registered
instance name because React Native does not synthesise a weight.

The one difference worth stating carefully is where the blur lives, because it
decides how each client pays for an edge. On the web the blur travels with the
surface: every glass weight carries its own `backdrop-blur` and
`backdrop-saturate`, so a card re-focuses what is behind it and a hairline is
enough to finish the edge. Here the blur is a separate native component
(`src/components/ui/Blur.tsx`) used on four chrome surfaces only — the orb, the
month picker, the auth form and the tab bar — so an ordinary card is
translucency with no blur at all. It has no re-focused edge to separate on, and
buys one with the single soft shadow this system allows instead. That is the
reason for the shadow; it is not that the web is flat and the phone is not.

**Key Characteristics:**

- Dark-only and portrait-only — one palette stated once, not a dark half
  chosen from the system
- Translucent surfaces at 70% over a lit backdrop — shared with the web, which
  sits at 60%; the number is the one place the two genuinely differ
- Two numeric faces: a serif for figures that own a screen, a mono for amounts
  in a ledger
- Amounts coloured by what kind of money they are, not by sign
- One shared palette with the web, stated in both and drifting in neither

## Colors

The web palette exactly, expressed as space-separated RGB channels so alpha
modifiers keep working, plus the mobile-only hairline weights.

### Primary

- **Lamplit Gold** (`#e0be7a`): The accent, the primary button's fill, and the
  colour of a savings amount. At 11:1 on this ground it reads as text as well
  as fill.
- **Lamplit Gold Hover** (`#eacb8f`): The pressed and hovered state of a gold
  control.

### Neutral

- **Cool Near-Black** (`#0a0a10`): The app ground, and the ink used on gold.
- **Card Surface** (`#131320`): Drawn at 70% opacity, so what shows through is
  part of the colour.
- **Raised Surface** (`#1c1c2b`): Secondary controls and muted fills.
- **Accent Wash** (`#262015`): A warm low surface where the accent needs a
  ground rather than a fill.
- **Foreground** (`#ececf1`) and **Muted Foreground** (`#9b9bad`): Primary and
  secondary text.
- **Hairline** (`rgba(236, 236, 241, 0.10)`) and **Hairline Strong**
  (`rgba(236, 236, 241, 0.16)`): Borders and dividers. The two weights are a
  default and an emphasis, not a light and a dark.

### Semantic Amount Colors

Shared with the web through `@finance/core`, and the reason the accent is not
purely decorative:

- **Income** — Success green (`#34d399`)
- **Expense** — Destructive salmon (`#f87171`)
- **Savings** — Lamplit Gold (`#e0be7a`)
- **Investment** — Info cyan (`#22d3ee`)

**Awaiting Orange** (`#fb923c`) is separate from all four. It marks a row
waiting on a decision, and it is orange rather than amber specifically so that
at 8px it can be told apart from both the gold accent and a salmon amount
sitting in the same row.

### Chart Colors

`#d8a041`, `#b05645`, `#9fd08b`, `#43acc7`, `#968d88` — gold-anchored but
categorical, spread on lightness as well as hue. The closest pair stays 17 ΔE
apart under protanopia, deuteranopia and tritanopia; the palette this replaced
fell to 5.4.

### Named Rules

**The One Palette Rule.** There is one palette and it is dark, and
`src/global.css` states it once on `:root` with no `prefers-color-scheme`
branch to fall back to. The app separately pins the scheme —
`userInterfaceStyle: "dark"` in app.json and `Appearance.setColorScheme("dark")`
at boot — but that pinning governs how `dark:` variants resolve; it is no
longer what keeps a second palette off screen. Do not reintroduce one, and do
not add a scheme-conditional token.

**The Shared Palette Rule.** Every colour here is stated identically in
`apps/web/app/globals.css`. A change to one is a change to both, in the same
commit. One amount looks like one amount across the two clients, or the promise
that they are one ledger stops being visible.

**The Semantic Amount Rule.** An amount's colour says what kind of money it is —
income, expense, savings or investment — never whether it is positive or
negative. Do not colour an amount by sign, and do not invent a fifth category
colour.

## Typography

**UI Face:** Instrument Sans (`InstrumentSans-Regular`)
**Figure Face:** Fraunces (`Fraunces-Regular`, `Fraunces-SemiBold`)
**Ledger Face:** IBM Plex Mono (`IBMPlexMono-Regular`, `IBMPlexMono-Medium`)
**Logo Face:** Orbit

**Character:** The phone runs two numeric treatments, and the distinction is
the system's sharpest typographic idea. A figure that owns a screen is set in
the serif at 56 or 32 points. An amount inside a ledger row is set in the mono
at 16. The serif says *this is the number you came for*; the mono says *this is
one row among many, and its digits will line up with the rows above and below*.

### Hierarchy

- **Hero** (Fraunces SemiBold, 56, tracking -2, tabular): The one figure that
  owns a screen — money on hand, a portfolio total.
- **Figure** (Fraunces SemiBold, 32, tracking -0.6, tabular): Card-level
  amounts, one step under the hero.
- **Title** (Instrument Sans, 24, bold): A screen or sheet heading.
- **Head** (Instrument Sans, 16, bold): A block heading inside a screen.
- **Body** (Instrument Sans, 16): Prose and row labels.
- **Muted** (Instrument Sans, 14): Secondary text and row subtitles.
- **Amount** (IBM Plex Mono, 16, tabular): Every amount in a ledger row.
- **Label** (Instrument Sans, 12, semibold, uppercase): Section headers.
- **Micro** (11): Timestamps, units, the line under a figure.

### Named Rules

**The Registered Instance Rule.** React Native takes the exact registered
family name and does not synthesise a weight from `fontWeight`. A semibold face
is asked for by name (`Fraunces-SemiBold`), never by weighting the regular one.

**The Unset Line Height Rule.** Display sizes carry no `text-*` class and no
line height. Tailwind's size utilities set `lineHeight` alongside `fontSize`,
and on Android that clipped this font's taller glyphs. The platform uses the
font's own metrics instead.

**The One Size Class Rule.** Each `Text` variant sets exactly one text-size
utility. Layering a second at a call site leaves font size and line height
disagreeing with each other.

**The Tabular Digits Rule.** Every numeric style carries `tabular-nums`. It is
not decoration: proportional digits change width as a figure animates, so a
counting amount visibly jitters and a right-aligned column never settles.

## Layout

Surfaces inset their contents by `card` (20px); list rhythm is `row` (12px).
Twenty was the phone's own habit before it was a token — `p-5` in 36 of 54
surface paddings — and the web was asked to meet it rather than the reverse.

List rows are a minimum of 56px with `14px 20px` padding, comfortably over both
platform minimums (44pt on iOS, 48dp on Android). Dividers between rows are
inset by 56px so they begin where the row's text does rather than cutting the
full width.

Icon sizes are a closed six-step scale — 12, 14, 16, 18, 20, 28 — with
two-point steps at the small end, because one point is a visible difference on
a 14pt glyph and a meaningless one on a 28pt glyph. This replaced ten inline
literals across the app.

Content lays out inside safe-area insets on both platforms. The app is portrait
only.

### Named Rules

**The Closed Icon Scale Rule.** Six sizes, no others. `size={13}` at a call
site is exactly what this scale replaced.

## Elevation & Depth

Depth comes from translucency first. A card is drawn at 70% opacity over the
app's lit ground, so separation is carried by what shows through rather than by
a cast shadow.

Where a surface still needs a defined edge, a single soft shadow is available —
`0px 1px 2px rgba(0, 0, 0, 0.06)` — described in the tokens as soft elevation,
explicitly not a brutalist offset shadow. Beyond that, depth is a hairline or a
bezel.

### Shadow Vocabulary

- **Soft** (`0px 1px 2px rgba(0, 0, 0, 0.06)`): The only shadow. A hint of
  separation for a translucent surface, never a lift.

### Named Rules

**The One Shadow Rule.** There is a single soft shadow and no elevation scale.
If something needs to read as separate, raise its surface, give it a hairline,
or wrap it in a bezel before reaching for depth.

## Shapes

Four radius roles, named by what they hold rather than by size: **control**
(10) for anything pressable, **card** (20) for a surface holding content,
**shell** (26) for a surface holding cards, and **pill** (999) for a bar's
fill, a dot, or the quick-add button.

The numbers are stated twice — in `src/theme/tokens.ts` for StyleSheet objects,
animated views and blur styles, and in `tailwind.config.js` for the classes —
because neither file can import the other. They must agree.

### Named Rules

**The Tray And Inlay Rule.** Shell is concentric with card: 26 outer, minus 6
of bezel padding, leaves exactly the 20 the inner surface uses. Before this, a
plain card was 16 and a bezelled one 22 inside a 28 shell, so two forms of the
same component disagreed. Change the three together or not at all.

## Components

### Buttons

- **Character:** Tactile and confident — the press is acknowledged immediately
  and precisely, and the gesture stops there.
- **Variants:** default (gold fill with a rim), secondary (raised surface),
  outline (hairline on transparent), ghost (transparent), pill (fully round,
  with a circular nub for a trailing icon).
- **Shape:** Control radius, or pill. Minimum 48dp of height so the Android
  floor is met on both platforms.
- **Label:** Semibold, in the variant's ink.

### Cards

- **Plain:** `rounded-card`, `p-card`, hairline border, card surface at 70%.
- **Bezel:** A tray at `rgba(236, 236, 241, 0.06)` with 6px of padding and
  shell radius, holding the same translucent card inside.

### List Rows

- Minimum 56px, `14px 20px`, a 12px gap between elements, with an expandable
  region beneath and a divider inset by 56px between siblings.
- Grouped under an uppercase label, with an optional micro footnote below.

### Sheets and Modals

Bottom sheets carry a grabber and are the default for a focused sub-task;
confirmation uses a dedicated sheet rather than a system alert. Honour
swipe-to-dismiss unless dismissing would lose data.

### Signature: The Privacy Blur

Amounts render through a dedicated private-amount component backed by a native
blur, so every figure on screen can be hidden with one tap. Any new surface
showing money must route its figures through it.

### Motion and Feedback

Haptics confirm a committed action rather than decorating a tap. Reduced motion
is consulted throughout — the codebase reads the accessibility setting in
seventeen places — and animations degrade to a cut or a crossfade rather than
merely shortening.

## Do's and Don'ts

### Do:

- **Do** state a colour change in both this file's tokens and the web
  stylesheet, in the same commit.
- **Do** set a screen-owning figure in Fraunces and a ledger-row amount in
  IBM Plex Mono, both with tabular digits.
- **Do** colour amounts by category type through `@finance/core`.
- **Do** ask for a font weight by its registered instance name.
- **Do** keep every touch target at 48dp or more, and list rows at 56px.
- **Do** lay out inside safe-area insets, and honour the system Back gesture on
  Android and the left-edge back gesture on iOS.
- **Do** check reduced motion before animating, and degrade to a cut.
- **Do** use the six icon sizes and the four radius roles; both scales are
  closed.

### Don't:

- **Don't** add a light palette or a scheme-conditional token. The stylesheet
  states one palette unconditionally; a `prefers-color-scheme` branch is the
  thing that was removed.
- **Don't** set a line height on a display size; Android clips the tall glyphs.
- **Don't** layer a second text-size utility over a `Text` variant.
- **Don't** add an elevation scale or a second shadow. There is one, and it is
  soft.
- **Don't** colour an amount by whether it is positive or negative.
- **Don't** reinvent a platform control — switches, pickers, date fields,
  action sheets and the system Back behaviour belong to the OS.
- **Don't** let the two radius declarations drift; `tokens.ts` and
  `tailwind.config.js` state the same four numbers on purpose.
