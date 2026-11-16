# 0005. AI runs only on the person's own account

- **Date:** 2026-10-09
- **Status:** Accepted
- **See also:** `docs/plans/AI_ACCOUNT_PLAN.md`, migrations `053`, `065`

## Context

Month reads, category reads, wallet reads and later Ask Pluclair need a
language model. For a while Pluclair's own Mistral key was used when a person
had none.

## Decision

Pluclair holds **no model key of its own**. Every AI call (reads, questions,
instrument readings, receipts, scans) runs on the person's own OpenRouter
account, connected from Profil through OAuth with PKCE, and paid by them.
There is no free quota anywhere. Without a connected account, nothing is
written, and the screen invites the person to connect one.

## Consequences

- `AI_SECRETS_KEY` seals each account's key on the server; screens only learn
  whether an account is connected and the model's name.
- The phone reaches AI only through bearer routes on the web server.
- Scans and screenshots are read by a Mistral model on its EU endpoint, on
  the person's account, with consent asked per file.
- « Gratuit » on the site always sits beside the two prices people pay to
  their own services (OpenRouter by use, and open-banking.io for the owner),
  never to Pluclair.

## Don't

- Reintroduce a house model or a free allowance without asking.
