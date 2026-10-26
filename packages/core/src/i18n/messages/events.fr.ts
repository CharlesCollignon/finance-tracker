import type { eventsEn } from "./events.en";

/** `events.en.ts`, in French. `fr.ts` mounts it as `events`. */
export const eventsFr: typeof eventsEn = {
  open: "Opérations",
  intro:
    "Ce qui s'est passé dans le compte : une ligne achetée ou vendue, un dividende reçu, des frais prélevés. Saisi ici, ou lu dans l'export du courtier.",
  empty: "Aucune opération pour l'instant",
  emptyBody:
    "Saisissez-en une, ou lisez l'export du courtier : un CSV ou un tableur des mouvements du compte.",
  count: { one: "{count} opération", other: "{count} opérations" },
  fromFile: "lue dans un fichier",
  new: "Nouvelle opération",
  kind: "Nature",
  kindBuy: "Achat",
  kindSell: "Vente",
  kindDividend: "Dividende",
  kindFee: "Frais",
  date: "Date",
  instrument: "Ligne",
  instrumentPlaceholder: "ex. Amundi MSCI World",
  isin: "ISIN",
  isinHint: "Facultatif : les douze caractères du relevé du courtier.",
  isinInvalid:
    "Un ISIN, c'est deux lettres, neuf lettres ou chiffres, puis un chiffre",
  quantity: "Titres ou parts",
  amount: "Montant",
  amountBuy: "Ce que ça a coûté, frais compris",
  amountSell: "Ce que ça a rapporté, frais déduits",
  amountDividend: "Ce qui a été reçu, net",
  amountFee: "Ce qui a été prélevé",
  note: "Note",
  add: "Ajouter l'opération",
  adding: "Ajout…",
  added: "Opération ajoutée",
  delete: "Supprimer",
  deleteNamed: "Supprimer l'opération du {date}",
  deleted: "Opération supprimée",
  close: "Fermer",
  importFile: "Lire l'export du courtier",
  importing: "Lecture…",
  importHint:
    "Un CSV ou un tableur des mouvements du compte, tel que le courtier le donne. Une ligne déjà lue n'est jamais ajoutée deux fois.",
  importRead: {
    one: "{count} opération lue",
    other: "{count} opérations lues",
  },
  importSkipped: {
    one: "{count} ligne mise de côté : pas une opération",
    other: "{count} lignes mises de côté : pas des opérations",
  },
  importConfirm: "Les ajouter",
  importNone: "Rien à ajouter",
  imported: {
    one: "{count} opération ajoutée",
    other: "{count} opérations ajoutées",
  },
  importedKnown: {
    one: "{count} déjà connue",
    other: "{count} déjà connues",
  },
  importNoTable:
    "Ce fichier n'est pas un tableau que l'app sait lire. Un CSV ou un tableur, oui.",
  importNoColumns:
    "Aucun en-tête nommant une date et un montant n'a été trouvé dans ce fichier.",
  importEmpty: "Ce fichier est vide.",
  importSynthetic:
    "Lu d'après les noms des colonnes et les mots de chaque ligne, en français ou en anglais, et mis au point sur des exports d'exemple : vérifiez le premier fichier lu.",
  cardTitle: "Dividendes et plus-values réalisées",
  cardEmpty:
    "Rien pour l'instant. Les opérations saisies, ou lues dans l'export du courtier, s'affichent ici par année.",
  cardBody:
    "Chaque vente est rapprochée des achats les plus anciens de la même ligne encore détenus, premier entré premier sorti, comme le fisc les lit. Dividendes et frais sont ce qui a été reçu et prélevé, net.",
  gains: "Plus-values réalisées",
  dividends: "Dividendes",
  fees: "Frais",
  proceeds: "Vendu",
  basis: "Avait coûté",
  uncovered: {
    one: "{count} vente sans tous ses achats enregistrés : sa plus-value est surestimée de leur coût.",
    other:
      "{count} ventes sans tous leurs achats enregistrés : leur plus-value est surestimée de leur coût.",
  },
};
