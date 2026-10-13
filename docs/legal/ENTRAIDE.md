# Entraide — cadre juridique et choix retenus

Tenu à jour au 13 octobre 2026. Entraide est construit (phases 5b et 5c de `docs/plans/BLOG_CHANGELOG_PLAN.md`) et fermé au public jusqu'à son ouverture. Ses règles, « Les règles d'Entraide », sont un document à part : `apps/web/components/marketing/entraide-rules-copy.fr.ts` (et sa version anglaise), servi sur `/blog/entraide/regles`. Il a son propre interrupteur de brouillon, `ENTRAIDE_RULES_DRAFT` (`legal-status.ts`) : la page répond 404 en production tant qu'il vaut `true`, comme la politique de confidentialité et les conditions avec `LEGAL_DRAFT`. Les deux se signent séparément, pour que la politique et les conditions puissent l'être avant qu'Entraide existe.

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

## Les questions, et ce qui a été retenu

L'éditeur a choisi, le 13 octobre 2026, de ne pas consulter d'avocat et de
retenir partout l'option la plus prudente. Ce qui suit n'est pas un avis
juridique.

1. **Données à conserver sur qui a publié quoi.** Retenu : pour chaque
   question ou réponse écrite, modifiée ou supprimée, l'identifiant et
   l'adresse e-mail du compte, l'adresse IP de la connexion et l'heure,
   gardés un an après l'opération, même après la suppression du compte, lus
   par personne et remis aux seules autorités qui les demandent légalement
   (migration 073, `entraide_authorship` ; balayage de nuit `sweep_entraide`).
   C'est la lecture la plus large du décret n° 2021-1362.
2. **Exemption des petites entreprises (DSA, art. 19).** Retenu : ne pas s'en
   prévaloir pour ce qui coûte peu — contestation possible pendant six mois et
   réexamen par une personne (sur le modèle de l'art. 20), exposé des motifs
   à chaque mesure (art. 17), exclusion d'un pseudonyme qui récidive (sur le
   modèle de l'art. 23). Pour le reste (rapports de transparence, base de
   données de la Commission, signaleurs de confiance, règlement
   extrajudiciaire), Pluclair, sans salarié ni chiffre d'affaires, est au plus
   une microentreprise et en est dispensé ; risque jugé faible.
3. **Références de la LCEN.** Retenu : citer la loi sans numéro d'article,
   la numérotation ayant changé avec la loi SREN de 2024. Aucun effet sur les
   obligations.
4. **Durée de conservation des signalements et des décisions.** Retenu : un
   an après la décision ; une décision tant que la mesure qu'elle porte dure.
5. **Licence sur les contenus.** Retenu : la licence des règles (gratuite,
   limitée au fonctionnement d'Entraide, tant que le message y reste), acceptée
   par la mention « En publiant, vous acceptez les règles d'Entraide » à côté
   du bouton. Une case à cocher n'est pas exigée.
6. **Mineurs.** Retenu : rien de plus que l'âge minimum du compte (15 ans,
   majorité numérique en France), le pseudonyme et le masquage des
   coordonnées ; les règles interdisent les données personnelles.
7. **Forme du document.** Retenu : « Les règles d'Entraide » valent conditions
   au sens de l'art. 14 du DSA ; les conditions d'utilisation et la politique
   de confidentialité y renvoient par une ligne, ajoutée à l'ouverture.
8. **L'exposé des motifs.** Retenu : affiché à l'auteur sur le message dès que
   la mesure prend effet, avec une notification ; l'éditeur envoie le même par
   e-mail depuis la file de modération. L'art. 17 n'exige pas de canal
   particulier.

## À l'ouverture d'Entraide

- Fait le 13 octobre 2026 : le registre (section 11) et l'AIPD décrivent
  Entraide ; les deux blancs des règles sont remplis (questions 1 et 4).
- Ouvert le 13 octobre 2026, après la publication de la politique de
  confidentialité et des conditions : une ligne de chacune renvoie aux
  règles, et `ENTRAIDE_RULES_DRAFT` est à `false`.
