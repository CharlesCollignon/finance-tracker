# 0018. Several bank accounts: a role per account, own savings counted once

- **Date:** 2026-10-07
- **Status:** Accepted
- **See also:** `docs/plans/MULTI_ACCOUNT_PLAN.md`, migration `056`

## Context

One credentials file reads every bank in a person's open-banking.io
account. The owner wanted one or several accounts to be "super easy".

## Decision

- Each account gets a role: Courant, Épargne, Commun or Ne pas suivre,
  pre-filled from the bank's account type and confirmed with one tap.
  Nothing from an undecided account enters the Journal.
- A transfer from the current account to one's own savings counts once, as
  savings, on the current side. The savings account only gives its balance.
- One merged Journal. Each bank line shows its bank once there are two or
  more current accounts, with a filter by account.

## Consequences

- Fixed transfers to an own Livret disappearing from « économisé ».
