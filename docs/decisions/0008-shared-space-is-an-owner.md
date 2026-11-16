# 0008. A couple's shared space: a space is an owner

- **Date:** 2026-10-09
- **Status:** Accepted
- **See also:** `docs/plans/SHARED_SPACE_DESIGN.md`, `CONTEXT.md` « Shared space »

## Context

CONTEXT.md and PRODUCT.md described "one person's money". The owner wanted
couples to share money beside each one's own, and chose a real shared space
over a lighter "my share %" option.

## Decision

- A **space** is an owner. The money tables keep `user_id`, now read as
  _owner_: a person's id for their own money, a space's id for the joint
  money (migration `060`).
- Partners see only the joint space, never each other's own money.
- A joint bank account is filed « Compte commun » (`061`). Each partner has a
  share of joint spending (`062`). A joint home counts each partner's deed
  share in their net worth (`063`).

## Consequences

- Web: `getOwner` / `asOwner` and the `pluclair-owner` cookie. Phone:
  `OwnerProvider`.
- Plan and Placements are personal and are hidden while a space is shown.
- The privacy policy describes what a partner sees.
