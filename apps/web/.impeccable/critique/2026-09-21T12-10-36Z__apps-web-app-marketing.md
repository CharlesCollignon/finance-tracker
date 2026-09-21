---
target: apps/web marketing surface
total_score: 22
max_score: 36
na_heuristics: 7
p0_count: 1
p1_count: 3
target_identity: "file:/home/charles/Code/charles/finance-tracker/apps/web/apps/web/app/(marketing)"
timestamp: 2026-09-21T12-10-36Z
slug: apps-web-app-marketing
---
Method: dual-agent (design review + detector, isolated). No browser automation available; static evidence only.

## Design Health Score — Marketing (Persuade): 22/36 (61%, Acceptable)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Locale switch is a server round-trip whose entire feedback is opacity-60 (LocaleSwitch.tsx:68) |
| 2 | Match System / Real World | 3 | Mechanism-over-benefit held nearly everywhere; "Bearing"/"the run" arrive unglossed; nav landmark announces "Marketing" |
| 3 | User Control and Freedom | 3 | Escape/outside-click dismissal, scroll-margin for anchors; locale change has no undo |
| 4 | Consistency and Standards | 2 | text-white 25x against a three-grey rule; gold in 11 roles against a rule warning at three; drop shadows against a flat rule |
| 5 | Error Prevention | 3 | Touch targets raised deliberately with reasoning recorded; one swallowed failure path |
| 6 | Recognition Rather Than Recall | 3 | Feature icons deliberately match the app's sidebar glyphs; no current-location cue |
| 7 | Flexibility and Efficiency | n/a | A marketing page has one path by design; the only preference (language) is already in three places |
| 8 | Aesthetic and Minimalist | 2 | ~1,012 words; the most persuasive line on the site is its faintest text; accent spent across 11 roles |
| 9 | Error Recovery | 2 | Failed locale write is console.error only; a bad /features/<slug> lands outside the marketing shell in hardcoded English |
| 10 | Help and Documentation | 2 | Seven good feature pages, but no FAQ, contact, pricing, terms, privacy policy or company identity |

Heuristic 7 scored n/a, so the maximum is 36 and the band is read off the percentage.

## Design Specificity
Authored copy on a borrowed page. The copy could not be anyone else's — "Three things it will not do", "No amount of arithmetic over the rows can find what is not in them. The balance can." Strip the copy and the orb and the composition is 2024 dark-SaaS block for block. The site that invented "the serif is for money" sets every figure it states in its own voice in mono at text-white; Fraunces appears only inside the screenshots.

## Priority Issues

### P0 — The site sells a bank connection no ordinary signup can have
lib/bank/client.ts states it directly: "Two ways in exist, and only the first is wired." getBankConnection(userId) returns null unless userId equals OPEN_BANKING_OWNER_USER_ID; BankConnection.source has one variant, "owner-credentials"; Partner Connect "is a seam rather than an implementation". The claim appears in the hero tagline, the root meta description, pillar 1, twice in the privacy section, in the month-close body, and in two feature pages. landing-copy.ts's own header forbids exactly this: "Never promise what the app does not do... Writing around any of that would win a signup and lose the first session." PRODUCT.md asserts the connection as shipped fact, so docs and marketing agree with each other and disagree with the code. Command: clarify

### P1 — The footer contradicts the page, in both languages
landing-copy.ts:324 "No bank connection. No aggregator. No advice." and landing-copy.fr.ts:315. Rendered as the last line a visitor reads, 200px after the strongest CTA copy on the site. layout.tsx:39-41 records that the meta description was already fixed for this same stale claim; the footer was missed. Command: clarify

### P1 — Contrast and focus failures against a blocking requirement
--color-marketing-faint at 0.35 over #06060a computes to roughly 3.07:1, below the 4.5:1 AA floor, and carries real prose in at least ten places including the pillars heading, the footer disclaimer and prev/next on all seven feature pages. The Three Greys Rule bakes a contrast failure into a named token. Separately, only LandingCtas carries a designed focus ring; every other interactive element on the surface falls back to the UA outline. Command: harden

### P1 — The hero's two figures are fabricated, unlabelled, and one carries a trend line
LandingPage.tsx:144-160. UNRECORDED_TREND is twelve bars falling 0.95 to 0.34 — a claimed outcome rendered as data, above the fold, with the example-data note five sections away. PRODUCT.md: no benchmarks "may be invented, implied, or dressed up as placeholder content on any surface." Command: clarify

### P2 — The hierarchy is inverted and the accent is spent
pillars.heading, the best line on the site, renders at text-sm in the faintest grey. Lamplit Gold appears in 11 roles against a rule warning at three, so the primary button competes with eighteen decorations for the one colour meant to say "press this." Command: typeset

## Detector evidence
11 advisories in components/marketing (all font-size; 8 inside in-app mocks and arguably out of ramp scope), 0 in the route files, 4 in public/offline.html. Two gradient-text warnings at globals.css:576,579 — the only non-advisory findings in the tree — applying to all five .marketing-display headings, with three of four stops warm and undocumented. Rule compliance by grep: Three Greys VIOLATED (ten distinct white alphas plus 26 text-white), Three Steps PASS for display type, Serif Is For Money PASS, Flat-With-One-Exception VIOLATED (gold glow on the primary CTA, 60px black drop shadow on the phone frame, plus glass-panel and glass-menu shadows). public/offline.html ships a light theme as its default with a purple #4f2fd0 CTA.

## Strengths
1. The site is written twice, not translated once — the French refuses concatenation, localises merchant names, and carries correct guillemets.
2. The mocks are the app, not a picture of it — authored at real client sizes and scaled by viewBox; the sample arithmetic cross-references and holds.
3. Touch-target, motion and focus discipline most marketing sites skip, with the reasoning recorded in comments.
