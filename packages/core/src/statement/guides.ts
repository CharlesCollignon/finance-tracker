import type { Locale } from "../i18n/locale";
import type { BankId } from "./banks";

/**
 * « Où trouver l'export de ma banque ? » — where a bank puts the file
 * Pluclair reads, in three short steps, and its website.
 *
 * A bank's own steps are given only where they are written down somewhere
 * Pluclair can point to — the bank's help pages, or guides published about
 * its export as of October 2026. Every other bank gets the steps that hold
 * for all of them, rather than a menu path guessed: a guide that names a
 * button the bank does not have is worse than one that says where to look.
 */

export interface ExportGuide {
  /** The bank's website, where the export is usually fullest. */
  site: string | null;
  steps: string[];
}

const SITES: Record<BankId, string> = {
  boursobank: "https://www.boursobank.com",
  "credit-agricole": "https://www.credit-agricole.fr",
  "bnp-paribas": "https://mabanque.bnpparibas",
  "societe-generale": "https://particuliers.sg.fr",
  lcl: "https://www.lcl.fr",
  "caisse-epargne": "https://www.caisse-epargne.fr",
  "banque-populaire": "https://www.banquepopulaire.fr",
  "credit-mutuel": "https://www.creditmutuel.fr",
  cic: "https://www.cic.fr",
  "la-banque-postale": "https://www.labanquepostale.fr",
  fortuneo: "https://www.fortuneo.fr",
  "hello-bank": "https://www.hellobank.fr",
  monabanq: "https://www.monabanq.com",
  hsbc: "https://www.hsbc.fr",
  revolut: "https://www.revolut.com",
  n26: "https://n26.com",
  qonto: "https://qonto.com",
  shine: "https://www.shine.fr",
  nickel: "https://nickel.eu",
  sumeria: "https://www.sumeria.eu",
};

const NBSP = " ";

/** The bank's own first step, where it is written down. */
const SPECIFIC: Partial<Record<BankId, Record<Locale, string[]>>> = {
  "banque-populaire": {
    fr: [
      `Depuis la synthèse de vos comptes, ou le détail d'un compte, choisissez d'exporter vos opérations${NBSP}: le format CSV ou OFX, la période, et le séparateur «${NBSP};${NBSP}» pour un CSV.`,
      `Si l'export n'apparaît pas, activez les fonctionnalités avancées dans les réglages de votre espace client.`,
    ],
    en: [
      "From your accounts' overview, or an account's detail, choose to export your transactions: CSV or OFX, the period, and the « ; » separator for a CSV.",
      "If the export does not show, turn on the advanced features in your online banking settings.",
    ],
  },
  boursobank: {
    fr: [
      `Sur le site, ouvrez votre compte et cherchez les opérations de la période voulue${NBSP}: «${NBSP}Exporter en format CSV${NBSP}» apparaît sous les résultats, avec OFX et QIF au même endroit.`,
    ],
    en: [
      "On the website, open your account and search the period you want: « Exporter en format CSV » shows under the results, with OFX and QIF in the same place.",
    ],
  },
  lcl: {
    fr: [
      `Dans «${NBSP}Mes opérations${NBSP}», le bouton «${NBSP}Exporter${NBSP}» propose CSV et OFX.`,
    ],
    en: ["In « Mes opérations », the « Exporter » button offers CSV and OFX."],
  },
  cic: {
    fr: [
      `Dans votre espace Filbanque, téléchargez vos opérations en CSV, OFX ou QIF.`,
    ],
    en: [
      "In your Filbanque space, download your transactions as CSV, OFX or QIF.",
    ],
  },
  fortuneo: {
    fr: [
      `L'export de vos opérations, sur le site, propose CSV, Excel, QIF et OFX.`,
    ],
    en: [
      "Your transactions' export, on the website, offers CSV, Excel, QIF and OFX.",
    ],
  },
  qonto: {
    fr: [
      `L'export de vos transactions propose CSV, Excel, OFX, QIF et MT940${NBSP}: tous se lisent ici.`,
    ],
    en: [
      "Your transactions' export offers CSV, Excel, OFX, QIF and MT940: all of them read here.",
    ],
  },
};

const GENERAL: Record<Locale, string[]> = {
  fr: [
    `Sur le site de votre banque — souvent plus complet que son application —, ouvrez le compte, puis la liste des opérations.`,
    `Cherchez «${NBSP}Exporter${NBSP}» ou «${NBSP}Télécharger${NBSP}», et choisissez CSV, OFX, QIF ou Excel, sur la période voulue.`,
  ],
  en: [
    "On your bank's website — often fuller than its app — open the account, then its list of transactions.",
    "Look for « Exporter » or « Télécharger », and choose CSV, OFX, QIF or Excel, over the period you want.",
  ],
};

const LAST: Record<Locale, string> = {
  fr: `Déposez ou partagez le fichier ici, tel qu'il est${NBSP}: Pluclair le lit, et ne garde que les opérations.`,
  en: "Drop or share the file here as it is: Pluclair reads it, and keeps only the transactions.",
};

/** Where a bank's export is, or the steps that hold for any bank. */
export function exportGuide(bank: BankId | null, locale: Locale): ExportGuide {
  const own = bank ? SPECIFIC[bank]?.[locale] : undefined;
  return {
    site: bank ? SITES[bank] : null,
    steps: [...(own ?? GENERAL[locale]), LAST[locale]],
  };
}
