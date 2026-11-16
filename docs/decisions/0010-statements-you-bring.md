# 0010. Statements you bring, through the same feed

- **Date:** 2026-10-13
- **Status:** Accepted
- **See also:** `docs/plans/STATEMENTS_PLAN.md`, migrations `074`, `075`, `082`

## Context

No automatic bank connection is legal for other people without a licensed
aggregator's contract (GoCardless closed to new sign-ups; Enable Banking's
restricted mode covers only one's own accounts). The owner asked for the
no-contract route: "as easy as possible, friendly, automatic if there is a
way, as many formats as possible".

## Decision

- Every way of bringing lines (a file, a pasted table, a scan read by AI, a
  file shared to Pluclair, a forwarded bank e-mail, Android bank
  notifications) becomes `bank_feed_items` lines with a `source`, on file
  accounts, and goes through the same matcher and « À vérifier » inbox as the
  bank's lines.
- Line ids are the file's own (FITID…) or a fingerprint plus a rank. An
  import can be undone for 30 days.
- The old CSV wizard is gone.

## Consequences

- `hasBankFeed` counts bank lines only.
- E-mail alerts make provisional lines that a later statement confirms.
- Real anonymised bank exports are still wanted as reader fixtures.

## Don't

- Ask for bank passwords or scrape a bank. Everything is data the person
  hands over.
