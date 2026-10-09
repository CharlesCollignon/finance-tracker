# Registre des activités de traitement — Pluclair

> **Projet à relire** (1ᵉʳ octobre 2026). Tenu au titre de l'article 30 du RGPD :
> l'exemption des structures de moins de 250 personnes ne s'applique pas,
> parce que les traitements ci-dessous ne sont pas occasionnels et portent sur
> des données bancaires. Rédigé d'après ce que l'application fait réellement ;
> à mettre à jour dans le même temps que le code. Les `[[…]]` sont à compléter
> par le responsable du traitement. Ce document n'est pas un avis juridique.

## Responsable du traitement

- **Identité** : [[nom et prénoms de l'éditeur, ou dénomination de la société]]
- **Adresse** : [[adresse]]
- **Contact pour les données personnelles** : [[adresse e-mail]]
- **Délégué à la protection des données** : aucun désigné (non obligatoire pour
  ce traitement) — [[à confirmer]]

## Sous-traitants et destinataires communs

| Acteur                                  | Rôle                                                                    | Lieu des données                                    | Garantie                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Supabase                                | Base de données, authentification                                       | Union européenne — [[région exacte]]                | Accord de sous-traitance (DPA v1, 1ᵉʳ août 2026) ; clauses contractuelles types pour tout accès hors UE |
| Vercel Inc.                             | Hébergement du site et des fonctions serveur                            | Fonctions à Paris (`cdg1`) ; société aux États-Unis | Certification au cadre UE–États-Unis (Data Privacy Framework) ; DPA                                     |
| OpenRouter, Inc.                        | Si l'utilisateur connecte son propre compte IA — seule voie vers les lectures et les questions : transmission au modèle qu'il a choisi | États-Unis, puis selon le fournisseur du modèle | Sur le compte de l'utilisateur, à sa demande, après consentement ; [[conditions d'OpenRouter à vérifier]] |
| Expo, Apple, Google, Mozilla, Microsoft | Acheminement des notifications                                          | Selon le service                                    | Notifications web chiffrées de bout en bout ; [[vérifier les conditions d'Expo]]                        |
| Google                                  | Connexion « Se connecter avec Google », si l'utilisateur la choisit     | Selon Google                                        | Responsable de traitement distinct                                                                      |

Hors de ce tableau, et responsables de leur propre traitement : **Tatic ApS
(open-banking.io, Danemark)** et **Enable Banking Oy (Finlande, prestataire de
services d'information sur les comptes enregistré auprès de la FIN-FSA)**,
auprès desquels l'utilisateur a lui-même ouvert un compte.

---

## 1. Comptes utilisateurs

- **Finalité** : créer et sécuriser le compte, se connecter, retenir les préférences.
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Personnes concernées** : les utilisateurs.
- **Données** : adresse e-mail ; nom et identifiant fournis par Google en cas de
  connexion Google ; clés publiques des clés d'accès (passkeys) ; sessions ;
  préférences (langue, devise, invitations écartées).
- **Destinataires** : Supabase, Vercel ; Google si l'utilisateur l'a choisi.
- **Durée** : tant que le compte existe ; suppression immédiate à la
  suppression du compte (Profil → Supprimer le compte), sauvegardes écrasées
  sous [[durée de conservation des sauvegardes Supabase]].
- **Sécurité** : sécurité au niveau des lignes (RLS) ; TLS ; mots de passe
  gérés par Supabase Auth.

## 2. Tenue du budget

- **Finalité** : tenir les comptes de l'utilisateur — opérations, catégories,
  charges récurrentes, plafonds, objectifs, portefeuilles et positions,
  clôtures de mois, étiquettes et notes.
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Données** : ce que l'utilisateur saisit ou importe (relevés CSV : seules
  les lignes conservées sont enregistrées, pas le fichier).
- **Destinataires** : Supabase, Vercel.
- **Durée** : tant que le compte existe. Une écriture supprimée est conservée
        pour permettre l'annulation ; **la tâche qui l'efface définitivement n'est
        pas encore programmée** — [[durée retenue, 30 jours proposés, et date de mise
        en place]].
- **Sécurité** : RLS ; chaque ligne rattachée à son compte.

## 3. Connexion bancaire

- **Finalité** : afficher dans le budget les comptes, soldes et opérations
  bancaires de l'utilisateur, et classer ces opérations.
- **Base légale** : consentement (art. 6.1.a), recueilli à l'écran au dépôt du
  fichier d'identifiants, daté et versionné (`bank_connections.consent_version`,
  `consent_given_at`) ; **consentement explicite au titre de l'article 9.2.a**
  pour les catégories particulières que les opérations peuvent révéler (santé,
  convictions, appartenance syndicale…). Retrait à tout moment par la
  déconnexion.
- **Source des données** : le compte open-banking.io de l'utilisateur, que
  celui-ci alimente via Enable Banking Oy avec le consentement donné à sa banque.
- **Données** : le fichier d'identifiants (clé API et clé privée — **seules ces
  deux valeurs sont conservées**) ; par compte : nom, devise, solde déclaré ;
  par opération : date, montant, devise, sens, libellé, contrepartie, code
  catégorie commerçant ; état de la connexion et date de fin du consentement
  bancaire.
- **Accès à la banque** : uniquement lorsque l'utilisateur demande une
  actualisation ; les traitements programmés lisent seulement ce que le compte
  open-banking.io contient déjà.
- **Destinataires** : Supabase, Vercel. Aucun identifiant bancaire n'est jamais reçu.
- **Durée** : fichier d'identifiants — jusqu'à la déconnexion, son
  remplacement ou la suppression du compte ; opérations importées — durée du
  compte, ou suppression à la déconnexion si l'utilisateur le choisit.
- **Sécurité** : chiffrement AES-256-GCM sous une clé détenue hors de la base
  (`BANK_SECRETS_KEY`, rotation prévue) ; table inaccessible aux deux
  applications ; jamais renvoyé au navigateur ni au téléphone, jamais
  journalisé ; adresse de l'API figée pour qu'un fichier ne puisse détourner la
  clé ; ouverture par indicateur (`bank.connect`), compte par compte.

## 4. Notifications

- **Finalité** : envoyer les rappels (nouveau mois, plafond dépassé, charges
  arrivées, consentement bancaire à renouveler) et les moments d'un bien
  immobilier (moitié d'un prêt remboursée, dernière échéance, nouvelle
  estimation), qui citent le nom du prêt, du bien et des montants.
- **Base légale** : consentement donné par l'autorisation de notification de
  l'appareil ou du navigateur (art. 6.1.a) — [[à confirmer : ou exécution du contrat]].
- **Données** : abonnement push ou jeton Expo, agent utilisateur du
  navigateur, journal des rappels envoyés.
- **Destinataires** : Vercel, Supabase, services push (voir tableau).
- **Durée** : jusqu'au retrait de l'autorisation ou à la suppression du
  compte ; journal des rappels — durée du compte.

## 5. Lectures et questions rédigées par un modèle d'IA

- **Finalité** : rédiger les courtes lectures du mois, d'une catégorie ou d'un
  portefeuille, et répondre aux questions posées dans « Questions ».
- **Seulement avec un compte IA connecté** (migration 053) : Pluclair n'a pas
  de modèle à lui depuis le 9 octobre 2026. Les lectures et les réponses sont
  rédigées sur le compte OpenRouter de l'utilisateur, par le modèle qu'il a
  choisi, à ses frais. Sans compte connecté, rien n'est envoyé.
- **Données transmises** à OpenRouter (États-Unis), puis au fournisseur du
  modèle (Mistral, OpenAI ou Anthropic) : noms des catégories et totaux du
  mois, ou fonds d'un portefeuille et leurs valeurs, le nom et l'ISIN d'un
  fonds à lire, la question telle que tapée avec les seuls totaux utiles pour
  y répondre ; jamais le nom, l'e-mail ni les opérations une à une.
- **Base légale** : le consentement de l'utilisateur, recueilli avant la
  connexion (art. 6.1.a). La clé du compte est conservée chiffrée (AES-256-GCM,
  clé maître `AI_SECRETS_KEY`) et supprimée à la déconnexion.
- **Durée** : lectures conservées [[durée de conservation des lectures]].

## 6. Journaux techniques

- **Finalité** : sécurité et diagnostic des pannes.
- **Base légale** : intérêt légitime (art. 6.1.f).
- **Données** : journaux de requêtes de l'hébergeur.
- **Durée** : [[durée de conservation des journaux Vercel]].

## 7. Biens immobiliers et prêts

- **Finalité** : suivre les biens que l'utilisateur possède — ce qu'ils ont
  coûté, les prêts qui les ont financés et leurs mensualités, ce qu'ils valent
  d'après les ventes alentour (onglet Immobilier, ouvert compte par compte).
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Données** : nom du bien, type et usage, commune (code INSEE), code postal,
  coordonnées du point de l'adresse, surface, pièces, classe énergie (DPE),
  part détenue, prix d'achat, frais et travaux, estimation de l'utilisateur ;
  pour chaque prêt : montant, taux, durée, dates, assurance, frais, part empruntée, capital
  restant dû indiqué par la banque ; le relevé du marché calculé pour le
  bien et, pour un bien loué, les loyers d'annonce relevés pour sa commune.
  Le loyer lui-même est une opération récurrente (section du budget saisi).
  **L'adresse complète n'est conservée que si l'utilisateur le demande** ; par
  défaut seuls la commune et le point sont gardés, pour comparer le bien aux
  ventes dans un rayon de 500 m.
- **Destinataires** : Supabase, Vercel ; l'**IGN (Géoplateforme)** reçoit le
      texte de l'adresse au moment où l'utilisateur la saisit, pour la retrouver.
      La requête part du serveur de Pluclair : l'IGN ne reçoit ni l'adresse IP de
      l'utilisateur, ni son identité, ni aucune autre donnée du compte —
      [[vérifier les conditions d'utilisation de la Géoplateforme et la durée de
      conservation de ses journaux]].
- **Durée** : tant que le compte existe ; supprimer un bien supprime ses
  prêts, son relevé du marché et ses loyers d'annonce, et « Supprimer toutes
  mes données » les supprime tous.
- **Sécurité** : RLS sur les biens, les prêts, les relevés et les loyers
  d'annonce ; chaque ligne rattachée à son compte, et aucune lisible par un
  autre compte. Le relevé
  est rangé avec le bien plutôt que dans une table commune par lieu, qui
  aurait laissé voir à tout compte les quartiers où des utilisateurs
  possèdent un logement.

## 8. Mesure d'audience

- **Finalité** : savoir si l'application sert, par trois chiffres d'ensemble
  — retour après un mois, ouverture plusieurs jours par semaine, mois
  clôturés (vue `insights.figures`). Jamais pour adapter ce qu'un utilisateur
  voit.
- **Base légale** : intérêt légitime (art. 6.1.f), avec droit d'opposition par
  l'interrupteur « Mesure d'audience » du Profil
  (`user_preferences.measure_audience`). Lecture faite de l'exemption de la
  CNIL pour la mesure d'audience (délibération 2020-091), écrite pour les
  traceurs sur l'appareil : ici rien n'est déposé sur l'appareil, le comptage
  est fait par le serveur — [[à confirmer]].
- **Données** : un identifiant calculé (SHA-256 de l'identifiant du compte et
  d'un sel propre à la base, que nul client ne lit), le jour, et le nombre
  d'opérations ajoutées, de mois clôturés et de questions « Puis-je me
  permettre ? » ce jour-là. Aucun montant, commerce ni texte (migration 058).
- **Destinataires** : Supabase ; consulté par l'éditeur seul.
- **Durée** : 13 mois, effacé par la tâche de nuit ; à la suppression du
  compte, effacé aussitôt.

## Hors registre : cours de marché, ventes immobilières et indices

Les cours des fonds sont consultés sur Yahoo Finance et sur les pages des
émetteurs (justETF, iShares) à partir du seul identifiant du fonds : aucune
donnée personnelle n'est transmise.

Les ventes immobilières (fichiers DVF publiés par Etalab, données publiques)
sont téléchargées par commune, et l'indice des prix des logements anciens
Notaires-INSEE par série : la requête ne porte que sur un code de commune ou
un identifiant de série, le même pour tout utilisateur, et aucune donnée
personnelle n'est transmise. Pluclair n'en conserve que des agrégats (médiane
et quartiles par bien) et l'indice publié.

La carte des loyers de l'ANIL (données publiques, data.gouv.fr) est
téléchargée en entier, table par table : la requête est la même pour tout
utilisateur et ne transmet aucune donnée personnelle. Pluclair n'en garde,
pour chaque bien loué, que la ligne de sa commune.

---

**Validation** : [[nom, date]] — à revoir à chaque changement de traitement et
au moins une fois par an.
