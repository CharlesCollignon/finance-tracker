# Your own AI account: the reads, written on the user's account

Pluclair's written reads — the month read, a category's read, the band's
re-rank and the portfolio review — are written today by Mistral on
Pluclair's own key, within monthly allowances. This plan lets each user
connect their own AI account in one press, and makes that connection what
the reads are written with.

## Decisions (owner, 2026-10-04)

- **One way to connect in the first version: OpenRouter, by OAuth.** The
  user presses « Connecter un compte IA », approves on OpenRouter and comes
  back connected: OpenRouter creates an API key for them, under their own
  account, credits and spending limit. One integration reaches GPT, Claude
  and Mistral models alike.
- **No AI without a connected account.** The reads appear only for a user
  who has connected one; Pluclair's Mistral key no longer writes them.
  Reads already stored stay readable.
- **No monthly ceiling on one's own account.** The user pays for every
  call, so a connected account has no monthly allowance; the cooldown
  between two presses and the guard against a double press stay.
- **Instrument readings move to the user's account too.** « Lire un
  instrument » reads public documents, but it is AI all the same: without a
  connection, no instrument is read.
- **A short list of models**, each tested against the reads' checks:
  Mistral first and by default (closest to today's reads), then one GPT and
  one Claude.
- **« Sign in with ChatGPT » comes later**, as its own phase, once OpenAI
  accepts Pluclair into the commercial trial (the owner fills OpenAI's
  interest form). It would let ChatGPT Plus and Pro subscribers use their
  plan's allowance, within a weekly cap they set.

What the providers allow, as checked on 2026-10-04:

- **OpenRouter**: OAuth with PKCE, self-serve, returns a user-controlled
  key ([docs](https://openrouter.ai/docs/guides/overview/auth/oauth)).
- **OpenAI**: « Sign in with ChatGPT » (OAuth 2.0 with PKCE and OpenID
  Connect), launched 2026-09-29; self-serve for open-source apps, a limited
  trial on application for commercial hosted ones
  ([docs](https://developers.openai.com/siwc/website)).
- **Anthropic**: a Claude Free, Pro or Max subscription may not be used in a
  third-party product (consumer terms, since February 2026); only API keys
  from the Claude Console. Claude stays reachable through OpenRouter.
- **Mistral**: API keys only, with a free tier; no OAuth.

## Constraints kept

- **Every check stays, whoever writes.** The model never writes a figure:
  the facts, the closed catalogue, the figure rule and the shape checks are
  the app's and do not depend on the provider.
- **The secret never leaves the server.** The OpenRouter key is sealed with
  AES-256-GCM under a key held only in the server's environment
  (`AI_SECRETS_KEY`, rotated like `BANK_SECRETS_KEY`), never returned to a
  browser, never stored on the phone, never logged.
- **Consent before the first byte.** Connecting says, before redirecting,
  that the page's figures — never the transactions, never who the user is —
  go to OpenRouter and from there to the chosen model's provider, mostly in
  the United States. The privacy policy says the same (`docs/legal`: no
  `prettier --write` there, see `legal-docs-prettier-drift`).
- **Simple.** One button, one consent, one place to disconnect; no key to
  paste in the first version.

## Phase 0 — Written down (branch `ai-account-0/terms`)

- [x] CONTEXT.md: « compte IA » (AI account) and « rédacteur » (writer) in
      the glossary; « matelas de sécurité » where it still said
      « coussin ».
- [x] The models, checked in OpenRouter's catalogue: see « Models » below.
- [x] The copy that lands with the feature, below. The privacy policy and
      the register change only when the reads move to the user's account
      (Phase 2), so they never describe something the app does not do.

### Models

From OpenRouter's catalogue on 2026-10-04. All three take `response_format`
and `structured_outputs`; « one read » is about 6 000 tokens in and 1 200
out, at OpenRouter's prices.

| Model                        | OpenRouter id                  | One read  |
| ---------------------------- | ------------------------------ | --------- |
| Mistral Medium 3.5 (default) | `mistralai/mistral-medium-3-5` | ≈ 0,018 $ |
| GPT-6 Sol                    | `openai/gpt-6-sol`             | ≈ 0,024 $ |
| Claude Sonnet 5.5            | `anthropic/claude-sonnet-5.5`  | ≈ 0,024 $ |

Cheaper alternates, if the tests in Phase 2 allow them: Mistral Large 3
(`mistralai/mistral-large-2512`, ≈ 0,005 $), GPT-6 Luna
(`openai/gpt-6-luna`, ≈ 0,001 $), Claude Haiku 4.5
(`anthropic/claude-haiku-4.5`, ≈ 0,012 $). The GPT-6 models take no
`temperature`: the adapter leaves it out for them. None lists
`web_search_options`; instrument readings go through OpenRouter's web plugin
instead, to be checked in Phase 2.

### Copy to land with the feature

**Consent, before redirecting to OpenRouter** (Phase 3):

> **Connecter un compte IA**
> Les lectures écrites — votre mois, une catégorie, vos placements, un
> fonds — seront rédigées par le modèle que vous choisissez, sur votre
> compte OpenRouter, et facturées sur vos crédits.
> Pour chaque lecture, Pluclair envoie les chiffres de la page concernée :
> totaux, noms de catégories, lignes de vos placements. Jamais votre nom,
> votre e-mail, vos opérations une à une ni vos identifiants bancaires.
> OpenRouter les transmet au fournisseur du modèle (Mistral, OpenAI ou
> Anthropic), le plus souvent aux États-Unis.
> Vous pouvez déconnecter ce compte à tout moment, ici ou depuis OpenRouter.
> **[Continuer vers OpenRouter]** [Annuler]

> **Connect an AI account**
> Written reads — your month, a category, your investments, a fund — will be
> written by the model you choose, on your OpenRouter account, and charged to
> your credits.
> For each read, Pluclair sends the figures of the page it is about: totals,
> category names, the lines of your investments. Never your name, your email,
> your entries one by one or your bank credentials. OpenRouter passes them to
> the model's provider (Mistral, OpenAI or Anthropic), most often in the
> United States.
> You can disconnect this account at any time, here or from OpenRouter.
> **[Continue to OpenRouter]** [Cancel]

**Privacy policy, « Qui nous aide à fonctionner »** (`legal-copy.fr.ts`
and `legal-copy.ts`, Phase 2), replacing the Mistral AI line:

> OpenRouter (États-Unis), si vous connectez un compte IA : transmet les
> chiffres à partir desquels une lecture est écrite — noms de catégories et
> totaux du mois, ou fonds d'un portefeuille et leurs valeurs — au
> fournisseur du modèle que vous avez choisi, sur votre propre compte.
> Jamais votre nom, votre e-mail ni vos écritures une à une. Sans compte IA
> connecté, aucune donnée n'est envoyée à un service d'IA.

and, under transfers, that OpenRouter and the model providers may process
outside the Union, on the user's own account and at their request.

**Register of processing** (`docs/legal/registre-des-traitements.md`,
Phase 2; never `prettier --write` there): the Mistral AI row becomes
OpenRouter, purpose « rédaction des lectures, à la demande et sur le compte
IA de l'utilisateur », location États-Unis, legal basis the user's consent
given at connection; the DPIA's minimisation line says the same.

## Phase 1 — The connection (branch `ai-account-1/connection`)

- [x] Migration 053: `ai_connections` (one per user: service, model,
      connected at, last used at, last error — the user may read it, change
      its model and delete it), `ai_connection_secrets` (the sealed key, no
      client role may touch it, gone with its connection) and
      `ai_connect_flows` (state, sealed PKCE verifier, `redirect` or `app`,
      ten minutes); the `ai.account` flag, off for everyone. Nine checks in
      `supabase/tests/053_ai_connections.test.sql`, passing on the local
      stack.
- [x] `lib/secrets/sealer.ts`: the bank's AES-256-GCM sealing made one
      sealer per key; the bank's under `BANK_SECRETS_KEY` as before, the AI
      account's under its own `AI_SECRETS_KEY`.
- [x] `lib/ai/openrouter.ts`: PKCE, the authorisation address (key labelled
      « Pluclair », our state), the code exchange and the key check.
- [x] `POST /api/ai/openrouter/start` (cookie or the phone's bearer, behind
      the flag): stores a state and its sealed verifier, answers
      OpenRouter's authorisation address.
- [x] `GET /api/ai/openrouter/callback`: spends the state, exchanges the
      code with the verifier, checks the key, seals and stores it — keeping
      a reconnecting user's model — then lands on `/profile?ai=…` (web) or
      `pluclair://profile?ai=…` (phone). Declined at OpenRouter, the state
      is spent all the same.
- [x] `DELETE /api/ai/connection`: the row goes as the user, its key with
      it; the Profile (Phase 3) says how to revoke the key on OpenRouter.
- [x] Tested without OpenRouter or a server: the client against a fake
      `fetch`, the whole round trip against an in-memory database (stored
      sealed, default model, replay refused, expiry, refusals store
      nothing, a declined round trip spent).

Still to do by hand before Phase 2 is tried for real: apply 053 on the
hosted project, set `AI_SECRETS_KEY` on Vercel, and turn `ai.account` on
for the owner's account.

## Phase 2 — The reads, on the user's account (branch `ai-account-2/reads`)

- [ ] One OpenAI-compatible adapter (base address, key, model), with
      structured output and `require_parameters`, so a request only goes to
      a provider that honours the schema.
- [ ] `readSourceFor(userId)`: the user's connection, or none. The four
      writers take their source from it; « configured » becomes « this user
      has a connection ».
- [ ] Without a connection: no write button anywhere; a discreet line where
      a read would be — « Connectez un compte IA pour des lectures écrites »
      — opening the Profile. Stored reads still show.
- [ ] Each read keeps saying exactly which model wrote it (it already
      records the model).
- [ ] No monthly allowance for a connected account; the cooldown and the
      in-flight guard stay. The allowance copy (« N restantes ») goes.
- [ ] Instrument readings on the user's account. They use Mistral's own
      `web_search` tool today; through OpenRouter they need its web search
      instead (charged per request on top of the model), so this adapter is
      its own task, tested on a few real ISINs.

## Phase 3 — The Profile, on both apps (branch `ai-account-3/profile`)

- [ ] Web, Profile « Compte IA »: the consent, « Connecter avec OpenRouter
      », then the connected state — the model, the credit left (read from
      OpenRouter), « Déconnecter ».
- [ ] Phone, the same: the authorisation in a browser session
      (`expo-web-browser`), back through `pluclair://`; the server keeps the
      secret.
- [ ] Copy reviewed in French with the owner; English beside it.

## Phase 4 — Sign in with ChatGPT (after OpenAI's answer)

- [ ] Apply to OpenAI's commercial trial (owner).
- [ ] Once accepted: « Se connecter avec ChatGPT » beside OpenRouter, the
      plan's usage behind the same adapter interface, its weekly cap
      explained in the Profile.
