---
name: Pluclair
description: A calm, exact dark ledger where the only bright thing on screen is the figure that matters.
colors:
  cool-near-black: "#0a0a10"
  marketing-ground: "#06060a"
  sidebar-ground: "#0d0d15"
  card-surface: "#131320"
  raised-surface: "#1c1c2b"
  accent-wash: "#262015"
  bloom-violet: "rgba(139, 74, 255, 0.55)"
  bloom-violet-deep: "rgba(124, 58, 237, 0.24)"
  offstage-magenta: "rgba(232, 74, 178, 0.26)"
  rail-indigo: "rgba(88, 52, 196, 0.26)"
  bounce-purple: "rgba(84, 48, 160, 0.30)"
  lamplit-gold: "#e0be7a"
  lamplit-gold-hover: "#eacb8f"
  foreground: "#ececf1"
  muted-foreground: "#9b9bad"
  success: "#34d399"
  info: "#22d3ee"
  warning: "#fb923c"
  destructive: "#f87171"
  hairline: "rgba(236, 236, 241, 0.1)"
  hairline-strong: "rgba(236, 236, 241, 0.16)"
  marketing-ink: "rgb(255 255 255 / 0.85)"
  marketing-muted: "rgb(255 255 255 / 0.55)"
  marketing-faint: "rgb(255 255 255 / 0.5)"
  chart-1: "#d8a041"
  chart-2: "#b05645"
  chart-3: "#9fd08b"
  chart-4: "#43acc7"
  chart-5: "#968d88"
typography:
  display:
    fontFamily: "Instrument Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 8vw, 5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Instrument Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3.5rem)"
    fontWeight: 600
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Instrument Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.75rem)"
    fontWeight: 600
    letterSpacing: "-0.035em"
  figure:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    letterSpacing: "-0.035em"
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Instrument Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Instrument Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.015em"
  mono:
    fontFamily: "IBM Plex Mono, SF Mono, Courier New, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
  logo:
    fontFamily: "Orbit, Instrument Sans, sans-serif"
    fontWeight: 400
    letterSpacing: "-0.01em"
rounded:
  control: "0.625rem"
  card: "20px"
  shell: "26px"
spacing:
  base: "0.25rem"
  row: "12px"
  card: "20px"
  shell-header: "3.25rem"
  shell-bottom-nav: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.lamplit-gold}"
    textColor: "{colors.cool-near-black}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.lamplit-gold-hover}"
  button-secondary:
    backgroundColor: "{colors.raised-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  button-pill:
    backgroundColor: "{colors.lamplit-gold}"
    textColor: "{colors.cool-near-black}"
    rounded: "9999px"
    padding: "6px 6px 6px 20px"
    height: "44px"
  card:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "16px"
  glass-card:
    backgroundColor: "rgba(19, 19, 32, 0.6)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
    backdropFilter: "blur(24px) saturate(150%)"
  glass-panel:
    backgroundColor: "rgba(10, 10, 16, 0.8)"
    textColor: "{colors.foreground}"
    backdropFilter: "blur(40px) saturate(150%)"
  glass-chrome:
    backgroundColor: "rgba(10, 10, 16, 0.6)"
    textColor: "{colors.foreground}"
    backdropFilter: "blur(24px) saturate(150%)"
  solid-panel:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
  card-bezel:
    backgroundColor: "rgba(236, 236, 241, 0.04)"
    rounded: "{rounded.shell}"
    padding: "6px"
  input:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  list-row:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    padding: "14px 20px"
    height: "56px"
---

# Design System: Pluclair

## Overview

**Creative North Star: "The Quiet Ledger"**

Pluclair is a ledger that happens to be lit from behind. It carries the
discipline of ruled paper — consistent rows, aligned figures, nothing
decorative competing with a number — onto a cool near-black ground, and the
inversion is the whole idea. Paper's restraint, none of paper's brightness.
The system is calm, exact and unhurried: its job is to let a figure be read
correctly, and everything that would interfere with that has already been
taken out.

Lit from behind is literal, and the light is the one thing that was not taken
out. Mounted once in the shell, behind every screen in Operate mode, is a
bloom: a violet main light high and wide over the content column, a magenta
second source off to the right as if out of frame, indigo down the left edge,
a purple bounce along the bottom, and the brand gold low and faint. Over it
sits a WebGL veil, blurred past the point of structure, so the whole ground
drifts slowly enough that nobody catches it moving. The surfaces above are
translucent and quiet — a card is drawn at 60% over that light and blurs what
shows through — so they are quiet *against* something they admit rather than
hide, which is what makes the restraint read as a decision rather than as the
whole of the design. The same cards on an unlit near-black would read as
printing.

This is a dark system with no light counterpart, and that is settled rather
than pending. A warm paper theme shipped alongside this one and was removed:
it was the CSS default while every entry point sent users to dark, which meant
two palettes to keep honest and only one anybody saw. Designing a light variant
is not an improvement to this system; it is a reversal of a decision already
made.

Restraint here is specific, not general. There is one accent and it is used
rarely. The app casts no shadow at all, with one deliberate exception, and the
marketing surface casts two, named and scoped to itself. There are three
marketing greys, because the site genuinely needs three and did not need the
ten alpha literals it had. There are three display sizes, because five clamp
ranges produced twenty-eight distinct size/weight/family triples across eight
pages. Each of these is a reduction that was made on purpose, and the count is
the point: adding a fourth grey or a sixth type step undoes the work.

**Key Characteristics:**

- Dark-only, on a cool near-black lit from behind by a violet bloom
- A ground that drifts — a blurred shader over that bloom, slow enough never to
  be caught moving
- Translucent surfaces over that ground — three glass weights between 60% and
  80%, each blurring and saturating what shows through
- One accent — a warm gold — against otherwise unsaturated surfaces
- Flat by rule; depth comes from translucency, surface value steps and
  hairlines, read against that lit ground
- Serif numerals for money, sans for everything that is words
- Controls that answer a press immediately and precisely, then stop

## Colors

Unsaturated surfaces — cool near-blacks with a single warm accent, plus a small
set of status hues that appear only where a state has to be told apart — over a
ground that is not unsaturated at all. The restraint is in what the app paints;
the colour is in what it paints on.

### Primary

- **Lamplit Gold** (`#e0be7a`): The only warm thing in the system and the only
  colour permitted to carry emphasis. At 11:1 against the page it is legible as
  text, not just as fill, so it serves as both the primary button's ground and
  an emphatic figure's ink. Also the focus ring.
- **Lamplit Gold Hover** (`#eacb8f`): The lift on a primary control's hover.
  The only state change a primary button makes to its fill.

### Neutral

- **Cool Near-Black** (`#0a0a10`): The application page. Also the ink used
  *on* the accent, since dark-on-gold is the only readable direction there.
- **Marketing Ground** (`#06060a`): The public site, one step deeper than the
  app so a lit artefact over it reads as a thing giving off light.
- **Sidebar Ground** (`#0d0d15`): The navigation rail, sitting between the
  marketing ground and the page.
- **Card Surface** (`#131320`): Cards, popovers and input fields. The first
  step that reads as a distinct surface rather than as the page.
- **Raised Surface** (`#1c1c2b`): Secondary buttons, muted fills, and the hover
  ground for outline and ghost controls.
- **Accent Wash** (`#262015`): A warm-tinted low surface for where the accent
  needs a resting ground rather than a fill.
- **Foreground** (`#ececf1`): Primary text. Never pure white.
- **Muted Foreground** (`#9b9bad`): Secondary text, captions, row subtitles and
  section labels.
- **Hairline** (`rgba(236, 236, 241, 0.1)`) and **Hairline Strong**
  (`rgba(236, 236, 241, 0.16)`): Every border in the app. The strong step is a
  hover or emphasis state, not a second default.

### Ground Bloom

Five colours that live only in the `BLOOM` stack inside `AppBackdrop`, which
the shell mounts once behind every Operate-mode screen. They are light rather
than paint: each is an alpha stop in a radial gradient read through the page's
near-black, and none of them is a token, because nothing above the backdrop is
meant to reach for them.

- **Bloom Violet** (`rgba(139, 74, 255, 0.55)`): The main light, and the
  brightest colour in the system by a wide margin. It is centred on the content
  rather than on the window — 58% across on a desktop, where the side rail
  takes the first 224–256px and the content column's optical centre sits right
  of the middle, and 50% on a phone, where there is no rail and the content is
  the window.
- **Bloom Violet Deep** (`rgba(124, 58, 237, 0.24)`): The main light's second
  stop, at 44% of its radius. One stop falls off like a spotlight; the second
  is what makes it fall off like a room.
- **Offstage Magenta** (`rgba(232, 74, 178, 0.26)`): A second source high on
  the right, placed as though it were out of frame. One centred glow reads as a
  spotlight; two of different hue, size and position read as depth.
- **Rail Indigo** (`rgba(88, 52, 196, 0.26)`): Down the left edge, with exactly
  one job — it keeps the navigation rail from reading as a separate black panel
  bolted onto a coloured page.
- **Bounce Purple** (`rgba(84, 48, 160, 0.30)`): The bounce along the bottom.
  Without it the lower half of the page is dead black and the whole thing reads
  as a bloom pasted onto a void rather than as a lit room.

**Lamplit Gold at 10%** (`rgba(224, 190, 122, 0.10)`) closes the stack, low and
faint in the bottom-left corner, so the palette still belongs to Pluclair
rather than to the reference the bloom was drawn from. It is the accent's one
non-semantic appearance, and at a tenth of an alpha over near-black it does not
compete with the places the accent is actually spent.

Over the bloom sits a WebGL veil (`DarkVeil`): a CPPN fragment shader
hue-shifted 258° onto the same violet, rendered at `0.34` of the element's
resolution, blurred `64px`, and composited at 45% opacity in `screen`. The blur
is the design rather than a concession — left sharp the shader draws hard
diagonal streaks that read as a smear across the page, and throwing it out of
focus keeps only the one thing CSS cannot do, which is colour that moves. The
bloom is the floor and the shader is a refinement of it, so where WebGL is
missing, blocklisted, or on a software renderer that will not link a program
this large, the page is very slightly flatter and nothing else changes. Someone
who has asked for reduced motion gets the veil as a single still frame rather
than not at all.

One band deliberately puts the light out: a `h-32` wash at the bottom edge
fading from the page ground to transparent, so the phone's floating navigation
bar has something solid under it. An all-over vignette was tried and removed —
the corners were already dark, and darkening them again only cost the violet.

### Status

- **Success** (`#34d399`), **Info** (`#22d3ee`), **Destructive** (`#f87171`),
  **Warning** (`#fb923c`). Warning is orange rather than amber specifically so
  that a row awaiting a decision can be told apart at 8px from both the gold
  accent and a destructive amount sitting in the same row.

### Semantic Amount Colors

Shared with the mobile app through `@finance/core`, and the reason the accent
is not purely decorative. An amount is coloured by what kind of money it is:

- **Income** — Success green (`#34d399`)
- **Expense** — Destructive salmon (`#f87171`)
- **Savings** — Lamplit Gold (`#e0be7a`)
- **Investment** — Info cyan (`#22d3ee`)

The same mapping drives allocation charts, so a slice and a row agree about
what a category is.

### Marketing Greys

- **Marketing Ink** (`rgb(255 255 255 / 0.85)`), **Marketing Muted** (`/ 0.55`),
  **Marketing Faint** (`/ 0.5`). Three, doing three jobs, replacing ten alpha
  literals that did the same three jobs inconsistently.

### Named Rules

**The One Palette Rule.** There is one palette and it is dark. Tokens are set
on `:root` as well as `.dark` so nothing depends on the class being present.
Do not introduce a light theme, a light-mode token pair, or a `light:` variant.

**The Rare Accent Rule.** Lamplit Gold earns attention by being scarce. Its
places are the primary action, the focus ring, a figure that genuinely leads a
screen, and — systematically — a savings amount. Outside those, a surface that
reaches for it in three unrelated places has spent it. The semantic use is not
an exception to this rule so much as the proof of it: gold means something
specific, which is why scattering it elsewhere costs so much.

The count is now true rather than aspirational. An audit found the accent in
roughly twenty-three roles across ninety-eight call sites — navigation pills,
badges, avatars, switches, chips, calendar days, meters, toasts, chart swatches
and inline links — and every one outside the four above was taken off. What
replaced them is the token that already carried the meaning: foreground against
muted for an active state, a hairline or a surface step for a selection, a chart
colour for a chart. Two decorative glows that ringed every card on the Bearing
went to foreground for the same reason. Read the four homes as a description of
the code, not a wish about it, and add a fifth only by changing this paragraph
first.

**The Semantic Amount Rule.** An amount's colour says what kind of money it is —
income, expense, savings or investment — never whether it is positive or
negative. Do not colour an amount by sign, and do not invent a fifth category
colour.

**The Three Greys Rule.** Marketing text uses exactly three opacities: 0.85,
0.55, 0.5. The faint step was 0.35 until it was measured at 3.09:1 against the
marketing ground and failed AA for the ten runs of prose it carries; 0.5 reads
5.31:1. The count did not change and must not — a fourth value is a decision
nobody made, so reach for an existing
step instead of interpolating.

## Typography

**Display / Body Font:** Instrument Sans (with Helvetica Neue, Helvetica, Arial)
**Figure Font:** Fraunces (with ui-serif, Georgia)
**Mono Font:** IBM Plex Mono (with SF Mono, Courier New)
**Logo Font:** Orbit, a local face used for the wordmark only

**Character:** One sans carries both headings and prose — headings are the body
face at weight 600 with tighter tracking, not a second typeface. Against that
uniformity, the serif's appearance is an event: it shows up on large monetary
figures and nowhere else, which is what makes a figure read as the subject of
its screen rather than as another line of interface.

Default letter-spacing across the app is `-0.01em`, tightening to `-0.035em`
for headings and figures.

### Hierarchy

- **Display** (600, `clamp(2.4rem, 8vw, 5rem)`): The landing headline. One per
  page.
- **Headline** (600, `clamp(2rem, 6vw, 3.5rem)`): A marketing section's
  heading.
- **Title** (600, `clamp(1.75rem, 4vw, 2.75rem)`): The heading of a block
  inside a section.
- **Figure** (Fraunces 600, `tabular-nums`): Monetary values presented as the
  subject — the hero figure, a card's headline number, a projection total.
- **Body** (400, 1rem): Prose and row labels.
- **Label** (600, 0.75rem, `0.015em`, uppercase): Section headers above lists
  and grouped rows.
- **Mono** (400, 0.875rem): Identifiers, symbols, codes and anything the user
  compares character by character.

In-app headings use the `Text` component's steps (`h1` 4xl→5xl bold, `h2`
3xl→4xl semibold, `h3` 2xl medium, descending to `h6` at base), which are the
application counterpart to the three marketing clamps above.

### Named Rules

**The Serif Is For Money Rule.** Fraunces appears on figures and never on
prose. Every use carries `tabular-nums` so digits hold their column as a value
changes. A serif heading is not in this system.

**The Three Steps Rule.** Marketing display type has exactly three sizes, all
`clamp()`. A headline that does not scale with the viewport is the wrong fix;
five arbitrary ranges was the original problem, and a fourth step reopens it.

**The One Typeface Rule.** Headings are the body sans at 600 with tight
tracking. Reaching for a second display family to make something feel important
is the move this system already rejected.

## Layout

The application is a shell: a fixed header at `3.25rem`, a navigation rail on
the sidebar ground, and on small screens a bottom navigation bar at `3.5rem`
with a `0.75rem` inset, both respecting `env(safe-area-inset-*)` through the
`pt-safe` and `pb-safe` utilities.

Spacing derives from a `0.25rem` base. Two composite steps are named because
they recur structurally rather than incidentally: **row** (`12px`) is the
vertical rhythm inside a list, and **card** (`20px`) is a card's internal
padding. Controls own their own padding rather than each screen setting it —
there is deliberately no token for a control's inner spacing.

List rows are a minimum of `56px` tall with `14px 20px` padding, which is a
finger-sized target before it is a visual rhythm.

The marketing surface is its own environment: `.marketing-shell` carries the
dark class itself and sets a deeper ground, so the public pages are dark
regardless of anything the app does around them.

### Named Rules

**The Named Step Rule.** When a spacing value recurs structurally, name it —
`row`, `card`, the shell heights. When it does not, use the base scale. A
one-off `17px` is a mistake, not a step.

## Elevation & Depth

**This system is flat.** Every shadow token — `--shadow-2xs` through
`--shadow-2xl` — is set to `none`, deliberately and not by omission. Surfaces
never lift off the page, and there is no hover elevation anywhere in the app.
The marketing surface holds one named exception to both, at the end of this
chapter.

Depth is built four ways instead. First, there is a ground for the surfaces to
be read against: the bloom described under Colors, fixed to the viewport by the
shell so the light stays where it is while the page scrolls through it. Second,
the surfaces admit that ground rather than covering it — the glass weights
below are drawn between 60% and 80% opacity and blur what shows through, so a
surface separates by what it does to the light behind it instead of by casting
anything in front. Third, surfaces step in value: marketing ground `#06060a`,
page `#0a0a10`, sidebar `#0d0d15`, card `#131320`, raised `#1c1c2b`. Fourth,
hairline borders separate what value alone leaves ambiguous. The order is the
reason it works: five near-blacks spanning so narrow a range separate far more
legibly over a lit field than they would over a uniform void, so the ground is
first and not an afterthought.

The bloom is a ground, not an elevation. It sits at `-z-10` behind everything,
it belongs to no component, and nothing is nearer the viewer for sitting over a
brighter part of it.

The web and the phone are the same material, not two. Both answer that lit
ground with translucency, and the phone is the *more* opaque of the pair: its
cards are drawn at 70% (`rgba(19, 19, 32, 0.7)`) where the web's are at 60%.
What differs is where the blur lives and what each pays for an edge. On the web
the blur travels with the surface — every glass weight carries its own
`backdrop-blur` and `backdrop-saturate-150`, so the surface refocuses and
re-saturates the light it admits — and separation is finished with a hairline,
which is how the web's flatness survives intact. On the phone the blur is a
separate native component (`Blur`, `blurAmount` 24 over an
`rgba(11, 9, 5, 0.35)` tint) used on four chrome surfaces only, so an ordinary
card there is translucency with no blur at all, and it buys the edge that costs
it with the one soft shadow (`0px 1px 2px rgba(0, 0, 0, 0.06)`) that system
allows. Same room, same glass, cut differently.

### Surface Weights

`lib/glass.ts` holds the vocabulary, kept as class strings rather than
components so they compose with `cn` at the call site — a wrapper component per
weight would be three components that only forward children. Three weights,
because there are three jobs, and all three carry `backdrop-saturate-150`:
translucency alone drains the violet it admits, and the saturate step is what
puts it back.

- **Chrome** (`GLASS_CHROME` — `bg-background/60`, `backdrop-blur-xl` (24px),
  `backdrop-saturate-150`, over `border-border`): Header bands and the side
  rail. Structure, not content, and it has to stay legible over anything that
  scrolls under it. Used by `PageHeader` and `SideNav`.
- **Card** (`GLASS_CARD` — `bg-card/60`, `backdrop-blur-xl` (24px),
  `backdrop-saturate-150`, over a `border-foreground/10` hairline): A content
  card floating on the veil, and the most used of the three. `60` rather than a
  lower number, because the figures on these cards are the point of the screen
  and text over a moving gradient at high transparency is the single easiest
  way to make an interface look cheap.
- **Panel** (`GLASS_PANEL` — `bg-background/80`, `backdrop-blur-2xl` (40px),
  `backdrop-saturate-150`, over the same hairline): Popovers, menus and sheets.
  A panel floats above everything and has to be readable over content it did
  not choose, so it is the most opaque of the three and blurs the hardest. Used
  by `AccountMenu` and the phone-width `BottomNav`.

`SOLID_PANEL` (`bg-popover` at full opacity, over the same hairline) is the
deliberate exception, and it is not glass. `backdrop-filter` composites against
what is already painted behind the element, and it does not nest: a blurred
panel inside a blurred header gets the header's finished pixels as its backdrop
and blurs nothing, so the content behind shows through sharp and the panel
becomes unreadable. The month grid opens out of the header band, so
`MonthPicker` cannot be glass — a control holding twelve small targets is one
to see clearly, not through. The mobile app reached the same conclusion by a
different route, its account sheet noting that a frosted panel made the rows
hard to read against busy content behind it.

`GLASS_HERO` gives one card a little more than the weight underneath it, and it
is light rather than elevation: a hairline highlight along the card's top edge,
drawn as a `before:` gradient from transparent through `foreground/25` and
back, the way a pane of glass catches a reflection. It sits on the Month
screen's headline card and nowhere else, because the effect is only expensive
while it is rare. Being a pseudo-element gradient and not a `box-shadow`, it
costs the flatness rule nothing.

Glass is not the only surface in the app, and that is the state of things
rather than a plan. The `Card` component in `components/retroui/Card.tsx`
paints an opaque `bg-card`, and twenty files import it against ten that import
`GLASS_CARD`: the glass weights are what the Operate-mode screens sitting
directly over the backdrop use, and the opaque card is what everything else
still uses. Two overlays — `SelectionBar` and `OutboxBanner` — hand-roll a
further weight inline at `bg-background/95 backdrop-blur-xl` instead of
importing one, which is drift to fold back in rather than to copy.

A glass surface's alpha belongs to its weight, not to the palette. The colours
are `--card` and `--background` exactly as Colors already states them, and
`/60`, `/80` and `/95` are the only alphas they are ever spent at; a
`card-surface-60` entry under Colors would invite a call site to reach for a
tint instead of a weight, which is the failure the Three Greys Rule describes.
The alphas are recorded in the frontmatter under `components:` as
`glass-card`, `glass-panel` and `glass-chrome`, which is where the phone states
its own `rgba(19, 19, 32, 0.7)` too.

Inside the app exactly one surface treatment breaks the flatness, and it is a
recess rather than a lift. The marketing surface holds the system's only cast
shadows, thrown by glass rather than by elevation. Both are named below, beside
the inset highlights that are neither — including the orb's, the one
`box-shadow` that crosses into the app without describing a surface at all.

### Shadow Vocabulary

- **Bezel Inset** (`box-shadow: inset 0 1px 1px rgba(255, 246, 230, 0.08)`):
  A single warm highlight along a card's top inner edge, inside the tray of
  `Card.Bezel`. It reads as machined material catching light, not as the card
  floating.
- **Marketing Panel Glass** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 60px -20px rgba(0, 0, 0, 0.7)`):
  `.glass-panel`, marketing only. The inset is the light along the pane's top
  edge; the drop is how far the pane sits in front of the orb.
- **Marketing Menu Glass** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 30px 70px -20px rgba(0, 0, 0, 0.85)`):
  `.glass-menu`, marketing only. The same pair, longer and darker, because a
  dropdown opens over a 5rem headline and has the most to hold down.
- **Marketing Flat Glass** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09)`):
  `.glass-flat` and `.glass-grid`, marketing only. The lit top edge alone, a
  shade under the panels'. These carry their own text instead of floating over
  the orb, so there is nothing for them to sit in front of and nothing to cast.
- **Orb Bounce** (`box-shadow: inset 0 -7cqw 11cqw -5cqw rgb(255 237 194 / calc(0.24 * var(--orb-glass)))`):
  `.pc-orb::after`, on both surfaces. The light the ground throws back up into
  the underside of the sphere, sized in `cqw` so it scales with the mark rather
  than with the viewport. Interior modelling of a decoration, not a claim about
  where its box sits.

Five entries, and exactly two of them carry anything cast: the drop inside
Marketing Panel Glass and the drop inside Marketing Menu Glass. Everything else
here is an inset — light drawn on a surface, which is how a system that refuses
elevation can hold this many and stay flat.

### Named Rules

**The Flat-With-One-Exception Rule.** No element casts a shadow. The only
depth cue in the system is the bezel's inset highlight, and it describes a
recess. If something needs to feel separate, step its surface value or give it
a hairline — do not reach for a drop shadow, and do not add an elevation scale.

**The Marketing Glass Rule.** The marketing surface casts two shadows and
lifts one card on hover, and those three declarations are the whole of what
this rule licenses. `.glass-panel` casts `0 24px 60px -20px rgba(0, 0, 0, 0.7)`
under an `inset 0 1px 0 rgba(255, 255, 255, 0.14)`; `.glass-menu` casts
`0 30px 70px -20px rgba(0, 0, 0, 0.85)` under an
`inset 0 1px 0 rgba(255, 255, 255, 0.1)`; and `.glass-flat-hover:hover` adds
`transform: translateY(-2px)` to the border and background it was already
changing. All three live in `app/globals.css` beside the other marketing
glass and apply nowhere else. Two more drops were deleted on the way to
writing this down — a gold glow under the hero button and a black pool under
the phone mock — because neither was glass, and the exception is the
vocabulary, not the surface.

Two is the count of what is cast, not of what is written. `box-shadow` appears
at five places in `app/globals.css`, and the three this rule does not name cast
nothing: `.glass-flat` and `.glass-grid` each take
`inset 0 1px 0 rgba(255, 255, 255, 0.09)`, and `.pc-orb::after` takes
`inset 0 -7cqw 11cqw -5cqw rgb(255 237 194 / calc(0.24 * var(--orb-glass)))`.
The two cast declarations open with an inset of their own as well, so the file
holds five inset highlights against two drops. An inset puts nothing in front
of the element and moves nothing away from the page — it is light drawn on a
surface, which is precisely what the bezel inset is and why the flatness rule
can call a recess its one exception. So this rule is scoped to what is thrown,
and an inset highlight is not a candidate for it, in marketing or anywhere
else. The orb's is the one worth saying out loud: `Orb` is a brand component
and its 22–26px mark sits in `PageHeader` and `Logo` on the app side, so the
sphere's interior modelling travels with it across the line this rule draws.
That is shading inside a decoration, not a box announcing how far off the page
it sits, and how far off the page a surface sits is the only thing the flatness
rule is about.

Two hover transforms are outside it and are recorded here rather than blessed:
`LandingCtas`' primary button rises `-translate-y-0.5` and `LandingGlass`'
arrow nub slides the same step diagonally. Neither casts anything, so neither
is elevation in the sense the rule above refuses, but neither has been decided
on either — do not read them as room for a third.

The marketing surface earns it because it is lit differently. Operate mode has
a ground its surfaces admit: a card at 60% over the bloom separates by what it
does to the light behind it, and a hairline finishes the job, so flatness costs
that side nothing. The landing pages put glass over an orb, where admitting the
light is not enough — a pane with nothing under it reads as a hole punched in
the light rather than as something in front of it. The drop is therefore a
description of the material and not a lift: long offset, soft blur, pulled back
in by a negative spread, measuring the distance to the orb the way the inset
highlight measures the light along the top edge. The app side is not waiting
for the same thing. Its depth is the four-way build above — ground, glass,
surface value steps, hairlines — and that is already a complete answer, so a
shadow there would be a second depth system arguing with the first. Nothing
here licenses a drop shadow, a hover lift or an elevation scale under
`app/(app)/**`, in `components/finance/**`, or in anything both surfaces share.

Which leaves the rule above carrying a name that is now slightly wrong: count
this vocabulary and the system has more than one exception. The name stays.
Tooling and `.impeccable/design.json` both reference it, and a rule renamed to
accommodate an exception is a rule being negotiated rather than kept. Read its
body — exact, and unchanged by this — and read this rule as the one named place
standing beside it.

**The One Backdrop Rule.** The lit ground is mounted once, in `AppShell`, and
never per route. A WebGL context is expensive to create and browsers cap how
many can be live at once — Chrome at 16, silently dropping the oldest — so one
backdrop that survives navigation beats one per page; the drift must not
restart when somebody changes surface; and a backdrop unmounted mid-navigation
would flash through everything sitting over it. Do not mount a second
`AppBackdrop`, and do not give a screen its own gradient to match this one.

## Shapes

Three radii, each tied to a role rather than a size: **control** (`0.625rem`,
10px) for buttons, inputs and anything pressable; **card** (`20px`) for a
card's own corner; **shell** (`26px`) for the tray that wraps a card. The
6px difference between card and shell is what makes the tray read as a frame
around the inlay rather than as a second card.

Pills are the one full-round form, reserved for the marketing call to action,
where the trailing nub is a circle nested flush inside the button's end
padding.

Borders are uniformly 1px hairlines. There are no double borders, no dashed
strokes, and no decorative dividers where a spacing step would do.

### Named Rules

**The Tray And Inlay Rule.** A bezel is `shell` radius outside, `card` radius
inside, with `6px` of tray showing. Those three values move together or not at
all; changing one alone breaks the frame.

## Components

### Buttons

- **Character:** Tactile and confident. A press is acknowledged immediately and
  precisely, and the gesture stops there.
- **Shape:** Control radius (`0.625rem`), minimum height 44px on touch, relaxed
  on large screens.
- **Primary:** Lamplit Gold ground with near-black ink, plus a 1px rim.
  Hover raises the fill to `#eacb8f`.
- **Secondary:** Raised surface ground, foreground ink, hover to muted.
- **Outline / Ghost:** Transparent ground — outline carries a hairline, ghost
  does not — both washing to muted on hover.
- **Link:** Text only, underline on hover with a 4px offset.
- **Pill:** Fully round, used for the marketing call to action, carrying a
  circular **nub** that drifts up and to the right on hover.
- **States:** `active:scale(0.98)` on press; focus-visible draws a 2px ring in
  Lamplit Gold with a 2px offset against the page. Disabled drops to 50%
  opacity with the cursor disallowed.

### Cards / Containers

- **Corner Style:** `20px`, or `26px` for the bezel tray around it.
- **Background:** Two, and both ship. A card on an Operate-mode screen uses
  `GLASS_CARD` — card surface at 60% with `backdrop-blur-xl` and
  `backdrop-saturate-150` — so the bloom reads through it, while the `Card`
  component paints card surface opaque. See Surface Weights under Elevation &
  Depth for which belongs where.
- **Shadow Strategy:** None. See Elevation & Depth; the bezel's inset highlight
  is the only depth cue.
- **Border:** 1px hairline.
- **Internal Padding:** 16px in the header and content blocks; `20px` is the
  named card step for composed layouts.
- **Bezel variant:** A tray at `rgba(236, 236, 241, 0.04)` with `6px` of
  padding, wrapping a card that carries the inset highlight.

### Inputs / Fields

- **Style:** Card-surface ground, 1px hairline, control radius, `8px 12px`
  padding, 44px minimum height, placeholder in muted foreground.
- **Focus:** 2px Lamplit Gold ring; the border itself does not shift.
- **Error:** Border and text both turn Destructive, driven by `aria-invalid`
  rather than by a separate visual prop.

### List Rows

- **Style:** Full-width, minimum 56px, `14px 20px`, a 12px gap between the
  label, the value and any trailing affordance. Transparent at rest with a
  colour wash on hover.
- **Grouping:** Rows sit inside a bezel with the inner surface clipped, under
  an uppercase label in muted foreground.

### Navigation

- Header at `3.25rem` on the sidebar ground with a hairline beneath. On small
  screens a bottom bar at `3.5rem` with a `0.75rem` inset, inside the safe
  area. Active state is carried by foreground colour, not by a pill or an
  underline.

### Signature: The Privacy Blur

Any element marked `.privacy-amount` or `.privacy-sensitive` blurs to `7px`
when `html[data-privacy="on"]`, transitioning over the press duration, with
selection and pointer events disabled underneath. It is a first-class state of
the design system, not a utility: any new surface that displays money must mark
its figures so this keeps working.

### Motion

One easing curve across the system — `cubic-bezier(0.32, 0.72, 0, 1)` — on a
three-step duration scale: **press** 140ms, **hover** 200ms, **enter** 500ms
(550ms for the page and stagger entrances). Tailwind's default transition
duration is pointed at the hover token, so a transition written without a
duration is still on the scale. A global `prefers-reduced-motion` block reduces
all animation and transition to 0.01ms, and the landing logo's float is
switched off entirely.

## Do's and Don'ts

### Do:

- **Do** keep every new surface dark. Tokens resolve identically on `:root` and
  `.dark`.
- **Do** set monetary figures in Fraunces with `tabular-nums` when the figure is
  the subject of its screen, and in the sans when it is one value among many in
  a row.
- **Do** mark every rendered amount with `.privacy-amount` or
  `.privacy-sensitive` so the blur keeps covering the whole app.
- **Do** colour amounts by category type through `@finance/core`, so a figure
  means the same thing here as it does on the phone.
- **Do** build depth from the lit ground, the glass weights, the surface value
  steps and the hairlines already defined, in that order.
- **Do** reach for one of the three weights in `lib/glass.ts` when a surface
  sits over the lit ground, and for `SOLID_PANEL` when it opens out of another
  blurred surface — `backdrop-filter` composites against finished pixels and
  does not nest.
- **Do** give touch targets at least 44px, and list rows at least 56px.
- **Do** use the three duration tokens and the single easing curve; a
  transition with no duration inherits the hover token and is already correct.
- **Do** honour `prefers-reduced-motion` in any new animation, following the
  landing logo's example of switching off rather than merely shortening.

### Don't:

- **Don't** add a light theme, a light-mode token, or a `light:` variant. The
  paper theme was removed on purpose.
- **Don't** introduce a drop shadow or an elevation scale. Every `--shadow-*`
  is `none` by decision.
- **Don't** read the `shadow-lg` and `shadow-xl` classes already in the tree as
  permission — and don't leave them where they are either. Six surfaces ask for
  a shadow against tokens that resolve to `none`: `SOLID_PANEL` in
  `lib/glass.ts` (`shadow-xl shadow-black/40`), `SelectionBar`, `OutboxBanner`,
  `QuickAddSheet`'s note-suggestion list, `QuickAddProvider`'s floating
  quick-add button and `SwipeToast`, each with `shadow-lg`. All six state an
  intent the system forbids and render nothing, so the classes are dead
  declarations that read as approval to the next person. This is a known
  contradiction and it is recorded here unresolved: resolving it means deciding
  per surface whether it needs an edge it can actually have — a hairline, a
  surface value step, or a heavier glass weight — and then deleting the dead
  class. It does not mean giving `--shadow-lg` a value, which would undo The
  Flat-With-One-Exception Rule that made these tokens `none` in the first
  place. Until that pass happens, do not add a seventh.
- **Don't** add a fourth marketing grey or a fourth display clamp. Both counts
  are the result of a deliberate reduction.
- **Don't** reach for a second display typeface to signal importance; headings
  are the body sans at 600.
- **Don't** colour an amount by whether it is positive or negative.
- **Don't** spend Lamplit Gold on decoration; its semantic and emphatic uses are
  the whole of its job.
- **Don't** hard-code a hex, an alpha literal, or a duration where a token
  exists — the ten alpha literals and the twenty-eight type triples are exactly
  what this system was consolidated out of.
- **Don't** use Fraunces for headings or prose, and don't let a figure set in it
  lose `tabular-nums`.
