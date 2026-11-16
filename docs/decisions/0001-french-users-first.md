# 0001. French users first

- **Date:** 2026-10-01
- **Status:** Accepted
- **See also:** `CONTEXT.md`, `packages/core/src/i18n/`

## Context

Pluclair began with a principle that France was "one case rather than the
target", and France-specific assumptions were to be generalised.

## Decision

Pluclair is for French users only: French banks, French and EU law (ACPR,
CNIL, Code monétaire et financier, Code de la consommation, LCEN). French is
the default language for every new reader, whatever the browser or phone
says (`DEFAULT_LOCALE = "fr"`). English is offered once to a device that
prefers it, can be chosen in Profil, and is the catalogue a missing string
falls back to (`FALLBACK_LOCALE = "en"`). Migration `043` stores French by
default.

## Consequences

- France-specific assumptions are the shape of the product, not debt:
  PEA, Livret A, LEP, assurance-vie, PER, DVF, INSEE, French public holidays.
- French copy is written first and well, never as a translation afterthought.
- Providers and legal choices are the ones that fit French users and EU law.

## Don't

- Propose work aimed at other countries or currencies without the owner's
  go-ahead.
