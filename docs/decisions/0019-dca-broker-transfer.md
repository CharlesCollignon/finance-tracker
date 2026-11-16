# 0019. The broker transfer is kept under the hood

- **Date:** 2026-10-06, reworked 2026-10-07
- **Status:** Accepted
- **See also:** `docs/plans/DCA_TRANSFER_PLAN.md`, migrations `054`, `055`

## Context

Many people fund their DCAs (PEA, CTO) with a monthly transfer to a broker
the app can't read. A first version made the transfer a managed charge,
which felt like one more thing to manage.

## Decision

- A tick per DCA (« Payé par le virement au courtier »), on by default.
- The app keeps the transfer itself, never as a charge on the list. It is due
  on the 1st, and covers the next month's DCAs: always the full amount, plus
  5 % on share-priced DCAs, rounded up to the next 50 €.
- The card shows 5 days before; the push comes 2 days before, and again when
  the pay that funds it arrives.

## Consequences

- A transfer a few days late still counts.
