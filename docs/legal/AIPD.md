# Analyse d'impact relative à la protection des données (AIPD) — Pluclair

> **Tenue à jour au 13 octobre 2026**, selon la méthode de la CNIL
> (contexte, principes fondamentaux, risques, plan d'action). Une AIPD est
> attendue ici : le CEPD estime qu'elle sera « très probablement » requise pour
> les données de comptes de paiement (lignes directrices 06/2020), et la CNIL
> range les données de paiement parmi les données « à caractère hautement
> personnel » (livre blanc, 2021) ; la catégorisation des dépenses ajoute un
> second critère. Complétée par l'éditeur avec l'aide de l'agent de
> développement, sans relecture d'avocat : partout où un choix restait
> ouvert, le plus prudent est retenu. Ce document n'est pas un avis juridique.

## 1. Contexte

### 1.1 Le traitement

Pluclair est une application gratuite de suivi du budget personnel (web et
téléphone), destinée aux particuliers en France. Le traitement étudié ici est
la **connexion bancaire** ; les autres traitements (compte, budget saisi,
biens immobiliers et prêts, notifications, lectures par IA) sont décrits au
registre et présentent un risque moindre.

Les biens immobiliers ajoutent une donnée de localisation : le point de
l'adresse d'un logement, souvent le domicile. Elle est réduite à la commune et
à ce point (l'adresse écrite n'est gardée qu'à la demande de l'utilisateur),
protégée comme le reste par la sécurité au niveau des lignes, et l'adresse
n'est envoyée au service de géocodage de l'IGN que depuis le serveur, sans
l'adresse IP ni l'identité de l'utilisateur. Ce traitement n'appelle pas
d'analyse distincte : il ne suit personne, ne croise rien, et ne garde du lieu
que ce qu'il faut pour comparer un bien aux ventes voisines.

Entraide (questions et réponses publiques entre membres, sous pseudonyme)
n'en appelle pas non plus : rien n'y est publié que ce que le membre écrit
lui-même, l'identifiant du compte n'est jamais montré, les IBAN, numéros de
carte, e-mails et téléphones sont masqués avant publication, et ce qui
identifie l'auteur n'est gardé qu'un an, pour les seules autorités (registre,
section 11).

- **Responsable** : Charles Collignon, éditeur à titre non professionnel
  (contact : pluclair.app@gmail.com).
- **Personnes concernées** : l'éditeur seul depuis le 13 octobre 2026 (la
  fonction est fermée aux autres comptes, section 3.4) ; l'analyse reste
  valable si elle rouvre.
- **Finalité** : afficher dans le budget les comptes, soldes et opérations
  bancaires, et classer ces opérations.

### 1.2 Cycle de vie des données

1. L'utilisateur ouvre lui-même un compte chez open-banking.io (Tatic ApS,
   Danemark), le paie, et y connecte sa banque ; le consentement DSP2 est donné
   auprès de la banque via Enable Banking Oy (prestataire d'information sur
   les comptes enregistré auprès de la FIN-FSA).
2. Il télécharge chez open-banking.io son fichier d'identifiants
   (`credentials.json` : une clé API et sa clé privée de déchiffrement).
3. Dans Pluclair, il coche le consentement (daté, versionné) puis dépose le
   fichier. Le serveur le vérifie (taille, champs, adresse d'API figée),
   l'essaie en listant les comptes, puis ne conserve que les deux clés,
   chiffrées.
4. Pluclair lit le compte open-banking.io : en tâche de fond, seulement ce qui
   y est déjà ; **la banque n'est sollicitée que lorsque l'utilisateur demande
   une actualisation**.
5. Les opérations sont classées d'après l'historique de l'utilisateur ; ce qui
   ne peut l'être attend dans une revue.
6. À la déconnexion, le fichier est supprimé immédiatement ; l'utilisateur
   choisit de garder ou de retirer les opérations importées.

### 1.3 Supports

Fonctions serveur chez Vercel (Paris) ; base de données Supabase (Union
européenne, Francfort `eu-central-1`) ; applications web et mobile ; API
d'open-banking.io.

## 2. Principes fondamentaux

| Principe            | Mesure                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité déterminée | Budget personnel uniquement ; aucune publicité, aucun profilage commercial, aucune revente, aucune décision automatisée produisant des effets juridiques.                                                  |
| Base légale         | Consentement (6.1.a) et consentement explicite pour les catégories particulières (9.2.a), recueillis avant la réception du fichier, datés et versionnés ; nouveau consentement demandé si le texte change. |
| Minimisation        | Aucun identifiant bancaire reçu ; seules la clé API et la clé privée sont conservées du fichier ; seuls OpenRouter et le fournisseur du modèle choisi, et seulement si l'utilisateur connecte son propre compte IA, reçoivent des agrégats (noms de catégories, totaux).                                      |
| Exactitude          | Les données viennent de la banque ; doublons détectés et rattachés plutôt que dupliqués ; annulation des décisions de revue.                                                                               |
| Durées              | Fichier : jusqu'à la déconnexion ou la suppression du compte ; opérations : durée du compte ; écritures supprimées : 30 jours, puis effacées par la tâche de chaque nuit.                           |
| Information         | Politique de confidentialité (français et anglais), rappels à l'écran avant le dépôt du fichier.                                                                                                           |
| Droits              | Correction et suppression de chaque écriture ; export d'un mois au format CSV ; déconnexion ; suppression du compte ; export complet sur simple demande à pluclair.app@gmail.com, sous un mois (portabilité, art. 20).            |
| Sous-traitance      | Supabase, Vercel : accords de sous-traitance intégrés à leurs conditions de service, acceptés à l'ouverture des comptes. OpenRouter n'intervient que sur le compte IA que l'utilisateur connecte lui-même.                                                                                                              |
| Transferts          | Données stockées dans l'UE ; Vercel Inc. certifiée au cadre UE–États-Unis (validé par le Tribunal de l'UE le 3 septembre 2025, pourvoi pendant) ; clauses contractuelles types chez Supabase. Avec un compte IA connecté, les chiffres d'une lecture partent vers OpenRouter et le fournisseur du modèle, le plus souvent aux États-Unis, à la demande de l'utilisateur et après information.              |

## 3. Risques

Échelle de la CNIL : négligeable, limitée, importante, maximale.

### 3.1 Accès illégitime aux données

- **Ce qui est redouté** : la fuite des clés d'un utilisateur, qui permettent
  de lire tout son historique bancaire ; la révélation de sa situation
  financière et des informations sensibles que trahissent ses dépenses ; leur
  usage pour une fraude ou une escroquerie ciblée.
- **Sources** : attaquant externe compromettant le serveur ou la base ;
  personne disposant d'un accès d'administration ; vol d'un appareil connecté.
- **Gravité** : maximale (données financières et catégories particulières).
- **Mesures** : chiffrement AES-256-GCM sous une clé détenue hors de la base,
  avec rotation ; table des secrets sans aucune politique d'accès pour les
  applications ; clés jamais renvoyées au navigateur ni au téléphone, jamais
  journalisées ; copie du fichier sur le téléphone supprimée après envoi ;
  adresse de l'API figée ; sécurité au niveau des lignes sur toutes les
  tables ; verrouillage biométrique de l'application mobile ; accès
  d'administration limité à l'éditeur seul.
- **Vraisemblance résiduelle** : limitée.

### 3.2 Modification non désirée des données

- **Ce qui est redouté** : des écritures faussées (import en double, mauvaise
  catégorie) qui faussent le budget et les décisions de l'utilisateur.
- **Gravité** : limitée.
- **Mesures** : détection des doublons ; décisions de revue annulables ;
  suppression réversible des écritures ; RLS.
- **Vraisemblance résiduelle** : limitée.

### 3.3 Disparition des données

- **Ce qui est redouté** : la perte de l'historique saisi ou importé.
- **Gravité** : importante.
- **Mesures** : export CSV ; les données bancaires restent disponibles chez
  open-banking.io. L'offre Supabase utilisée ne comprend aucune sauvegarde :
  une perte côté hébergeur ne se rattraperait pas, ce que la politique de
  confidentialité dit.
- **Vraisemblance résiduelle** : limitée.

### 3.4 Risques hors RGPD à suivre

- **Qualification réglementaire** : la lecture du compte open-banking.io de
  l'utilisateur pourrait être qualifiée de service d'information sur les
  comptes (CMF L314-1 II 8°), activité soumise à enregistrement auprès de
  l'ACPR. L'utilisateur contracte lui-même avec open-banking.io, qui s'appuie
  sur un prestataire enregistré (Enable Banking), et confie à Pluclair un
  accès en lecture seule à ses propres données : c'est l'argument pour que
  Pluclair n'en fournisse pas un lui-même, mais il n'a été confirmé ni par
  l'ACPR ni par open-banking.io.
- **Dépendance contractuelle** : accord écrit demandé à open-banking.io par
  e-mail le 12 octobre 2026 ; réponse du même jour : l'accès pour le compte
  des utilisateurs d'une application tierce « n'est pas possible pour le
  moment ».
- **Décision (13 octobre 2026)** : la connexion bancaire est fermée à tous les
  comptes sauf celui de l'éditeur, qui lit ses propres données par son propre
  compte open-banking.io (`bankOpenTo`, `apps/web/lib/bank/client.ts`) ; le
  site ne la propose plus. Les deux risques ci-dessus tombent avec elle. Elle
  ne rouvrira qu'avec l'accord écrit d'open-banking.io et une réponse sur la
  qualification.

## 4. Plan d'action

| Action                                                          | Échéance                                       | Statut                                  |
| --------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| Consentement daté et versionné avant le dépôt du fichier        | —                                              | Fait                                    |
| Aucune sollicitation programmée de la banque                    | —                                              | Fait                                    |
| Fonctions serveur à Paris, données dans l'UE                    | —                                              | Fait (Supabase à Francfort)             |
| Mentions légales, politique de confidentialité, conditions      | 13 octobre 2026                                | Complétées ; publiées à la décision de l'éditeur |
| Effacement programmé des écritures supprimées                   | —                                              | Fait (30 jours, tâche de nuit)          |
| Export complet des données (portabilité)                        | —                                              | Sur demande, sous un mois ; en un geste à construire |
| Procédure de violation de données (notification CNIL sous 72 h) | 13 octobre 2026                                | Rédigée (section 6)                     |
| Accords de sous-traitance vérifiés                              | 13 octobre 2026                                | Fait (intégrés aux conditions)          |
| Accord écrit d'open-banking.io                                  | 12 octobre 2026                                | Refusé le jour même                     |
| Connexion bancaire fermée aux autres comptes                    | 13 octobre 2026                                | Fait (3.4)                              |
| Biens immobiliers : adresse réduite à la commune et au point    | —                                              | Fait                                    |
| Conditions de la Géoplateforme de l'IGN vérifiées               | 13 octobre 2026                                | Fait (service public ouvert)            |
| Revue de cette AIPD                                             | Annuelle, et à chaque changement du traitement | —                                       |

## 5. Validation

- **Avis du délégué à la protection des données** : sans objet, aucun
  délégué n'étant obligatoire (registre).
- **Avis des personnes concernées** : non recueilli formellement ; les retours
  passent par « Envoyer un retour » et Entraide.
- **Décision du responsable du traitement** : mise en œuvre acceptée ; la
  connexion bancaire fermée à tous les comptes sauf celui de l'éditeur
  (section 3.4) — le 13 octobre 2026, Charles Collignon.

## 6. Procédure en cas de violation de données

1. **Constater et contenir** : couper l'accès en cause (clé révoquée, compte
   d'administration sécurisé, `BANK_SECRETS_KEY` ou `AI_SECRETS_KEY`
   changée), garder les traces.
2. **Évaluer** : quelles données, combien de personnes, quel risque pour
   elles.
3. **Notifier la CNIL sous 72 heures** (notifications.cnil.fr) dès qu'un
   risque pour les personnes ne peut pas être écarté, même si tout n'est pas
   encore connu, en complétant ensuite.
4. **Prévenir les personnes concernées** sans tarder si le risque est élevé —
   par exemple des clés bancaires exposées : leur dire de supprimer la clé API
   chez open-banking.io.
5. **Consigner** chaque violation, même non notifiée, ici même : date, faits,
   effets, mesures prises.
