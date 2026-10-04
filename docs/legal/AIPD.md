# Analyse d'impact relative à la protection des données (AIPD) — Pluclair

> **Projet à relire** (1ᵉʳ octobre 2026), selon la méthode de la CNIL
> (contexte, principes fondamentaux, risques, plan d'action). Une AIPD est
> attendue ici : le CEPD estime qu'elle sera « très probablement » requise pour
> les données de comptes de paiement (lignes directrices 06/2020), et la CNIL
> range les données de paiement parmi les données « à caractère hautement
> personnel » (livre blanc, 2021) ; la catégorisation des dépenses ajoute un
> second critère. Les `[[…]]` sont à compléter par le responsable du
> traitement. Ce document n'est pas un avis juridique.

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
l'adresse IP ni l'identité de l'utilisateur. [[Confirmer que ce traitement ne
justifie pas d'analyse distincte.]]

- **Responsable** : [[identité de l'éditeur]].
- **Personnes concernées** : utilisateurs de Pluclair ayant choisi de
  connecter leur banque (fonction ouverte compte par compte).
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
européenne, [[région exacte]]) ; applications web et mobile ; API
d'open-banking.io.

## 2. Principes fondamentaux

| Principe            | Mesure                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité déterminée | Budget personnel uniquement ; aucune publicité, aucun profilage commercial, aucune revente, aucune décision automatisée produisant des effets juridiques.                                                  |
| Base légale         | Consentement (6.1.a) et consentement explicite pour les catégories particulières (9.2.a), recueillis avant la réception du fichier, datés et versionnés ; nouveau consentement demandé si le texte change. |
| Minimisation        | Aucun identifiant bancaire reçu ; seules la clé API et la clé privée sont conservées du fichier ; Mistral AI — ou, si l'utilisateur connecte son propre compte IA, OpenRouter et le fournisseur du modèle choisi — ne reçoit que des agrégats (noms de catégories, totaux).                                      |
| Exactitude          | Les données viennent de la banque ; doublons détectés et rattachés plutôt que dupliqués ; annulation des décisions de revue.                                                                               |
| Durées              | Fichier : jusqu'à la déconnexion ou la suppression du compte ; opérations : durée du compte ; écritures supprimées : [[durée — l'effacement programmé reste à mettre en place]].                           |
| Information         | Politique de confidentialité (français et anglais), rappels à l'écran avant le dépôt du fichier.                                                                                                           |
| Droits              | Correction et suppression de chaque écriture ; export d'un mois au format CSV ; déconnexion ; suppression du compte ; [[export complet de toutes les données — à prévoir pour la portabilité]].            |
| Sous-traitance      | Supabase, Vercel, Mistral AI : [[accords de sous-traitance signés ou acceptés — à vérifier]]. OpenRouter n'intervient que sur le compte IA que l'utilisateur connecte lui-même.                                                                                                              |
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
  d'administration limité à [[personnes ayant un accès d'administration]].
- **Vraisemblance résiduelle** : limitée — [[à valider]].

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
- **Mesures** : sauvegardes Supabase ([[fréquence et durée]]) ; export CSV ;
  les données bancaires restent disponibles chez open-banking.io.
- **Vraisemblance résiduelle** : négligeable à limitée.

### 3.4 Risques hors RGPD à suivre

- **Qualification réglementaire** : la lecture du compte open-banking.io de
  l'utilisateur pourrait être qualifiée de service d'information sur les
  comptes (CMF L314-1 II 8°) ; question posée à l'ACPR — [[date et réponse]].
- **Dépendance contractuelle** : open-banking.io pourrait suspendre les
  comptes dont les identifiants sont confiés à un tiers ; accord écrit
  demandé — [[date et réponse]].

## 4. Plan d'action

| Action                                                          | Échéance                                       | Statut                                  |
| --------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| Consentement daté et versionné avant le dépôt du fichier        | —                                              | Fait                                    |
| Aucune sollicitation programmée de la banque                    | —                                              | Fait                                    |
| Fonctions serveur à Paris, données dans l'UE                    | —                                              | Fait ([[confirmer la région Supabase]]) |
| Mentions légales, politique de confidentialité, conditions      | [[date]]                                       | Projets à compléter et faire relire     |
| Effacement programmé des écritures supprimées                   | [[date]]                                       | À faire                                 |
| Export complet des données (portabilité)                        | [[date]]                                       | À faire                                 |
| Procédure de violation de données (notification CNIL sous 72 h) | [[date]]                                       | À rédiger                               |
| Accords de sous-traitance vérifiés                              | [[date]]                                       | À faire                                 |
| Question à l'ACPR et accord d'open-banking.io                   | [[date]]                                       | À envoyer                               |
| Biens immobiliers : adresse réduite à la commune et au point    | —                                              | Fait                                    |
| Conditions de la Géoplateforme de l'IGN vérifiées               | [[date]]                                       | À faire                                 |
| Revue de cette AIPD                                             | Annuelle, et à chaque changement du traitement | —                                       |

## 5. Validation

- **Avis du délégué à la protection des données** : sans objet — [[à confirmer]].
- **Avis des personnes concernées** : [[recueilli ou non, et comment]].
- **Décision du responsable du traitement** : [[mise en œuvre acceptée / sous
        conditions]], le [[date]], [[nom]].
