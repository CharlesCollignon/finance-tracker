# 0020. Real pay and card patterns: ask, don't guess

- **Date:** 2026-11-04 to 2026-11-05
- **Status:** Accepted
- **See also:** `docs/plans/CARDS_CADENCE_PLAN.md`, migrations `083`–`087`

## Context

Pluclair assumed one persona: a monthly salary on a fixed day and an
immediate-debit card. Real people have bonuses, pay that varies, advances,
deferred-debit cards, bills every quarter and payments in 3 or 4 times.

## Decision

- **Deferred-debit cards are asked once per card**, not detected. « Il vous
  reste » takes their spending off on its own line, even when it's debited
  after payday.
- **A card line counts on the day of purchase**; the booking day is kept as
  the cash day.
- **Pay:** an amount above the expected one is still the pay, with the excess
  set apart as « Prime ». « Le montant varie » matches from half the figure
  up. « Avec un acompte » makes two monthly incomes.
- **Cadence:** a monthly instruction can fall in some months only. Money
  moves on the working day.
- Purchases in 3 or 4 times, and refunds that don't count as income.

## Consequences

- Freelancers and irregular income, and pay every two weeks, are not done
  yet.
