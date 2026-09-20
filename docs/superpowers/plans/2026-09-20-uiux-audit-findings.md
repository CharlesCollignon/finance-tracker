# What the three surfaces actually measure

The brief: audit the UI/UX of every screen on the web app, the phone and the
marketing site; fix bad margins and padding; leave no weird blank space;
harmonize type, hover, and animation; and make the web app's left menu always
open.

This document is the audit half. It reports what was measured, what turned out
not to be wrong, and what is. The spec that follows will argue about what to do
with it; nothing here proposes a change.

## How it was measured

The eleven routes that need no session — the whole marketing site, both auth
pages and the 404 — were loaded in a real browser at four widths, 375, 768,
1280 and 1920, and asked what they had actually drawn: computed radii, padding
quads, font size/weight/family, transition durations, the box of every tappable
thing, the document's scroll width against the viewport, and every vertical run
between stacked siblings that neither a gap nor a margin accounts for. That is
44 captures, all of which succeeded.

The web app's own routes and the phone's screens are read from source instead,
each for its own reason, both given under "Still owed". Where a finding below
is counted rather than measured, it says so.

Reading ninety screenshots would have been slower and less precise than asking
the page for numbers, so the numbers come first and the screenshots are looked
at where the numbers point.

The evidence lives in `.ux-audit/`, which is gitignored: the app screenshots
contain real account data and must never reach a commit. Each pass writes its
report after every capture rather than at the end, because the first attempt at
this audit lost everything it had measured when its scratch directory was
cleared.

Three corrections were made to the method along the way, each of which changed
what the numbers said:

1. **Reduced motion voided the motion measurement.** The first pass asked the
   browser for `prefers-reduced-motion: reduce` to keep screenshots still. The
   app honours that flag, so every transition computed to `1e-05s` and the
   duration inventory measured nothing. Screenshots are frozen per-shot
   instead, and motion is left alone.
2. **Entrances were measured mid-flight.** Marketing reveals blocks on scroll
   and translates them on the way in, so anything below the fold was measured
   while it was still moving. Each page is now walked top to bottom and given
   time to settle before anything is read.
3. **Collapsed margins read as dead space.** The detector credited a gap
   declared on the element itself, but `Rise` puts its `mt-16 md:mt-20` on a
   child of the div that reveals it, and that margin collapses out through the
   wrapper. Every marketing section therefore reported 64–104px of
   "unexplained" space that was in fact declared one level down. The detector
   now walks the collapse chain.

That third correction is the reason the headline finding below is a negative
one. Both earlier readings — first "three dead gaps per page", then "one per
page" — were artifacts of the tool, not defects in the site.

## What is not wrong

**There is no unexplained vertical dead space on any public screen.** Zero, on
all 44 captures, at every width. The vertical rhythm of the marketing site is
deliberate throughout: every gap of 56px or more is declared by a gap or a
margin somewhere in the chain. Whatever "weird blank space" means on these
pages, it is not a spacing defect — it is a question of proportion, which the
screenshots can argue about but the measurements cannot.

**The two surfaces already share their typefaces.** `--font-head` resolves to
`--font-sans`, so the app's headings and marketing's headlines are both
Instrument Sans; `--font-serif` is Fraunces, and marketing spends it on figures
exactly as the app does — 60px and 36px in the landing mocks, matching
`FIGURE_HERO` and `FIGURE`. An earlier reading of this audit called
`marketing-display` "the wrong face". It is not. It is the same family one
weight lighter, and `globals.css` records why: at that size the 600 of
`.font-head` "turns from confident into loud".

**The colour, easing and icon vocabularies hold.** One palette, one
`EASE_STANDARD`, one `ICON` scale, one figure scale with a documented web/phone
counterpart. The foundations are in better shape than the screens are.

## What is wrong

### 1. The landing page scrolls sideways on a phone — fixed

At 375px the document is 399px wide; at 768px it is 792px. Twenty-four pixels
of horizontal scroll at both, and only on the landing page.

The culprit is the bloom in `LandingDeviceStack.tsx:26` —
`marketing-bloom pointer-events-none absolute -inset-x-12 -top-16 bottom-0` —
which reaches 48px past each edge of a parent that has no clipping ancestor.
The orb's own blooms reach further still (149px past the right edge at 375) but
are clipped by an ancestor and cost nothing. The feature pages are saved by the
`overflow-x-clip` on their `<article>`; the landing page has no equivalent.

This is a bug, not a taste question.

**Fixed.** The section holding the second device stack — `id="read"`, at
`LandingPage.tsx:320` — never got the clip its twin in the devices section
above already had. It now carries `overflow-x-clip`, for the reason
`FeaturePage` gives in its own comment: `clip` contains the bloom without
making the section a scroll container. Re-measured: the document is 375px wide
at 375, and no capture at any width overflows.

### 2. The marketing footer cannot be tapped — fixed

Fourteen interactive boxes on every marketing page fall under the 44px minimum
at 375px, and ten of them are the footer's navigation: `Bearing`, `Ledger`,
`Charges`, `Plan`, `Wallets`, `Month close`, `Month read`, `Get started`,
`Sign in`, `Privacy` — each 18px tall. The header's logo link is 117×26, its
menu button 36×36, and its `Get started` pill 117×40.

Eighteen pixels is less than half the minimum, on the surface a visitor most
often meets on a phone.

**Fixed.** Every one of the fourteen now clears 44px at touch widths: the
footer links are `flex min-h-11` so the target is the whole column and not the
word, the two wordmarks and the nav pill ask for the height rather than
deriving one from padding, the menu trigger went from 36 to 44, and the phone
sheet's own rows went from 38 to 44. The footer relaxes again at `lg`, where a
pointer is aiming and 32px of pitch gives each 20px row its own 24px circle —
which is what WCAG 2.5.8 asks for. Re-measured across all 44 captures: at 375
and 768 every marketing page is now clean, where each had 14 and 15
respectively.

Two sub-44px targets survive elsewhere and are left alone deliberately. The
login page's `Sign up` is an inline link inside a sentence, which 2.5.8
exempts. The 404's `Go home` button is 95×38 — six pixels short, and it comes
from the app's shared `Button`, so raising it is a decision about every button
in the product rather than about this page. That belongs in the spec.

### 3. Radius has no scale on the web, and the phone ignores the one it has

The landing page alone draws five real corner sizes — 16, 20, 24, 25.6 and
32px — plus the pill, and across the public pass there are ten distinct radii.
Three of the five are bespoke: `rounded-[1.25rem]`, `rounded-[1.6rem]`,
`rounded-[2rem]`. In the web source, `rounded-md` appears 28 times, `xl` 23,
`lg` 21, `3xl` 15, `2xl` 10, `sm` 4 — six steps chosen by eye on top of a
single `--radius: 0.625rem`.

The phone has the answer: `apps/mobile/tailwind.config.js` defines radius _by
role_, `card: 20px` and `shell: 26px`, and records the arithmetic — "26 outer −
6 of bezel padding leaves exactly the 20 the inner surface uses."

But it barely spends it. `rounded-card` appears 5 times and `rounded-shell` 2,
against 49 uses of `lg`, `md`, `2xl`, `xl` and `3xl` on the same client. So
this is not "port the phone's solved problem to the web" as an earlier reading
had it — the phone has the vocabulary and mostly does not use it. Both clients
need to start spending it.

### 4. Card inset is seven values on the web, one on the phone

Web: `p-5` 35 times, `p-3` 34, `p-4` 29, `p-6` 19, `p-8` 10, `p-2` 10, `p-1` 6,
`p-7` 3. Phone: `p-5` 36 of 54, and nothing else above 7.

As drawn, the public pass counts 27 distinct padding quads, 13 of them on the
landing page — 20/20/20/20, 16/20/16/20, 14/28/14/28, 28/28/28/28, 32/32/32/32,
12/16/12/16, 10/20/10/20, 56/24/56/24 and more. The phone is the disciplined
one here, and this time it deserves the credit.

### 5. `DURATION` is incomplete, not ignored

Its three entries — `enter: 500`, `count: 650`, `panel: 420` — all describe
_arrival_, and both clients spend them faithfully: `AnimatedAmount`, `Stagger`,
`FadeIn`, `BearingCards`, `Spine`, `BranchedNav` and `ToastProvider` all import
them.

What has no token is **response to a press or a hover**, so every site invented
its own:

| Where                    | Duration          | What it is                   |
| ------------------------ | ----------------- | ---------------------------- |
| phone `Button`           | 120 / 150ms       | press down / release         |
| phone `QuickAddProvider` | 110 / 140ms       | press down / release         |
| phone `SegmentedControl` | 200ms             | thumb slide                  |
| phone `Skeleton`         | 850ms             | shimmer                      |
| web, 28 sites            | 200ms             | `transition-colors` on hover |
| web marketing            | 150 / 200 / 300ms | hover and CTA transitions    |

Measured on the public pages: 0.2s on 424 elements, 0.3s on 367, 0.15s on 16,
0.5s on 8. Only the last coincides with a token.

Forcing a hover onto `enter: 500` would be actively worse — a half-second hover
feels broken. The missing category is the finding: both clients independently
converged on roughly 120–150ms for a press and 180–200ms for a hover, which is
what the token should say.

### 6. Marketing has ten shades of dimmed white

`text-white/30`, `/35`, `/40`, `/45`, `/50`, `/55`, `/60`, `/70`, `/80`, `/85`
— ten alpha literals doing the job `muted-foreground` does in the app. The app
side of the same idea is two or three semantic steps.

### 7. The landing page runs 31 type combinations, and one of them is Arial

Thirty-one distinct size/weight/family triples on one page. The sizes come from
`clamp()`, so they land wherever the viewport puts them: 15.2px, 37.6px, 44px,
56px, 80px — off any scale, and different at every width. The app's steps are
discrete by construction.

One combination is `12px / 400 / Arial`, from the `<text>` in
`components/magicui/safari.tsx` — an SVG label with no font-family, falling
through to the platform default and outside the type system entirely.

### 8. Neither client has a scale for text — only for figures

`FIGURE_HERO`, `FIGURE` and `MICRO` on the web, `TYPE.hero/figure/micro` on the
phone: the figure scale is shared, documented and honoured. Everything that is
_not_ a figure is on its own.

The web at least has Tailwind's steps — `text-sm` 357 times, `text-xs` 151,
`text-base` 68, `text-lg` 22 — but escapes them 30 times with arbitrary sizes:
`text-[10px]`, `text-[11px]`, `text-[0.65rem]`, `text-[0.975rem]`,
`text-[0.95rem]`, `text-[1.75rem]`, `text-[3.25rem]`, `text-[4rem]`.

The phone has no step scale at all. Twenty-nine inline `fontSize:` values
across ten sizes — 9, 10, 11, 12, 16, 17, 18, 22, 26, 48 — none of which is a
`TYPE` entry, because `TYPE` only describes figures. The two clients therefore
cannot disagree about text type, because neither of them has said anything
about it.

### 9. The phone's own taps sit at or under the minimum

Measured from the source rather than from pixels, for the reason given below:
`h-11` (44px, exactly the minimum) appears 14 times, `h-10` (40px) 8 times and
`h-9` (36px) 6 times. Ten components pass a `hitSlop`, which widens the
touchable area past the drawn box — so some of those are fine and some are not,
and which is which needs the rendered screens to settle.

### 10. The web app spends 33 paddings, 11 radii and 20 type sizes

Read from source rather than from pixels — see "Still owed" for why. Each of
the twelve app routes was walked through its component tree (four levels of
local imports, 12 to 40 files per route) and inventoried:

| Route        | Files | Padding | Radius | Type | Gap |
| ------------ | ----: | ------: | -----: | ---: | --: |
| bearing      |    40 |      24 |      9 |    9 |   9 |
| transactions |    28 |      23 |      7 |   11 |  10 |
| calendar     |    28 |      23 |      7 |   11 |   8 |
| investments  |    36 |      21 |      9 |   10 |   9 |
| look-through |    23 |      21 |      5 |   12 |   6 |
| budgets      |    27 |      20 |      9 |   10 |   6 |
| recurring    |    23 |      20 |      7 |    9 |   6 |
| profile      |    20 |      20 |      5 |    6 |   5 |
| shell        |    23 |      20 |      8 |   11 |   5 |
| categories   |    19 |      19 |      7 |    9 |   7 |
| import       |    14 |      19 |      5 |    9 |   4 |
| history      |    25 |      15 |      8 |   10 |   7 |
| welcome      |    12 |      15 |      5 |   13 |   5 |

Across the app that is **33 distinct padding values** (`px-3` 87 times, `py-2`
77, `px-4` 56, `p-4` 52, `py-1` 38, `px-2` 38, `p-3` 37, `p-5` 36, `py-1.5` 35,
`py-2.5` 22 …), **11 radii**, **20 type sizes** and **11 gaps**. Even the
single busiest screen, the Bearing, uses 24 paddings and 9 radii across its 40
files.

The radius steps resolve to six real sizes — `--radius` is 10px, so `sm` 6,
`md` 8, `lg` 10, `xl` 14, then `2xl` 16 and `3xl` 24 — plus the pill, which is
used 134 times.

Motion inside the app is the tidiest thing here: only three duration classes,
`duration-200` 66 times, `duration-500` 12, `duration-300` twice. Which is the
same finding as §5 from the other side — 66 hovers at a number no token names.

### 11. Forty-three controls in the app are under the tap minimum

`h-9` (36px) appears 19 times in the app's own components, `h-10` (40px) 17,
`h-8` 4 and `h-7` 3 — against `h-11` (44px) 18 times. On a desktop pointer that
is a non-issue; the same components draw the phone-width layout, where 36px is
under the minimum and the app has a bottom nav precisely because it is used
that way.

### 12. At 1920 the app leaves 384px of backdrop on each side

`SHELL_HEADER_INNER_CLASS` and `PageContainer` stop at `xl:max-w-6xl`, 1152px.
`layout-shell.ts` records the reasoning: the ceiling was 90rem for the
two-column Month surface, Month was retired, and it was narrowed to 72rem so a
line of prose stops short of a tiring measure. That argument holds for the
Ledger's table and its prose. Whether it holds for the Bearing's five cards —
which are cards, not prose — is the open question, and it is the one finding
here that wants a screenshot rather than a source file.

### 13. The sidebar folds what you asked to stay open

Decided, not a defect: `BranchedNav` derives whether a section is open from
where you are — `folded.get(href) ?? href === here` — so a surface's child
views are hidden whenever you are elsewhere. The rail itself is already
permanent at ≥768px; it is the sections inside it that fold. The agreed change
is that they stop folding at all, which removes the derived state, the caret
and its two labels.

## Still owed

- **The web app's own routes, as drawn.** Google refuses OAuth in an
  automation-driven browser — "this browser or app may not be secure" — which
  is its anti-phishing check and it fires on the instrumented Chromium no
  matter who is typing. The alternatives were an app-scoped password set in
  Supabase, a throwaway account with no data, or reading the routes from
  source; the third was chosen. So §10 to §12 are counted from the component
  trees rather than measured from pixels, and three things stay unaudited on
  those screens because only a rendered page can show them: **dead space,
  horizontal overflow, and how the real figures wrap** at 375px with a
  six-figure balance in them. If those matter — and "no weird blank space" says
  they do — the app pass wants a session later.
- **The phone's screens as drawn.** Not obtainable in a browser without
  changing what is being audited. `expo start --web` was taken as far as it
  goes: its static web output had to become a single-page app before the phone
  could boot at all, then `Appearance.setColorScheme` threw against NativeWind's
  media dark mode, then — with the dark mode switched to class — the root
  layout died on `ExpoNotifications.getLastNotificationResponse`, which has no
  web implementation. Behind that sit blur, biometrics, passkeys and haptics,
  each with the same shape of failure. Three config changes bought two screens
  of an error overlay, so the attempt was stopped and every change reverted
  (`app.json`, `src/lib/theme.ts`, `tailwind.config.js` are all back as they
  were). The phone's findings above are therefore read from source against its
  own tokens, and they are less evidenced than the web's. Rendered phone
  screens need a simulator or a device, which is a decision to make rather than
  a thing to work around.
- **The 72rem ceiling at 1920.** `layout-shell.ts` explains the number and the
  explanation is sound for the Ledger's prose; whether it is right for the
  Bearing's five cards is a judgement to make against a screenshot, and that
  screenshot needs the app pass.
