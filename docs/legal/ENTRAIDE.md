# Entraide — cadre juridique et questions pour l'avocat

Brouillon du 13 octobre 2026. Entraide n'est pas encore construit (phase 5b de `docs/plans/BLOG_CHANGELOG_PLAN.md`). Ses règles, « Les règles d'Entraide », sont un document à part : `apps/web/components/marketing/entraide-rules-copy.fr.ts` (et sa version anglaise), servi sur `/blog/entraide/regles`. Il a son propre interrupteur de brouillon, `ENTRAIDE_RULES_DRAFT` (`legal-status.ts`) : la page répond 404 en production tant qu'il vaut `true`, comme la politique de confidentialité et les conditions avec `LEGAL_DRAFT`. Les deux se signent séparément, pour que la politique et les conditions puissent l'être avant qu'Entraide existe.

## Ce qu'est Entraide

Décidé avec l'éditeur le 13 octobre 2026 :

- un espace public de questions et de réponses entre personnes qui utilisent Pluclair, sur pluclair.com, lisible par tous et indexé ; écrire, réagir et signaler demandent un compte ;
- un pseudonyme choisi à la première publication, jamais le nom ni l'e-mail ;
- une modération a posteriori : un message paraît tout de suite, tout membre peut le signaler, l'éditeur examine chaque signalement ; trois signalements de membres différents masquent le message jusqu'à examen ; un pseudonyme peut être exclu ;
- ni score, ni points, ni classement ;
- à la suppression d'un compte, ses messages deviennent « Message supprimé » et leur texte est effacé ;
- l'engagement « Pluclair ne dit pas quoi faire » (PRODUCT.md) lie la voix de Pluclair (l'application, les guides, les réponses de l'éditeur marquées « Pluclair ») ; les réponses des membres sont présentées comme leur avis, jamais comme un conseil de Pluclair.

## Le cadre retenu dans le texte, à vérifier

- **Hébergeur.** Pour ce que publient les membres, Pluclair se présente comme hébergeur au sens du règlement (UE) 2022/2065 (DSA) et de la LCEN : pas de contrôle préalable, retrait prompt d'un contenu illicite dès qu'il en a connaissance.
- **Plateforme en ligne.** Entraide stocke et diffuse au public des contenus à la demande de ses membres : c'est une plateforme en ligne au sens du DSA. Le texte applique, quelle que soit la réponse à la question 2 :
  - art. 11 et 12 — points de contact pour les autorités et pour les membres (pluclair.app@gmail.com) ;
  - art. 14 — des règles de modération claires dans les conditions ;
  - art. 16 — un mécanisme de notification ouvert à tous, avec les mentions qu'il exige ;
  - art. 17 — un exposé des motifs à l'auteur de tout message masqué ou pseudonyme exclu ;
  - art. 18 — l'information des autorités en cas de menace pour la vie ou la sécurité d'une personne ;
  - de façon volontaire : une contestation possible pendant six mois, réexaminée par une personne (sur le modèle de l'art. 20), et l'exclusion d'un pseudonyme qui récidive (sur le modèle de l'art. 23).
- **RGPD.** Bases légales retenues : l'exécution du contrat pour publier et afficher les messages, l'intérêt légitime pour la modération, l'obligation légale pour la conservation imposée aux hébergeurs.

## Questions pour l'avocat

1. **Données à conserver sur qui a publié quoi.** Le décret n° 2021-1362 du 20 octobre 2021 fixe les données qu'un hébergeur doit conserver pour identifier l'auteur d'un contenu (identité, informations du compte, données techniques comme l'adresse IP), et pour combien de temps (un an à compter de la création du contenu, d'après les textes consultés — à confirmer). Que doit conserver Pluclair, éditeur particulier sans activité commerciale, pour chaque question et chaque réponse ? Faut-il enregistrer l'adresse IP de chaque publication ? Ces données doivent-elles survivre à la suppression du compte ?
2. **Exemption des petites entreprises.** L'art. 19 du DSA écarte les micro et petites entreprises des obligations propres aux plateformes (art. 20 à 28, sauf art. 24 §3), et l'art. 15 §2 des rapports de transparence. S'applique-t-elle à un particulier qui édite Pluclair sans activité commerciale ? Si non : traitement interne des réclamations, règlement extrajudiciaire des litiges (art. 21), signaleurs de confiance (art. 22), rapports de transparence, transmission des exposés des motifs à la base de données de la Commission (art. 24 §5).
3. **Références de la LCEN.** La loi n° 2024-449 du 21 mai 2024 (SREN) a renuméroté la LCEN. Le texte cite donc la loi sans numéro d'article. Quels articles citer aujourd'hui pour le statut d'hébergeur et pour l'obligation de conservation ? Le décret n° 2021-1362 est-il toujours le texte applicable ?
4. **Durée de conservation des signalements et des décisions.** Proposition : un an après la décision, pour répondre à une contestation ou à une autorité. Suffisant, ou trop ?
5. **Licence sur les contenus.** La section « Ce que vous publiez » accorde à Pluclair, gratuitement et tant que le message reste dans Entraide, le droit de le conserver, de l'afficher et de le garder dans sa conversation. Suffisant ? Faut-il la faire accepter explicitement à la première publication ?
6. **Mineurs.** Un compte Pluclair est ouvert dès 15 ans. Un espace public demande-t-il des précautions particulières pour les 15–17 ans ?
7. **Forme du document.** « Les règles d'Entraide » peut-il valoir conditions générales au sens de l'art. 14 du DSA en étant rattaché aux conditions d'utilisation par une ligne, ou faut-il l'intégrer aux conditions elles-mêmes ?

## À l'ouverture d'Entraide (phase 5b)

- La politique de confidentialité et les conditions d'utilisation reçoivent chacune une ligne qui renvoie à ces règles, dans le même commit que le code qui stocke les messages.
- Le registre des traitements et l'AIPD reçoivent le traitement « Entraide ».
- Les blancs `[[…]]` des règles sont remplis avec les réponses aux questions 1 et 4, et `ENTRAIDE_RULES_DRAFT` passe à `false` une fois le texte relu ; `entraide-rules-copy.test.ts` échoue si un blanc subsiste.
