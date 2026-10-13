# Registre des activités de traitement — Pluclair

> **Tenu à jour au 13 octobre 2026.** Tenu au titre de l'article 30 du RGPD :
> l'exemption des structures de moins de 250 personnes ne s'applique pas,
> parce que les traitements ci-dessous ne sont pas occasionnels et portent sur
> des données bancaires. Rédigé d'après ce que l'application fait réellement ;
> à mettre à jour dans le même temps que le code. Complété par l'éditeur avec
> l'aide de l'agent de développement, sans relecture d'avocat : les choix y sont
> les plus prudents. Ce document n'est pas un avis juridique.

## Responsable du traitement

- **Identité** : Charles Collignon, personne physique, éditeur à titre non
  professionnel (pas de SIREN).
- **Adresse** : non écrite ici, ce dépôt étant public ; tenue à la
  disposition de la CNIL sur demande.
- **Contact pour les données personnelles** : pluclair.app@gmail.com.
- **Délégué à la protection des données** : aucun désigné. Il n'est pas
  obligatoire : l'éditeur n'est pas une autorité publique, et ses traitements
  ne consistent ni en un suivi régulier et systématique de personnes à grande
  échelle, ni en un traitement à grande échelle de catégories particulières de
  données (art. 37 du RGPD).

## Sous-traitants et destinataires communs

| Acteur                                  | Rôle                                                                    | Lieu des données                                    | Garantie                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Supabase                                | Base de données, authentification                                       | Union européenne — Francfort (`eu-central-1`)       | Accord de sous-traitance (DPA v1, 1ᵉʳ août 2026) ; clauses contractuelles types pour tout accès hors UE |
| Vercel Inc.                             | Hébergement du site et des fonctions serveur                            | Fonctions à Paris (`cdg1`) ; société aux États-Unis | Certification au cadre UE–États-Unis (Data Privacy Framework) ; DPA                                     |
| OpenRouter, Inc.                        | Si l'utilisateur connecte son propre compte IA — seule voie vers les lectures et les questions : transmission au modèle qu'il a choisi | États-Unis, puis selon le fournisseur du modèle | Sur le compte de l'utilisateur, à sa demande, après consentement ; OpenRouter agit selon les conditions que l'utilisateur a acceptées en ouvrant ce compte, auxquelles Pluclair n'est pas partie |
| Expo, Apple, Google, Mozilla, Microsoft | Acheminement des notifications                                          | Selon le service                                    | Notifications web chiffrées de bout en bout ; Expo ne reçoit que le jeton de l'appareil, le titre et le texte du rappel, pour l'acheminer |
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
  suppression du compte (Profil → Supprimer le compte). L'offre Supabase utilisée ne comprend
  aucune sauvegarde : ce qui est supprimé ne peut pas être restauré.
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
  30 jours pour permettre l'annulation, puis effacée par la tâche de chaque
  nuit (`sweep_deleted`, migration 036).
- **Sécurité** : RLS ; chaque ligne rattachée à son compte.

## 3. Connexion bancaire

Fermée à tous les comptes sauf celui de l'éditeur depuis le 13 octobre 2026 :
open-banking.io ne permet pas à ses clients de confier leur accès à une
application tierce. Ce qui suit vaut pour ce seul compte, et si elle rouvre.

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
  l'appareil ou du navigateur (art. 6.1.a), retiré à tout moment par le
  réglage de l'appareil ou les interrupteurs du Profil.
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
  fonds à lire ; pour « Questions », les questions telles que tapées, les
  réponses déjà données dans la conversation et ce que le modèle consulte
  pour répondre — totaux par mois, catégorie ou commerce, opérations
  récurrentes, comptes d'épargne, placements, prêts et, quand la question
  porte sur elles, des opérations une à une (date, libellé, catégorie,
  montant) ; jamais le nom, l'e-mail ni les identifiants bancaires.
- **Base légale** : le consentement de l'utilisateur, recueilli avant la
  connexion (art. 6.1.a). La clé du compte est conservée chiffrée (AES-256-GCM,
  clé maître `AI_SECRETS_KEY`) et supprimée à la déconnexion.
- **Durée** : les lectures — tant que le compte existe, supprimées avec lui ;
  les conversations de « Questions » — 30 jours, effacées par la tâche de nuit
  (`sweep_ask`, migration 064), ou plus tôt à la demande.

## 6. Journaux techniques

- **Finalité** : sécurité et diagnostic des pannes.
- **Base légale** : intérêt légitime (art. 6.1.f).
- **Données** : journaux de requêtes de l'hébergeur.
- **Durée** : celle que Vercel applique à ses journaux selon l'offre souscrite
  (de l'ordre de quelques heures à quelques jours) ; Pluclair n'en garde
  aucune copie.

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
      l'utilisateur, ni son identité, ni aucune autre donnée du compte. La
      Géoplateforme est un service public de l'État, ouvert à tous.
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
  est fait par le serveur, et les conditions de l'exemption sont tenues de
  toute façon — une seule finalité, des chiffres d'ensemble, 13 mois au plus,
  un droit d'opposition, aucun croisement avec d'autres traitements.
- **Données** : un identifiant calculé (SHA-256 de l'identifiant du compte et
  d'un sel propre à la base, que nul client ne lit), le jour, et le nombre
  d'opérations ajoutées, de mois clôturés et de questions « Puis-je me
  permettre ? » ce jour-là. Aucun montant, commerce ni texte (migration 058).
- **Destinataires** : Supabase ; consulté par l'éditeur seul.
- **Durée** : 13 mois, effacé par la tâche de nuit ; à la suppression du
  compte, effacé aussitôt.

## 9. Espace commun

- **Finalité** : réunir deux personnes autour de ce qu'elles partagent — un
  compte joint, des dépenses communes, un bien acheté ensemble.
- **Base légale** : exécution du contrat (art. 6.1.b) ; c'est l'utilisateur qui
  choisit de partager, et avec qui.
- **Données** : l'appartenance à l'espace et les invitations (lien valable
  sept jours, pour une personne) ; ce que l'un met dans l'espace commun, que
  l'autre voit et modifie ; le nom affiché de chacun ; une empreinte SHA-256
  de l'IBAN d'un compte, jamais l'IBAN, pour reconnaître le même compte joint.
- **Destinataires** : l'autre membre de l'espace, pour l'espace commun
  seulement ; Supabase, Vercel.
- **Durée** : tant que l'espace existe ; quitter l'espace ou supprimer son
  compte en retire aussitôt ; l'espace disparaît avec ses lignes quand la
  dernière personne le quitte.

## 10. « Nouveautés » : lecture, réactions et votes

- **Finalité** : dire ce qui est nouveau depuis la dernière lecture, sur le
  web et le téléphone ; laisser réagir aux nouveautés et voter pour ce qui se
  prépare.
- **Base légale** : exécution du contrat (art. 6.1.b).
- **Données** : la dernière nouveauté lue (migration 069) ; les réactions et
  votes — ce sur quoi, lequel, quand (migration 070), au plus 120 par heure.
- **Destinataires** : Supabase ; le public ne voit que des nombres, jamais qui
  a réagi.
- **Durée** : tant que le compte existe ; supprimés avec lui.

## 11. Entraide

Ouvert au public avec ses règles (`ENTRAIDE_RULES_DRAFT`) ; d'ici là, rien
n'est publié en production.

- **Finalité** : permettre aux membres de poser des questions sur l'argent au
  quotidien et d'y répondre publiquement ; modérer ; tenir les obligations
  d'un hébergeur.
- **Base légale** : exécution du contrat pour publier et afficher (art. 6.1.b) ;
  intérêt légitime pour la modération (art. 6.1.f) ; obligation légale pour la
  conservation des données d'identification (art. 6.1.c ; LCEN et décret
  n° 2021-1362 du 20 octobre 2021).
- **Personnes concernées** : les membres qui publient, réagissent ou signalent.
  Les visiteurs lisent sans qu'aucune donnée les concernant soit gardée.
- **Données** : le pseudonyme ; les questions, réponses et leurs dates ; les
  réactions « Utile » et « Merci » ; les signalements (motif et précision) ;
  les décisions de modération (mesure, règle, faits) ; pour chaque message
  écrit, modifié ou supprimé, l'identifiant et l'adresse e-mail du compte,
  l'adresse IP de la connexion et l'heure (migrations 071 à 073).
- **Destinataires** : le public — pseudonyme, messages, dates et nombre de
  réactions, jamais l'identifiant du compte ; Supabase, Vercel ; l'éditeur,
  pour la modération ; les autorités judiciaires, sur réquisition, pour les
  données d'identification.
- **Durée** : les messages, jusqu'à leur suppression par leur auteur ou celle
  du compte, où ils sont vidés et remplacés par « Message supprimé » ; les
  signalements et décisions, un an après la décision, une décision tant que la
  mesure dure ; les données d'identification, un an après chaque opération,
  y compris après la suppression du compte ; effacement par la tâche de nuit
  (`sweep_entraide`).
- **Sécurité** : lecture publique par des fonctions qui ne livrent jamais
  l'identifiant d'un compte ; RLS ; masquage des IBAN, numéros de carte,
  e-mails et téléphones avant publication ; données d'identification lisibles
  par le seul rôle de service.

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

**Validation** : Charles Collignon, 13 octobre 2026 — à revoir à chaque
changement de traitement et au moins une fois par an.
