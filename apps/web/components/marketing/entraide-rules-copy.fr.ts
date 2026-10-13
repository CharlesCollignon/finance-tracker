import type { EntraideRulesCopy } from "./entraide-rules-copy";

/** « Les règles d'Entraide », en français : la langue où elles s'appliquent. */
export const entraideRulesCopyFr: EntraideRulesCopy = {
  updated: "2026-10-13",
  draftNotice:
    "Brouillon à relire : ces règles s'appliquent à l'ouverture d'Entraide. Les blancs surlignés sont à compléter par l'éditeur, et le texte n'a pas encore été relu par un avocat.",
  document: {
    title: "Les règles d'Entraide",
    summary:
      "Comment demander, répondre et s'entraider dans Entraide : ce qui est bienvenu, ce qui ne l'est pas, comment fonctionne la modération, et ce que devient ce que vous publiez.",
    sections: [
      {
        id: "what",
        heading: "Entraide en bref",
        body: [
          "Entraide est l'espace de pluclair.com où les personnes qui utilisent Pluclair posent leurs questions d'argent et répondent à celles des autres. Tout le monde peut le lire, et les moteurs de recherche l'affichent ; poser une question, répondre, réagir et signaler demandent un compte Pluclair.",
          "Entraide ne montre que ce que les membres y écrivent. Il ne lit jamais vos chiffres dans Pluclair : rien de votre compte n'y apparaît, sauf ce que vous y écrivez vous-même.",
        ],
      },
      {
        id: "rules",
        heading: "Les règles",
        body: ["Dans Entraide :"],
        points: [
          "répondez avec ce que vous savez, et dites d'où vous le savez — une source, ou votre propre expérience ;",
          "restez bienveillant : on peut contester une idée, jamais une personne, et ni insulte, ni moquerie, ni harcèlement ;",
          "gardez les données personnelles pour vous : ni IBAN, ni numéro de compte ou de carte, ni adresse, téléphone ou e-mail — les vôtres comme ceux des autres ;",
          "ne faites la promotion de rien : ni publicité, ni code de parrainage, ni lien affilié, ni démarchage pour un produit, un service ou un groupe payant ;",
          "ne demandez jamais d'argent, ne proposez jamais de gérer l'argent de quelqu'un ou de prendre ses coordonnées bancaires, et n'emmenez pas une conversation ailleurs pour le faire ;",
          "ne publiez rien d'illicite : ni arnaque, ni incitation à la haine ou à la violence, ni atteinte aux droits d'autrui ;",
          "ne vous faites pas passer pour quelqu'un d'autre — un autre membre, un professionnel, ou Pluclair ;",
          "restez dans le sujet : l'argent au quotidien en France, et Pluclair.",
        ],
      },
      {
        id: "views",
        heading: "L'avis des membres, pas un conseil",
        body: [
          "Ce qu'écrivent les membres est leur propre avis, présenté comme le leur. Ce n'est pas un conseil de Pluclair, et rien dans Entraide n'est un conseil en investissement, fiscal, juridique ou de crédit.",
          "Les réponses de Pluclair lui-même portent la marque « Pluclair ». Comme tout ce qu'écrit Pluclair, elles expliquent comment les choses fonctionnent et ne disent pas quoi faire. Avant une décision qui compte, vérifiez auprès des sources officielles, ou demandez à un professionnel.",
        ],
      },
      {
        id: "pseudonym",
        heading: "Votre pseudonyme",
        body: [
          "Vous choisissez un pseudonyme la première fois que vous publiez, et c'est tout ce que les autres voient de vous : jamais votre nom, jamais votre adresse e-mail. Choisissez-en un qui ne permette pas de vous identifier, ni d'identifier quelqu'un d'autre, et qui ne se fasse pas passer pour quelqu'un d'autre.",
        ],
      },
      {
        id: "before",
        heading: "Avant qu'un message soit publié",
        body: [
          "Avant qu'une question ou une réponse soit publiée, Pluclair masque ce qui ressemble à un IBAN, un numéro de carte, une adresse e-mail ou un numéro de téléphone, et vous montre ce qu'il a masqué, pour que vous puissiez corriger avant que rien ne parte.",
          "Pour garder Entraide à l'abri du spam, le nombre de messages par compte et par jour est limité, et un compte de moins d'un jour ne peut pas publier de lien. Les liens des messages sont signalés comme écrits par des membres, pour que les moteurs de recherche ne les prennent pas pour ceux de Pluclair.",
        ],
      },
      {
        id: "yours",
        heading: "Ce que vous publiez",
        body: [
          "Ce que vous écrivez reste à vous. En le publiant, vous autorisez Pluclair, gratuitement et tant qu'il reste dans Entraide, à le conserver, à le montrer à toute personne qui consulte Entraide, et à le garder dans la conversation à laquelle il appartient — uniquement pour faire fonctionner Entraide, jamais pour le vendre ni l'utiliser ailleurs. Vous êtes responsable de ce que vous publiez, et vous confirmez avoir le droit de le publier.",
          "Vous pouvez modifier ou supprimer vos questions et vos réponses à tout moment. Un message supprimé est remplacé par « Message supprimé », pour que la conversation autour reste lisible.",
        ],
      },
      {
        id: "moderation",
        heading: "Comment fonctionne la modération",
        body: [
          "Pluclair ne lit pas les messages avant qu'ils paraissent. Tout membre peut signaler une question ou une réponse qui enfreint ces règles ou la loi (« Signaler »), en disant pourquoi ; la personne signalée ne sait jamais qui l'a signalée. L'éditeur examine chaque signalement, et peut masquer un message, le rétablir, ou interdire à un pseudonyme de publier{N}; qui a signalé apprend ce qui a été décidé.",
          "Quand trois membres différents signalent le même message, il est masqué automatiquement jusqu'à ce que l'éditeur l'ait examiné. Masquer est la mesure habituelle : un message masqué est conservé, pas effacé, pour que la décision puisse être réexaminée. Un pseudonyme qui enfreint les règles de façon répétée, ou qui publie quelque chose de manifestement illicite, peut être exclu d'Entraide ; le reste du compte n'est pas touché.",
        ],
      },
      {
        id: "notices",
        heading: "Signaler un contenu illicite",
        body: [
          "Toute personne, avec ou sans compte, peut signaler un contenu qu'elle estime illicite en écrivant à pluclair.app@gmail.com. Pour pouvoir être traité, un signalement indique :",
        ],
        points: [
          "l'adresse (URL) du message ;",
          "pourquoi vous l'estimez illicite ;",
          "vos nom et adresse e-mail — inutiles si le signalement concerne des contenus pédopornographiques ;",
          "une déclaration confirmant que vous pensez, de bonne foi, que le signalement est exact et complet.",
        ],
        after: [
          "Nous accusons réception de chaque signalement, le traitons rapidement, avec soin et objectivité, et vous disons ce que nous avons décidé et comment le contester.",
        ],
      },
      {
        id: "reasons",
        heading: "Quand un message est masqué ou un pseudonyme exclu",
        body: [
          "Nous en informons l'auteur, sur le message lui-même dès que la mesure prend effet, et par e-mail :",
        ],
        points: [
          "ce qui a été fait — un message masqué, un pseudonyme exclu — et pour combien de temps ;",
          "les faits sur lesquels la décision repose, et si elle fait suite à un signalement ou a été prise de notre propre initiative ;",
          "si elle a été automatique, comme quand trois signalements masquent un message ;",
          "la règle de cette page, ou la loi, qu'elle applique ;",
          "comment la contester.",
        ],
      },
      {
        id: "challenge",
        heading: "Contester une décision",
        body: [
          "Vous pouvez contester toute décision concernant votre message ou votre pseudonyme, ou un signalement que vous avez fait, en répondant à l'e-mail qui vous l'a annoncée, ou en écrivant à pluclair.app@gmail.com, dans un délai de six mois. Une personne — jamais une machine — la réexamine, et nous vous disons ce qui en ressort. Vous pouvez aussi saisir les tribunaux compétents.",
        ],
      },
      {
        id: "host",
        heading: "Pluclair, hébergeur",
        body: [
          "Pour ce que publient les membres, Pluclair est un hébergeur au sens du règlement européen sur les services numériques (règlement (UE) 2022/2065, « DSA ») et de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN). Il ne vérifie pas les messages avant leur publication, et agit promptement pour retirer un contenu illicite ou en bloquer l'accès dès qu'il en a connaissance. Quand la loi l'exige, il informe les autorités — d'un message laissant craindre une menace pour la vie ou la sécurité de quelqu'un, par exemple.",
          "Point de contact pour les membres et pour les autorités (DSA, articles 11 et 12) : pluclair.app@gmail.com, en français ou en anglais.",
        ],
      },
      {
        id: "data",
        heading: "Vos données dans Entraide",
        body: [
          "Pour Entraide, nous conservons votre pseudonyme, vos questions et vos réponses avec leurs dates, vos réactions, et les signalements que vous faites ou qui vous concernent. Tout le monde peut voir votre pseudonyme, vos messages, leurs dates et le nombre de réactions ; qui a signalé un message n'est jamais affiché.",
          "C'est pour faire fonctionner Entraide, que vous demandez en publiant (le contrat qui nous lie), et pour le modérer et le garder dans la loi (notre intérêt légitime, et nos obligations d'hébergeur).",
        ],
        points: [
          "Vos messages : jusqu'à ce que vous les supprimiez, ou votre compte. Supprimer votre compte remplace chacun de vos messages par « Message supprimé » et en efface le texte ; votre pseudonyme part avec lui.",
          "Les signalements et les décisions de modération : [[combien de temps — par exemple un an après la décision]], pour répondre à une contestation ou à une autorité.",
          "Ce que la loi impose à un hébergeur de conserver sur qui a publié quoi (LCEN et décret n° 2021-1362 du 20 octobre 2021) : [[quelles données, et combien de temps]].",
        ],
        after: [
          "Tout le reste de la politique de confidentialité s'applique à Entraide : vos droits, comment les exercer, et comment saisir la CNIL.",
        ],
      },
      {
        id: "changes",
        heading: "Modifications de ces règles",
        body: [
          "Quand ces règles changent, la date en haut de page change avec elles, et un changement qui compte est annoncé dans Entraide avant de prendre effet.",
        ],
      },
    ],
  },
};
