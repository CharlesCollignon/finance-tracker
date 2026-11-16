# 0007. Ask Pluclair is a real chat, with advice up to tier 3

- **Date:** 2026-10-10
- **Status:** Accepted
- **See also:** `docs/how-pluclair-works.md` « Questions », migration `064`

## Context

The first Ask Pluclair (2026-10-09) never let the model write a number, had
no history and saw only totals. The owner found it "super limited".

## Decision

- **A real chat** with tools: the model calls the app's figures and writes
  detailed answers, streamed. Conversations are kept 30 days.
- **Advice tiers 0–3** (`docs/plans/PLUCLAIR_UPGRADE_PLAN.md` D1): facts,
  comparisons, explanations, what-ifs, rules of thumb labelled as such, and
  budgeting and saving tips.
- **Never a specific product, fund, contract or provider.** Tiers 4–5 need
  a CIF or insurance-intermediary status Pluclair doesn't have.
- **Single entries when the question needs them** (date, label, amount,
  category), totals by default. Never a name, IBAN or bank id.

## Consequences

- The landing's « jamais un conseil » lines and the privacy policy were
  reworded to match.
- Any new data the model sees must be reflected in `legal-copy*.ts` and in
  the register and AIPD.

## Don't

- Add product, fund or provider recommendations to prompts or answers.
