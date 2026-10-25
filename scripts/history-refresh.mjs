#!/usr/bin/env node
/**
 * Rebuilds the market history the Plan replays a reader's accounts on, and
 * writes it to packages/core/src/history/data.generated.ts.
 *
 *   node scripts/history-refresh.mjs                # build, check, write
 *   node scripts/history-refresh.mjs --check        # build and check only
 *   node scripts/history-refresh.mjs --end 2026-12  # another last month
 *
 * Run once a year, in January, once INSEE has published December's prices;
 * the series end at the last full year. Needs the network and `unzip`. The
 * sources and their terms are in packages/core/src/history/sources.ts; the
 * method is below, next to each step, and every series is a run of monthly
 * returns in euros (francs at 6,55957 before 1999).
 *
 * Shares, which are the hard part:
 *
 * - The United States are the whole American market with dividends, from
 *   Fama and French, from 1970.
 * - Developed markets and Europe are Fama and French's own total returns
 *   from July 1990. Before that they are rebuilt: each country's OECD share
 *   price index in dollars, weighted by its stock market's size at the end
 *   of 1989 (World Bank) and carried back month by month with its prices,
 *   so that a country's weight moves as its market did — Japan passes the
 *   United States in 1989, as it did. The United States in that mix are
 *   Fama and French's; every other country gets a dividend yield on top of
 *   its prices, the constant that makes the same rebuild return what Fama
 *   and French do over the years both exist.
 * - Emerging markets start in July 1989, with Fama and French.
 *
 * MSCI is not used anywhere: its index data and factsheets may not be used
 * commercially without its written permission.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "packages/core/src/history/data.generated.ts");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const endIndex = args.indexOf("--end");

const START = "1970-01";
const END =
  endIndex >= 0 ? args[endIndex + 1] : `${new Date().getFullYear() - 1}-12`;
if (!/^\d{4}-\d{2}$/.test(END ?? "")) {
  fail(`--end takes a month, YYYY-MM (got ${END}).`);
}

/** The month Fama and French's developed and European returns begin. */
const FF_REGIONS_START = "1990-07";
/** The year-end whose market sizes weight the rebuild before it. */
const ANCHOR = "1989-12";

// ------------------------------------------------------------- the months

function monthsBetween(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function addMonths(month, count) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function monthRange(from, to) {
  return Array.from({ length: monthsBetween(from, to) + 1 }, (_, index) =>
    addMonths(from, index),
  );
}

const MONTHS = monthRange(START, END);

function fail(message) {
  console.error(`history-refresh: ${message}`);
  process.exit(1);
}

// ----------------------------------------------------------- the fetching

async function fetchText(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "pluclair-history-refresh",
          // Node's default `*` makes the OECD answer 500 to any query it
          // has not cached yet.
          "Accept-Language": "en",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === 3) {
        fail(`could not read ${url}: ${error.message}`);
      }
      console.log(`  ${new URL(url).host}: ${error.message}, trying again…`);
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    }
  }
}

async function fetchZipText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`could not read ${url}: HTTP ${response.status}`);
  }
  const folder = mkdtempSync(join(tmpdir(), "pluclair-history-"));
  try {
    const file = join(folder, "data.zip");
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    return execFileSync("unzip", ["-p", file], {
      encoding: "latin1",
      maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

// ------------------------------------------------- INSEE consumer prices

/**
 * Chained by monthly change, each series used up to its `until`. When INSEE
 * stops a base and starts another, the new series is added here.
 */
const CPI_SEGMENTS = [
  // « Indice des prix des 295 postes », base 1980, stopped in 1992.
  { idbank: "000008964", until: "1990-01" },
  // Base 2015, all households, France; stopped with December 2025.
  { idbank: "001759970", until: "2025-12" },
];

async function inseeSeries(idbank) {
  const xml = await fetchText(
    `https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/${idbank}`,
  );
  const values = new Map();
  for (const [, attributes] of xml.matchAll(/<Obs\b([^>]*)\/?>/g)) {
    const period = /TIME_PERIOD="([^"]+)"/.exec(attributes)?.[1];
    const value = Number(/OBS_VALUE="([^"]+)"/.exec(attributes)?.[1]);
    if (period && Number.isFinite(value)) {
      values.set(period, value);
    }
  }
  return values;
}

async function buildCpi() {
  const last = CPI_SEGMENTS.at(-1).until;
  if (monthsBetween(last, END) > 0) {
    fail(
      `INSEE's series in CPI_SEGMENTS stop at ${last}; add the current base's series to reach ${END}.`,
    );
  }
  const segments = await Promise.all(
    CPI_SEGMENTS.map(async (segment) => ({
      ...segment,
      values: await inseeSeries(segment.idbank),
    })),
  );
  return MONTHS.map((month) => {
    const segment = segments.find((each) => month <= each.until);
    const now = segment.values.get(month);
    const before = segment.values.get(addMonths(month, -1));
    if (now === undefined || before === undefined) {
      fail(`INSEE ${segment.idbank} has no index for ${month}.`);
    }
    return now / before - 1;
  });
}

// --------------------------------------------- Fed H.10 exchange rates

/**
 * The developed markets the rebuild weighs, with their currency against the
 * dollar from H.10. `usdPer`: H.10 quotes dollars per unit (pound, Australian
 * and New Zealand dollars). `euro`: the rate the currency joined the euro
 * at, used from January 1999. `par`: the Bretton Woods parity in 1970, before
 * H.10 begins, for the currencies the OECD gives no 1970 rate for.
 */
const COUNTRIES = {
  USA: { europe: false },
  JPN: { fx: "EXJPUS", europe: false },
  GBR: { fx: "EXUSUK", usdPer: true, europe: true },
  CAN: { fx: "EXCAUS", europe: false },
  FRA: { fx: "EXFRUS", euro: 6.55957, par: 5.55419, europe: true },
  DEU: { fx: "EXGEUS", euro: 1.95583, par: 3.66, europe: true },
  CHE: { fx: "EXSZUS", europe: true },
  AUS: { fx: "EXUSAL", usdPer: true, europe: false },
  NLD: { fx: "EXNEUS", euro: 2.20371, par: 3.62, europe: true },
  SWE: { fx: "EXSDUS", europe: true },
  ITA: { fx: "EXITUS", euro: 1936.27, par: 625, europe: true },
  ESP: { fx: "EXSPUS", euro: 166.386, europe: true },
  BEL: { fx: "EXBEUS", euro: 40.3399, par: 50, europe: true },
  DNK: { fx: "EXDNUS", europe: true },
  NOR: { fx: "EXNOUS", europe: true },
  NZL: { fx: "EXUSNZ", usdPer: true, europe: false },
};

async function fredSeries(id) {
  const csv = await fetchText(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
  );
  const values = new Map();
  for (const line of csv.split("\n").slice(1)) {
    const [date, raw] = line.trim().split(",");
    const value = Number(raw);
    if (date && raw && raw !== "." && Number.isFinite(value)) {
      values.set(date.slice(0, 7), value);
    }
  }
  return values;
}

// ------------------------------------------------------------- the OECD

const OECD =
  "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0";

/** Several measures for some countries, as measure → country → month → value. */
async function oecdMeasures(countries, measures, from, to) {
  const csv = await fetchText(
    `${OECD}/${countries.join("+")}.M.${measures.join("+")}......?startPeriod=${from}&endPeriod=${to}&format=csv`,
  );
  const [header, ...lines] = csv.trim().split("\n");
  const columns = header.split(",");
  const at = (name) => columns.indexOf(name);
  const byMeasure = new Map(measures.map((measure) => [measure, new Map()]));
  for (const line of lines) {
    const cells = line.split(",");
    const value = Number(cells[at("OBS_VALUE")]);
    if (!cells[at("OBS_VALUE")] || !Number.isFinite(value)) {
      continue;
    }
    const measure = cells[at("MEASURE")];
    const country = cells[at("REF_AREA")];
    const month = cells[at("TIME_PERIOD")];
    const byCountry = byMeasure.get(measure);
    const values = byCountry.get(country) ?? new Map();
    if (values.has(month)) {
      fail(`the OECD gave two ${measure} values for ${country} in ${month}.`);
    }
    values.set(month, value);
    byCountry.set(country, values);
  }
  return byMeasure;
}

// ----------------------------------------------- Fama and French returns

const FF =
  "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp";

/** A file's monthly market return, Mkt-RF plus RF, as month → fraction. */
async function famaFrenchMarket(name) {
  const text = await fetchZipText(`${FF}/${name}_CSV.zip`);
  const values = new Map();
  let columns = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(",")) {
      // Each table opens with its header; the first is the monthly one.
      columns ??= line.split(",").map((cell) => cell.trim());
      continue;
    }
    const match = /^(\d{4})(\d{2})\s*,(.*)$/.exec(line);
    if (!match || !columns) {
      continue;
    }
    const cells = [match[1] + match[2], ...match[3].split(",")].map((cell) =>
      Number(cell.trim()),
    );
    const excess = cells[columns.indexOf("Mkt-RF")];
    const riskFree = cells[columns.indexOf("RF")];
    if (excess > -99 && riskFree > -99) {
      values.set(`${match[1]}-${match[2]}`, (excess + riskFree) / 100);
    }
  }
  if (values.size === 0) {
    fail(`no monthly returns read from Fama and French's ${name}.`);
  }
  return values;
}

// ------------------------------------------- the World Bank's market sizes

/** Stock market capitalisation, US dollars, as country → year → value. */
async function marketSizes(countries, from, to) {
  const json = JSON.parse(
    await fetchText(
      `https://api.worldbank.org/v2/country/${countries.join(";")}/indicator/CM.MKT.LCAP.CD?format=json&per_page=5000&date=${from}:${to}`,
    ),
  );
  const sizes = new Map();
  for (const row of json[1] ?? []) {
    if (row.value) {
      const years = sizes.get(row.countryiso3code) ?? new Map();
      years.set(Number(row.date), row.value);
      sizes.set(row.countryiso3code, years);
    }
  }
  return sizes;
}

// ----------------------------------------------------------------- build

const countryIds = Object.keys(COUNTRIES);
const fxIds = [
  ...new Set(
    Object.values(COUNTRIES)
      .map((country) => country.fx)
      .filter(Boolean),
  ),
];

/**
 * Share prices, the French long rate, and exchange rates for 1970, before
 * H.10 begins.
 */
async function oecdAll() {
  const byMeasure = await oecdMeasures(
    countryIds,
    ["SHARE", "IRLT", "CC"],
    addMonths(START, -1),
    END,
  );
  return ["SHARE", "IRLT", "CC"].map((measure) => byMeasure.get(measure));
}

console.log(`Reading the sources, ${START} to ${END}…`);
const [
  cpi,
  [sharePrices, longRates, oecdRates],
  fxEntries,
  usdPerEur,
  sizes,
  ffUs,
  ffDeveloped,
  ffDevelopedExUs,
  ffEurope,
  ffEmerging,
] = await Promise.all([
  buildCpi(),
  oecdAll(),
  Promise.all(fxIds.map(async (id) => [id, await fredSeries(id)])),
  fredSeries("EXUSEU"),
  marketSizes(countryIds, 1989, Number(END.slice(0, 4))),
  famaFrenchMarket("F-F_Research_Data_Factors"),
  famaFrenchMarket("Developed_3_Factors"),
  famaFrenchMarket("Developed_ex_US_3_Factors"),
  famaFrenchMarket("Europe_3_Factors"),
  famaFrenchMarket("Emerging_5_Factors"),
]);
const fx = new Map(fxEntries);

/** Euros (francs before 1999) for one dollar, the month's average. */
function eurPerUsd(month) {
  if (month >= "1999-01") {
    const usd = usdPerEur.get(month);
    return usd ? 1 / usd : null;
  }
  const francs =
    month < "1971-01" ? COUNTRIES.FRA.par : fx.get("EXFRUS").get(month);
  return francs ? francs / COUNTRIES.FRA.euro : null;
}

/** A country's currency for one dollar, the month's average. */
function localPerUsd(id, month) {
  const country = COUNTRIES[id];
  if (id === "USA") {
    return 1;
  }
  if (country.euro && month >= "1999-01") {
    const perUsd = eurPerUsd(month);
    return perUsd ? country.euro * perUsd : null;
  }
  const quoted = fx.get(country.fx).get(month);
  if (quoted !== undefined) {
    return country.usdPer ? 1 / quoted : quoted;
  }
  if (month < "1971-01") {
    return country.par ?? oecdRates.get(id)?.get(month) ?? null;
  }
  return null;
}

/** A country's share price index in dollars, or null where unknown. */
function priceInUsd(id, month) {
  const price = sharePrices.get(id)?.get(month);
  const perUsd = localPerUsd(id, month);
  return price === undefined || !perUsd ? null : price / perUsd;
}

/** A dollar return carried into euros (francs before 1999). */
function inEuros(usdReturn, month) {
  const now = eurPerUsd(month);
  const before = eurPerUsd(addMonths(month, -1));
  if (!now || !before) {
    fail(`no dollar rate for ${month}.`);
  }
  return (1 + usdReturn) * (now / before) - 1;
}

function required(series, month, name) {
  const value = series.get(month);
  if (value === undefined) {
    fail(`${name} has no return for ${month}.`);
  }
  return value;
}

/** A market's size at a year-end, carried by its prices from the last one known. */
function sizeAt(id, year) {
  const years = sizes.get(id);
  if (!years) {
    return null;
  }
  for (let known = year; known >= 1989; known -= 1) {
    const size = years.get(known);
    if (size) {
      const then = priceInUsd(id, `${known}-12`);
      const now = priceInUsd(id, `${year}-12`);
      return then && now ? (size * now) / then : null;
    }
  }
  return null;
}

/**
 * The price return of a set of countries weighted by market size: by the
 * size at `anchor` carried by prices, or, without one, by each previous
 * year-end's size carried through the year. Countries come in when their
 * index does.
 */
function weightedPriceReturn(ids, month, anchor) {
  const before = addMonths(month, -1);
  let total = 0;
  let weighted = 0;
  for (const id of ids) {
    const priceBefore = priceInUsd(id, before);
    const priceNow = priceInUsd(id, month);
    const base = anchor ?? `${Number(before.slice(0, 4)) - 1}-12`;
    const priceAtBase = priceInUsd(id, base);
    const size = sizeAt(id, Number(base.slice(0, 4)));
    if (!priceBefore || !priceNow || !priceAtBase || !size) {
      continue;
    }
    const weight = (size * priceBefore) / priceAtBase;
    total += weight;
    weighted += weight * (priceNow / priceBefore - 1);
  }
  return total > 0 ? { ret: weighted / total, weight: total } : null;
}

/** The yearly yield that brings a price-only rebuild level with a total return. */
function matchedDividend(ids, target, from) {
  let rebuilt = 1;
  let source = 1;
  const months = monthRange(from, END);
  for (const month of months) {
    rebuilt *= 1 + weightedPriceReturn(ids, month, null).ret;
    source *= 1 + required(target, month, "Fama and French");
  }
  return (source / rebuilt) ** (12 / months.length) - 1;
}

const exUs = countryIds.filter((id) => id !== "USA");
const europe = countryIds.filter((id) => COUNTRIES[id].europe);
const dividends = {
  exUs: matchedDividend(exUs, ffDevelopedExUs, FF_REGIONS_START),
  europe: matchedDividend(europe, ffEurope, FF_REGIONS_START),
};

/**
 * Before Fama and French's regions: the United States' total return and
 * every other country's prices plus the matched yield, weighted by market
 * size at the end of 1989 carried back by prices.
 */
function rebuiltReturn(ids, month, dividend) {
  const monthly = (1 + dividend) ** (1 / 12) - 1;
  const before = addMonths(month, -1);
  let total = 0;
  let weighted = 0;
  for (const id of ids) {
    const priceBefore = priceInUsd(id, before);
    const priceNow = priceInUsd(id, month);
    const priceAtAnchor = priceInUsd(id, ANCHOR);
    const size = sizes.get(id)?.get(1989);
    if (!priceBefore || !priceNow || !priceAtAnchor || !size) {
      continue;
    }
    const weight = (size * priceBefore) / priceAtAnchor;
    const ret =
      id === "USA"
        ? required(ffUs, month, "Fama and French US")
        : (priceNow / priceBefore) * (1 + monthly) - 1;
    total += weight;
    weighted += weight * ret;
  }
  return weighted / total;
}

/** The United States' share of the rebuild, for the summary. */
function usShare(month) {
  const all = weightedPriceReturn(countryIds, month, ANCHOR).weight;
  const us = weightedPriceReturn(["USA"], month, ANCHOR).weight;
  return us / all;
}

function regionSeries(ids, source, dividend) {
  return MONTHS.map((month) =>
    inEuros(
      month >= FF_REGIONS_START
        ? required(source, month, "Fama and French")
        : rebuiltReturn(ids, month, dividend),
      month,
    ),
  );
}

/**
 * A ten-year French government bond bought each month at par and sold a
 * month later, one month shorter, at the new yield: the coupon earned plus
 * what the price did.
 */
function bondSeries() {
  const yields = longRates.get("FRA");
  return MONTHS.map((month) => {
    const coupon = yields.get(addMonths(month, -1)) / 100;
    const rate = yields.get(month) / 100;
    if (!Number.isFinite(coupon) || !Number.isFinite(rate)) {
      fail(`the OECD has no French long rate around ${month}.`);
    }
    const years = 10 - 1 / 12;
    const discount = (1 + rate) ** -years;
    const price =
      rate === 0
        ? coupon * years + 1
        : (coupon * (1 - discount)) / rate + discount;
    return price - 1 + coupon / 12;
  });
}

const emergingStart = [...ffEmerging.keys()].sort()[0];
const built = {
  "cpi-fr": { start: START, reconstructedUntil: null, returns: cpi },
  world: {
    start: START,
    reconstructedUntil: addMonths(FF_REGIONS_START, -1),
    returns: regionSeries(countryIds, ffDeveloped, dividends.exUs),
  },
  us: {
    start: START,
    reconstructedUntil: null,
    returns: MONTHS.map((month) =>
      inEuros(required(ffUs, month, "Fama and French US"), month),
    ),
  },
  europe: {
    start: START,
    reconstructedUntil: addMonths(FF_REGIONS_START, -1),
    returns: regionSeries(europe, ffEurope, dividends.europe),
  },
  emerging: {
    start: emergingStart,
    reconstructedUntil: null,
    returns: monthRange(emergingStart, END).map((month) =>
      inEuros(required(ffEmerging, month, "Fama and French emerging"), month),
    ),
  },
  "bonds-fr": { start: START, reconstructedUntil: null, returns: bondSeries() },
};

// ---------------------------------------------------------------- checks

/** Monthly returns outside these are a reading error, not a market. */
const BOUNDS = {
  "cpi-fr": [-0.03, 0.05],
  world: [-0.4, 0.4],
  us: [-0.4, 0.4],
  europe: [-0.4, 0.4],
  emerging: [-0.5, 0.5],
  "bonds-fr": [-0.2, 0.2],
};

for (const [id, series] of Object.entries(built)) {
  const expected = monthsBetween(series.start, END) + 1;
  if (series.returns.length !== expected) {
    fail(`${id} has ${series.returns.length} months, not ${expected}.`);
  }
  series.returns.forEach((value, index) => {
    const [low, high] = BOUNDS[id];
    if (!Number.isFinite(value) || value < low || value > high) {
      fail(`${id} returns ${value} in ${addMonths(series.start, index)}.`);
    }
  });
}

// --------------------------------------------------------------- summary

function compound(returns) {
  return returns.reduce((level, value) => level * (1 + value), 1);
}

function worstFall(series) {
  let peak = 1;
  let peakAt = series.start;
  let level = 1;
  let worst = { fall: 0, from: series.start, to: series.start };
  series.returns.forEach((value, index) => {
    level *= 1 + value;
    const month = addMonths(series.start, index);
    if (level > peak) {
      peak = level;
      peakAt = month;
    }
    if (level / peak - 1 < worst.fall) {
      worst = { fall: level / peak - 1, from: peakAt, to: month };
    }
  });
  return worst;
}

function calendarYear(series, year) {
  const from = monthsBetween(series.start, `${year}-01`);
  return compound(series.returns.slice(from, from + 12)) - 1;
}

const percent = (value) => `${(value * 100).toFixed(1)} %`;
const prices = compound(cpi);
console.log(`\nInflation ${START}–${END}: prices ×${prices.toFixed(2)}.`);
console.log(
  `Dividends added before ${FF_REGIONS_START}: outside the US ${percent(dividends.exUs)}, Europe ${percent(dividends.europe)}.`,
);
console.log(
  `US share of the rebuild: ${percent(usShare(START))} in ${START}, ${percent(usShare(ANCHOR))} in ${ANCHOR}.`,
);
for (const [id, series] of Object.entries(built)) {
  if (id === "cpi-fr") {
    continue;
  }
  const years = series.returns.length / 12;
  const nominal = compound(series.returns) ** (1 / years) - 1;
  const deflator = compound(cpi.slice(monthsBetween(START, series.start)));
  const real =
    (compound(series.returns) / deflator) ** (1 / years) - 1;
  const fall = worstFall(series);
  console.log(
    `${id.padEnd(9)} from ${series.start}: ${percent(nominal)}/yr, ${percent(real)}/yr real; worst fall ${percent(fall.fall)} (${fall.from} → ${fall.to}); 2008 ${percent(calendarYear(series, 2008))}, 2022 ${percent(calendarYear(series, 2022))}`,
  );
}

if (checkOnly) {
  console.log("\n--check: nothing written.");
  process.exit(0);
}

// ----------------------------------------------------------------- write

function rows(series) {
  const values = series.returns.map((value) => Math.round(value * 1e5));
  const lines = [];
  let month = series.start;
  let index = 0;
  while (index < values.length) {
    const left = 13 - Number(month.slice(5, 7));
    const row = values.slice(index, index + left);
    lines.push(`        /* ${month.slice(0, 4)} */ [${row.join(", ")}],`);
    index += left;
    month = addMonths(month, left);
  }
  return lines.join("\n");
}

const refreshed = new Date().toISOString().slice(0, 10);
const body = Object.entries(built)
  .map(
    ([id, series]) => `    "${id}": {
      start: "${series.start}",
      reconstructedUntil: ${series.reconstructedUntil ? `"${series.reconstructedUntil}"` : "null"},
      e5: [
${rows(series)}
      ],
    },`,
  )
  .join("\n");

writeFileSync(
  outPath,
  `/**
 * Written by scripts/history-refresh.mjs on ${refreshed}; run it again rather
 * than editing by hand. Where each series comes from: ./sources.ts.
 */
import type { GeneratedHistory } from "./series";

// prettier-ignore
export const GENERATED: GeneratedHistory = {
  end: "${END}",
  refreshed: "${refreshed}",
  dividends: {
    exUs: ${dividends.exUs.toFixed(5)},
    europe: ${dividends.europe.toFixed(5)},
  },
  series: {
${body}
  },
};
`,
);
console.log(`\nWrote ${outPath.slice(root.length + 1)}.`);
