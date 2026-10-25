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
 * - Each country's whole market, dividends reinvested, in dollars, comes
 *   from Global Factor Data (Jensen, Kelly and Pedersen; CC BY-NC 4.0): the
 *   United States from 1926, most others from 1986. Its returns are over
 *   the US Treasury bill, which is added back (Fed H.15, three months).
 * - Developed markets and Europe are those countries weighted by the size
 *   of their stock market at each year-end (World Bank), carried through the
 *   year by their returns. Global Factor Data's own regions are not used:
 *   they do not weigh countries by size, and return far less than any index
 *   a fund follows.
 * - Before 1986 they are rebuilt: the United States as above, every other
 *   country from its OECD share price index in dollars, all weighted by
 *   market size at the end of 1985 carried back by prices — Japan passes the
 *   United States in 1989, as it did. Prices leave out dividends, so every
 *   country but the United States gets the yearly yield that makes the
 *   same rebuild return what the countries' own figures do from 1986.
 * - Emerging markets have no series: weighted by the World Bank's figures,
 *   China counts all its domestic shares and the result strays far from
 *   any fund, and Taiwan is missing. Emerging funds follow developed ones.
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

/** The month the countries' own figures take over from the rebuild. */
const COUNTRIES_START = "1986-01";
/** The year-end whose market sizes weight the rebuild before it. */
const ANCHOR = "1985-12";

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
      encoding: "utf8",
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

// ------------------------------------------------------------ the markets

/**
 * The developed markets: Global Factor Data's name for each, whether it is
 * European, and, for those the rebuild before 1986 reads, how to put its
 * OECD price index into dollars. `fx`: its H.10 rate; `usdPer`: H.10 quotes
 * dollars per unit (pound, Australian and New Zealand dollars); `euro`: the
 * rate it joined the euro at, used from January 1999; `par`: its Bretton
 * Woods parity in 1970, before H.10 begins, where the OECD gives none.
 */
const MARKETS = {
  USA: { europe: false, rebuild: true },
  JPN: { europe: false, rebuild: true, fx: "EXJPUS" },
  GBR: { europe: true, rebuild: true, fx: "EXUSUK", usdPer: true },
  CAN: { europe: false, rebuild: true, fx: "EXCAUS" },
  FRA: {
    europe: true,
    rebuild: true,
    fx: "EXFRUS",
    euro: 6.55957,
    par: 5.55419,
  },
  DEU: { europe: true, rebuild: true, fx: "EXGEUS", euro: 1.95583, par: 3.66 },
  CHE: { europe: true, rebuild: true, fx: "EXSZUS" },
  AUS: { europe: false, rebuild: true, fx: "EXUSAL", usdPer: true },
  NLD: { europe: true, rebuild: true, fx: "EXNEUS", euro: 2.20371, par: 3.62 },
  SWE: { europe: true, rebuild: true, fx: "EXSDUS" },
  ITA: { europe: true, rebuild: true, fx: "EXITUS", euro: 1936.27, par: 625 },
  ESP: { europe: true, rebuild: true, fx: "EXSPUS", euro: 166.386 },
  BEL: { europe: true, rebuild: true, fx: "EXBEUS", euro: 40.3399, par: 50 },
  DNK: { europe: true, rebuild: true, fx: "EXDNUS" },
  NOR: { europe: true, rebuild: true, fx: "EXNOUS" },
  NZL: { europe: false, rebuild: true, fx: "EXUSNZ", usdPer: true },
  FIN: { europe: true, rebuild: false },
  AUT: { europe: true, rebuild: false },
  IRL: { europe: true, rebuild: false },
  PRT: { europe: true, rebuild: false },
  ISR: { europe: false, rebuild: false },
  // Not Hong Kong or Singapore: the World Bank counts every company listed
  // there in full, mainland Chinese ones included — Hong Kong as large as
  // Japan — where a developed-market fund holds a sliver of either.
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

const JKP = "https://jkpfactors-data.s3.amazonaws.com/public";

/**
 * Every country's value-weighted market return over the Treasury bill, in
 * dollars, as country (upper case, as everywhere else here) → month → fraction.
 */
async function globalFactorMarkets() {
  const csv = await fetchZipText(
    `${JKP}/%5Ball_countries%5D_%5Bmkt%5D_%5Bmonthly%5D_%5Bvw%5D.zip`,
  );
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = header.split(",");
  const at = (name) => columns.indexOf(name);
  const byCountry = new Map();
  for (const line of lines) {
    const cells = line.split(",");
    const value = Number(cells[at("ret")]);
    if (!Number.isFinite(value)) {
      continue;
    }
    const country = cells[at("location")].toUpperCase();
    const values = byCountry.get(country) ?? new Map();
    values.set(cells[at("date")].slice(0, 7), value);
    byCountry.set(country, values);
  }
  if (!byCountry.has("USA")) {
    fail("Global Factor Data's market file has no United States.");
  }
  return byCountry;
}

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

// ----------------------------------------------------------------- read

const marketIds = Object.keys(MARKETS);
const rebuildIds = marketIds.filter((id) => MARKETS[id].rebuild);
const fxIds = rebuildIds.map((id) => MARKETS[id].fx).filter(Boolean);

/** Share prices, the French long rate, and exchange rates for 1970. */
async function oecdAll() {
  const byMeasure = await oecdMeasures(
    rebuildIds,
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
  billRates,
  sizes,
  markets,
] = await Promise.all([
  buildCpi(),
  oecdAll(),
  Promise.all(fxIds.map(async (id) => [id, await fredSeries(id)])),
  fredSeries("EXUSEU"),
  fredSeries("TB3MS"),
  marketSizes(marketIds, 1984, Number(END.slice(0, 4))),
  globalFactorMarkets(),
]);
const fx = new Map(fxEntries);

// ------------------------------------------------------------ currencies

/** Euros (francs before 1999) for one dollar, the month's average. */
function eurPerUsd(month) {
  if (month >= "1999-01") {
    const usd = usdPerEur.get(month);
    return usd ? 1 / usd : null;
  }
  const francs =
    month < "1971-01" ? MARKETS.FRA.par : fx.get("EXFRUS").get(month);
  return francs ? francs / MARKETS.FRA.euro : null;
}

/** A country's currency for one dollar, the month's average. */
function localPerUsd(id, month) {
  const market = MARKETS[id];
  if (id === "USA") {
    return 1;
  }
  if (market.euro && month >= "1999-01") {
    const perUsd = eurPerUsd(month);
    return perUsd ? market.euro * perUsd : null;
  }
  const quoted = fx.get(market.fx).get(month);
  if (quoted !== undefined) {
    return market.usdPer ? 1 / quoted : quoted;
  }
  if (month < "1971-01") {
    return market.par ?? oecdRates.get(id)?.get(month) ?? null;
  }
  return null;
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

// ------------------------------------------------- what each country did

/** The three-month Treasury bill over one month, as Global Factor Data's base. */
function billReturn(month) {
  const rate = billRates.get(month);
  if (rate === undefined) {
    fail(`the Fed has no Treasury bill rate for ${month}.`);
  }
  return rate / 1200;
}

/** A country's whole market in dollars, dividends in, or null before its data. */
function countryReturn(id, month) {
  const excess = markets.get(id)?.get(month);
  return excess === undefined ? null : excess + billReturn(month);
}

/**
 * Each country's market as a level, 1 the month before its first return
 * (or before 1970, for the United States), so that a weight can be carried
 * by what the market did.
 */
const countryLevels = new Map(
  marketIds.map((id) => {
    const months = [...(markets.get(id)?.keys() ?? [])]
      .filter((month) => month >= START)
      .sort();
    const levels = new Map();
    if (months.length > 0) {
      let level = 1;
      levels.set(addMonths(months[0], -1), level);
      for (const month of monthRange(months[0], months.at(-1))) {
        const ret = countryReturn(id, month);
        if (ret === null) {
          break;
        }
        level *= 1 + ret;
        levels.set(month, level);
      }
    }
    return [id, levels];
  }),
);

/** A country's OECD share price index in dollars, or null where unknown. */
function priceInUsd(id, month) {
  const price = sharePrices.get(id)?.get(month);
  const perUsd = localPerUsd(id, month);
  return price === undefined || !perUsd ? null : price / perUsd;
}

/**
 * A market's size at a year-end: the World Bank's figure, or the last one
 * before it carried by the market's level.
 */
function sizeAt(id, year, levelAt) {
  const years = sizes.get(id);
  for (let known = year; years && known >= 1984; known -= 1) {
    const size = years.get(known);
    if (size) {
      const then = levelAt(id, `${known}-12`);
      const now = levelAt(id, `${year}-12`);
      return then && now ? (size * now) / then : null;
    }
  }
  return null;
}

/**
 * A size-weighted month: each country weighed by its size at the year-end
 * before (or at `anchor`), carried by its level since. Countries come in
 * once their figures and their size are both known.
 */
function weightedMonth(ids, month, { levelAt, returnOf, anchor = null }) {
  const before = addMonths(month, -1);
  const base = anchor ?? `${Number(month.slice(0, 4)) - 1}-12`;
  let total = 0;
  let weighted = 0;
  for (const id of ids) {
    const levelBefore = levelAt(id, before);
    const levelAtBase = levelAt(id, base);
    const ret = returnOf(id, month);
    const size = sizeAt(id, Number(base.slice(0, 4)), levelAt);
    if (!levelBefore || !levelAtBase || ret === null || !size) {
      continue;
    }
    const weight = (size * levelBefore) / levelAtBase;
    total += weight;
    weighted += weight * ret;
  }
  return total > 0 ? { ret: weighted / total, weight: total } : null;
}

/** The countries' own figures, weighted by size. */
const fromCountries = {
  levelAt: (id, month) => countryLevels.get(id)?.get(month) ?? null,
  returnOf: countryReturn,
};

/** OECD prices alone, weighted by size: what the yield is matched against. */
const fromPrices = {
  levelAt: priceInUsd,
  returnOf: (id, month) => {
    const before = priceInUsd(id, addMonths(month, -1));
    const now = priceInUsd(id, month);
    return before && now ? now / before - 1 : null;
  },
};

function compound(returns) {
  return returns.reduce((level, value) => level * (1 + value), 1);
}

/**
 * The yearly yield that brings the OECD's prices level with the countries'
 * own figures from 1986, for the same countries but the United States.
 */
function matchedDividend(ids) {
  const months = monthRange(COUNTRIES_START, END);
  const own = [];
  const prices = [];
  for (const month of months) {
    own.push(weightedMonth(ids, month, fromCountries).ret);
    prices.push(weightedMonth(ids, month, fromPrices).ret);
  }
  return (compound(own) / compound(prices)) ** (12 / months.length) - 1;
}

const developed = marketIds;
const europe = marketIds.filter((id) => MARKETS[id].europe);
const rebuildExUs = rebuildIds.filter((id) => id !== "USA");
const dividends = {
  exUs: matchedDividend(rebuildExUs),
  europe: matchedDividend(rebuildIds.filter((id) => MARKETS[id].europe)),
};

/**
 * Before 1986: the United States' own figures and every other country's
 * prices with the matched yield, weighted by size at the end of 1985
 * carried back by prices.
 */
function rebuiltMonth(ids, month, dividend) {
  const monthly = (1 + dividend) ** (1 / 12) - 1;
  const result = weightedMonth(ids, month, {
    levelAt: priceInUsd,
    returnOf: (id, at) => {
      if (id === "USA") {
        return countryReturn("USA", at);
      }
      const ret = fromPrices.returnOf(id, at);
      return ret === null ? null : (1 + ret) * (1 + monthly) - 1;
    },
    anchor: ANCHOR,
  });
  if (!result) {
    fail(`nothing to rebuild ${month} from.`);
  }
  return result.ret;
}

function regionSeries(ownIds, rebuildFrom, dividend) {
  return MONTHS.map((month) => {
    if (month < COUNTRIES_START) {
      return inEuros(rebuiltMonth(rebuildFrom, month, dividend), month);
    }
    const own = weightedMonth(ownIds, month, fromCountries);
    if (!own) {
      fail(`no country figures for ${month}.`);
    }
    return inEuros(own.ret, month);
  });
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

const rebuiltUntil = addMonths(COUNTRIES_START, -1);
const built = {
  "cpi-fr": { start: START, reconstructedUntil: null, returns: cpi },
  world: {
    start: START,
    reconstructedUntil: rebuiltUntil,
    returns: regionSeries(developed, rebuildIds, dividends.exUs),
  },
  us: {
    start: START,
    reconstructedUntil: null,
    returns: MONTHS.map((month) => {
      const ret = countryReturn("USA", month);
      if (ret === null) {
        fail(`Global Factor Data has no US return for ${month}.`);
      }
      return inEuros(ret, month);
    }),
  },
  europe: {
    start: START,
    reconstructedUntil: rebuiltUntil,
    returns: regionSeries(
      europe,
      rebuildIds.filter((id) => MARKETS[id].europe),
      dividends.europe,
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

/** The United States' share of the rebuild at a month. */
function usShare(month) {
  const weightOf = (ids) =>
    weightedMonth(ids, month, {
      levelAt: priceInUsd,
      returnOf: () => 0,
      anchor: ANCHOR,
    }).weight;
  return weightOf(["USA"]) / weightOf(rebuildIds);
}

const percent = (value) => `${(value * 100).toFixed(1)} %`;
console.log(`\nInflation ${START}–${END}: prices ×${compound(cpi).toFixed(2)}.`);
console.log(
  `Dividends added before ${COUNTRIES_START}: outside the US ${percent(dividends.exUs)}, Europe ${percent(dividends.europe)}.`,
);
console.log(
  `US share of the rebuild: ${percent(usShare(addMonths(START, 1)))} in ${START}, ${percent(usShare(ANCHOR))} in ${ANCHOR}.`,
);
for (const [id, series] of Object.entries(built)) {
  if (id === "cpi-fr") {
    continue;
  }
  const years = series.returns.length / 12;
  const nominal = compound(series.returns) ** (1 / years) - 1;
  const deflator = compound(cpi.slice(monthsBetween(START, series.start)));
  const real = (compound(series.returns) / deflator) ** (1 / years) - 1;
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
