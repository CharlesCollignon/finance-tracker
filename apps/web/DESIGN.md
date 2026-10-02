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
  lamplit-gold: "#ecb25e"
  lamplit-gold-hover: "#f2c27a"
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
shows through — so they are quiet _against_ something they admit rather than
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

- **Lamplit Gold** (`#ecb25e`): The only warm thing in the system and the only
  colour permitted to carry emphasis — an orange-gold since October 2026,
  moved with the orb so the accent and the mark read as one brand colour. At
  10:1 against the page it is legible as text, not just as fill, so it serves
  as both the primary button's ground and an emphatic figure's ink. Also the
  focus ring.
- **Lamplit Gold Hover** (`#f2c27a`): The lift on a primary control's hover.
  The only state change a primary button makes to its fill.

### Neutral

- **Frame** (`#040406`): The desktop shell's bezel and the notch cut from it —
  the one surface darker than the page, so the page reads as a lit pane set
  into it.
- **Cool Near-Black** (`#0a0a10`): The application page. Also the ink used
  _on_ the accent, since dark-on-gold is the only readable direction there.
- **Marketing Ground** (`#06060a`): The public site, one step deeper than the
  app so a lit artefact over it reads as a thing giving off light.
- **Sidebar Ground** (`#0d0d15`): The value step between the marketing ground
  and the page. It named the navigation rail's ground; the rail became the
  desktop's bezel and notch, which are Frame, so nothing on the web paints it now and
  the token stays for the step it marks.
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
  column's optical centre, which is the middle of the window at every width.
  It sat at 58% on a desktop while a 224–256px side rail pushed the column
  right; the rail became the top bar, and the light came back to 50%.
- **Bloom Violet Deep** (`rgba(124, 58, 237, 0.24)`): The main light's second
  stop, at 44% of its radius. One stop falls off like a spotlight; the second
  is what makes it fall off like a room.
- **Offstage Magenta** (`rgba(232, 74, 178, 0.26)`): A second source high on
  the right, placed as though it were out of frame. One centred glow reads as a
  spotlight; two of different hue, size and position read as depth.
- **Rail Indigo** (`rgba(88, 52, 196, 0.26)`): Down the left edge. Its one job
  was to keep the navigation rail from reading as a separate black panel
  bolted onto a coloured page. The rail is gone, so for now it only colours the
  left of the room; it is the first stop to question if the bloom is ever
  redrawn.
- **Bounce Purple** (`rgba(84, 48, 160, 0.30)`): The bounce along the bottom.
  Without it the lower half of the page is dead black and the whole thing reads
  as a bloom pasted onto a void rather than as a lit room.

**Lamplit Gold at 10%** (`rgba(236, 178, 94, 0.10)`) closes the stack, low and
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
- **Savings** — Lamplit Gold (`#ecb25e`)
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
screen, a savings amount (systematically), and a moment (see Moments): a
milestone reached, a cushion rung lit, a run of month-ends still alive, a month
closed, the inbox emptied. Outside those, a surface that reaches for it in three unrelated places has spent it. The semantic use is not
an exception to this rule so much as the proof of it: gold means something
specific, which is why scattering it elsewhere costs so much.

The count is now true rather than aspirational. An audit found the accent in
roughly twenty-three roles across ninety-eight call sites — navigation pills,
badges, avatars, switches, chips, calendar days, meters, toasts, chart swatches
and inline links — and every one outside the four above was taken off. What
replaced them is the token that already carried the meaning: foreground against
muted for an active state, a hairline or a surface step for a selection, a chart
colour for a chart. Two decorative glows that ringed every card on the Bearing
went to foreground for the same reason. Read the homes as a description of
the code, not a wish about it, and add another only by changing this paragraph
first.

The fifth, celebration, came with the Plan page in October 2026 and was at
first held to that one surface. Later that month the owner widened it from a
surface to _moments_: something the user did, said back to them where they did
it. Gold there still means _done_: a milestone passed is the orb in its warm
light, a milestone ahead is a neutral bar; a lit rung is gold, an unlit one a
hairline ring; the flame is gold while the run lasts and grey when it ends; a
closed month's Kept counts up in gold. Gold on anything that is not a moment is
still the accent spent.

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

The application is a shell. On a desktop the page is a rounded pane set into a
`0.5rem` bezel in Frame, with one notch of the same colour hanging `3.5rem`
below the bezel at the top centre holding the five surfaces and the add
button, and the wordmark and the shared controls on the page either side of
it. There are no page titles on a desktop — the notch says where you are — so
a page's own header only appears, at `3.25rem`, when it has controls of its
own, like the Ledger's month. On small screens the page header is the only bar at
the top and a bottom navigation bar at `3.5rem` with a `0.75rem` inset is the
nav, both respecting `env(safe-area-inset-*)` through the `pt-safe` and
`pb-safe` utilities.

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
ground with translucency, and the phone is the _more_ opaque of the pair: its
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
  `backdrop-saturate-150`, over `border-border`): Header bands. Structure, not
  content, and it has to stay legible over anything that scrolls under it.
  Used by `PageHeader` on a phone. The desktop's chrome is the bezel and its
  notch, which are opaque Frame rather than glass: content scrolls behind
  them, not under a blur, and a light frost (`.app-topbar-scrim`) comes up
  behind the wordmark and actions once it has — a blur rather than a fade to
  the page's colour, so the notch keeps light around it.
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
rather than a plan. The `Card` component in `components/ui/Card.tsx`
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
- **Orb Glow** (`box-shadow: 0 0 calc(var(--orb-size) * (0.18 + 0.32 * var(--orb-pulse)) + 1px) calc(var(--orb-size) * 0.06 * var(--orb-pulse)) rgb(var(--orb-c2) / calc((0.2 + 0.3 * var(--orb-pulse)) * var(--orb-glow)))`):
  `.pc-orb`, on both surfaces, and the one light the system casts outward. The
  orb breathes: `--orb-pulse` rises from 0 to 1 and back over a little under
  six seconds, and the halo swells with it while a warm light rises inside the
  shell (the first gradient of `.pc-orb::after`). It is the brand's own light,
  not elevation — it says nothing about where a box sits — and it stops at its
  rest state under reduced motion. Sized off `--orb-size`, which `Orb` sets
  from its `size`: on a query container's own box a `cqw` measures the
  container above it, not the orb. The phone draws the same breath with a
  halo view and an inner light layer in `Orb.tsx`.
  Six entries, and exactly two of them carry anything cast: the drop inside
  Marketing Panel Glass and the drop inside Marketing Menu Glass. The Orb Glow
  is outward too, but it is light, not shadow — the mark's own colour around the
  mark, never a surface sitting above another. Everything else here is an inset
  — light drawn on a surface, which is how a system that refuses elevation can
  hold this many and stay flat.

### Named Rules

**The Flat-With-One-Exception Rule.** No element casts a shadow (the orb's
breathing glow is the brand's light, not a shadow, and lives on the orb alone). The only
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
holds five inset declarations against two drops. (The landing hero's Earth
draws its light in WebGL; its fallback, for a browser without it, rims a dark
ellipse with a glow — light, like the orb's, and never seen beside the
canvas.) An inset puts nothing in front
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
  Hover raises the fill to `#f2c27a`.
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

- From `md`, the bezel (`.app-frame`) and one notch cut from it (`TopNav`),
  centred, holding the five surfaces and, at its end, the add button as a
  gold "+" disc (its name in the tooltip and for screen readers). The notch is square where it meets the
  bezel and round where it faces the page, and concave fillets (`NotchWing`)
  turn its square corners into the bezel's line. The wordmark (left) and the
  refresh, privacy blur and account (right) sit on the page itself, on the notch's row line, with no
  ground at rest; once the page scrolls, a frost comes up behind them so
  nothing is read through them, and the top of the pane keeps its light. The bezel is an outline on a
  fixed element over the page, so the document still scrolls as a document.
- In the centre notch the surface you are in is a pill of Raised Surface and a
  filled icon. The pill is one Motion `layoutId`, so it slides to the next
  surface rather than a second one lighting up; the layout engine behind it
  loads after the page (`lib/motion-features`), and reduced motion moves it
  without the slide. Below `lg` the other surfaces drop to their icon.
- The bar's classes live in `lib/nav-notch` and the notch's wings in
  `components/layout/NotchWing`, both shared with the marketing mock that
  pictures them.
- A surface's views (the Ledger's three, the Wallets' two) are the tab strip
  at the top of the surface, at every width; the nav names only surfaces.
- The page header at `3.25rem`: on a phone, sticky, on Chrome glass with a
  hairline beneath, holding the orb, the title, the page's controls, the
  refresh, the blur and the account menu. From `md`, only the page's own controls, static and
  bare; the title stays in the document as the page's `h1` for screen readers
  but is not drawn, and a page with no controls draws no band at all.
- On small screens a bottom bar at `3.5rem` with a `0.75rem` inset, inside the
  safe area, holding the surfaces and nothing else. There, active state is
  carried by foreground colour and the icon's fill, not by a pill or an
  underline, and a label shrinks with its slot, from 10px down to 8px,
  rather than lose its end.

### Moments

A moment is something the user did, said back to them where it happened: a
milestone reached, a cushion rung lit and the run kept alive on Plan, a month
closed in the close sheet, the review inbox emptied, and a loan half repaid
or repaid on its card. It replaced, in October 2026, the rule that
only Plan celebrates. The allowance is specific:

- **Real and measured.** Every moment is a fact about the user's own money or
  habit, worked out in `@finance/core` — never points, a level, a score or a
  badge for opening the app. The landing page's « Aucun conseil. Aucun score. »
  stays true.
- **Once.** A milestone is celebrated once per account
  (`user_preferences.milestone_seen`), on whichever device sees it first; a
  close's moment belongs to the close that earned it.
- **It arrives, then rests.** The pop and the flame live in
  `components/motion/moments.module.css`, and a figure counts up through
  `AnimatedAmount` with `startFrom`. Nothing moves across the screen, there is
  no confetti, and reduced motion lands on the final state.
- **Gold on the moment only** — the figure or the pill that is the news, never
  the card around it.
- The phone adds a success haptic; the web has none to add.

**A month closed.** What the month kept counts up from zero in gold and, when
the close extended the run past one month, a pill with the flame pops in once
the count has landed: « Série prolongée : 4 mois d'affilée », or « Nouveau
record » when it beat the best run before it (`runMoment`,
`packages/core/src/month-close.ts`). A month that cost more than it brought,
and a baseline, are told as before, without a moment.

**A loan's moment.** Half a loan repaid, or its last payment made, puts a gold
pill beside its name on the property's page — « La moitié est remboursée »,
« Prêt remboursé » — for the month after the day (`loanMoment`,
`packages/core/src/property-moments.ts`). It happens while nobody is looking,
so the device remembers that it popped (`components/motion/use-moment-seen.ts`)
and the pill rests from then on; a push said it on the day.

**The inbox emptied.** When the last group is filed, « Tout est classé. »
pops in with a gold tick, and under it how many shops were just filed under a
category — « 3 commerces appris pour la prochaine fois. » — which is what the
next sync learns from. Counted, not guessed: the groups filed in that sitting.

### Plan: Where Moments Gather

Plan (`components/finance/plan/`) is where the money is heading: a year from
now with an "Et si…" slider, the milestones and the cushion, the long view
after French tax, and the run of month-ends with what each one saved. Most of
the app's moments live here, and the allowance is specific:

- **Gold means done.** Reached milestones (the orb, `tone="mark"`, in a glow of
  `--primary` drawn as a radial light, never a shadow), lit cushion rungs, the
  live flame, and the savings bars, which are gold because they are savings.
  Everything still ahead is neutral.
- **Motion arrives, then rests.** Curves draw in once (`balance-curve-draw`),
  the long view's stack rises from its baseline once, bars grow in one after
  another, badges pop past their size and settle — all on the one curve, in
  `plan.module.css`, whose pop and flame are the shared moments'. The only loops are the flame's sway and the glow's
  breath, both in place, and both switched off under reduced motion.
- **Play answers at once.** The slider, the horizon and every field of the
  long view redraw immediately; a calculator that animates between answers is
  one you wait for. The headline figures count to their new value.
- **The long view is a calculator, and says so.** It opens on the user's own
  figures and the 2026 French rates, every input is theirs to change, the
  edits stay in this browser, and "Revenir à mes chiffres" goes back. The
  milestones never read those edits: they are about money that exists.
- **What the future is made of, quietly.** Under the long view's net value, a
  1.5px bar of each account's share (2px seams, chart tokens in the accounts'
  order, never gold) and one muted line naming them, four at most and the rest
  as "Autres". It follows the year the chart is being read at; which accounts
  are named, and so their colours, is decided at the horizon and held while
  the chart is scrubbed — a colour follows its account, never its rank.

### Placements: The User's Own Accounts

Placements lists the accounts the user keeps — declared savings accounts
first (Livret A, LDDS, LEP, CEL, PEL, another livret), then the wallets with
holdings or that they added — as one row of chips ending in "+ Ajouter un
compte". Nobody is shown an account they do not have. The hero is the whole
patrimoine, savings and investments, with the split under it.

- A savings account's panel is a balance and four plain facts (rate, tax,
  ceiling, each month), not a list of holdings; its few editable things open
  in place, one field and a save.
- Removing an account asks in place, with the sentence that says what goes,
  then a destructive outline button. No dialog: the question is about the
  panel it sits in.
- The add sheet adds a wallet on the press; a savings account asks one
  question — its balance, or the bank account that reports it — and a rate
  only for the two accounts whose rate is not fixed by law.
- Three tabs: **Comptes** (one account at a time: its panel, and the PEA's
  ceiling and five-year card under the PEA), **Analyse** (all accounts at
  once: the yearly return — a savings account's is its rate after tax — the
  split with its targets, and the fees) and **Composition**. A question asked
  of every account belongs on Analyse, never under one account's panel.
- The monthly tags under the hero cover every account something goes into
  each month, wallets then savings accounts, in the same pill.
- The split covers every account kept, savings accounts included; its bars
  are one colour, and the label says which account.

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
switched off entirely. The hero's Earth (`components/marketing/LandingEarth.tsx`,
WebGL) follows the same setting on its own: under reduced motion nothing
twinkles, the stars stop drifting, and the aurora's curtains, the black hole's
disk and the distant sun's glow hold still. Its light never follows the pointer
on the landing; it rests in the distant sun.

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
