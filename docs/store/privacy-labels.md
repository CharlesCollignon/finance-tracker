# Privacy labels and data safety — draft

What to answer in App Store Connect (« Confidentialité de l'app ») and in the
Play Console (« Sécurité des données »), read from the privacy policy
(`apps/web/components/marketing/legal-copy.fr.ts`). The policy is the
source: if it changes, these answers change with it. Lines marked [[…]] are
the owner's to decide. Draft of 2026-10-09, not yet signed off.

## What the app collects, from the policy

| Data                                                                   | When                         | Why                       |
| ---------------------------------------------------------------------- | ---------------------------- | ------------------------- |
| Email address                                                          | Always (the account)         | The account               |
| Name, Google account id                                                | Signing in with Google only  | The account               |
| Transactions, balances, charges, wallets, property, notes, labels      | What the person enters       | The service               |
| What the bank sends (accounts, balances, movements)                    | A bank connected only        | The service               |
| A property's commune and point, the full address on request            | A property added only        | Its market reading        |
| Questions typed in « Questions »                                       | Asked only; 30 days          | The answer                |
| Active days and a few counts, under a pseudonymous id                  | Unless switched off; 13 mo.  | Audience measurement      |
| Push token                                                             | Notifications switched on    | Sending them              |
| Passkey public key                                                     | A passkey added only         | Signing in                |

Nothing for advertising, no tracking across apps or sites, nothing sold.
Everything is encrypted in transit; deleting the account, from the app,
deletes it all.

## App Store — App Privacy

**Do you or your third-party partners collect data from this app?** Yes.

**Tracking** (data used to track across other companies' apps or sites): No,
for every type below. No App Tracking Transparency prompt is needed.

| Apple data type                  | Collected | Linked to the user | Purposes                      |
| -------------------------------- | --------- | ------------------ | ----------------------------- |
| Contact Info → Email Address     | Yes       | Yes                | App Functionality             |
| Contact Info → Name              | Yes       | Yes                | App Functionality             |
| Contact Info → Physical Address  | [[1]]     | Yes                | App Functionality             |
| Financial Info → Other Financial Info | Yes  | Yes                | App Functionality             |
| User Content → Other User Content | Yes      | Yes                | App Functionality             |
| Identifiers → User ID            | Yes       | Yes                | App Functionality, Analytics  |
| Usage Data → Product Interaction | Yes       | [[2]]              | Analytics                     |

Not collected: Health & Fitness, Location (the device's), Sensitive Info,
Contacts, Browsing or Search History, Purchases, Diagnostics [[3]], Payment
Info, Credit Info.

- [[1]] A property's address: the policy keeps the commune and a point, and
  the full address only on request. Recommended: declare it, since a
  person's own home is their address.
- [[2]] The measurement's id is computed from the account with a server
  secret: it names no one, but Pluclair could link it back. Recommended:
  « Linked », which Apple's definition asks for when the developer can.
- [[3]] The host's request logs are kept briefly for security and fixing
  outages. Apple counts data « collected » by the app; server logs of
  requests are commonly left out. To confirm.

## Google Play — Data safety

**Does the app collect or share any of the required user data types?** Yes.
**Is all collected data encrypted in transit?** Yes. **Can users ask for
their data to be deleted?** Yes — in the app (Profil → Supprimer le compte)
and from [[the web page that explains how, for the console's « URL de
suppression du compte » — https://pluclair.com/privacy#rights is the
candidate]].

Shared with third parties: none. Supabase and Vercel are service
providers, which Google does not count as sharing. A question sent to the
person's own OpenRouter account is their transfer, on their account, after
their consent [[to confirm it reads that way to Google]].

| Google data type                          | Collected | Optional            | Purposes                          |
| ----------------------------------------- | --------- | ------------------- | --------------------------------- |
| Personal info → Email address             | Yes       | No                  | App functionality, Account management |
| Personal info → Name                      | Yes       | Yes (Google sign-in) | Account management               |
| Personal info → Address                   | [[1]]     | Yes                 | App functionality                 |
| Financial info → Purchase history         | Yes       | No                  | App functionality                 |
| Financial info → Other financial info     | Yes       | No                  | App functionality                 |
| Messages → Other in-app messages          | Yes       | Yes (« Questions ») | App functionality                 |
| App activity → App interactions           | Yes       | Yes (opt-out)       | Analytics                         |
| App activity → Other user-generated content | Yes     | Yes                 | App functionality                 |
| Device or other IDs                       | Yes       | Yes (notifications) | App functionality                 |

Ephemeral processing: no — each of these is stored.

## Other forms in the Play Console

- **Financial features**: the app offers none of the regulated ones (no
  loans, no payments, no trading, no crypto exchange); it is personal
  budgeting and account aggregation, read-only. Answer accordingly.
- **Target audience**: 18 and over (the policy turns away under-15s; 18+
  keeps the app out of the Families programme).
- **Content rating** (IARC): no violence, sex, gambling, drugs or user
  interaction between users — expected « 3+ » / « Tout public ».
- **Ads**: the app contains no ads.
- **Government app / health / news**: no.

## App Store — other answers

- **Age rating**: none of the content descriptors apply — 4+. [[The policy
  turns away under-15s; Apple's rating is about content, so 4+ stays
  correct.]]
- **Content rights**: no third-party content.
- **Export compliance**: answered in the build (`usesNonExemptEncryption:
  false` in `app.json`).
