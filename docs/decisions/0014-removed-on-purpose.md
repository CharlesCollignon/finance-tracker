# 0014. Removed on purpose

- **Date:** 2026-10-12 to 2026-11-12
- **Status:** Accepted

## Context

Several features were built, used, and then removed at the owner's word.
Without a record, they tend to come back as suggestions.

## Decision

| Removed                                                  | When       | Why                                                                  |
| -------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| Tax-return page                                          | 2026-10-09 | Not wanted at all ([0006](0006-no-tax-return-help.md))               |
| « Abonnements » block on Récurrents                      | 2026-10-12 | Not wanted there; the Monday recap still watches subscriptions       |
| Journal's week strip                                     | 2026-10-25 | Replaced by « Passé · À venir »                                      |
| « Il vous reste » line and « Puis-je me permettre ? »    | 2026-10-25 | Le point simplified. `left` is still computed for Ask and the widget |
| « Une cible à viser » (target allocation) in Composition | 2026-10-26 | Not understood                                                       |
| Plan's crash tests, « Face à l'histoire », « Et si… »    | 2026-10-26 | « Trop flou et pas vraiment pratique »                               |
| « Partager ce mois »                                     | 2026-11-06 | Not used. `/api/month-share/image` stays for 1.5.0 phones            |
| « Par commerce » in the Journal                          | 2026-11-07 | Not used                                                             |
| Light under the pointer on cards                         | 2026-10-09 | « Remove the hover effect on the card »                              |
| The Earth behind the landing hero                        | 2026-11-12 | A minimal first screen                                               |

## Consequences

These stay out unless the owner brings them back.
