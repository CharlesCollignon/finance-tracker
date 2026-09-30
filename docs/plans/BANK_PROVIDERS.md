# Bank-data providers for French accounts — comparison

> Research of 30 September 2026, after open-banking.io closed its partner
> programme (see [`BANK_CONNECT_PLAN.md`](./BANK_CONNECT_PLAN.md), section 0).
>
> **Not pursued.** On 1 October 2026 the owner chose to keep open-banking.io,
> with each user bringing their own account and uploading its credentials
> file. This comparison stays as the record of why, and as the starting
> point should that route close too.
> Every claim below was checked against the provider's own pages, docs, terms
> or a public register that day unless marked _(secondary)_. Prices change and
> most are not published: treat every figure as a starting point for a quote,
> not a quote. Not legal advice.

---

## 1. What changed, in three sentences

1. **Nobody sound lets the end user pay the provider any more.** open-banking.io
   was the only one, and it was reselling Enable Banking; Enable Banking's terms
   of 9 January 2026 forbid exactly that ("sublicense, sell, resell … or make
   accessible to any third party"). The one user-pays service left (Lunch Flow)
   resells GoCardless, which is closed to new sign-ups — the same fragility.
2. **Every realistic provider needs a legal entity and a signed contract, and
   bills Pluclair.** A micro-entreprise (SIREN) is the least that is likely to be
   accepted; whether each accepts one has to be asked.
3. **Pluclair would not need its own ACPR registration** if it runs under the
   provider's licence, as long as the provider is visibly the service provider:
   its consent screen, its terms accepted by the user.

---

## 2. The comparison

| Provider                                                       | Price                                                                                                                                                                | Under its licence?                                                           | Company needed                                | French coverage                                                               | Savings, PEA, assurance-vie                               | Unattended refresh                   | History on connect                   | Verdict                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Powens** (FR, ACPR)                                          | Quote only. Billed per _active_ user (≥1 sync in the month), committed volume in an order form, tacit renewal with 90 days' notice. Startup programme ("Launchpad"). | Yes (user accepts Powens' terms in its webview); agent route also exists     | Expect so (B2B order form)                    | All majors + Revolut, N26, Qonto, Shine                                       | Yes — separate "Wealth & Loans" product, credential-based | Up to 4/day (docs: daily by default) | 3–24 months                          | **First to ask**                                                                                            |
| **Enable Banking** direct (FI, passported)                     | Quote only. Volume-based per account accessed, with a minimum monthly invoice.                                                                                       | Yes (its terms page before the bank)                                         | **Yes — "organisations only"** for production | 130 entries incl. Qonto, Shine, Trade Republic; several majors flagged "beta" | No                                                        | 4/day                                | Often 1–3 years (`strategy=longest`) | **Second to ask**                                                                                           |
| **Bridge** (FR, ACPR; BPCE minority stake)                     | Quote only. _(secondary)_ "from €30/month" (2025) and "from €499/month" (untraced) disagree.                                                                         | Yes                                                                          | Yes (KYB with a Kbis under 3 months)          | 246 connectors incl. neobanks                                                 | Yes — "all accounts" mode, credential-based               | 1–2/day                              | 0–36 months                          | Third; categorisation included, but API calls need allow-listed IPs (Vercel has none) and it is loss-making |
| **Linxo** (FR, ACPR; joining Crédit Agricole Payment Services) | Quote only                                                                                                                                                           | Yes                                                                          | Expect so                                     | 314 providers                                                                 | **Best**: Livret A, PEA, PER, assurance-vie…              | Once a night                         | 90 days to 13 months, per bank       | Weak fit: once-a-day sync, and it says PFM is "stagnant" for it                                             |
| **Salt Edge** Partner Program                                  | Quote only. _(secondary, stale)_ "100 connections free / $500 a month" (2019).                                                                                       | Yes, but under **two Czech third parties'** licences (Spendee, BudgetBakers) | Yes                                           | 121 providers incl. neobanks                                                  | —                                                         | 4/day                                | Per bank                             | Same "licence two steps away" shape that just failed                                                        |
| **Tink** (SE, Visa)                                            | Prices "exclusively for existing customers"; no pay-per-use. _(secondary)_ old list €0.50/user/month.                                                                | Yes; agent model too                                                         | Yes (business-only, AML screening)            | 97; **no Qonto, no Shine**                                                    | Barely                                                    | 4/day                                | Up to 24 months                      | Only if the others refuse                                                                                   |
| **Yapily** (LT)                                                | Quote only. _(secondary, conflicted author)_ £200–500/month.                                                                                                         | Yes ("Yapily Connect")                                                       | Expect so                                     | ~50                                                                           | No                                                        | 4/day                                | Often 90 days                        | Payments-first                                                                                              |
| **finAPI** (DE, BaFin; Fabrick)                                | **Public**: ≈ €260–300/month up to 200 users (Access B2C €60 + PSD2 licence €200 + options), ≈ €1,500/month at 1,000                                                 | Yes (licence fee)                                                            | Yes (business email, company)                 | 86 banks; BNP, LCL, La Banque Postale, BoursoBank **unconfirmed**             | No                                                        | 1/day, 4 with a €20 add-on           | Not published                        | Known price, uncertain coverage, German-first                                                               |
| **GoCardless** Bank Account Data                               | Free tier (≈50 connections/month)                                                                                                                                    | Yes (ACPR)                                                                   | No                                            | 137                                                                           | No                                                        | 4/day                                | 90–730 days                          | **Closed to new sign-ups since ~July 2025**                                                                 |
| **Plaid** (NL)                                                 | EU: custom plans only                                                                                                                                                | Says a PFM app needs its own status, or to become its agent                  | Yes                                           | 95                                                                            | No                                                        | 1–4/day                              | 90–730 days                          | Out                                                                                                         |
| **TrueLayer** (IE)                                             | Quote only                                                                                                                                                           | Yes                                                                          | Yes                                           | **9** providers                                                               | No                                                        | —                                    | —                                    | Out                                                                                                         |
| **Lunch Flow** (UK)                                            | **User pays**: €5.49/month for 4 connections                                                                                                                         | No licence of its own found; data "via GoCardless"                           | —                                             | Some                                                                          | No                                                        | Once a day                           | —                                    | Same reseller risk as open-banking.io; legal status for Pluclair unclear                                    |

Also worth one email: **BudgetBakers' "AISP Open Banking API Platform"** (Czech-licensed, pitched at PFM apps, no public price; reportedly on Salt Edge).

---

## 3. The legal paths for Pluclair

Showing a user their aggregated accounts is the account information service
(CMF L314-1 II 8°). Doing it without a status is illegal exercise (up to 3
years and €375,000), and being free does not exempt it. The ACPR's own example
is an app that reads accounts "pour connaître son budget".

| Path                                          | Company?                          | Registration                          | Cost and effort                                                                                                                          | Fit                                                                       |
| --------------------------------------------- | --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Register Pluclair as a PSIC (AISP)            | No — an individual may            | Yes, with the ACPR                    | Indemnity insurance of ≈ €150–200k cover (premium ≈ €5–30k/year _(secondary)_), DORA-level ICT governance, bank connectivity, 6–9 months | No                                                                        |
| Agent of a licensed aggregator                | No — a natural person may         | The aggregator registers you (REGAFI) | Commercial; aggregators may refuse individuals                                                                                           | Possible (Powens has agents)                                              |
| **Under the provider's licence**              | Probably (contracts want a SIREN) | None for Pluclair                     | Per-user fees and a minimum                                                                                                              | **The realistic one** — provided the aggregator is visibly the provider   |
| Users hand Pluclair their own aggregator keys | —                                 | —                                     | —                                                                                                                                        | **Avoid**: breaches Enable Banking's terms and is probably unlicensed AIS |
| CSV / OFX import only                         | No                                | None                                  | Already built                                                                                                                            | Always available                                                          |

Whatever the path: a DPIA is expected for bank data (EDPB 06/2020: "most probably
a DPIA will be required"), and Pluclair is a controller in its own right.

**Nothing changes soon.** PSD3 and the PSR await a plenary vote around
14 December 2026 and would apply about 21 months later (late 2028); FiDA is
stalled. PSD2 is the law for the next one to two years.

---

## 4. What it means for Pluclair

- **"Free in Pluclair, the user pays the provider" is gone.** Any sound option
  has Pluclair paying a provider, with a minimum. Bank sync becomes either a
  cost Pluclair carries, a paid Pluclair option, or something only the owner
  has.
- **The owner's own feed is safe either way.** open-banking.io says users' own
  accounts are unaffected; and should that change, Enable Banking's free
  restricted mode ("personal use of private individuals", own accounts only) is
  a legitimate direct replacement for the owner alone.
- **The code mostly survives.** The grouped inbox, the Bank page, health,
  renewal, invitations, sealed secrets and the legal drafts are
  provider-independent. `lib/bank/partner.ts`, `lib/bank/connect.ts` and the
  client in `lib/bank/client.ts` would be rewritten per provider. Powens,
  Bridge and Linxo all have a hosted flow that returns to an HTTPS or app-scheme
  URL, which fits the popup, redirect and `pluclair://bank` modes already built.
  The legal drafts would need their provider section rewritten.

## 5. Next steps (the owner's)

1. Decide whether bank sync for everyone is worth a legal entity and a monthly
   bill. If not, stop here: CSV import for users, open-banking.io for the owner.
2. If yes: create the entity (a micro-entreprise is the lightest), then ask
   **Powens** (Launchpad), **Enable Banking** ("needs to contract with an
   authorised provider") and **Bridge** the same questions:
   - Is a micro-entreprise accepted?
   - Minimum monthly fee, and price per active user at 50, 200 and 1,000 users.
   - Commitment length and notice period.
   - Price of savings/investment accounts (Powens, Bridge).
   - Unattended refreshes per day, and history on first connect, for the big
     French banks.
3. Before launch, a French fintech lawyer's view on the consent presentation
   (the provider must be visibly the provider) and the DPIA.

---

## Sources (primary unless noted)

- Powens: terms of use https://www.powens.com/fr/sas-conditions-utilisation/ ·
  terms of sale https://www.powens.com/fr/sas-conditions-vente/ · transactions
  https://www.powens.com/products/transactions/ · startups
  https://www.powens.com/fr/startup-program/ · docs https://docs.powens.com
- Bridge: end-user terms (15 Jul 2025)
  https://cdn.prod.website-files.com/6674250de1acfb13fc4a9da4/69e777d17cd3bcda908dea57_CGS%20AIS%20%2B%20PIS%20VJuillet2025.docx.pdf
  · production https://support.bridgeapi.io/hc/fr-fr/articles/22854214914322 ·
  IP allow-list https://support.bridgeapi.io/hc/fr-fr/articles/9798710145298 ·
  refresh https://docs.bridgeapi.io/docs/manage-the-lifecycle · providers
  https://providers-data.bridgeapi.io/providers.json · BPCE stake
  https://newsroom-en.groupebpce.fr/news/bridge-raises-eur20-million-from-truffle-capital-and-groupe-bpce-to-create-the-next-generation-of-payment-solutions-and-accelerate-its-development-in-europe-c656-53927.html
  · price _(secondary)_ https://wise.com/fr/blog/api-bancaire
- Linxo: end-user terms https://linxo.com/cgu-accounts/ · licence model
  https://developers.linxo.com/docs/accounts/v2/accounts-headline/ · sync
  https://developers.linxo.com/docs/accounts/v3/connections-data-synchronization/
  · strategy _(secondary)_
  https://www.financexmagazine.com/post/linxo-and-the-real-cost-of-building-open-banking-in-france
- Enable Banking: terms (9 Jan 2026) https://enablebanking.com/terms/ · FAQ
  https://enablebanking.com/docs/faq/ · changelog
  https://enablebanking.com/blog/2026/01/15/enable-banking-changelog-december-2025
  · French banks https://enablebanking.com/api/aspsps?country=FR
- GoCardless: https://bankaccountdata.gocardless.com/new-signups-disabled
- Tink: https://tink.com/pricing/ · https://tink.com/legal/faq/ ·
  https://tink.com/get-started/ · providers https://api.tink.se/api/v1/providers/FR
- Salt Edge: https://www.saltedge.com/legal/partner_terms_of_use ·
  https://docs.saltedge.com/partners/v1/
- Yapily: https://docs.yapily.com/tools-and-services/yapily-connect/overview ·
  https://www.yapily.com/pricing
- finAPI: https://www.finapi.io/en/prices/ ·
  https://documentation.finapi.io/access/api-v2-exclusive-features
- Plaid: https://plaid.com/en-eu/open-banking/ · https://plaid.com/docs/account/billing/
- TrueLayer: https://auth.truelayer.com/api/providers
- Lunch Flow: https://lunchflow.app/docs/api/platform-api-overview.md ·
  https://lunchflow.app/docs/guides/account/pricing.md
- BudgetBakers: https://budgetbakers.com/en/solutions/developers/
- Law: CMF L522-1 https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035430748
  · CMF L572-5 https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000020871595
  · ACPR, which status
  https://acpr.banque-france.fr/fr/professionnels/lacpr-vous-accompagne/parcours-fintech/contenus-pedagogiques/de-quel-statut-releve-mon-activite/jaccede-aux-api-des-banques-jinitie-des-ordres-pour-le-compte-de-mes-clients
  · EBA Q&A 2018_4098
  https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2018_4098 ·
  EBA insurance guidelines (GL/2017/08) · EDPB guidelines 06/2020 ·
  PSR procedure https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2023/0210(COD)
