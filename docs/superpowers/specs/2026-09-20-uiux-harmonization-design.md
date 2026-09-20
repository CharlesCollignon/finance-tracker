# One vocabulary for three surfaces

**Date:** 2026-09-20
**Status:** Approved — phase 1 shipped, phases 2 to 6 outstanding

## What this changes

Nothing about what the app says, and almost nothing about what it looks like
from across the room.

Four vocabularies that do not exist get written down — a radius scale by role,
a card inset, the two motion durations the clients already invented, and three
greys for the marketing site — and then every screen on both clients stops
choosing those values by eye and starts spending them. The sidebar's sections
stop folding. Controls that a finger has to hit reach the size of a finger.

The measured result: six radii become four roles, 33 padding values become
three insets, ten dimmed whites become three, and 30 arbitrary type sizes on
the web plus 29 on the phone come back onto a scale.

## Why

From `2026-09-20-uiux-audit-findings.md`: the foundations are good and the
screens do not use them. There is one palette, one easing curve, one icon
scale and one figure scale, all documented and honoured. Beside them sit 33
padding values in the app's component trees, 11 radii, 20 type sizes, ten
alpha literals on marketing, and a `DURATION` with no entry for the only kind
of motion most of the product actually performs.

This is not a design problem in the sense of taste. Every number here was
chosen reasonably by someone looking at one screen; what is missing is the
thing that makes the next screen agree with it. The audit's own evidence for
that: marketing independently drew `rounded-[1.25rem]` and `rounded-[1.6rem]`
— 20px and 25.6px — which are, to within half a pixel, the `card: 20px` and
`shell: 26px` the phone had already reasoned its way to in a config file the
marketing author had no reason to read. Two people with good eyes arrived at
the same numbers twice. A token is how that stops being a coincidence.

## What was already here

Three findings shrink this work considerably.

**The phone already holds the radius answer, with its arithmetic.**
`apps/mobile/tailwind.config.js`: `card: 20px`, `shell: 26px`, and the note
that "26 outer − 6 of bezel padding leaves exactly the 20 the inner surface
uses." That is the whole scale, already reasoned. It is used seven times.

**`DURATION` is not being ignored.** Its three entries are spent faithfully by
`AnimatedAmount`, `Stagger`, `FadeIn`, `BearingCards`, `Spine`, `BranchedNav`
and `ToastProvider`. They all describe arrival. Nothing describes response,
which is why response was invented locally 41 times.

**The split between shared and per-client is settled.** `motion.ts` states it:
"the shared truth lives once, and each client adapts it to its own animation
engine." Numbers live in `packages/core`; rendered class strings live per
client with a documented counterpart, the way `lib/type-scale.ts` names
`apps/mobile/src/theme/tokens.ts`. Everything below follows that rule rather
than inventing a third pattern.

## The radius scale

Four roles, no sizes. A caller names what the thing _is_, not how round it is.

| Role      | Value | What wears it                                          |
| --------- | ----- | ------------------------------------------------------ |
| `control` | 10px  | buttons, inputs, chips, menu rows — anything you press |
| `card`    | 20px  | a surface holding content                              |
| `shell`   | 26px  | a surface holding cards, concentric with `card`        |
| `pill`    | full  | actions and badges that are fully round                |

`control` is today's `--radius: 0.625rem` unchanged, so the most-used step
moves nothing. `card` and `shell` come from the phone, and marketing has
already drawn both by hand.

What this costs, honestly: `rounded-md` (8px, 28 uses) becomes 10, which
nobody will see, and `rounded-lg` (21 uses) is already 10 and does not move.
`rounded-2xl` (16) and `rounded-3xl` (24) become 20, which is visible on the
surfaces that wear them, and is the point. Marketing's `rounded-[2rem]` (32)
comes down to 26.

Both clients declare the same four names in their own Tailwind config, which
is how the phone already does it. Neither client keeps `sm`/`md`/`lg`/`xl`/
`2xl`/`3xl` in use; the aliases stay defined so third-party vendored
components keep compiling.

## The inset scale

Three, and a rule about where the fourth would have come from.

| Role   | Value              | What takes it                  |
| ------ | ------------------ | ------------------------------ |
| `card` | 20px (`p-5`)       | the padding inside any card    |
| `row`  | 12px (`p-3`)       | a dense row in a list or table |
| gutter | 16px, 24px at `md` | the page's own edge, unchanged |

20px is not a compromise: it is what the phone converged on by itself, `p-5`
in 36 of its 54 surface paddings, and the web's single most common card inset
at 35 uses.

The reason the app shows 33 values and not five is the fourth role that should
not exist. Counted across the route trees, `px-3`, `py-2`, `px-4`, `py-1.5`
and `py-2.5` lead the table, and they are overwhelmingly the padding of
_controls_ — buttons, inputs, pills, badges — set at the call site. Those
belong to the component, not to the screen using it. So the rule is: a
control's padding lives in the control, and a screen may set `card` or `row`
and nothing else. That is what collapses the count; a fourth token would only
have given the sprinkling a nicer name.

## The motion tokens

Two entries added to `DURATION` in `packages/core/src/motion.ts`:

```ts
/** A surface answering a press. */
press: 140,
/** A surface answering a pointer arriving or leaving. */
hover: 200,
```

`hover: 200` is exactly what the web already writes in its 28 `duration-200`
call sites, so the web's feel does not change at all — only the number's
provenance does. `press: 140` sits between the phone's 120 down and 150
release. Those two were never documented as a deliberate asymmetry; if they
were, this token grows a second entry rather than the call sites growing two
more literals.

Spending them: the web gains `duration-press` and `duration-hover` through the
`transitionDuration` extension in its Tailwind config, fed by the same
numbers; the phone imports `DURATION.press` where it currently writes `120`.
No arrival timing changes.

The phone's `Skeleton` shimmer at 850ms is left alone. It is a loop, not a
response, and a third category with one member is a worse answer than a
literal with a comment.

## Marketing's three greys

`text-white/30` through `/85`, ten literals, become three roles defined
alongside the other marketing custom properties in `globals.css`:

| Role    | Today's literals   | Used for                                |
| ------- | ------------------ | --------------------------------------- |
| `ink`   | /80, /85           | body text that has to be read           |
| `muted` | /45, /50, /55, /60 | supporting prose, captions              |
| `faint` | /30, /35, /40      | labels, rules, the footer's small print |

Three rather than two because the site genuinely has three jobs for a dimmed
white, and rather than four because /45 and /60 are not telling a reader
anything /55 does not.

These stay marketing's own and do not merge into `muted-foreground`: the app
sits on paper and the site sits on near-black, and one token spanning both
would have to be two values anyway.

## Type

The figure scale is already shared and correct and is not touched.

**The web app** has Tailwind's steps and escapes them 30 times. Each escape
resolves to the nearest step, except `text-[11px]` and `text-[0.6875rem]`,
which are `MICRO` — the token that already exists for exactly that size — and
should say so.

**The phone has no text scale at all.** Twenty-nine inline `fontSize` values
across ten sizes, because `TYPE` only ever described figures. It gains the
three the web's steps already imply, mirroring them the way `TYPE.micro`
mirrors `MICRO`: `body: 14`, `label: 12`, `title: 18`. The remaining sizes —
9, 10, 16, 17, 22, 26, 48 — map to the nearest of those or to a figure step.

**Marketing's display** keeps `clamp()`, because a headline that does not
scale with the viewport is the wrong fix, but stops running five different
clamp ranges. Three: hero, section, sub.

**One label renders in Arial.** The `<text>` in `components/magicui/safari.tsx`
names no family. It gets `font-sans` with the rest of the site.

## The sidebar stops folding

`BranchedNav` derives openness from where you are: `folded.get(href) ?? href
=== here`. That derivation, the `folded` state, the caret button, its
`aria-expanded`, the `grid-template-rows` transition and the `tabIndex={-1}`
on hidden rows all go. Every surface's views are always rendered and always
reachable.

What stays is the drawing — the trunk, the branch curves, the accent redraw on
the view you are in. That was always the valuable part; the folding was the
part that hid three of the five surfaces' children whenever you were
elsewhere.

## Controls a finger can hit

Forty-three interactive boxes in the app's components are under 44px — `h-9`
19 times, `h-10` 17, `h-8` four, `h-7` three. The same components draw the
phone-width layout, which is why the app has a bottom nav.

The shared `Button` and the input components take a 44px minimum at touch
widths and keep their current height from `lg` up, which is the shape the
marketing footer already uses since tonight's fix. This also settles the 404's
`Go home` at 95×38 without touching that page.

## What is deleted

- `BranchedNav`'s fold: the state, the caret, the transition, the two i18n
  keys `nav.collapseViews` and `nav.expandViews`.
- The six size-named radius steps from all call sites on both clients.
- Thirty arbitrary `text-[…]` sizes on the web and the phone's 29 inline
  `fontSize` literals.
- Ten `text-white/NN` literals on marketing.
- The 41 hardcoded response durations: 35 `duration-*` classes on the web and
  six inline `duration:` values on the phone.

## Words

Only removals: `nav.collapseViews` and `nav.expandViews` leave `en` and `fr`
when the caret does. `unused-keys.test.ts` will fail until they do, which is
the check working.

Every other change here is a class name. No user-facing string moves.

## What this deliberately does not decide

**The 1152px ceiling at 1920.** `layout-shell.ts` argues 72rem from the
Ledger's prose measure, and that argument is sound. Whether it is also right
for the Bearing's five cards is a question about a rendered screen, and the
app pass is the one thing the audit could not get. It stays as it is until
there is a screenshot to argue with.

**Dead space in the app.** Zero on every public screen; unmeasured on the
twelve app routes for the same reason. If "weird blank space" turns out to
live anywhere, it lives there, and no token in this document would find it.

## Phases

Each phase is a commit you can look at, in this order, because each spends
what the one before it defined.

1. **The vocabulary exists.** Tokens added to `motion.ts`, both Tailwind
   configs and `globals.css`. Nothing spends them. _Visible change: none —
   that is the point of it being its own phase._
2. **Corners agree.** Both clients move to the four radius roles.
   _Visible: 16px and 24px corners become 20px; marketing's 32px becomes 26._
3. **Cards breathe the same.** The card and row insets, and control padding
   moves into the controls. _Visible: the busiest screens lose their
   unevenness._
4. **Press and hover come off the token.** _Visible: nothing, deliberately._
5. **Marketing resolves.** Three greys, three display steps, the Arial label.
   _Visible: the site's text colours stop drifting section to section._
6. **The sidebar stays open, and controls reach 44px.** _Visible: the two
   things you asked for by name._

## Testing

The audit harness is the regression test, and it already is one — tonight's
two fixes were verified by re-running it and diffing the counts. Worth
promoting a trimmed version into the repo as `pnpm check:surfaces`, asserting
three things a screen cannot argue with: no horizontal overflow at any width,
no interactive box under 44px below `lg`, and no more distinct radii or card
insets on a page than the scale defines. A budget that fails loudly is what
stops a fourteenth padding value arriving next month.

Per phase: the existing suite stays green, and `unused-keys` gates phase 6.

## Risks

**Phase 2 and 3 are wide, mechanical and visible.** They touch most component
files on both clients. The mitigation is that they are separable per surface
and each is a diff of class names with no logic in it.

**20px may be wrong for the densest surfaces.** The Ledger's rows are the case
to watch: `row` at 12px is what they use today, but a table inside a card gets
`card` + `row` and may end up looking padded twice. Phase 3 should start with
the Ledger for that reason.

**One pre-existing failure is already red.** `src/still-to-come.test.ts`,
"totals exactly the gap between the current and month-end views", fails on a
clean tree and has nothing to do with this work. It should be fixed or
quarantined before phase 1, so that "the suite is green" means something while
these phases run.
