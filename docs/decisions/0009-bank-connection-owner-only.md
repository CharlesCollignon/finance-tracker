# 0009. The bank connection is the owner's only

- **Date:** 2026-10-13
- **Status:** Accepted
- **See also:** `docs/plans/BANK_CONNECT_PLAN.md`, `docs/plans/BANK_PROVIDERS.md`, `docs/operations.md`

## Context

Pluclair reads bank data through open-banking.io with a credentials file. On
2026-10-13 open-banking.io answered that access on behalf of a third-party
app's users is "not possible for now". Pluclair is also not a registered
account-information service. The owner asked to keep the app legal and to
drop anything that isn't clearly so.

## Decision

- `bankOpenTo(userId)` (`apps/web/lib/bank/client.ts`) holds the bank
  connection to `OPEN_BANKING_OWNER_USER_ID`, whatever a flag or a stored file
  says.
- The site and the legal texts say the connection is "not offered at the
  moment".
- The cron never asks the bank itself; it reads the copy open-banking.io
  already holds. Only a person pressing Refresh asks the bank (PSD2).

## Consequences

- Everyone else brings their statements ([0010](0010-statements-you-bring.md)).
- If « no bank connected » shows for the owner, check
  `OPEN_BANKING_OWNER_USER_ID` on Vercel first.

## Don't

- Reopen the connection to other accounts without open-banking.io's written
  OK and an answer on the ACPR question.
