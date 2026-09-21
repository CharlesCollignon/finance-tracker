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
  marketing-faint: "rgb(255 255 255 / 0.35)"
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

This is a dark system with no light counterpart, and that is settled rather
than pending. A warm paper theme shipped alongside this one and was removed:
it was the CSS default while every entry point sent users to dark, which meant
two palettes to keep honest and only one anybody saw. Designing a light variant
is not an improvement to this system; it is a reversal of a decision already
made.

Restraint here is specific, not general. There is one accent and it is used
rarely. There are no shadows at all, with one deliberate exception. There are
three marketing greys, because the site genuinely needs three and did not need
the ten alpha literals it had. There are three display sizes, because five
clamp ranges produced twenty-eight distinct size/weight/family triples across
eight pages. Each of these is a reduction that was made on purpose, and the
count is the point: adding a fourth grey or a sixth type step undoes the work.

**Key Characteristics:**

- Dark-only, on a cool near-black with a faint violet cast
- One accent — a warm gold — against an otherwise unsaturated field
- Flat by rule; depth comes from surface value steps and hairlines
- Serif numerals for money, sans for everything that is words
- Controls that answer a press immediately and precisely, then stop

## Colors

An unsaturated field of cool near-blacks with a single warm accent, plus a
small set of status hues that appear only where a state has to be told apart.

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
  **Marketing Faint** (`/ 0.35`). Three, doing three jobs, replacing ten alpha
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

**The Semantic Amount Rule.** An amount's colour says what kind of money it is —
income, expense, savings or investment — never whether it is positive or
negative. Do not colour an amount by sign, and do not invent a fifth category
colour.

**The Three Greys Rule.** Marketing text uses exactly three opacities: 0.85,
0.55, 0.35. A fourth value is a decision nobody made — reach for an existing
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
never lift off the page, and there is no hover elevation anywhere.

Depth is built two ways instead. First, surfaces step in value: marketing
ground `#06060a`, page `#0a0a10`, sidebar `#0d0d15`, card `#131320`, raised
`#1c1c2b`. Second, hairline borders separate what value alone leaves ambiguous.

There is exactly one exception, and it is a recess rather than a lift.

### Shadow Vocabulary

- **Bezel Inset** (`box-shadow: inset 0 1px 1px rgba(255, 246, 230, 0.08)`):
  A single warm highlight along a card's top inner edge, inside the tray of
  `Card.Bezel`. It reads as machined material catching light, not as the card
  floating.

### Named Rules

**The Flat-With-One-Exception Rule.** No element casts a shadow. The only
depth cue in the system is the bezel's inset highlight, and it describes a
recess. If something needs to feel separate, step its surface value or give it
a hairline — do not reach for a drop shadow, and do not add an elevation scale.

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
- **Background:** Card surface on the page ground.
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
- **Do** build depth from the surface value steps and hairlines already
  defined, in that order.
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
