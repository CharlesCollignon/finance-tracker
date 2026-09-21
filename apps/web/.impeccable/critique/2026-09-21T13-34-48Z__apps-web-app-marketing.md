---
target: apps/web marketing surface
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 4
target_identity: "file:/home/charles/Code/charles/finance-tracker/apps/web/apps/web/app/(marketing)"
timestamp: 2026-09-21T13-34-48Z
slug: apps-web-app-marketing
---
Method: dual-agent (design review + detector, isolated, neither told what had changed). No browser automation; static evidence only.

## Design Health Score — Marketing (Persuade): 19/32 (59%, Acceptable)

Two heuristics n/a this run (7 Flexibility and 10 Help), against one last run (7 only), so the maximum moved 36 to 32 and the runs are not like-for-like. Compare the percentages: 61% to 59%.

| # | Heuristic | Score | Was | Key issue |
|---|---|---|---|---|
| 1 | Visibility of System Status | 2 | 2 | No section is ever marked current; FadeContent hides server-painted HTML then fades it back |
| 2 | Match System / Real World | 2 | 3 | "reconciled" in hero and footer is the word CONTEXT.md forbids; PEA/CTO/AV/PER unglossed to a euro-zone audience |
| 3 | User Control and Freedom | 3 | 3 | Good dismissal; a feature page ends on prev/next with no CTA |
| 4 | Consistency and Standards | 1 | 2 | 4 cast shadows, 3 hover lifts, 25 text-white, 10 raw alpha literals, gold in 8+ non-permitted roles |
| 5 | Error Prevention | 3 | 3 | Type-level translation guarantees are exemplary |
| 6 | Recognition Rather Than Recall | 3 | 3 | App icons reused in the feature grid; hero exampleNote depends on a concept introduced 800 words later |
| 7 | Flexibility and Efficiency | n/a | n/a | One path by design |
| 8 | Aesthetic and Minimalist | 3 | 2 | IMPROVED. Ornament disciplined; held off 4 by prose volume, not clutter |
| 9 | Error Recovery | 2 | 2 | Locale failure is console.error only; no forced-colors fallback for the transparent-fill headline |
| 10 | Help and Documentation | n/a | 2 | Re-scored n/a: the seven feature pages are the explanation and there is no help system to score |

## What verifiably improved
- Focus rings: 24 of 24 interactive elements now carry the shared helper, with the offset colour named as the marketing ground.
- Contrast: all three greys pass AA. Faint raised 0.35 to 0.50, independently recomputed at 5.31:1 against 3.09:1 before.
- i18n: no user-facing literal in the marketing components bypasses the catalogues.
- The footer no longer contradicts the page.
- Aesthetic and Minimalist rose a point.

## Priority issues

### P1 — Three present-tense descriptions of a bank statement feed survive
features.body, pillars.items[1].body and pages.charges.steps[1].body all describe statement rows arriving. PRODUCT.md, rewritten in the same session, now says no surface may describe connecting a bank in the present tense and that the site says so in the future tense in one place only. Three others were judged true on the grounds that a CSV export is a statement. privacy.points[0] says "Nothing is read from your bank" on the same page, ~500 words apart. Command: clarify

### P1 — Both sparklines are outcome claims, and the comment above them says so
UNRECORDED_TREND falls 0.95 to 0.34; KEPT_TREND rises 0.30 to 0.66. The fix moved the first out of the hero into the month-close block rather than deleting it, and never touched the second. A slope is not a figure, so the adjacent "Example data" note does not label it. Command: harden

### P1 — The positioning is absent from the hero, and entirely absent above the fold on a phone
PRODUCT.md states it in three words: the month close. The hero says "Your whole month, on one quiet screen". The "Unrecorded" card is hidden below 640px. Command: clarify

### P1 — The privacy section alarms rather than reassures
It argues in database terms, "there is nothing to sell because there is nobody to sell it to" reads as no business model, and no /privacy, /terms, /legal, /about or /contact route exists. The footer's Privacy link resolves to the section itself. Command: clarify

### P2 — Four named DESIGN.md rules broken, with counts
Flat-With-One-Exception (4 shadows, 3 hover lifts), Three Greys (25 text-white, 10 alpha literals), Serif Is For Money (the site's own figures in mono beside mocks in Fraunces), Rare Accent (gold on ordinals, dt columns, bullet dots, meters, icon chips).

## Detector evidence
11 advisories in components/marketing, 4 in public/offline.html, 2 gradient-text warnings at globals.css. offline.html still ships a light theme as its default with a #4f2fd0 CTA.

## French parity defects
The product changes grammatical gender: elle throughout, but "Trois choses qu'il ne fera pas" and "Il ne déplace jamais votre argent" — the section heading and the last line of every page. One concept has two French names: "La série" from the catalogue against "Votre régularité" in the page copy. "Enveloppe" carries two unrelated money meanings on one page.
