# Decisions

Why Pluclair is the way it is. Each file records one decision: the context,
what was decided, what follows from it, and what not to do again. Most were
the owner's calls. The timeline below says when each part of the app arrived.

Read the relevant record before you propose something that touches it. If a
record says « Don't », don't bring it up unless the owner does.

## Records

| #                                             | Decision                                                              | Date       |
| --------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| [0001](0001-french-users-first.md)            | French users first                                                    | 2026-10-01 |
| [0002](0002-shared-core-and-parity.md)        | One set of rules, two apps with the same features                     | 2026-10-01 |
| [0003](0003-moments-not-a-score.md)           | Moments, not a score; habit from use alone                            | 2026-10-01 |
| [0004](0004-automate-what-was-instructed.md)  | Automate what the person already said; confirm what the app can't see | 2026-10    |
| [0005](0005-ai-on-the-persons-own-account.md) | AI runs only on the person's own account                              | 2026-10-09 |
| [0006](0006-no-tax-return-help.md)            | No tax-return help                                                    | 2026-10-09 |
| [0007](0007-ask-a-real-chat-advice-tiers.md)  | Ask Pluclair is a real chat, with advice up to tier 3                 | 2026-10-10 |
| [0008](0008-shared-space-is-an-owner.md)      | A couple's shared space: a space is an owner                          | 2026-10-09 |
| [0009](0009-bank-connection-owner-only.md)    | The bank connection is the owner's only                               | 2026-10-13 |
| [0010](0010-statements-you-bring.md)          | Statements you bring, through the same feed                           | 2026-10-13 |
| [0011](0011-apk-from-the-site.md)             | The Android app is an APK from the site; iPhone uses the home screen  | 2026-10-12 |
| [0012](0012-arrivals-fade.md)                 | Arrivals fade                                                         | 2026-10-25 |
| [0013](0013-plan-on-market-history.md)        | The Plan rests on market history; Pluclair stays free                 | 2026-10-25 |
| [0014](0014-removed-on-purpose.md)            | Removed on purpose                                                    | 2026-10–11 |
| [0015](0015-nouveautes-never-behind.md)       | « Nouveautés » is never behind                                        | 2026-10-12 |
| [0016](0016-four-designs-own-layouts.md)      | Four designs, each with its own layouts; the logo never changes       | 2026-11-06 |
| [0017](0017-property-own-tab.md)              | Property has its own tab; net worth stays apart from milestones       | 2026-10-02 |
| [0018](0018-several-bank-accounts.md)         | Several bank accounts: a role per account, own savings counted once   | 2026-10-07 |
| [0019](0019-dca-broker-transfer.md)           | The broker transfer is kept under the hood                            | 2026-10-07 |
| [0020](0020-everyday-money-patterns.md)       | Real pay and card patterns: ask, don't guess                          | 2026-11-05 |
| [0021](0021-read-only-demo.md)                | A read-only demo, rebuilt every night                                 | 2026-10-26 |
| [0022](0022-entraide-community.md)            | Entraide: a community, moderated after posting                        | 2026-10-13 |
| [0023](0023-cautious-legal-choices.md)        | Always the cautious legal choice                                      | 2026-10-13 |
| [0024](0024-audience-measurement.md)          | Audience measurement under one switch                                 | 2026-11-12 |
| [0025](0025-no-client-cache.md)               | No client cache: every screen reads what it shows                     | 2026-09    |
| [0026](0026-soft-delete-with-undo.md)         | Deletes can be taken back for 30 days                                 | 2026-09-20 |
| [0027](0027-self-hosted-fonts.md)             | Fonts are self-hosted                                                 | 2026-10-09 |
| [0028](0028-branch-per-phase-owner-merges.md) | A branch per phase; the owner merges                                  | 2026-10-02 |

Older design notes from September 2026 are in `docs/superpowers/`. Each
feature's build plan, with its own decisions and open points, is in
`docs/plans/`.

## Adding a record

When the owner makes a call that shapes the product (a choice between
options, a removal, a line not to cross), or a technical choice is made that
others would otherwise undo:

1. Copy the shape below into `NNNN-short-slug.md`, with the next number.
2. Add its row to the table above, and a line to the timeline if it shipped.
3. If it changes a line in `AGENTS.md` « Lines the product does not cross »,
   update that too.
4. A decision that replaces an older one sets the older record's status to
   « Superseded by NNNN ». Don't delete the old record.

```markdown
# NNNN. The decision, as a sentence

- **Date:** YYYY-MM-DD
- **Status:** Accepted
- **See also:** plan, migration, doc

## Context

What prompted it, and the options there were.

## Decision

What was chosen, in plain words.

## Consequences

What follows from it in the code and the product.

## Don't

What not to propose again because of it.
```

## Timeline

What reached `main`, month by month. For the full list of merges:
`git log --first-parent main --merges --format='%ad %s' --date=short`.

### June – August 2026: the beginning

- **2026-06-15** — The project starts: a Next.js app on Supabase
  (migration `001`).
- **2026-07-23** — The phone app (Expo) and `@finance/core` arrive.
- **2026-08-13** — The public site.
- **2026-08-28** — `CONTEXT.md`, the glossary.

### September 2026: the month and the bank

- **09-02** — The month close (`018`) and the bank feed (`019`).
- **09-05** — The month read, written by a model that never writes a number
  (`024`).
- **09-09** — The app in English and French.
- **09-19 – 09-21** — The category screen as findings; a pass of polish.
- **09-20** — Deletes that can be taken back ([0026](0026-soft-delete-with-undo.md)).
- **09-25** — Feature switches (`039`).

### October 2026: the everyday app

- **10-01** — French by default ([0001](0001-french-users-first.md));
  `@finance/data` shared by both apps ([0002](0002-shared-core-and-parity.md)).
- **10-02** — Quality, sync and engagement phases: notifications, moments,
  the weekly recap ([0003](0003-moments-not-a-score.md)). Immobilier, phases
  0–7 ([0017](0017-property-own-tab.md)).
- **10-04** — The AI account on OpenRouter.
- **10-05 – 10-08** — The broker transfer for DCAs
  ([0019](0019-dca-broker-transfer.md)); several bank accounts
  ([0018](0018-several-bank-accounts.md)); the everyday plan: search, imports,
  « Votre année ».
- **10-09** — Shared space ([0008](0008-shared-space-is-an-owner.md)); Ask
  Pluclair; AI only on one's own account ([0005](0005-ai-on-the-persons-own-account.md));
  the tax page built and removed ([0006](0006-no-tax-return-help.md)); the
  Plan's year ahead; the landing v2; self-hosted fonts.
- **10-10** — Ask as a real chat ([0007](0007-ask-a-real-chat-advice-tiers.md)).
- **10-12** — `/a-propos` and the public APK ([0011](0011-apk-from-the-site.md));
  « Nouveautés » with reactions ([0015](0015-nouveautes-never-behind.md));
  the Journal's weeks; « Abonnements » removed.
- **10-13** — « Le blog » and Entraide, then Entraide on the phone
  ([0022](0022-entraide-community.md)); the bank closed to all but the owner
  ([0009](0009-bank-connection-owner-only.md)); the legal pages published
  ([0023](0023-cautious-legal-choices.md)); statements you bring: files,
  share, PDF, e-mail ([0010](0010-statements-you-bring.md)). APKs 1.1.0 and
  1.2.0.
- **10-25** — Sign-up e-mails through Resend; `/telecharger`; the iPhone
  home-screen guide; no shadows; arrivals fade ([0012](0012-arrivals-fade.md));
  Le point simplified. APK 1.3.0.
- **10-26** — The Plan on market history ([0013](0013-plan-on-market-history.md));
  a darker, less purple background; the orange orb and accent; Placements'
  order; the reference-app phases (filing rules, splits and receipts,
  partner balance, broker operations, the demo
  ([0021](0021-read-only-demo.md)), one Journal, the Android listener).

### November 2026: real money patterns and designs

- **11-04** — A salary with a bonus; « Nouvelles dépenses » pushes;
  Placements follows confirmed purchases.
- **11-05** — Cadence by month, deferred-debit cards, the purchase day, pay
  that varies, advances, payments in 3 or 4 times, refunds, working days
  ([0020](0020-everyday-money-patterns.md)).
- **11-06** — One frame for every entry sheet; APK 1.5.0; the Journal opens
  on Calendrier; Placements as tiles; SEO foundations; four designs, then
  their own layouts on the web and the phone
  ([0016](0016-four-designs-own-layouts.md)); « Partager ce mois » removed.
- **11-07** — The in-app APK update; « Par commerce » removed; sheets close
  by dragging down.
- **11-12** — Vercel Analytics under « Mesure d'audience »
  ([0024](0024-audience-measurement.md)); a minimal landing hero.
