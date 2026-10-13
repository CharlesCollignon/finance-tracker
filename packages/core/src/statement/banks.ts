/**
 * The banks a French export may come from, and how a file gives its bank
 * away: the bank code inside an IBAN or an OFX, or a CSV's own column names.
 *
 * Only what is certain is kept. A bank named wrongly on the import's card
 * (« Relevé BNP Paribas » over a Société Générale export) costs more trust
 * than a card that asks; so an unknown code or a header shared by several
 * banks says nothing, and the person picks their bank once.
 *
 * The CSV signatures are the column names each bank's export used in
 * October 2026. A bank that changes them falls back to being read by its
 * columns' contents (`table.ts`), which needs no signature at all.
 */

export const BANK_IDS = [
  "boursobank",
  "credit-agricole",
  "bnp-paribas",
  "societe-generale",
  "lcl",
  "caisse-epargne",
  "banque-populaire",
  "credit-mutuel",
  "cic",
  "la-banque-postale",
  "fortuneo",
  "hello-bank",
  "monabanq",
  "hsbc",
  "revolut",
  "n26",
  "qonto",
  "shine",
  "nickel",
  "sumeria",
] as const;

export type BankId = (typeof BANK_IDS)[number];

/** The name a person knows their bank by. */
export const BANK_NAMES: Record<BankId, string> = {
  boursobank: "BoursoBank",
  "credit-agricole": "Crédit Agricole",
  "bnp-paribas": "BNP Paribas",
  "societe-generale": "Société Générale",
  lcl: "LCL",
  "caisse-epargne": "Caisse d'Épargne",
  "banque-populaire": "Banque Populaire",
  "credit-mutuel": "Crédit Mutuel",
  cic: "CIC",
  "la-banque-postale": "La Banque Postale",
  fortuneo: "Fortuneo",
  "hello-bank": "Hello bank!",
  monabanq: "Monabanq",
  hsbc: "HSBC",
  revolut: "Revolut",
  n26: "N26",
  qonto: "Qonto",
  shine: "Shine",
  nickel: "Nickel",
  sumeria: "Sumeria",
};

export function isBankId(value: unknown): value is BankId {
  return (BANK_IDS as readonly unknown[]).includes(value);
}

/**
 * French bank codes (« code banque », the five digits after `FR76` in an
 * IBAN, and an OFX's `BANKID`) that belong to one bank alone. The regional
 * networks — Crédit Agricole, Caisse d'Épargne, Banque Populaire, Crédit
 * Mutuel — each have dozens of codes, one per regional bank, and are left to
 * their files' other signs.
 */
const BANK_CODES: Record<string, BankId> = {
  "30004": "bnp-paribas",
  "30003": "societe-generale",
  "30002": "lcl",
  "20041": "la-banque-postale",
  "40618": "boursobank",
  "30066": "cic",
  "30056": "hsbc",
};

/** The bank a French bank code belongs to, when it belongs to one alone. */
export function bankFromCode(code: string | null | undefined): BankId | null {
  const digits = code?.replace(/\D/g, "") ?? "";
  return digits.length === 5 ? (BANK_CODES[digits] ?? null) : null;
}

/** The bank an IBAN belongs to, for a French IBAN whose code says. */
export function bankFromIban(iban: string | null | undefined): BankId | null {
  const clean = iban?.replace(/\s+/g, "").toUpperCase() ?? "";
  return clean.startsWith("FR") && clean.length >= 9
    ? bankFromCode(clean.slice(4, 9))
    : null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Column names only one bank's export carries, all of which must be there.
 * Checked against the header row as read, accents and case aside.
 */
const CSV_SIGNATURES: { bank: BankId; columns: string[] }[] = [
  // dateOp;dateVal;label;category;categoryParent;supplierFound;amount;…
  { bank: "boursobank", columns: ["dateop", "dateval", "supplierfound"] },
  // Type,Product,Started Date,Completed Date,Description,Amount,Fee,…,State
  {
    bank: "revolut",
    columns: ["started date", "completed date", "product", "state"],
  },
  // Date de comptabilisation;Libelle simplifie;Libelle operation;…
  {
    bank: "banque-populaire",
    columns: ["date de comptabilisation", "libelle simplifie"],
  },
  // Date de l'opération;Libellé;Détail de l'écriture;Montant de l'opération
  {
    bank: "societe-generale",
    columns: ["detail de l ecriture", "montant de l operation"],
  },
];

/** The bank a CSV's header row names unmistakably, or null. */
export function bankFromHeader(header: readonly string[]): BankId | null {
  const names = new Set(header.map(normalizeHeader));
  for (const signature of CSV_SIGNATURES) {
    if (signature.columns.every((column) => names.has(column))) {
      return signature.bank;
    }
  }
  return null;
}

/**
 * The bank a file names in its own words — « BoursoBank », « Crédit
 * Agricole » in the lines above a CSV's header, or in an OFX's `ORG` — when
 * exactly one bank is named.
 */
export function bankFromText(text: string): BankId | null {
  const plain = text
    .slice(0, 4000)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const named = BANK_IDS.filter((bank) => {
    const words = BANK_TEXT[bank];
    return words.some((word) => plain.includes(word));
  });
  return named.length === 1 ? named[0]! : null;
}

/** How each bank writes its own name, without accents, lower case. */
const BANK_TEXT: Record<BankId, string[]> = {
  boursobank: ["boursobank", "boursorama"],
  "credit-agricole": ["credit agricole"],
  "bnp-paribas": ["bnp paribas"],
  "societe-generale": ["societe generale"],
  lcl: ["le credit lyonnais", "lcl banque"],
  "caisse-epargne": ["caisse d'epargne", "caisse d epargne"],
  "banque-populaire": ["banque populaire"],
  "credit-mutuel": ["credit mutuel"],
  cic: ["cic filbanque"],
  "la-banque-postale": ["la banque postale"],
  fortuneo: ["fortuneo"],
  "hello-bank": ["hello bank"],
  monabanq: ["monabanq"],
  hsbc: ["hsbc"],
  revolut: ["revolut"],
  n26: ["n26 bank"],
  qonto: ["qonto"],
  shine: ["shine sas"],
  nickel: ["compte-nickel", "compte nickel"],
  sumeria: ["sumeria"],
};
