# 0017. Property has its own tab; net worth stays apart from milestones

- **Date:** 2026-10-02, extended 2026-10-25
- **Status:** Accepted
- **See also:** `docs/plans/REAL_ESTATE_PLAN.md`, migrations `049`–`052`, `063`

## Context

The owner asked for real estate: purchase price, area, loans, the loan's
repayment as a charge, and the market price by location.

## Decision

- Its own tab, « Immobilier » (against the recommendation of a group inside
  Placements). The phone bar went to six tabs, with labels that shrink to fit.
- **Net worth apart:** milestones stay savings plus investments. A
  « Patrimoine net » card adds property value minus loans.
- A precise address (IGN geocoder), DVF sales nearby, the INSEE index.
- Principal repaid is not counted as kept money; it shows on the property and
  in net worth.
- Up to four loans per property, one recurring charge per loan.
- « Bien » on a recurring entry only where it can matter.

## Consequences

- Property value stays out of the Plan's forward projection, except through
  the « Avec vos biens » switch.
