import type { ChangelogEntry, RoadmapItem } from "./changelog";

/**
 * Every entry of « Nouveautés », newest first.
 *
 * Written from the repository: each is a merge into `main`, or a run of
 * commits on it, dated the day it landed — `git log --merges --first-parent
 * main` shows them, and `scripts/changelog-draft.mjs` lists what has landed
 * since the newest entry here. A branch that changes what someone using the
 * app sees adds its entry before it is merged, and the date is set on the
 * day of the merge.
 *
 * What changes behind the screen — a refactor, a test, a migration nobody
 * sees — is not an entry. What was built and then taken back out (the tax
 * page, October 2026) is not either: it never stayed long enough for anyone
 * to use.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-11-05-instalments",
    date: "2026-11-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Un achat payé en 3 ou 4 fois",
      body: "Quand une ligne de votre banque vient d’Alma, Oney, Klarna, Floa, Scalapay ou d’un « paiement en 4 fois » PayPal, Récurrents le propose dès le premier prélèvement : vous dites en combien de fois, et les prélèvements restants comptent dans « Encore à venir » et « Il vous reste », jusqu’au dernier.",
      detail:
        "Quand la ligne dit déjà « 3X » ou « 4X », rien n’est demandé. Deux achats chez le même prestataire restent deux. Faute de vraies lignes sous la main, cela a été essayé sur des exemples : un prélèvement mal reconnu, signalez-le. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "A purchase paid in 3 or 4 instalments",
      body: "When a line from your bank comes from Alma, Oney, Klarna, Floa, Scalapay or a PayPal “pay in 4”, Recurring suggests it from the first instalment: you say in how many, and the instalments left count in “Still to come” and “You have”, until the last one.",
      detail:
        "When the line already says “3X” or “4X”, nothing is asked. Two purchases with the same provider stay two. Without real lines at hand, this was tried on samples: if an instalment is misread, report it. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-card-statements",
    date: "2026-11-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Le relevé d’une carte à débit différé",
      body: "En important un relevé, un nouveau compte peut maintenant être une « Carte différée » : ses paiements arrivent dans votre journal à leur date, et quittent votre compte le jour du débit — la fin du mois, ou le jour choisi dans « Vos cartes ». La ligne de votre compte courant qui les débite tous ensemble est alors comptée une seule fois.",
      detail:
        "Les e-mails d’alerte et les notifications d’une carte à débit différé attendent, eux aussi, le jour du débit. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "A deferred-debit card's statement",
      body: "When you import a statement, a new account can now be a “Deferred card”: its payments come into your ledger on their day, and leave your account on the debit day — month end, or the day chosen in “Your cards”. The line on your current account that debits them all together is then counted once.",
      detail:
        "Alert e-mails and notifications for a deferred-debit card wait for the debit day too. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-card-owed",
    date: "2026-11-05",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Ce que la carte doit encore",
      body: "Avec une carte à débit différé, votre banque montre un solde qui contient encore ce que la carte a dépensé. Désormais la courbe de votre solde et « Encore à venir » sur Le point comptent un « Débit carte » le jour du débit, et « Il vous reste » le met de côté : « dont 450 € de carte, débités le 31 oct. », même quand le débit tombe après votre paie.",
      detail:
        "Le budget, lui, compte chaque paiement le jour où vous l’avez fait. Le widget Android dit la même ligne, avec la prochaine version du téléphone.",
    },
    en: {
      title: "What the card still owes",
      body: "With a deferred-debit card, your bank shows a balance that still holds what the card has spent. Now your balance line and “Still to come” on the Overview count a “Card debit” on the debit day, and “You have” keeps it aside: “of which €450 on the card, debited on 31 Oct”, even when the debit falls after your pay.",
      detail:
        "The budget still counts each payment on the day you made it. The Android widget says the same line, with the phone's next version.",
    },
  },
  {
    id: "2026-11-05-deferred-cards",
    date: "2026-11-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Les cartes à débit différé",
      body: "Pluclair demande maintenant, une fois par carte, si elle est débitée tout de suite ou une fois par mois — sur Le point, puis dans Banque, « Vos cartes ». Pour une carte à débit différé, chaque paiement compte le jour où vous payez et l’argent quitte votre compte le jour du débit. La ligne de fin de mois qui les débite tous ensemble (« FACTURE CARTE… », « RELEVE DIFFERE… ») n’est plus comptée une seconde fois quand ses paiements sont déjà là.",
      detail:
        "Les paiements arrivent par la banque, un relevé, un e-mail d’alerte ou une notification. Une banque qui montre la carte comme un compte à part la fait suivre aussi. Faute d’une vraie carte à débit différé sous la main, tout cela a été essayé sur des relevés d’exemple : une ligne de votre banque mal reconnue, signalez-la. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "Deferred-debit cards",
      body: "Pluclair now asks, once per card, whether it is debited at once or once a month — on the Overview, then in Bank, “Your cards”. For a deferred-debit card, each payment counts on the day you pay and the money leaves your account on the debit day. The month-end line that debits them all together (“FACTURE CARTE…”, “RELEVE DIFFERE…”) is no longer counted a second time when its payments are already in.",
      detail:
        "Payments come through the bank, a statement, an alert e-mail or a notification. A bank that shows the card as an account of its own has it followed too. Without a real deferred-debit card at hand, all of this was tried on sample statements: if a line from your bank is misread, report it. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-pay-advance",
    date: "2026-11-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Un salaire avec un acompte",
      body: "En ajoutant un salaire mensuel, « Avec un acompte » demande le montant et le jour de l’acompte. Vous tapez le salaire entier : Pluclair enregistre l’acompte à son jour et le reste le jour de paie, chacun comme une opération récurrente que la banque vient confirmer.",
      detail:
        "« Il vous reste » court toujours jusqu’au jour de paie, le plus gros des deux versements. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "A pay with an advance",
      body: "When you add a monthly pay, “With an advance” asks for the advance's amount and day. You type the whole pay: Pluclair saves the advance on its day and the rest on payday, each as a recurring entry the bank comes to confirm.",
      detail:
        "“You have” still runs to payday, the larger of the two payments. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-why-not-passed",
    date: "2026-11-05",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Pourquoi ce n’est pas encore passé",
      body: "Quand un paiement prévu reste « Pas encore passé », sa fiche dit maintenant pourquoi Pluclair ne l’a rapproché d’aucune ligne de votre banque : un mouvement du bon montant classé dans une autre catégorie, une ligne qui attend sa catégorie dans « À vérifier », le plus proche trop loin en montant ou en jours, ou rien de semblable.",
      detail:
        "Le plus souvent, il suffit de reclasser le mouvement, ou de cocher « Le montant varie » sur l’opération récurrente. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "Why it hasn't gone through yet",
      body: "When an expected payment stays “Not through yet”, its sheet now says why Pluclair has not paired it with a line from your bank: a movement of the right amount filed under another category, a line waiting for its category in “Review”, the nearest too far off in amount or days, or nothing like it.",
      detail:
        "Most often, refiling the movement is enough, or ticking “The amount varies” on the recurring entry. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-amount-varies",
    date: "2026-11-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Un montant qui varie",
      body: "Une opération récurrente peut maintenant dire « Le montant varie » : un salaire qui dépend des heures, une allocation — celle de France Travail est plus basse en février —, une facture d’énergie. Pluclair la reconnaît dès la moitié du montant prévu, au lieu de la compter encore à venir quand elle arrive plus de 5 % en dessous.",
      detail:
        "Le montant que vous tapez sert d’estimation pour les jours à venir. Au-dessus, rien n’est mis à part comme prime : c’est le montant qui varie. Une dépense, elle, s’arrête à une fois et demie le montant. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "An amount that varies",
      body: "A recurring entry can now say “The amount varies”: pay that depends on hours, a benefit — France Travail's is lower in February —, an energy bill. Pluclair recognises it from half the expected amount up, instead of still counting it as to come when it arrives more than 5 % lower.",
      detail:
        "The amount you type is the estimate for the days ahead. Above it, nothing is set apart as a bonus: it is the amount varying. An expense stops at one and a half times the amount. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-bills-before-payday",
    date: "2026-11-05",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Une grosse facture compte avant de tomber",
      body: "Une dépense annuelle, ou qui ne tombe pas tous les mois — la taxe foncière, une facture d’eau trimestrielle —, est étalée sur l’année dans votre budget, et Pluclair ne la voyait pas venir avant le jour où elle tombait. Désormais la courbe de votre solde et ce que le mois retire encore la comptent le jour où elle part, et « Il vous reste » la garde de côté quand elle tombe avant votre paie.",
      detail:
        "Le budget la compte toujours comme une part de l’année chaque mois. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "A big bill counts before it lands",
      body: "A yearly expense, or one that does not come every month — property tax, a quarterly water bill — is spread over the year in your budget, and Pluclair did not see it coming until the day it landed. Now your balance line and what the month still takes out count it on the day it leaves, and “You have” keeps it aside when it lands before your pay.",
      detail:
        "The budget still counts it as a share of the year each month. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-card-purchase-day",
    date: "2026-11-05",
    kind: "fixed",
    platforms: ["web", "phone"],
    fr: {
      title: "Un paiement par carte compte le jour où vous avez payé",
      body: "La banque enregistre un paiement par carte un à neuf jours après l’achat. Une course du 31 octobre enregistrée le 3 novembre comptait pour novembre. Désormais chaque paiement par carte que la banque apporte compte le jour de l’achat, celui qu’elle écrit au bout de la ligne (« … 31/10 »), et le Journal dit « Débité le 3 nov. » quand le débit tombe le mois suivant.",
      detail:
        "Le bilan du mois suit toujours votre banque : l’argent quitte le compte le jour où elle l’a débité. Une notification ou un e-mail d’alerte se rapproche du paiement par le jour de l’achat, et ne le compte plus deux fois quand la banque l’enregistre plus de quatre jours après. Les paiements déjà dans le Journal gardent leur date. Sur le téléphone, « Débité le » et la règle du mois suivant arrivent avec la prochaine version : d’ici là, il affiche « Payé le » sous les paiements par carte redatés.",
    },
    en: {
      title: "A card payment counts on the day you paid",
      body: "The bank books a card payment one to nine days after the purchase. Shopping on 31 October booked on 3 November counted for November. Now each card payment the bank brings counts on the day of the purchase, the one it writes at the end of the line (“… 31/10”), and the Ledger says “Debited on 3 Nov” when the debit falls in the next month.",
      detail:
        "The month close still follows your bank: the money leaves the account on the day it was debited. A notification or alert e-mail is paired with the payment by the day of the purchase, and is no longer counted twice when the bank books it more than four days later. Payments already in the Ledger keep their date. On the phone, “Debited on” and the next-month rule come with the next version: until then it shows “Paid on” under re-dated card payments.",
    },
  },
  {
    id: "2026-11-05-cadence-detection",
    date: "2026-11-05",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Récurrents repère ce qui revient tous les trimestres",
      body: "En haut de Récurrents, les opérations de votre relevé qui ont l’air de se répéter comptent maintenant aussi celles qui reviennent tous les 2 mois, tous les trimestres ou tous les 6 mois, et un prélèvement qui saute les mêmes mois chaque année, comme un impôt prélevé de janvier à octobre. L’ajouter crée l’opération avec ses mois.",
      detail:
        "Un mois ne compte comme sauté que si chacun des autres a été vu deux années différentes : un paiement oublié une fois ne devient pas une habitude. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "Recurring spots what comes every quarter",
      body: "At the top of Recurring, the charges in your statement that look like they repeat now include those that come every 2 months, every quarter or every 6 months, and a debit that skips the same months each year, like a tax taken from January to October. Adding it creates the entry with its months.",
      detail:
        "A month only counts as skipped when each of the others was seen in two different years: a payment missed once does not become a habit. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-05-cadence-months",
    date: "2026-11-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Ce qui ne tombe pas tous les mois",
      body: "Une opération récurrente mensuelle a maintenant un « Rythme » : tous les mois, tous les 2 mois, tous les trimestres, tous les 6 mois, ou certains mois que vous cochez. Un salaire versé chaque trimestre, une facture d’eau trimestrielle, un impôt prélevé de janvier à octobre : chacun tombe seulement dans ses mois.",
      detail:
        "Une dépense qui saute des mois compte dans votre budget pour une part de l’année chaque mois, comme une dépense annuelle. « Il vous reste » court jusqu’à votre prochaine paie, même si elle est dans plusieurs mois, et une prime trimestrielle ne prend pas la place de votre salaire. À la création du compte, « Pas tous les mois ? » sous le salaire. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "What doesn't come every month",
      body: "A monthly recurring entry now has a “How often”: every month, every 2 months, every quarter, every 6 months, or some months you tick. A salary paid each quarter, a quarterly water bill, a tax taken from January to October: each falls in its own months only.",
      detail:
        "An expense that skips months counts in your budget as a share of the year each month, like a yearly one. “You have” runs to your next pay, even when it is months away, and a quarterly bonus does not take your salary's place. When you set up your account, “Not every month?” sits under the salary. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-04-positions-follow-purchases",
    date: "2026-11-04",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Placements suit vos achats",
      body: "Un achat confirmé — « C'est passé » sur Le point — ou un achat Bitstack apporté par la banque allait dans le Journal, jamais dans Placements : le « Total versé » et les parts restaient ceux que vous aviez tapés. Désormais chaque achat fait après le jour où vous les avez tapés s'y ajoute — son montant au total versé, ses parts aux parts détenues — et la valeur suit.",
      detail:
        "Les parts d'un DCA en parts sont les siennes ; celles d'un achat en montant (Bitstack) sont son montant divisé par le cours du mois. Retaper un chiffre de votre courtier repart de là, sans rien compter deux fois. Sur le téléphone, avec la prochaine version.",
    },
    en: {
      title: "Investments follow your purchases",
      body: "A confirmed purchase — “It went through” on the Overview — or a Bitstack purchase the bank brought went into the Ledger, never into Investments: the “Total paid in” and the shares stayed as you had typed them. Now every purchase made after the day you typed them adds to them — its amount to the total paid in, its shares to the shares held — and the value follows.",
      detail:
        "A DCA bought in shares adds its own shares; one bought as an amount (Bitstack) adds its amount divided by the month's price. Typing your broker's figure again starts over from there, counting nothing twice. On the phone, with the next version.",
    },
  },
  {
    id: "2026-11-04-journal-tabs",
    date: "2026-11-04",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Les vues du Journal, au centre",
      body: "En haut du Journal, Liste, Calendrier, Par catégorie et Par commerce sont maintenant centrés sur leur propre ligne, le mois juste en dessous, au milieu, et « Ajouter » à droite.",
    },
    en: {
      title: "The Ledger's views, centred",
      body: "At the top of the Ledger, List, Calendar, By category and By shop are now centred on a row of their own, the month just under them, in the middle, and “Add” on the right.",
    },
  },
  {
    id: "2026-11-04-spending-push",
    date: "2026-11-04",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Une notification pour chaque nouvelle dépense",
      body: "Quand votre banque apporte un paiement, Pluclair vous le dit : « Nouvelle dépense : 32,10 € — Carrefour Market », ou, s’il y en a plusieurs, leur total et les plus grosses avec leur montant. Une seule notification par mise à jour, jamais une par ligne, et rien entre 21 h et 8 h : ce qui arrive la nuit est dit le matin.",
      detail:
        "Seulement les paiements des trois derniers jours : un relevé ancien ou un premier branchement n’en déclenche pas. Un virement vers votre épargne ou un courtier n’est pas une dépense et n’est pas compté. Quand des opérations attendent leur catégorie, la même notification le dit et ouvre la liste à classer, au lieu d’en envoyer une seconde. Elle se coupe dans Profil, « Nouvelles dépenses » ; l’interrupteur arrive sur le téléphone avec la prochaine version.",
    },
    en: {
      title: "A notification for each new payment",
      body: "When your bank brings in a payment, Pluclair tells you: “New spending: €32.10 — Carrefour Market”, or, when there are several, their total and the biggest with their amounts. One notification per update, never one per line, and nothing between 9 pm and 8 am: what comes in at night is said in the morning.",
      detail:
        "Only payments from the last three days: an old statement or a first connection does not set it off. A transfer to your savings or a broker is not spending and is not counted. When transactions wait for a category, the same notification says so and opens the list to sort, instead of sending a second one. It is turned off in Profile, “New spending”; the switch reaches the phone with the next version.",
    },
  },
  {
    id: "2026-11-04-salary-bonus",
    date: "2026-11-04",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Un salaire avec une prime reste votre salaire",
      body: "Un salaire arrivé bien au-dessus de son montant habituel — une prime, un treizième mois — n’était plus reconnu : il restait dans le mois où l’argent est arrivé, et le mois qu’il payait n’avait pas de salaire. Il vous est maintenant proposé comme les autres, au jour de paie, et en le confirmant la différence est mise à part sur sa propre ligne, « Prime », dans le même mois que le salaire.",
      detail:
        "Seulement pour les revenus mensuels ou annuels, et seulement au-dessus : un salaire nettement plus bas que prévu n’est toujours pas proposé. Annuler la confirmation remet la prime avec le salaire.",
    },
    en: {
      title: "A salary with a bonus is still your salary",
      body: "A salary that came in well above its usual amount — a bonus, a thirteenth month — was no longer recognised: it stayed in the month the money arrived, and the month it paid for had no salary. It is now offered like the others, on payday, and confirming it sets the difference apart on its own line, “Bonus”, in the same month as the salary.",
      detail:
        "Only for monthly or yearly income, and only above: a salary well below what was expected is still not offered. Undoing the confirmation puts the bonus back with the salary.",
    },
  },
  {
    id: "2026-10-26-le-point-layout",
    date: "2026-10-26",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Le point et la démo, deux retouches",
      body: "Sur Le point, « Fiabilité du mois » et « Partager ce mois » prennent toute la largeur : les faits côte à côte, le texte à gauche et les boutons à droite, plus de carte seule à côté d’un vide. Dans la démo, la ligne qui le rappelle n’est plus cachée sous la barre du haut sur ordinateur.",
    },
    en: {
      title: "The Overview and the demo, two touches",
      body: "On the Overview, “Month check” and “Share this month” take the whole width: the facts side by side, the words on the left and the buttons on the right, no more card alone beside an empty space. In the demo, the line saying so is no longer hidden under the top bar on a computer.",
    },
  },
  {
    id: "2026-10-26-site",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Le site dit ce qui est nouveau",
      body: "Sur pluclair.com, « Et tout ce qu’il y a autour » compte six cartes de plus — les règles de rangement, la vue par commerce, les parts et le ticket, « Partager ce mois », les opérations d’un compte de placement, Cmd+K —, les pages Le point, Journal, Placements et Espace commun disent ce qu’elles ont gagné, deux questions rejoignent « Vos questions », et « Bientôt » annonce les notifications de la banque.",
      detail:
        "Rien n’y est promis qui ne soit déjà dans l’application ; ce qui ne l’est pas encore reste au futur, sous « Bientôt ».",
    },
    en: {
      title: "The site says what is new",
      body: "On pluclair.com, “And everything around it” has six more cards — filing rules, the view by shop, parts and the receipt, “Share this month”, an investment account’s operations, Cmd+K —, the Overview, Ledger, Investments and Shared space pages say what they gained, two questions join “Your questions”, and “Coming soon” announces the bank’s notifications.",
      detail:
        "Nothing is promised there that is not already in the app; what is not yet stays in the future tense, under “Coming soon”.",
    },
  },
  {
    id: "2026-10-26-demo",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Essayer la démo",
      body: "Sur le site, « Essayer la démo » ouvre Pluclair sur un compte d’exemple, sans rien créer : neuf mois d’un budget inventé, ses récurrents, ses placements, ses clôtures. Tout s’y lit, rien ne s’y écrit — c’est le même compte pour tout le monde — et il est refait chaque nuit pour le mois en cours.",
      detail:
        "Une ligne au-dessus de l’app le rappelle, avec le chemin vers votre propre compte. Le compte de démo n’est pas compté parmi les lecteurs.",
    },
    en: {
      title: "Try the demo",
      body: "On the site, “Try the demo” opens Pluclair on a sample account, with nothing to create: nine months of a made-up budget, its recurring entries, its investments, its closes. Everything reads, nothing writes — it is the same account for everyone — and it is rebuilt every night for the current month.",
      detail:
        "A line above the app says so, with the way to an account of your own. The demo account is not counted among the readers.",
    },
  },
  {
    id: "2026-10-26-wallet-events",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Ce qui se passe dans un compte de placement",
      body: "Sur chaque compte de Placements, « Opérations » : une ligne achetée ou vendue, un dividende reçu, des frais prélevés — saisis à la main, ou lus dans l’export du courtier (un CSV ou un tableur), montrés avant d’être ajoutés, jamais ajoutés deux fois. Sur Analyse, une carte « Dividendes et plus-values réalisées » les additionne par année et par compte.",
      detail:
        "Chaque vente est rapprochée des achats les plus anciens de la même ligne encore détenus, premier entré premier sorti, comme le fisc les lit ; une vente dont les achats manquent le dit. La lecture des exports repose sur les noms des colonnes et les mots de chaque ligne, en français ou en anglais, et a été mise au point sur des exemples : vérifiez le premier fichier lu.",
    },
    en: {
      title: "What happens inside an investment account",
      body: "On each account under Placements, “Operations”: a line bought or sold, a dividend received, a fee taken — typed by hand, or read off the broker’s export (a CSV or a spreadsheet), shown before they are added, never added twice. On Analyse, a “Dividends and realised gains” card adds them up by year and account.",
      detail:
        "Each sale is set against the oldest purchases of the same line still held, first in first out, as the tax office reads them; a sale whose purchases are missing says so. The reading of exports rests on the names of the columns and the words of each line, in French or English, and was built on samples: check the first file read.",
    },
  },
  {
    id: "2026-10-26-month-share",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Partager ce mois",
      body: "Sur Le point, une carte envoie le mois en image — entré, sorti, le mois, économisé, non noté, et où c’est parti — avec les montants, ou avec les parts seulement. Sur l’ordinateur, la même chose en page à imprimer ou à enregistrer en PDF, avec les opérations du mois.",
      detail:
        "Dessiné pour votre compte au moment où vous le demandez, et gardé nulle part. Pour un partenaire, un comptable, ou vous-même.",
    },
    en: {
      title: "Share this month",
      body: "On the Overview, a card sends the month as an image — came in, went out, the month, kept, unrecorded, and where it went — with the amounts, or with the shares only. On the desktop, the same as a page to print or save as a PDF, with the month’s entries.",
      detail:
        "Drawn for your account when you ask, and kept nowhere. For a partner, an accountant, or yourself.",
    },
  },
  {
    id: "2026-10-26-palette",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Cmd+K ouvre une palette",
      body: "Sur l’ordinateur, Cmd+K (Ctrl+K) ouvre une palette : ajouter une opération ou une récurrente, poser une question, aller à n’importe quelle page — et, dès que vous tapez, un montant à ajouter, un mois à ouvrir, un commerce, une catégorie, une opération récurrente.",
      detail:
        "Les flèches choisissent, Entrée ouvre, Échap ferme. L’ajout reste la première ligne : Cmd+K puis Entrée, comme avant à une touche près. Un montant tapé arrive déjà rempli dans l’ajout.",
    },
    en: {
      title: "Cmd+K opens a palette",
      body: "On the desktop, Cmd+K (Ctrl+K) opens a palette: add a transaction or a recurring entry, ask a question, go to any page — and, as you type, an amount to add, a month to open, a shop, a category, a recurring entry.",
      detail:
        "The arrows choose, Enter opens, Escape closes. The add stays the first line: Cmd+K then Enter, as before but for one key. An amount typed arrives already filled into the add.",
    },
  },
  {
    id: "2026-10-26-splits-receipts",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Un paiement en plusieurs parts, et le ticket derrière",
      body: "Depuis une opération : « Partager en plusieurs » place son montant dans deux catégories ou plus, chaque part devenant une opération, les parts restant un seul paiement — et « Réunir les parts » les rassemble. « Joindre un justificatif » garde la photo ou le PDF du ticket avec l’opération.",
      detail:
        "« Lire le ticket » demande à votre propre compte IA d’y relever le commerce, le jour et le total ; vous les appliquez, ou pas. Le fichier est à vous seul, et n’est lu que quand vous le demandez.",
    },
    en: {
      title: "One payment in several parts, and the receipt behind it",
      body: "From an entry: “Split into parts” places its amount in two categories or more, each part becoming an entry, the parts staying one payment — and “Put the parts back together” rejoins them. “Attach a receipt” keeps the picture or the PDF with the entry.",
      detail:
        "“Read the receipt” asks your own AI account to copy the shop, the day and the total off it; you apply them, or not. The file is yours alone, and is read only when you ask.",
    },
  },
  {
    id: "2026-10-26-space-balance",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "À deux : l’équilibre entre vous",
      body: "Sous « Commun », Le point dit ce que chacun a versé sur le compte commun ce mois-ci, face à sa part de ce qu’il a dépensé — et ce que celui qui est en retard verserait pour être au niveau du partage. Le profil le dit depuis le début de l’espace.",
      detail:
        "Un partenaire apprend ce que l’autre a versé sur le compte qu’ils partagent, et rien d’autre de son argent. Jamais un paiement entre vous : un versement au compte commun, si vous le voulez.",
    },
    en: {
      title: "For two: the balance between you",
      body: "Under “Shared”, the Overview says what each of you put into the joint account this month, against your part of what it spent — and what the one behind would put in to be level with the split. The profile says it since the space began.",
      detail:
        "A partner learns what the other put into the account they share, and nothing else of their money. Never a payment between you: a transfer to the joint account, if you want one.",
    },
  },
  {
    id: "2026-10-26-by-shop",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Le Journal, par commerce",
      body: "Une quatrième vue du Journal : chaque endroit où votre argent est allé ces douze derniers mois, du plus gros au plus petit — combien de fois, combien à chaque fois, ce que ça fait un mois normal, et la dernière fois. Un commerce s'ouvre sur ses douze mois et ses opérations.",
      detail:
        "La recherche trouve un commerce par ses mots ou sa catégorie. Un commerce est reconnu à ses deux premiers mots, quelle que soit la façon dont la banque l'écrit.",
    },
    en: {
      title: "The Ledger, by shop",
      body: "A fourth Ledger view: every place your money went in the last twelve months, biggest first — how many times, how much a time, what a normal month comes to, and when last. A shop opens on its twelve months and its entries.",
      detail:
        "The search finds a shop by its words or its category. A shop is known by its first two words, however the bank spells it.",
    },
  },
  {
    id: "2026-10-26-filing-rules",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Des règles de rangement, écrites par vous",
      body: "Dans « À vérifier », cochez « Toujours ranger ici » en classant un commerce : une règle est écrite avec ses mots, et la prochaine ligne qui les contient se range toute seule. Vos règles se lisent, se modifient et se suppriment depuis Catégories.",
      detail:
        "Une règle passe avant ce que l’application a appris seule, et vaut aussi pour l’argent qui rentre — un salaire, un loyer perçu. La plus précise l’emporte, et chacune compte les lignes qu’elle a rangées.",
    },
    en: {
      title: "Filing rules, written by you",
      body: "In the review, tick “Always file here” as you file a shop: a rule is written with its words, and the next line that contains them files itself. Your rules can be read, changed and deleted from Categories.",
      detail:
        "A rule comes before anything the app learned on its own, and holds for money coming in too — a salary, a rent received. The most specific wins, and each counts the lines it filed.",
    },
  },
  {
    id: "2026-10-26-todo-strip",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "« À faire », en une bande",
      body: "Sur Le point, tout ce qui vous attend tient dans une bande sous le mois, avec son compte : le bilan, « C'est arrivé ? », les achats à confirmer, « À vérifier », un relevé à importer, une banque à renouveler. Chaque ligne mène là où ça se règle.",
      detail:
        "Les deux bandeaux de la banque et la ligne « en attente » disparaissent : la bande les compte à leur place. Les cartes qui posent la question restent où elles sont, un peu plus bas.",
    },
    en: {
      title: "“To do”, in one strip",
      body: "On the Overview, everything waiting for you fits in one strip under the month, with its count: the close, “did it arrive?”, purchases to confirm, the review, a statement to import, a bank to renew. Each line leads to where it is done.",
      detail:
        "The two bank banners and the “waiting” row are gone: the strip counts them in their place. The cards that ask the question stay where they were, a little lower.",
    },
  },
  {
    id: "2026-10-26-month-trust",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "« Fiabilité du mois »",
      body: "Sur Le point, une carte dit sur quoi reposent les chiffres du mois : jusqu’où va le relevé, les opérations récurrentes passées ou encore attendues, ce qui reste à vérifier, et le bilan — fait, à faire, ou prévu tel jour.",
      detail:
        "Chaque ligne est un fait, jamais une note. Une ligne qui mène quelque part s’ouvre d’un geste : le Journal, « À vérifier », le bilan.",
    },
    en: {
      title: "“Month check”",
      body: "On the Overview, a card says what the month’s figures rest on: how far the statement reaches, the recurring entries arrived or still awaited, what is left to review, and the close — done, ready, or due on a given day.",
      detail:
        "Each line is a fact, never a score. A line that leads somewhere opens with a press: the Ledger, the review, the close.",
    },
  },
  {
    id: "2026-10-26-proposals-for-imports",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Ce qui revient, repéré aussi dans vos relevés",
      body: "Récurrents propose ce qui a l’air de revenir — un abonnement, un prélèvement — dès que des lignes sont arrivées, par un relevé importé comme par la banque. Jusqu’ici, seule une banque connectée y donnait droit.",
      detail:
        "Le point compte aussi, pour tout le monde, les lignes qui attendent une catégorie après un import.",
    },
    en: {
      title: "Repeats spotted in your statements too",
      body: "Recurring now proposes what looks like it repeats — a subscription, a direct debit — as soon as lines have come in, from an imported statement as much as from a bank. Until now only a connected bank qualified.",
      detail:
        "The Overview also counts, for everyone, the lines waiting for a category after an import.",
    },
  },
  {
    id: "2026-10-26-accounts-order",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Vos comptes dans votre ordre",
      body: "Dans Placements, le CTO, le PEA et la crypto passent en premier, puis le reste. Faites glisser un compte pour les ranger comme vous voulez : l’ordre est gardé avec votre compte.",
      detail:
        "Sur un écran tactile, restez appuyé sur un compte avant de le faire glisser ; au clavier, Alt et les flèches le déplacent. Dans Composition, la section « Une cible à viser » disparaît.",
    },
    en: {
      title: "Your accounts in your order",
      body: "In Investments, the CTO, the PEA and crypto now come first, then the rest. Drag an account to arrange them as you like: the order is kept with your account.",
      detail:
        "On a touch screen, press and hold an account before dragging it; on a keyboard, Alt and the arrow keys move it. In “What's inside”, the “A target to aim at” section is gone.",
    },
  },
  {
    id: "2026-10-26-orange-orb",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Pluclair passe à l’orange",
      body: "L’orbe de Pluclair prend un orange franc partout où il apparaît : l’icône de l’onglet et de l’écran d’accueil, le logo en haut de page, la connexion et le site. Les boutons et les montants mis en avant passent au même orange.",
      detail:
        "Les opérations qui attendent votre réponse sont désormais signalées en ambre, pour rester bien distinctes des boutons.",
    },
    en: {
      title: "Pluclair turns orange",
      body: "Pluclair’s orb takes a clear orange wherever it appears: the tab and home-screen icon, the logo at the top of the page, sign-in and the site. Buttons and highlighted amounts take the same orange.",
      detail:
        "Transactions waiting for your answer are now marked in amber, so they stay clearly apart from the buttons.",
    },
  },
  {
    id: "2026-10-26-softer-ground",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Un fond plus sombre, moins violet",
      body: "La lumière violette derrière l’app est réduite de plus de moitié : le fond est presque noir, avec juste une touche de violet en haut.",
    },
    en: {
      title: "A darker, less purple background",
      body: "The violet light behind the app is cut by more than half: the background is almost black, with just a touch of violet at the top.",
    },
  },
  {
    id: "2026-10-26-elision",
    date: "2026-10-26",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "« d’octobre », plus « de octobre »",
      body: "L’app écrit « Faire le bilan d’octobre » ou « ce qu’août vous a laissé » : partout où un mois, une banque ou un nom commence par une voyelle.",
    },
    en: {
      title: "French months, properly elided",
      body: "In French, the app now writes « d’octobre » and « qu’août » rather than « de octobre », wherever a month, a bank or a name starts with a vowel.",
    },
  },
  {
    id: "2026-10-26-plan-fixes",
    date: "2026-10-26",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Plan : la croissance d’un bien compte tout de suite",
      body: "Dans « Vos comptes », changer la croissance annuelle d’un bien déplace la courbe de vos biens aussitôt, et plus seulement à la visite suivante.",
      detail:
        "« Sources et méthode » nomme aussi ses sources en anglais quand l’app est en anglais.",
    },
    en: {
      title: "Plan: a home’s growth counts at once",
      body: "In “Your accounts”, changing a home’s yearly growth moves your homes’ line straight away, not only on your next visit.",
      detail:
        "“Sources and method” also names its sources in English when the app is in English.",
    },
  },
  {
    id: "2026-10-26-plan-history",
    date: "2026-10-26",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Plan rejoue vos comptes sur l’histoire des marchés",
      body: "Plan montre où vos comptes peuvent aller en les rejouant sur ce que les marchés ont vraiment fait depuis 1970 : un chiffre au départ médian, la fourchette où finissent 8 départs sur 10 et le pire départ, en euros d’aujourd’hui.",
      detail:
        "Sous la courbe, « Vos comptes » montre de quoi elle est faite : ce que chaque compte a aujourd’hui, ce que vous y mettez chaque mois, son rendement historique, ses frais et l’impôt, tout modifiable ; un versement augmenté est pris sur votre compte courant. « Progression » réunit vos paliers, votre matelas et votre série, et les dates des paliers suivent désormais le départ médian. Les événements, « Et si… » et la vue « dans N ans » laissent place à cette page plus simple. Sur le site, la page du Plan le montre sur une personne d’exemple, trajectoire à jouer comprise.",
    },
    en: {
      title: "Plan replays your accounts on market history",
      body: "Plan shows where your accounts could go by replaying them on what markets actually did since 1970: one figure from the middle start, the range 8 starts in 10 end in, and the worst start, in today’s euros.",
      detail:
        "Under the chart, “Your accounts” shows what it is made of: what each account holds today, what you put in each month, its historical return, its fees and tax, all yours to change; a payment you raise comes off your current account. “Progress” brings your milestones, cushion and run together, and the milestones’ dates now follow the middle start. The events, “What if” and the “in N years” view give way to this simpler page. On the site, the Plan’s page shows it on a sample person, with a trajectory to play with.",
    },
  },
  {
    id: "2026-10-26-close-on-bearing",
    date: "2026-10-26",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Le bilan du mois se fait sur Le point",
      body: "Votre série, le bouton « Faire le bilan du mois » et « Vos mois » quittent Plan pour la carte « Sur la durée » de Le point : le mois se clôture là où il se lit.",
      detail:
        "« Vos mois » ouvre les barres de chaque mois, tous vos bilans, votre marge et votre jour de lecture. Quand un mois est prêt pour son bilan, le rappel en haut de Le point ouvre directement la feuille.",
    },
    en: {
      title: "The month close moves to Le point",
      body: "Your run, the “Close the month” button and “Your months” leave Plan for Le point’s “Over time” card: a month is closed where it is read.",
      detail:
        "“Your months” opens each month’s bar, every close, your allowance and your reading day. When a month is ready to close, the reminder at the top of Le point opens the sheet straight away.",
    },
  },
  {
    id: "2026-10-25-simpler-screens",
    date: "2026-10-25",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Le point, le Journal et Placements, plus simples",
      body: "Sur Le point, ce qui doit encore sortir ce mois-ci s’affiche juste sous votre solde ; la ligne « Il vous reste » et « Puis-je me permettre ? » quittent la carte. Le Journal se lit en « Passé » ou « À venir », et chaque opération se coche directement pour être sélectionnée.",
      detail:
        "Le choix des semaines et le bouton « Sélectionner » disparaissent. Dans le Calendrier, le virement vers le courtier apparaît en bleu, la couleur des placements. Plan passe en dernier dans le menu. Dans Placements, toute la ligne d’une position s’ouvre d’un clic, sans le crayon. Et le Bitcoin a son logo.",
    },
    en: {
      title: "Le point, the Journal and Placements, simpler",
      body: "On Le point, what is still to go out this month now sits right under your balance; the “Il vous reste” line and “Can I afford it?” leave the card. The Journal reads as “Past” or “Upcoming”, and every transaction can be ticked to select it.",
      detail:
        "The week picker and the “Select” button are gone. In the Calendar, the transfer to your broker shows in blue, the colour of investments. Plan moves to the end of the menu. In Placements, a holding’s whole row opens with one click, without the pencil. And Bitcoin has its logo.",
    },
  },
  {
    id: "2026-10-25-fades",
    date: "2026-10-25",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Tout apparaît en fondu, plus vite",
      body: "Sur le site, les écrans, les cartes, les feuilles et les messages apparaissent et s’en vont en un fondu rapide, au lieu de glisser, de monter ou de rebondir. Les barres et les courbes apparaissent à leur valeur au lieu de pousser depuis zéro.",
      detail:
        "Ce qui suit le doigt ou la souris (interrupteurs, curseurs, glissés), les montants qui défilent jusqu’à leur valeur et les moments — un palier atteint, un mois clôturé — bougent comme avant. L’accueil, « À propos » et la page de téléchargement gardent leur animation au défilement.",
    },
    en: {
      title: "Everything fades in, faster",
      body: "On the site, screens, cards, sheets and messages appear and leave with a quick fade instead of sliding, rising or bouncing. Bars and curves appear at their value instead of growing from zero.",
      detail:
        "What follows your finger or pointer (switches, sliders, swipes), amounts counting up to their value and the moments — a milestone reached, a month closed — move as before. The home page, “About” and the download page keep their scroll animation.",
    },
  },
  {
    id: "2026-10-25-focus-rings",
    date: "2026-10-25",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Le contour doré revient au clavier",
      body: "Sur le site, le bouton « + » et les messages en bas de l’écran montrent de nouveau le contour doré quand on y arrive au clavier. Le choix entre « Moi » et votre espace partagé retrouve son fin contour.",
    },
    en: {
      title: "The gold outline is back for the keyboard",
      body: "On the site, the “+” button and the messages at the bottom of the screen show the gold outline again when you reach them with the keyboard. The switch between “Me” and your shared space has its thin outline back.",
    },
  },
  {
    id: "2026-10-25-iphone-home-screen",
    date: "2026-10-25",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Pluclair sur l’écran d’accueil de l’iPhone",
      body: "Pas encore d’app iPhone, mais la page de téléchargement montre comment mettre Pluclair sur l’écran d’accueil depuis Safari, en trois gestes : il s’ouvre ensuite en plein écran, comme une app.",
      detail:
        "Sur un iPhone, l’accueil propose « Installer sur iPhone » au lieu du fichier Android, et la page commence par ces gestes. Depuis un ordinateur, un QR code ouvre Pluclair sur l’iPhone.",
    },
    en: {
      title: "Pluclair on the iPhone’s home screen",
      body: "No iPhone app yet, but the download page shows how to put Pluclair on your home screen from Safari, in three steps: it then opens full screen, like an app.",
      detail:
        "On an iPhone, the home page offers “Install on iPhone” instead of the Android file, and the page starts with those steps. On a computer, a QR code opens Pluclair on the iPhone.",
    },
  },
  {
    id: "2026-10-25-download-page",
    date: "2026-10-25",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "L’app Android, dès la première page",
      body: "« Télécharger pour Android » est en haut de l’accueil, et mène à une page qui dit tout : la version et sa taille, les trois gestes pour l’installer, les dernières nouveautés du téléphone.",
      detail:
        "Depuis un ordinateur, un QR code envoie le téléchargement sur votre téléphone. L’empreinte SHA-256 du fichier permet de vérifier qu’il est bien celui publié.",
    },
    en: {
      title: "The Android app, from the first page",
      body: "“Download for Android” is at the top of the home page, and leads to a page that says it all: the version and its size, the three steps to install it, the phone’s latest changes.",
      detail:
        "On a computer, a QR code sends the download to your phone. The file’s SHA-256 fingerprint lets you check it is the one published.",
    },
  },
  {
    id: "2026-10-25-statements-phone",
    date: "2026-10-25",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Vos relevés, aussi depuis le téléphone",
      body: "Le fichier de votre banque — CSV, OFX, Excel, PDF… — s’importe depuis le téléphone comme sur le site : une carte par compte, les opérations qui attendent dans « À vérifier », et chaque import se défait pendant trente jours. Sur Android, partagez le fichier vers Pluclair depuis n’importe quelle appli : il s’ouvre dans l’import.",
      detail:
        "« Importer un relevé » est dans le menu de votre compte. Une capture ou un relevé scanné peut être lu par votre compte IA, si vous le demandez. Le 5 de chaque mois, un rappel vous demande le relevé du mois passé ; il se coupe dans le Profil.",
    },
    en: {
      title: "Your statements, from the phone too",
      body: "Your bank’s file — CSV, OFX, Excel, PDF… — imports from the phone as on the site: one card per account, the transactions waiting in “Review”, and each import can be undone for thirty days. On Android, share the file to Pluclair from any app: it opens in the import.",
      detail:
        "“Import a statement” is in your account menu. A screenshot or a scanned statement can be read by your AI account, if you ask. On the 5th of each month, a reminder asks for last month’s statement; it can be turned off in Profile.",
    },
  },
  {
    id: "2026-10-25-entraide-phone-smoother",
    date: "2026-10-25",
    kind: "fixed",
    platforms: ["phone"],
    fr: {
      title: "Entraide, plus fluide sur le téléphone",
      body: "Réagir ou répondre ne fige plus l’écran ; une réponse s’affiche dès qu’elle est envoyée, une modification ou une suppression dès qu’elle est enregistrée.",
    },
    en: {
      title: "Entraide, smoother on the phone",
      body: "Reacting or answering no longer freezes the screen; an answer shows as soon as it is sent, an edit or a deletion as soon as it is saved.",
    },
  },
  {
    id: "2026-10-25-several-loans",
    date: "2026-10-25",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Plusieurs prêts pour un même bien",
      body: "En ajoutant un bien, chaque prêt qui l’a financé se saisit à part — un prêt à taux zéro à côté du prêt principal, par exemple —, avec son taux, sa durée et sa mensualité. Les chiffres du bien les additionnent.",
      detail:
        "Chaque mensualité rejoint vos opérations récurrentes. Pour un bien déjà ajouté, « Ajouter un prêt » est sur sa page.",
    },
    en: {
      title: "Several loans for one property",
      body: "When adding a property, each loan that paid for it is entered on its own — a 0 % loan beside the main one, for instance —, with its rate, length and monthly payment. The property’s figures add them up.",
      detail:
        "Each monthly payment joins your recurring entries. For a property already added, “Add a loan” is on its page.",
    },
  },
  {
    id: "2026-10-25-setup-labels",
    date: "2026-10-25",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Un libellé dès la prise en main",
      body: "« Qu’est-ce qui entre ? » et « Qu’est-ce qui sort ? » demandent un libellé — Salaire, Loyer, Netflix… —, pour reconnaître chaque opération ensuite dans Récurrents.",
    },
    en: {
      title: "A label from the first setup",
      body: "“What comes in?” and “What goes out?” ask for a label — Salary, Rent, Netflix… —, so each entry is recognised later in Recurring.",
    },
  },
  {
    id: "2026-10-25-property-choice",
    date: "2026-10-25",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "« Bien » seulement là où il compte",
      body: "Dans une opération récurrente, le choix du bien ne s’affiche plus pour un placement ou une épargne, ni pour un revenu tant qu’aucun bien n’est loué.",
    },
    en: {
      title: "“Property” only where it matters",
      body: "On a recurring entry, the property choice no longer shows for an investment or savings, nor for an income while no property is let.",
    },
  },
  {
    id: "2026-10-25-small-fixes",
    date: "2026-10-25",
    kind: "fixed",
    platforms: ["web", "phone"],
    fr: {
      title: "Le point et l’inscription, deux retouches",
      body: "Sur Le point, « Enregistrer » et « Plus tard » sont alignés sur le champ du solde. Et quand une inscription échoue de notre côté, le message le dit et propose de continuer avec Google.",
      detail:
        "La politique de confidentialité nomme aussi Resend, qui envoie désormais les e-mails de votre compte.",
    },
    en: {
      title: "Le point and signing up, two touches",
      body: "On Le point, “Save” and “Later” line up with the balance field. And when a sign-up fails on our side, the message says so and offers to continue with Google.",
      detail:
        "The privacy policy also names Resend, which now sends your account’s e-mails.",
    },
  },
  {
    id: "2026-10-25-signup-email",
    date: "2026-10-25",
    kind: "fixed",
    platforms: ["web", "phone"],
    fr: {
      title: "S’inscrire avec son e-mail, sans rester dans le doute",
      body: "Le mot de passe se tape deux fois. Le compte créé, un écran dit à quelle adresse le lien de confirmation est parti, et permet de le renvoyer ou de corriger l’adresse ; si un compte existe déjà avec elle, il le dit.",
      detail:
        "Le lien de confirmation, comme celui pour changer de mot de passe, s’ouvre sur n’importe quel appareil, et les deux e-mails ont pris les couleurs de Pluclair, en français ou en anglais selon la langue du compte.",
    },
    en: {
      title: "Signing up with your e-mail, without wondering",
      body: "The password is typed twice. Once the account is made, a screen says which address the confirmation link went to, and lets you send it again or fix the address; if that address already has an account, it says so.",
      detail:
        "The confirmation link, like the one to change your password, opens on any device, and both e-mails now wear Pluclair’s colours, in French or English as the account was made.",
    },
  },
  {
    id: "2026-10-13-statements-pdf",
    date: "2026-10-13",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Vos relevés PDF, et même une capture d’écran",
      body: "Le relevé PDF que votre banque envoie chaque mois s’importe comme n’importe quel fichier : Pluclair lit ses colonnes, et les soldes du relevé confirment la lecture au centime près — ou disent qu’il manque quelque chose. Vous pouvez aussi voir les opérations lues avant d’importer.",
      detail:
        "Un relevé scanné ou une capture de l’appli de votre banque peut être lu par votre compte IA, avec Mistral, si vous le demandez, fichier par fichier ; chaque ligne lue attend alors dans « À vérifier ».",
    },
    en: {
      title: "Your PDF statements, and even a screenshot",
      body: "The PDF statement your bank sends each month imports like any other file: Pluclair reads its columns, and the statement’s own balances confirm the reading to the cent — or say something is missing. You can also see the transactions read before importing.",
      detail:
        "A scanned statement or a screenshot of your bank’s app can be read by your AI account, with Mistral, if you ask, file by file; every line read then waits in “Review”.",
    },
  },
  {
    id: "2026-10-13-statements-anywhere",
    date: "2026-10-13",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Votre relevé, de partout",
      body: "Déposez le fichier de votre banque n’importe où dans Pluclair, ou copiez le tableau des opérations sur son site et collez-le dans l’import : il se lit pareil. L’import est aussi dans le menu de votre compte.",
      detail:
        "Le 5 de chaque mois, si vous importez vos relevés, un rappel vous demande celui du mois passé ; il se coupe dans le Profil.",
    },
    en: {
      title: "Your statement, from anywhere",
      body: "Drop your bank’s file anywhere in Pluclair, or copy the table of transactions on its website and paste it into the import: it reads the same. The import is in your account menu too.",
      detail:
        "On the 5th of each month, if you import your statements, a reminder asks for last month’s; it can be turned off in Profile.",
    },
  },
  {
    id: "2026-10-13-statements-import",
    date: "2026-10-13",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Importez le relevé de votre banque, tel quel",
      body: "Déposez le fichier que donne votre banque — CSV, Excel, OFX, QIF, CAMT, MT940 ou CFONB — sans rien régler : Pluclair reconnaît la banque et le compte, range ce qu’il connaît déjà, et le reste attend dans « À vérifier », comme avec une banque connectée.",
      detail:
        "Un relevé qui recoupe le précédent n’ajoute rien deux fois, un import s’annule pendant 30 jours, et « Où trouver l’export de ma banque ? » montre où le chercher.",
    },
    en: {
      title: "Import your bank’s statement, as it is",
      body: "Drop the file your bank gives — CSV, Excel, OFX, QIF, CAMT, MT940 or CFONB — with nothing to set: Pluclair recognises the bank and the account, files what it already knows, and the rest waits in “Review”, as with a connected bank.",
      detail:
        "A statement that overlaps the last one adds nothing twice, an import can be undone for 30 days, and “Where is my bank’s export?” shows where to find it.",
    },
  },
  {
    id: "2026-10-13-entraide-phone",
    date: "2026-10-13",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Entraide, dans l’application",
      body: "Entraide s’ouvre aussi sur le téléphone, depuis le menu du compte : lisez les questions, posez la vôtre, répondez, réagissez ou signalez, comme sur le site. Une notification de réponse ouvre la discussion.",
      detail:
        "Les règles sont les mêmes, et ce que vous écrivez passe par les mêmes vérifications : un IBAN, un numéro de carte ou une adresse e-mail est masqué avant d’être publié. Les notifications d’Entraide se règlent dans le Profil.",
    },
    en: {
      title: "Entraide, in the app",
      body: "Entraide opens on the phone too, from the account menu: read the questions, ask yours, answer, react or report, as on the site. A notification of an answer opens the thread.",
      detail:
        "The rules are the same, and what you write goes through the same checks: an IBAN, a card number or an email address is masked before it is published. Entraide's notifications are set in Profile.",
    },
  },
  {
    id: "2026-10-13-entraide",
    date: "2026-10-13",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Entraide ouvre",
      body: "Dans « Le blog », posez vos questions sur l’argent au quotidien et répondez à celles des autres, sous pseudonyme. « Déjà demandé ? » montre ce qui a déjà été répondu, et la réponse qui règle une question se marque « Résolu ».",
      detail:
        "Chaque réponse est l’avis de son auteur, jamais un conseil de Pluclair. Les règles d’Entraide disent ce qui y est bienvenu, comment fonctionne la modération et ce que deviennent vos messages.",
    },
    en: {
      title: "Entraide opens",
      body: "In “Le blog”, ask your questions about money in everyday life and answer other people's, under a pseudonym. “Already asked?” shows what has been answered before, and the answer that settles a question is marked “Solved”.",
      detail:
        "Each answer is its author's view, never advice from Pluclair. Entraide's rules say what is welcome there, how moderation works and what becomes of your posts.",
    },
  },
  {
    id: "2026-10-13-legal-pages",
    date: "2026-10-13",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Les pages légales, en ligne",
      body: "La politique de confidentialité, les conditions d’utilisation et les mentions légales sont publiées, en français et en anglais, et liées en bas de chaque page du site.",
      detail:
        "Elles disent ce que Pluclair garde, pourquoi, combien de temps, qui l’aide à fonctionner, et comment tout reprendre.",
    },
    en: {
      title: "The legal pages, online",
      body: "The privacy policy, the terms of use and the legal notice are published, in French and in English, and linked from the foot of every page of the site.",
      detail:
        "They say what Pluclair keeps, why, for how long, who helps run it, and how to take it all back.",
    },
  },
  {
    id: "2026-10-13-bank-closed",
    date: "2026-10-13",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "La connexion bancaire, fermée",
      body: "open-banking.io ne permet pas à ses clients de confier leur accès à une application comme Pluclair. La connexion bancaire n’est donc plus proposée : vous notez vos opérations, ou vous importez un relevé CSV de votre banque.",
      detail:
        "Rien ne change pour le bilan du mois, qui se fait contre le solde que vous lisez sur votre compte.",
    },
    en: {
      title: "The bank connection, closed",
      body: "open-banking.io does not let its customers give their access to an app like Pluclair, so the bank connection is no longer offered: you note your transactions, or import a CSV statement from your bank.",
      detail:
        "Nothing changes for the month's close, which is done against the balance you read on your account.",
    },
  },
  {
    id: "2026-10-13-header-small-phones",
    date: "2026-10-13",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Le menu du site, sur les petits téléphones",
      body: "Sur un téléphone étroit, l’icône du menu sortait de la barre en haut du site. Connecté, son bouton s’appelle maintenant « Ouvrir », et sur les écrans les plus étroits le nom Pluclair se replie derrière son orbe.",
    },
    en: {
      title: "The site's menu, on small phones",
      body: "On a narrow phone, the menu icon was pushed out of the bar at the top of the site. Signed in, its button now says “Open”, and on the narrowest screens the Pluclair name folds behind its orb.",
    },
  },
  {
    id: "2026-10-13-blog-guides",
    date: "2026-10-13",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Le blog : des guides pratiques",
      body: "Trois guides pour commencer : le jour de lecture, le bilan du mois, et le PEA, le CTO, l’assurance-vie et le PER côte à côte.",
      detail:
        "Sur pluclair.com/blog, dans le menu du site, en français. Les règles des placements renvoient à service-public.gouv.fr, avec le jour où elles ont été lues. Des explications, jamais de conseil.",
    },
    en: {
      title: "The blog: practical guides",
      body: "Three guides to start with: the reading day, the month's close, and the PEA, CTO, assurance-vie and PER side by side.",
      detail:
        "On pluclair.com/blog, in the site's menu, in French. The rules of each investment account link to service-public.gouv.fr, with the day they were read. Explanations, never advice.",
    },
  },
  {
    id: "2026-10-12-reactions",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Réagir aux nouveautés",
      body: "« J’adore », « Utile » ou « Enfin ! » sous chaque nouveauté, et « J’attends ça » sur ce qui se prépare.",
      detail:
        "Tout le monde voit les compteurs ; réagir demande d’être connecté, et chacun ne voit que ses propres réactions.",
    },
    en: {
      title: "React to what's new",
      body: "“Love it”, “Useful” or “At last!” under each change, and “I want this” on what is being built.",
      detail:
        "Everyone sees the counts; reacting needs an account, and each person sees only their own reactions.",
    },
  },
  {
    id: "2026-10-12-nouveautes-in-app",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Nouveautés » dans l’app",
      body: "Un point vert sur votre compte quand quelque chose de nouveau est arrivé. Lire « Nouveautés » le fait partir, sur le web comme sur le téléphone.",
    },
    en: {
      title: "“What's new” in the app",
      body: "A green dot on your account when something new has arrived. Reading “What's new” clears it, on the web and on the phone.",
    },
  },
  {
    id: "2026-10-12-whats-new-sheet",
    date: "2026-10-12",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Quoi de neuf, après une mise à jour",
      body: "Au premier lancement d’une nouvelle version de l’application, ce qu’elle apporte, en quelques cartes.",
    },
    en: {
      title: "What's new, after an update",
      body: "The first time a new version of the app opens, what it brings, in a few cards.",
    },
  },
  {
    id: "2026-10-12-new-version-banner",
    date: "2026-10-12",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Une nouvelle version, signalée",
      body: "Quand le site propose une application Android plus récente, Le point le dit, avec un bouton pour la télécharger.",
    },
    en: {
      title: "A new version, announced",
      body: "When the site offers a newer Android app, Le point says so, with a button to download it.",
    },
  },
  {
    id: "2026-10-12-nouveautes",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "« Nouveautés »",
      body: "Tout ce qui change dans Pluclair, semaine après semaine, sur une page à suivre — ou dans votre lecteur de flux RSS.",
      detail:
        "Ce qui est arrivé depuis votre dernière visite est marqué en vert, chaque nouveauté a son lien à partager, et « Bientôt » dit ce qui se prépare.",
    },
    en: {
      title: "“What's new”",
      body: "Everything that changes in Pluclair, week after week, on one page to follow — or in your RSS reader.",
      detail:
        "What arrived since your last visit is marked in green, each change has its own link to share, and “Coming soon” says what is being built.",
    },
  },
  {
    id: "2026-10-12-link-previews",
    date: "2026-10-12",
    kind: "better",
    platforms: ["web"],
    fr: {
      title: "Un aperçu quand vous partagez un lien",
      body: "Un lien vers pluclair.com envoyé dans une messagerie s’affiche avec son titre et son image.",
    },
    en: {
      title: "A preview when you share a link",
      body: "A link to pluclair.com sent in a messaging app shows with its title and its image.",
    },
  },
  {
    id: "2026-10-12-journal-weeks",
    date: "2026-10-12",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "ledger",
    featured: true,
    fr: {
      title: "Le Journal, une semaine à la fois",
      body: "Une bande en haut du Journal montre les semaines du mois : choisissez-en une, et les jours glissent à leur place.",
      detail:
        "Les entrées et les sorties de la semaine se mettent à jour d’un coup, et un bouton retourne l’ordre de la liste, du plus ancien au plus récent ou l’inverse.",
    },
    en: {
      title: "The Journal, a week at a time",
      body: "A strip at the top of the Journal shows the month’s weeks: pick one and the days slide into place.",
      detail:
        "The week’s money in and out update at once, and one button turns the list over, oldest first or newest first.",
    },
  },
  {
    id: "2026-10-12-recurring-lighter",
    date: "2026-10-12",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "charges",
    fr: {
      title: "Récurrents s’allège",
      body: "Le bloc « Abonnements » quitte Récurrents. Le récap du lundi continue de signaler un abonnement qui commence, augmente ou s’arrête.",
    },
    en: {
      title: "A lighter Recurring",
      body: "The “Subscriptions” block leaves Recurring. The Monday recap still says when a subscription starts, goes up or stops.",
    },
  },
  {
    id: "2026-10-12-about",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "« À propos » : qui fait Pluclair",
      body: "Qui construit Pluclair, pourquoi, et comment essayer la bêta, raconté au fil de la page.",
    },
    en: {
      title: "“About”: who makes Pluclair",
      body: "Who builds Pluclair, why, and how to try the beta, told as the page scrolls.",
    },
  },
  {
    id: "2026-10-12-android-apk",
    date: "2026-10-12",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "L’application Android, depuis le site",
      body: "L’application se télécharge directement sur pluclair.com, en bêta ouverte, sans passer par un store.",
    },
    en: {
      title: "The Android app, from the site",
      body: "The app downloads straight from pluclair.com, as an open beta, without going through a store.",
    },
  },
  {
    id: "2026-10-12-bank-for-everyone",
    date: "2026-10-12",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "month-close",
    fr: {
      title: "La connexion bancaire, ouverte à tous",
      body: "Chacun peut relier sa banque, en lecture seule, avec son propre compte open-banking.io, payé directement à ce service.",
    },
    en: {
      title: "Bank connection, open to everyone",
      body: "Anyone can connect their bank, read-only, with their own open-banking.io account, paid to that service directly.",
    },
  },
  {
    id: "2026-10-10-ask-chat",
    date: "2026-10-10",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "questions",
    featured: true,
    fr: {
      title: "Questions devient une conversation",
      body: "Demandez « où part mon argent ? », puis creusez à la suite. La réponse s’écrit en direct, à partir de vos propres chiffres.",
      detail:
        "Pluclair cherche lui-même dans vos écritures, compare deux mois, fait un calcul ; chaque montant cité est vérifié contre ce que l’app sait, et la conversation reste là quand vous revenez.",
    },
    en: {
      title: "Questions becomes a conversation",
      body: "Ask “where does my money go?”, then dig further. The answer is written live, from your own figures.",
      detail:
        "Pluclair looks through your entries itself, compares two months, runs a sum; every amount it quotes is checked against what the app knows, and the conversation is still there when you come back.",
    },
  },
  {
    id: "2026-10-10-plan-fees",
    date: "2026-10-10",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "plan",
    fr: {
      title: "Les frais, comptés dans chaque projection",
      body: "Les frais de vos placements sont retirés des paliers, de la vue longue et de « Dans un an ».",
    },
    en: {
      title: "Fees, counted in every projection",
      body: "Your investments’ fees come off the milestones, the long view and “A year from now”.",
    },
  },
  {
    id: "2026-10-09-year-ahead",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "plan",
    featured: true,
    fr: {
      title: "« Dans un an », compte par compte",
      body: "Le Plan montre où chacun de vos comptes en sera dans un an, pourquoi, et ce qui changerait si vous versiez plus ou moins.",
      detail:
        "Les livrets pleins, les versements prévus et les événements de l’année sont dessinés sur la même bande ; un interrupteur passe de « Pourquoi » à « Et si ».",
    },
    en: {
      title: "“A year from now”, account by account",
      body: "Plan shows where each of your accounts will be in a year, why, and what would change if you put in more or less.",
      detail:
        "Full savings accounts, planned transfers and the year’s events are drawn on the same band; a switch goes from “Why” to “What if”.",
    },
  },
  {
    id: "2026-10-09-together",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "together",
    featured: true,
    fr: {
      title: "À deux : l’espace commun",
      body: "« Moi · Commun » : un espace pour le compte joint, partagé avec votre conjoint. Chacun garde son propre espace, que l’autre ne voit jamais.",
      detail:
        "Invitez par un lien, passez d’un espace à l’autre d’une touche, et choisissez comment se répartissent les dépenses communes : Le point peut alors compter votre part.",
    },
    en: {
      title: "Together: the shared space",
      body: "“Me · Shared”: a space for the joint account, shared with your partner. Each keeps their own space, which the other never sees.",
      detail:
        "Invite with a link, switch spaces in one tap, and choose how shared spending is split: Le point can then count your part of it.",
    },
  },
  {
    id: "2026-10-09-shared-home",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "property",
    fr: {
      title: "Un logement à deux, et l’Immobilier pour tous",
      body: "Un bien peut appartenir à l’espace commun, avec la part de chacun. L’onglet Immobilier est désormais ouvert à tout le monde.",
    },
    en: {
      title: "A home owned together, and Property for all",
      body: "A property can belong to the shared space, with each partner’s part. The Property tab is now open to everyone.",
    },
  },
  {
    id: "2026-10-09-own-ai",
    date: "2026-10-09",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "questions",
    fr: {
      title: "L’IA de votre choix, sur votre compte",
      body: "Les questions et les lectures passent par votre propre compte OpenRouter, avec le modèle que vous choisissez : Mistral, ChatGPT ou Claude.",
    },
    en: {
      title: "The AI of your choice, on your account",
      body: "Questions and reads go through your own OpenRouter account, with the model you choose: Mistral, ChatGPT or Claude.",
    },
  },
  {
    id: "2026-10-09-android-widget",
    date: "2026-10-09",
    kind: "new",
    platforms: ["phone"],
    feature: "bearing",
    fr: {
      title: "« Il vous reste » sur l’écran d’accueil",
      body: "Un widget Android affiche ce qu’il vous reste, avec un « + » pour noter une dépense sans ouvrir l’app.",
    },
    en: {
      title: "“You have” on the home screen",
      body: "An Android widget shows what you have left, with a “+” to note a spend without opening the app.",
    },
  },
  {
    id: "2026-10-09-feedback",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Envoyer un retour »",
      body: "Une remarque, un bug ? Écrivez directement depuis votre Profil.",
    },
    en: {
      title: "“Send feedback”",
      body: "A remark, a bug? Write straight from your Profile.",
    },
  },
  {
    id: "2026-10-09-feature-pages",
    date: "2026-10-09",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Une page par fonction, avec sa démo",
      body: "Sur le site, chaque écran de Pluclair a sa page, et une démo à manipuler avec un mois d’exemple.",
    },
    en: {
      title: "A page for each feature, with its demo",
      body: "On the site, each of Pluclair’s screens has its own page, and a demo to play with on a sample month.",
    },
  },
  {
    id: "2026-10-09-google-account",
    date: "2026-10-09",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Google demande quel compte utiliser",
      body: "La connexion avec Google propose de choisir le compte à chaque fois, au lieu de reprendre le dernier.",
    },
    en: {
      title: "Google asks which account to use",
      body: "Signing in with Google offers a choice of account every time, instead of taking the last one.",
    },
  },
  {
    id: "2026-10-09-offline-retry",
    date: "2026-10-09",
    kind: "fixed",
    platforms: ["phone"],
    fr: {
      title: "« Réessayer » quand le réseau manque",
      body: "Trois écrans du téléphone restaient vides hors connexion ; ils proposent désormais de réessayer.",
    },
    en: {
      title: "“Try again” when the network drops",
      body: "Three phone screens stayed empty offline; they now offer to try again.",
    },
  },
  {
    id: "2026-10-08-left-to-spend",
    date: "2026-10-08",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    featured: true,
    fr: {
      title: "« Il vous reste », en tête du point",
      body: "Le point s’ouvre sur ce qu’il vous reste jusqu’à votre prochain revenu, recalculé à chaque dépense notée.",
      detail:
        "Ce que vos comptes contiennent, moins les charges qui tombent d’ici là, moins une marge pour ce que vous ne notez jamais. Et « Puis-je me permettre ? » : tapez un montant, Pluclair dit ce qu’il vous resterait, sans rien enregistrer.",
    },
    en: {
      title: "“You have”, at the top of Le point",
      body: "Le point opens on what you have left until your next income, worked out again with every spend you note.",
      detail:
        "What your accounts hold, less the charges due before then, less a margin for what you never note. And “Can I afford it?”: type an amount, and Pluclair says what you would have left, saving nothing.",
    },
  },
  {
    id: "2026-10-08-search",
    date: "2026-10-08",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "ledger",
    fr: {
      title: "Chercher dans tous les mois",
      body: "Depuis le Journal, retrouvez une écriture par commerçant, catégorie ou montant, quel que soit le mois.",
    },
    en: {
      title: "Search every month",
      body: "From the Journal, find an entry by shop, category or amount, whatever the month.",
    },
  },
  {
    id: "2026-10-08-statements",
    date: "2026-10-08",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Plus de relevés bancaires lus",
      body: "L’import lit les fichiers OFX, les CSV en Windows-1252 et ceux qui ont des lignes avant l’en-tête, comme en exportent beaucoup de banques françaises.",
    },
    en: {
      title: "More bank statements read",
      body: "Import reads OFX files, Windows-1252 CSVs and those with lines above the header, as many French banks export them.",
    },
  },
  {
    id: "2026-10-08-bank-steps",
    date: "2026-10-08",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "month-close",
    fr: {
      title: "Relier sa banque, une étape à la fois",
      body: "La connexion bancaire se fait pas à pas, et Pluclair se souvient où vous en êtes, sur le web comme sur le téléphone.",
    },
    en: {
      title: "Connecting a bank, one step at a time",
      body: "The bank connection goes step by step, and Pluclair remembers where you are, on the web and on the phone.",
    },
  },
  {
    id: "2026-10-08-your-year",
    date: "2026-10-08",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Votre année », racontée",
      body: "Début janvier, l’année passée en quelques cartes, avec une image à partager où ne figure aucun montant.",
    },
    en: {
      title: "“Your year”, told",
      body: "In early January, the year gone by in a few cards, with an image to share that shows no amount.",
    },
  },
  {
    id: "2026-10-08-quick-actions",
    date: "2026-10-08",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Un appui long sur l’icône",
      body: "Sur l’icône de l’app : « Ajouter une dépense » ou « Le point », directement.",
    },
    en: {
      title: "A long press on the icon",
      body: "On the app’s icon: “Add a spend” or “Le point”, straight away.",
    },
  },
  {
    id: "2026-10-08-broker-transfer-timing",
    date: "2026-10-08",
    kind: "better",
    platforms: ["web", "phone"],
    fr: {
      title: "Le virement au courtier, au bon moment",
      body: "Deux jours avant le 1er, puis quand le salaire arrive : combien envoyer à votre courtier pour les DCA du mois.",
    },
    en: {
      title: "The broker transfer, at the right time",
      body: "Two days before the 1st, then when the salary arrives: how much to send your broker for the month’s DCAs.",
    },
  },
  {
    id: "2026-10-07-several-accounts",
    date: "2026-10-07",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Plusieurs comptes bancaires",
      body: "Chaque compte reçoit son rôle d’une touche, Le point détaille le solde compte par compte, et chaque ligne du Journal dit d’où elle vient.",
    },
    en: {
      title: "Several bank accounts",
      body: "Each account gets its role in one tap, Le point breaks the balance down by account, and each Journal row says where it came from.",
    },
  },
  {
    id: "2026-10-07-dca-tick",
    date: "2026-10-07",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "wallets",
    fr: {
      title: "Une coche par DCA",
      body: "Chaque DCA dit s’il est payé par le virement au courtier, et Le point résume ce virement en une ligne sous la courbe.",
    },
    en: {
      title: "A tick for each DCA",
      body: "Each DCA says whether the broker transfer pays for it, and Le point sums that transfer up in one line under the curve.",
    },
  },
  {
    id: "2026-10-07-dca-bank-row",
    date: "2026-10-07",
    kind: "fixed",
    platforms: ["web", "phone"],
    fr: {
      title: "Une ligne de la banque n’est plus prise pour un DCA",
      body: "Un achat fait chez le courtier ne passe jamais par la banque ; Pluclair ne lui associe plus une ligne du relevé, et propose de rouvrir celles qui l’avaient été.",
    },
    en: {
      title: "A bank row is no longer taken for a DCA",
      body: "A buy made at the broker never goes through the bank; Pluclair no longer matches a statement row to it, and offers to reopen those it had.",
    },
  },
  {
    id: "2026-10-07-passkey",
    date: "2026-10-07",
    kind: "fixed",
    platforms: ["web"],
    fr: {
      title: "Après une passkey, Le point s’ouvre en entier",
      body: "La connexion par passkey menait à un point incomplet ; il se charge désormais entièrement.",
    },
    en: {
      title: "After a passkey, Le point opens in full",
      body: "Signing in with a passkey led to a half-loaded Le point; it now loads in full.",
    },
  },
  {
    id: "2026-10-06-dca-confirm",
    date: "2026-10-06",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "wallets",
    fr: {
      title: "Votre DCA est-il passé ?",
      body: "Pluclair ne voit pas les achats faits dans votre PEA : le lendemain d’un DCA, une notification le demande, et vous confirmez d’une touche.",
    },
    en: {
      title: "Did your DCA go through?",
      body: "Pluclair cannot see buys made inside your PEA: the morning after a DCA, a notification asks, and you confirm in one tap.",
    },
  },
  {
    id: "2026-10-06-broker-transfer",
    date: "2026-10-06",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "wallets",
    fr: {
      title: "Un virement au courtier qui suit vos DCA",
      body: "« Selon vos DCA » : le virement vers votre courtier prend le montant de vos DCA du mois, et le suit quand ils changent.",
    },
    en: {
      title: "A broker transfer that follows your DCAs",
      body: "“Following your DCAs”: the transfer to your broker takes the amount of the month’s DCAs, and follows them when they change.",
    },
  },
  {
    id: "2026-10-06-left-each-month",
    date: "2026-10-06",
    kind: "fixed",
    platforms: ["web", "phone"],
    feature: "charges",
    fr: {
      title: "« Reste chaque mois » ne compte plus les DCA deux fois",
      body: "Les DCA achetés chez le courtier étaient retirés deux fois, et le calendrier les comptait comme des sorties d’argent.",
    },
    en: {
      title: "“Left each month” no longer counts DCAs twice",
      body: "DCAs bought at the broker were taken off twice, and the calendar counted them as money going out.",
    },
  },
  {
    id: "2026-10-05-awaited",
    date: "2026-10-05",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Une charge attendue reste comptée",
      body: "Passé son jour, une charge que la banque n’a pas encore apportée reste dans Le point, marquée « attendue », jusqu’à ce qu’elle arrive.",
    },
    en: {
      title: "An awaited charge stays counted",
      body: "Once its day has passed, a charge the bank has not brought yet stays in Le point, marked “awaited”, until it arrives.",
    },
  },
  {
    id: "2026-10-05-new-site",
    date: "2026-10-05",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Un nouveau site",
      body: "pluclair.com, redessiné pour tout le monde : la Terre au lever du jour, et l’app racontée au fil du défilement.",
    },
    en: {
      title: "A new site",
      body: "pluclair.com, redesigned for everyone: the Earth at sunrise, and the app told as the page scrolls.",
    },
  },
  {
    id: "2026-10-04-bearing-markers",
    date: "2026-10-04",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Les jours où l’argent part, sur la courbe",
      body: "Chaque jour où de l’argent sort est marqué sur la courbe du point, et la lecture dit ce qui est parti.",
    },
    en: {
      title: "The days money leaves, on the curve",
      body: "Each day money goes out is marked on Le point’s curve, and the reading says what left.",
    },
  },
  {
    id: "2026-10-04-ai-account",
    date: "2026-10-04",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "month-read",
    fr: {
      title: "Votre propre compte d’IA",
      body: "Reliez votre compte OpenRouter : les lectures écrites par l’IA passent par votre clé, avec le modèle que vous choisissez.",
    },
    en: {
      title: "Your own AI account",
      body: "Connect your OpenRouter account: the reads the AI writes go through your key, with the model you choose.",
    },
  },
  {
    id: "2026-10-04-phone-catches-up",
    date: "2026-10-04",
    kind: "better",
    platforms: ["phone"],
    fr: {
      title: "Le téléphone rattrape le web",
      body: "La vue « Par catégorie » du Journal, la bande au-dessus du calendrier et les charges proposées depuis le relevé arrivent sur le téléphone.",
    },
    en: {
      title: "The phone catches up with the web",
      body: "The Journal’s “By category” view, the strip above the calendar and the charges suggested from the statement come to the phone.",
    },
  },
  {
    id: "2026-10-04-placements-phone",
    date: "2026-10-04",
    kind: "better",
    platforms: ["phone"],
    feature: "wallets",
    fr: {
      title: "Placements, repensé sur le téléphone",
      body: "Un résumé en tête, les logos de vos placements, et des lignes plus calmes.",
    },
    en: {
      title: "Investments, rethought on the phone",
      body: "A summary at the top, your holdings’ logos, and quieter rows.",
    },
  },
  {
    id: "2026-10-03-loan-insurance",
    date: "2026-10-03",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "property",
    fr: {
      title: "L’assurance d’un prêt, prélevée à part",
      body: "Si l’assurance de votre prêt est prélevée séparément, Pluclair garde les deux prélèvements distincts et ne les compte qu’une fois.",
    },
    en: {
      title: "A loan’s insurance, debited apart",
      body: "If your loan’s insurance is debited separately, Pluclair keeps the two debits apart and counts them once.",
    },
  },
  {
    id: "2026-10-03-property-progress",
    date: "2026-10-03",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "property",
    fr: {
      title: "Ce qui est déjà à vous",
      body: "Chaque bien montre la part qui vous appartient déjà, et où en est chacun de ses prêts.",
    },
    en: {
      title: "What is already yours",
      body: "Each property shows the share that is already yours, and how far each of its loans has come.",
    },
  },
  {
    id: "2026-10-02-property",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "property",
    featured: true,
    fr: {
      title: "L’immobilier",
      body: "Un onglet pour votre logement : sa valeur estimée d’après les ventes autour, ses prêts et leur tableau d’amortissement, et la part déjà à vous.",
      detail:
        "Les ventes viennent des données publiques (DVF), portées à aujourd’hui par l’indice des prix. Un bien loué montre aussi son mois, son rendement et les loyers demandés autour.",
    },
    en: {
      title: "Property",
      body: "A tab for your home: its value estimated from sales around it, its loans and their schedule, and the share already yours.",
      detail:
        "The sales come from public records (DVF), brought to today by the price index. A let property also shows its month, its yield and the rents asked around it.",
    },
  },
  {
    id: "2026-10-02-recap-warnings",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Le récap du lundi, et des alertes utiles",
      body: "Chaque lundi, votre semaine en quelques chiffres ; et un mot avant un découvert, avant une grosse charge, ou le jour où lire votre solde.",
      detail:
        "Chaque type de notification se coupe à part, dans le Profil, et rien n’arrive entre 21 h et 8 h.",
    },
    en: {
      title: "The Monday recap, and useful warnings",
      body: "Every Monday, your week in a few figures; and a word before an overdraft, before a large charge, or on the day to read your balance.",
      detail:
        "Each kind of notification can be turned off on its own, in Profile, and nothing arrives between 9 pm and 8 am.",
    },
  },
  {
    id: "2026-10-02-undo",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "« Annuler », partout",
      body: "Une suppression se reprend d’un « Annuler ». Un mois clos et une boîte de revue vidée deviennent de petits moments.",
    },
    en: {
      title: "“Undo”, everywhere",
      body: "A delete can be taken back with “Undo”. A closed month and an emptied review inbox become small moments.",
    },
  },
  {
    id: "2026-10-02-how-computed",
    date: "2026-10-02",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "« Comment c’est calculé ? »",
      body: "Sous le solde du point, une ligne ouvre le détail du calcul, en mots simples.",
    },
    en: {
      title: "“How is it worked out?”",
      body: "Under Le point’s balance, one line opens how the figure is worked out, in plain words.",
    },
  },
  {
    id: "2026-10-02-journal-export",
    date: "2026-10-02",
    kind: "fixed",
    platforms: ["web"],
    feature: "ledger",
    fr: {
      title: "L’export du Journal s’ouvre bien dans un tableur",
      body: "Le fichier exporté s’ouvre proprement dans un tableur, en français.",
    },
    en: {
      title: "The Journal export opens cleanly in a spreadsheet",
      body: "The exported file opens properly in a spreadsheet, in French.",
    },
  },
  {
    id: "2026-10-01-french-first",
    date: "2026-10-01",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Pluclair parle français d’abord",
      body: "Tout est écrit en français, en mots simples ; l’anglais reste disponible dans le Profil.",
    },
    en: {
      title: "Pluclair speaks French first",
      body: "Everything is written in French, in plain words; English stays available in Profile.",
    },
  },
  {
    id: "2026-10-01-charges-fill",
    date: "2026-10-01",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "charges",
    fr: {
      title: "Les charges se remplissent toutes seules",
      body: "Plus de bouton « Appliquer » : ce qui revient chaque mois s’ajoute de lui-même, compté dans le mois prévu même s’il passe un peu avant ou après.",
    },
    en: {
      title: "Charges fill in on their own",
      body: "No more “Apply” button: what comes back every month adds itself, counted in the month it was planned for even when it clears a little early or late.",
    },
  },
  {
    id: "2026-10-01-plan",
    date: "2026-10-01",
    kind: "better",
    platforms: ["web", "phone"],
    feature: "plan",
    fr: {
      title: "Le Plan, autour d’où va votre argent",
      body: "Le Plan est reconstruit : votre matelas, les paliers à venir, et une place pour chacun de vos comptes.",
    },
    en: {
      title: "Plan, built around where your money is heading",
      body: "Plan is rebuilt: your cushion, the milestones ahead, and a place for each of your accounts.",
    },
  },
  {
    id: "2026-09-21-site-french",
    date: "2026-09-21",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Le site, en français",
      body: "pluclair.com se lit en français comme en anglais.",
    },
    en: {
      title: "The site, in French",
      body: "pluclair.com reads in French as well as in English.",
    },
  },
  {
    id: "2026-09-19-category-read",
    date: "2026-09-19",
    kind: "new",
    platforms: ["web"],
    feature: "month-read",
    fr: {
      title: "Une catégorie, lue en quelques phrases",
      body: "Ouvrez une catégorie : douze mois en grille, ce qui se distingue, et une lecture écrite à la demande.",
    },
    en: {
      title: "A category, read in a few sentences",
      body: "Open a category: twelve months in a grid, what stands out, and a read written on request.",
    },
  },
  {
    id: "2026-09-09-bearing",
    date: "2026-09-09",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "bearing",
    fr: {
      title: "Le point",
      body: "Un écran pour savoir où vous en êtes aujourd’hui, et comment le mois va finir.",
    },
    en: {
      title: "Le point",
      body: "One screen to see where you stand today, and how the month will end.",
    },
  },
  {
    id: "2026-09-09-two-languages",
    date: "2026-09-09",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "L’app en français et en anglais",
      body: "Pluclair se lit dans les deux langues, et se souvient de celle que vous avez choisie.",
    },
    en: {
      title: "The app in French and English",
      body: "Pluclair reads in both languages, and remembers the one you chose.",
    },
  },
  {
    id: "2026-09-07-android-push",
    date: "2026-09-07",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Les notifications sur Android",
      body: "Les rappels et les alertes arrivent aussi sur le téléphone.",
    },
    en: {
      title: "Notifications on Android",
      body: "Reminders and warnings reach the phone too.",
    },
  },
  {
    id: "2026-09-02-bank",
    date: "2026-09-02",
    kind: "new",
    platforms: ["web", "phone"],
    feature: "month-close",
    featured: true,
    fr: {
      title: "La banque, en lecture seule",
      body: "Un mois se clôt contre le solde de votre banque, et ce qui a filé sans être noté apparaît.",
      detail:
        "Pluclair lit vos mouvements, reconnaît un commerçant comme la banque l’écrit, et ne range une ligne que là où vous l’avez déjà rangée vous-même. Il ne peut rien virer ni payer.",
    },
    en: {
      title: "The bank, read-only",
      body: "A month closes against your bank’s balance, and what slipped by unrecorded shows up.",
      detail:
        "Pluclair reads your movements, recognises a shop the way the bank spells it, and files a row only where you have filed one yourself. It cannot transfer or pay anything.",
    },
  },
  {
    id: "2026-09-01-import",
    date: "2026-09-01",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Importer un relevé",
      body: "Déposez le CSV de votre banque : les opérations du mois entrent d’un coup.",
    },
    en: {
      title: "Import a statement",
      body: "Drop your bank’s CSV: the month’s transactions come in at once.",
    },
  },
  {
    id: "2026-09-01-web-push",
    date: "2026-09-01",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "Des notifications dans le navigateur",
      body: "Installée depuis le navigateur, l’app peut vous prévenir comme une application.",
    },
    en: {
      title: "Notifications in the browser",
      body: "Installed from the browser, the app can notify you like any other.",
    },
  },
  {
    id: "2026-08-13-passkeys",
    date: "2026-08-13",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "Passkeys et déverrouillage biométrique",
      body: "Connectez-vous sans mot de passe, et rouvrez l’app avec votre visage ou votre empreinte.",
    },
    en: {
      title: "Passkeys and biometric unlock",
      body: "Sign in without a password, and reopen the app with your face or your fingerprint.",
    },
  },
  {
    id: "2026-08-11-pluclair",
    date: "2026-08-11",
    kind: "new",
    platforms: ["web", "phone"],
    fr: {
      title: "Il s’appelle Pluclair",
      body: "Votre argent, plus clair chaque mois.",
    },
    en: {
      title: "It is called Pluclair",
      body: "Your money, clearer every month.",
    },
  },
  {
    id: "2026-07-23-mobile-app",
    date: "2026-07-23",
    kind: "new",
    platforms: ["phone"],
    fr: {
      title: "L’app mobile",
      body: "Le même compte dans la poche, avec les mêmes chiffres.",
    },
    en: {
      title: "The mobile app",
      body: "The same account in your pocket, with the same figures.",
    },
  },
  {
    id: "2026-06-15-first-line",
    date: "2026-06-15",
    kind: "new",
    platforms: ["web"],
    fr: {
      title: "La première ligne de code",
      body: "Un tableau de bord, des catégories, et les opérations qui reviennent chaque mois.",
    },
    en: {
      title: "The first line of code",
      body: "A dashboard, categories, and the transactions that come back every month.",
    },
  },
];

/**
 * The figures the page states about the list, counted from the repository
 * by `scripts/changelog-draft.mjs` when an entry is added — not at build,
 * where Vercel's shallow clone would count a handful.
 */
export const CHANGELOG_STATS = {
  /** `git rev-list --count HEAD` on the branch that wrote the newest entry. */
  commits: 1186,
  /** The repository's first commit. */
  since: "2026-06-15",
  asOf: "2026-11-05",
} as const;

/**
 * « Bientôt »: what is being built and not open yet, in the future tense
 * and nowhere else. An item leaves this list the day its entry is written.
 */
export const ROADMAP: readonly RoadmapItem[] = [
  {
    id: "listener",
    fr: {
      title: "Les notifications de votre banque",
      body: "Sur Android, avec l’« Accès aux notifications », chaque paiement que votre banque annonce deviendra une ligne à vérifier au moment où il s’affiche — lu sur le téléphone seulement, et pour les applications bancaires que vous choisissez. Construit ; ouvert quand une version de l’application l’aura fait tourner.",
    },
    en: {
      title: "Your bank’s notifications",
      body: "On Android, with “Notification access”, each payment your bank announces will become a line to check the moment it shows — read on the phone only, and for the bank apps you choose. Built; open once a build of the app has run it.",
    },
  },
  {
    id: "stores",
    fr: {
      title: "Dans les stores",
      body: "Pluclair sur Google Play et l’App Store. En attendant, l’application Android se télécharge sur ce site, et Pluclair se met sur l’écran d’accueil de l’iPhone.",
    },
    en: {
      title: "In the stores",
      body: "Pluclair on Google Play and the App Store. Until then, the Android app downloads from this site, and Pluclair goes on the iPhone’s home screen.",
    },
  },
];
