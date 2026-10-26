/**
 * Where each history series comes from, and on what terms it may be reused.
 *
 * Settled with the owner in Phase 0 of docs/plans/PLAN_REDESIGN_PLAN.md
 * (2026-10-25). The obvious source for world shares, MSCI, was set aside:
 * its index data and factsheets may not be used commercially without its
 * written permission. What replaced it is a reconstruction, said as one,
 * and every source below is named on the page that uses it.
 */

import type { HistorySeriesId } from "./series";

export interface HistorySource {
  publisher: string;
  title: string;
  url: string;
  /** The terms the figures are reused on, as the publisher states them. */
  terms: string;
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
    publisher: "INSEE",
    title:
      "Indice des prix à la consommation, ensemble des ménages (séries 000008964 et 001759970)",
    url: "https://www.insee.fr/fr/statistiques/serie/001759970",
    terms: "Licence Ouverte / Open Licence 2.0 (Etalab)",
    standing: "open",
    series: ["cpi-fr"],
  },
  {
    publisher: "Jensen, Kelly et Pedersen",
    title:
      "Global Factor Data : rendement du marché de chaque pays, dividendes compris (« Is There a Replication Crisis in Finance? », Journal of Finance, 2023)",
    url: "https://jkpfactors.com/",
    terms: "CC BY-NC 4.0",
    standing: "non-commercial",
    series: ["us", "world", "europe"],
  },
  {
    publisher: "OCDE",
    title:
      "Statistiques des marchés financiers : cours des actions, taux d'intérêt à long terme",
    url: "https://data-explorer.oecd.org/",
    terms:
      "Conditions de l'OCDE : réutilisation, y compris commerciale, en citant la source",
    standing: "open",
    series: ["world", "europe", "bonds-fr"],
  },
  {
    publisher: "Banque mondiale",
    title:
      "Capitalisation boursière des sociétés cotées nationales (World Federation of Exchanges)",
    url: "https://data.worldbank.org/indicator/CM.MKT.LCAP.CD",
    terms: "CC BY 4.0",
    standing: "open",
    series: ["world", "europe"],
  },
  {
    publisher: "Federal Reserve Board",
    title:
      "H.10 Foreign Exchange Rates et H.15 Selected Interest Rates (bons du Trésor à trois mois), via FRED",
    url: "https://www.federalreserve.gov/releases/h10/",
    terms: "Domaine public (données du gouvernement fédéral américain)",
    standing: "open",
    series: ["world", "us", "europe"],
  },
  {
    publisher: "Banque de France",
    title:
      "Taux du Livret A et du LEP (Webstat, MIR1) et arrêtés au Journal officiel",
    url: "https://webstat.banque-france.fr/",
    terms: "Décisions publiques ; Webstat cité comme source",
    standing: "public",
    series: ["livret-a", "lep"],
  },
  {
    publisher: "ACPR et France Assureurs",
    title:
      "Taux moyen de revalorisation des fonds euros : ACPR depuis 2009, France Assureurs de 2000 à 2008",
    url: "https://acpr.banque-france.fr/",
    terms: "Chiffres publiés, cités avec leur source",
    standing: "public",
    series: ["fonds-euros"],
  },
  {
    publisher: "Yahoo Finance",
    title: "Cours mensuels BTC-EUR, ceux que l'app lit déjà pour Placements",
    url: "https://finance.yahoo.com/quote/BTC-EUR/",
    terms: "Conditions de Yahoo, déjà acceptées pour les cours de l'app",
    standing: "public",
    series: ["bitcoin"],
  },
];
