---
target: apps/web marketing surface
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 4
target_identity: "file:/home/charles/Code/charles/finance-tracker/apps/web/apps/web/app/(marketing)"
timestamp: 2026-09-21T15-22-15Z
slug: apps-web-app-marketing
---
Method: dual-agent (design review + detector, isolated, neither told what had changed, neither permitted to read prior snapshots). No browser automation; static evidence only.

## Design Health Score — Marketing (Persuade): 25/40 (62.5%, Acceptable)

Scored across all ten heuristics this run, against 19/32 with two n/a last run, so compare the percentages: 59% to 62.5%. The reviewer argued 7 and 10 have real material here (a grouped Product menu, prev/next chaining, seven task-focused feature pages) and that marking them n/a would hide that both are materially incomplete.

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | No aria-current on the active nav item; a failed locale change shows nothing |
| 2 | Match System / Real World | 3 | Both locales name concepts exactly as the app's catalogue does; "Bearing" and four French tax-wrapper acronyms arrive unglossed |
| 3 | User Control and Freedom | 3 | Escape closes menus but does not restore focus to the trigger |
| 4 | Consistency and Standards | 2 | Hero money in mono while the mocks beside it use Fraunces; three h2 treatments; gold in five unsanctioned roles |
| 5 | Error Prevention | 3 | isLandingPageId, generateStaticParams and a Record type make a dropped translation a compile error |
| 6 | Recognition Rather Than Recall | 3 | Feature cards reuse the app's own nav glyphs; current page signalled by tint alone |
| 7 | Flexibility and Efficiency | 2 | Anchors for 2 of 9 sections; the month close has none; no skip link |
| 8 | Aesthetic and Minimalist | 2 | ~1,100 words across nine sections, most at one weight |
| 9 | Error Recovery | 2 | offline.html overstates recovery: the outbox wraps quick-add alone |
| 10 | Help and Documentation | 2 | Seven good feature pages; no pricing, FAQ, contact, policy, terms or legal entity |

## Verified clean by the detector
Zero shadows (only comments explaining the removals). Zero resting off-token text colours. 24 of 24 interactive elements carry the shared focus ring. Every contrast value passes AA, and the published arithmetic reproduces to the decimal — though 5.23:1 for faint on glass is the middle of a range whose floor is 5.15:1. Three clamps, three tokens, five call sites, zero strays. public/offline.html is exemplary: bilingual without a catalogue, dark-only with the reasoning recorded, 44px target, focus ring, reduced-motion branch.

## Priority issues

### P0 — The month-close mock contradicts the figure it exists to prove
On /features/month-close the panel headed "How it adds up" lists opening 4,180, recorded in +3,200, recorded out -1,953, closing 4,906. That arithmetic gives 5,427, a gap of 521 against a headline claiming 218 unrecorded. Root cause: the February close reuses March's flows from the top-level sample. The same card reads "March 2026 is ready to close" beside a button "Close February 2026". This is the destination of the primary proof path, in front of the one audience guaranteed to do the subtraction. Command: harden

### P0 — No privacy policy, terms, legal entity or contact
No /legal, /terms or /privacy route exists. The footer's Privacy link points at a marketing anchor. The product asks a euro-zone individual to type their salary and portfolio behind a signup, and nothing makes any of the four privacy promises binding. GDPR Art. 13 and, for the French market, mentions legales. Command: shape

### P1 — The mocks advertise navigation the app no longer has
LandingMocks paints the gold rail marker, the gold active pill, the gold branch stroke and the gold active tab that the accent pullback removed from the app three commits ago. The mocks' own docstring promises the picture and the thing it depicts cannot drift; the structure is shared and the colour was hand-written.

### P1 — The differentiating figure is hidden on every phone
The unrecorded GlassStat is hidden sm:block, so below 640px the hero shows only a left-to-spend figure, which is what every budgeting app shows. Command: adapt

### P1 — The accent is spent on decoration while the role it exists for sits empty
Gold on step counters, dt labels, seven card icons, meter fills and bullet dots — five unsanctioned roles, roughly nineteen instances — while the third sanctioned home, a figure that leads a screen, is unoccupied: every GlassStat value renders marketing-ink. The marketing surface never received the sweep the app got. Command: colorize

### P1 — The page is an essay set in the third grey
~1,100 words across nine sections, with monthClose and monthRead duplicating inline what their feature pages already say in three steps each. Command: distill

## Detector evidence
11 advisories in components/marketing, 1 in public/. The hero headline's four colours remain outside the palette, and its weight (500) and line-height (0.98) deviate from the documented display step. The marketing hairline tokens exist and have zero call sites while twelve alpha literals do their job. Five unreferenced create-next-app scaffold SVGs ship in public/. No @media print fallback for the background-clip headline.
