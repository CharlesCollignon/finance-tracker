/**
 * Where each history series comes from, and on what terms it may be reused.
 *
 * Settled with the owner in Phase 0 of docs/plans/PLAN_REDESIGN_PLAN.md
 * (2026-10-25). The obvious source for world shares, MSCI, was set aside:
 * its index data and factsheets may not be used commercially without its
 * written permission. What replaced it is a reconstruction, said as one,
 * and every source below is named on the page that uses it.
 */

import type { Locale } from "../i18n/locale";
import type { HistorySeriesId } from "./series";

/** In each language, as the page that names the source is read. */
type Said = Record<Locale, string>;

export interface HistorySource {
  publisher: Said;
  title: Said;
  url: string;
  /** The terms the figures are reused on, as the publisher states them. */
  terms: Said;
  /**
   * `open`: reuse is allowed, commercial use included, with the source named.
   * `non-commercial`: reuse is allowed while Pluclair earns nothing — the day
   * it does, this source has to be replaced.
   * `public`: public decisions or published figures, named with their
   * source; or, for bitcoin, the quotes the app already shows.
   */
  standing: "open" | "non-commercial" | "public";
  series: readonly HistorySeriesId[];
}

export const HISTORY_SOURCES: readonly HistorySource[] = [
  {
    publisher: { fr: "INSEE", en: "INSEE" },
    title: {
      fr: "Indice des prix à la consommation, ensemble des ménages (séries 000008964 et 001759970)",
      en: "Consumer price index, all households (series 000008964 and 001759970)",
    },
    url: "https://www.insee.fr/fr/statistiques/serie/001759970",
    terms: {
      fr: "Licence Ouverte / Open Licence 2.0 (Etalab)",
      en: "Licence Ouverte / Open Licence 2.0 (Etalab)",
    },
    standing: "open",
    series: ["cpi-fr"],
  },
  {
    publisher: {
      fr: "Jensen, Kelly et Pedersen",
      en: "Jensen, Kelly and Pedersen",
    },
    title: {
      fr: "Global Factor Data : rendement du marché de chaque pays, dividendes compris (« Is There a Replication Crisis in Finance? », Journal of Finance, 2023)",
      en: "Global Factor Data: each country's market return, dividends included (“Is There a Replication Crisis in Finance?”, Journal of Finance, 2023)",
    },
    url: "https://jkpfactors.com/",
    terms: { fr: "CC BY-NC 4.0", en: "CC BY-NC 4.0" },
    standing: "non-commercial",
    series: ["us", "world", "europe"],
  },
  {
    publisher: { fr: "OCDE", en: "OECD" },
    title: {
      fr: "Statistiques des marchés financiers : cours des actions, taux d'intérêt à long terme",
      en: "Financial market statistics: share prices, long-term interest rates",
    },
    url: "https://data-explorer.oecd.org/",
    terms: {
      fr: "Conditions de l'OCDE : réutilisation, y compris commerciale, en citant la source",
      en: "OECD terms: reuse, commercial included, with the source named",
    },
    standing: "open",
    series: ["world", "europe", "bonds-fr"],
  },
  {
    publisher: { fr: "Banque mondiale", en: "World Bank" },
    title: {
      fr: "Capitalisation boursière des sociétés cotées nationales (World Federation of Exchanges)",
      en: "Market capitalization of listed domestic companies (World Federation of Exchanges)",
    },
    url: "https://data.worldbank.org/indicator/CM.MKT.LCAP.CD",
    terms: { fr: "CC BY 4.0", en: "CC BY 4.0" },
    standing: "open",
    series: ["world", "europe"],
  },
  {
    publisher: { fr: "Federal Reserve Board", en: "Federal Reserve Board" },
    title: {
      fr: "H.10 Foreign Exchange Rates et H.15 Selected Interest Rates (bons du Trésor à trois mois), via FRED",
      en: "H.10 Foreign Exchange Rates and H.15 Selected Interest Rates (three-month Treasury bills), via FRED",
    },
    url: "https://www.federalreserve.gov/releases/h10/",
    terms: {
      fr: "Domaine public (données du gouvernement fédéral américain)",
      en: "Public domain (US federal government data)",
    },
    standing: "open",
    series: ["world", "us", "europe"],
  },
  {
    publisher: { fr: "Banque de France", en: "Banque de France" },
    title: {
      fr: "Taux du Livret A et du LEP (Webstat, MIR1) et arrêtés au Journal officiel",
      en: "Livret A and LEP rates (Webstat, MIR1) and the orders in the Journal officiel",
    },
    url: "https://webstat.banque-france.fr/",
    terms: {
      fr: "Décisions publiques ; Webstat cité comme source",
      en: "Public decisions; Webstat named as the source",
    },
    standing: "public",
    series: ["livret-a", "lep"],
  },
  {
    publisher: {
      fr: "ACPR et France Assureurs",
      en: "ACPR and France Assureurs",
    },
    title: {
      fr: "Taux moyen de revalorisation des fonds euros : ACPR depuis 2009, France Assureurs de 2000 à 2008",
      en: "Average return credited on fonds euros: ACPR since 2009, France Assureurs from 2000 to 2008",
    },
    url: "https://acpr.banque-france.fr/",
    terms: {
      fr: "Chiffres publiés, cités avec leur source",
      en: "Published figures, named with their source",
    },
    standing: "public",
    series: ["fonds-euros"],
  },
  {
    publisher: { fr: "Yahoo Finance", en: "Yahoo Finance" },
    title: {
      fr: "Cours mensuels BTC-EUR, ceux que l'app lit déjà pour Placements",
      en: "Monthly BTC-EUR prices, the ones the app already reads for Investments",
    },
    url: "https://finance.yahoo.com/quote/BTC-EUR/",
    terms: {
      fr: "Conditions de Yahoo, déjà acceptées pour les cours de l'app",
      en: "Yahoo's terms, already accepted for the app's prices",
    },
    standing: "public",
    series: ["bitcoin"],
  },
];
