# 0022. Entraide: a community, moderated after posting

- **Date:** 2026-10-13
- **Status:** Accepted
- **See also:** `docs/plans/BLOG_CHANGELOG_PLAN.md`, `docs/legal/ENTRAIDE.md`, migrations `071`–`073`

## Context

The owner asked for a blog "to add more life to the app", with guides and a
place where signed-in people ask and others answer. Hosting people's posts
makes Pluclair a content host (DSA arts. 16 and 17, LCEN).

## Decision

- Public, indexed reading; pseudonyms; no points or karma.
- Moderation after posting: « Signaler », three reports hide a post, a queue
  for moderators, decisions with a reason.
- « Les règles d'Entraide » is its own document. Commitment 3 (« no
  advice ») binds only Pluclair's own voice; members' answers are shown as
  their views.
- What identifies each write is kept one year, even after the account is
  deleted (migration `073`). A deleted account's messages read « Message
  supprimé ».
- Web first, then the phone.

## Consequences

- The phone writes through `/api/entraide`, sharing the web's
  `lib/entraide-write.ts`.
