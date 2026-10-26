import { DEFAULT_CATEGORIES } from "./constants";
import type {
  CategoryType,
  InvestmentEventKind,
  WalletId,
} from "./types/database";

/**
 * The demo account's year (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 10):
 * a made-up person's money, built fresh for the day it is asked for, so
 * the demo always reads as this month. Pure — `@finance/data/demo` writes
 * it — and deterministic: the same `today` gives the same rows, so the
 * nightly reset changes nothing a visitor saw the day before but the
 * month that moved on.
 *
 * The figures are the landing's sample (`landing-sample.ts`): a salary of
 * 3 200 €, a rent of 850 €, a PEA fed 50 € every Friday, three wallets
 * worth 12 480 € for 11 000 € paid in — so the site and the demo tell one
 * story.
 */

export interface DemoCategory {
  /** How the other rows name it: `type:name`. */
  key: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  countsTowardSummary: boolean;
}

export interface DemoTemplate {
  key: string;
  categoryKey: string;
  description: string;
  amount: number;
  recurrence: "monthly" | "weekly";
  dayOfMonth: number | null;
  /** ISO weekday, 1 = Monday. */
  dayOfWeek: number | null;
  instrumentSymbol: string | null;
  instrumentName: string | null;
  fundedByTransfer: boolean;
  /** YYYY-MM-DD: the first month the sample has it. */
  startsOn: string;
}

export interface DemoTransaction {
  categoryKey: string;
  templateKey: string | null;
  occurredOn: string;
  /** Unsigned, as the ledger stores it: the category's type gives the way. */
  amount: number;
  note: string | null;
}

export interface DemoPosition {
  wallet: WalletId;
  name: string;
  initialBalance: number;
  currentValue: number;
  shareCount: number | null;
  instrumentSymbol: string | null;
  instrumentName: string | null;
  isin: string | null;
  ongoingCharge: number | null;
}

export interface DemoWalletPlan {
  wallet: WalletId;
  openedOn: string | null;
  contributionCeiling: number | null;
}

export interface DemoSavingsAccount {
  kind: "livret_a" | "ldds";
  balance: number;
  balanceOn: string;
  annualRate: number;
  categoryKey: string;
}

export interface DemoMonthClose {
  /** YYYY-MM-01. */
  month: string;
  closingBalance: number;
  observedOn: string;
}

export interface DemoFilingRule {
  words: string;
  categoryKey: string;
  direction: "in" | "out";
}

export interface DemoEvent {
  wallet: WalletId;
  kind: InvestmentEventKind;
  occurredOn: string;
  instrumentName: string;
  isin: string;
  quantity: number | null;
  amount: number;
}

export interface DemoSample {
  categories: DemoCategory[];
  templates: DemoTemplate[];
  transactions: DemoTransaction[];
  positions: DemoPosition[];
  walletPlans: DemoWalletPlan[];
  savingsAccounts: DemoSavingsAccount[];
  monthCloses: DemoMonthClose[];
  filingRules: DemoFilingRule[];
  events: DemoEvent[];
}

/** Months of history before this one. */
export const DEMO_MONTHS = 9;

/* ------------------------------------------------------------- dates */

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** `months` months before (negative) or after the month of `date`, as its first day. */
function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function isoWeekday(year: number, month: number, day: number): number {
  const sunday = new Date(year, month - 1, day).getDay();
  return sunday === 0 ? 7 : sunday;
}

function addDays(date: string, days: number): string {
  const { year, month, day } = parts(date);
  const moved = new Date(year, month - 1, day + days);
  return iso(moved.getFullYear(), moved.getMonth() + 1, moved.getDate());
}

/* ------------------------------------------------------- a little chance */

/** Mulberry32: small, deterministic, enough for groceries. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)]!;
}

function between(next: () => number, low: number, high: number): number {
  return Math.round((low + next() * (high - low)) * 100) / 100;
}

/* ----------------------------------------------------------- the people */

const key = (type: CategoryType, name: string) => `${type}:${name}`;

const CATEGORY_KEYS = {
  salary: key("income", "Salaire"),
  electricity: key("expense", "Électricité"),
  internet: key("expense", "Internet"),
  insurance: key("expense", "Assurance"),
  groceries: key("expense", "Courses"),
  sport: key("expense", "Sport"),
  transport: key("expense", "Transports"),
  subscriptions: key("expense", "Abonnements"),
  other: key("expense", "Autre"),
  rent: key("expense", "Loyer"),
  restaurants: key("expense", "Restaurants"),
  leisure: key("expense", "Loisirs"),
  clothes: key("expense", "Vêtements"),
  savings: key("savings", "Livret d'épargne"),
  transfer: key("investment", "Virement vers le courtier"),
  peaDca: key("investment", "DCA PEA"),
} as const;

/** The defaults in French, and the four a person adds in their first month. */
function demoCategories(): DemoCategory[] {
  const defaults: DemoCategory[] = DEFAULT_CATEGORIES.map((category) => ({
    key: key(category.type, category.names.fr),
    name: category.names.fr,
    type: category.type,
    icon: category.icon,
    countsTowardSummary:
      "countsTowardSummary" in category
        ? (category.countsTowardSummary ?? true)
        : true,
  }));
  const own: DemoCategory[] = [
    {
      key: CATEGORY_KEYS.rent,
      name: "Loyer",
      type: "expense",
      icon: "house",
      countsTowardSummary: true,
    },
    {
      key: CATEGORY_KEYS.restaurants,
      name: "Restaurants",
      type: "expense",
      icon: null,
      countsTowardSummary: true,
    },
    {
      key: CATEGORY_KEYS.leisure,
      name: "Loisirs",
      type: "expense",
      icon: null,
      countsTowardSummary: true,
    },
    {
      key: CATEGORY_KEYS.clothes,
      name: "Vêtements",
      type: "expense",
      icon: null,
      countsTowardSummary: true,
    },
  ];
  return [...defaults, ...own];
}

const GROCERS = ["Carrefour", "Monoprix", "Biocoop", "Lidl", "Franprix"];
const RESTAURANTS = [
  "Le Petit Bouillon",
  "Sushi Yama",
  "Pizza Capri",
  "Chez Lucie",
  "Bánh Mì Corner",
];
const LEISURE = [
  "UGC Ciné",
  "Fnac",
  "Decathlon",
  "Théâtre du Rond-Point",
  "Librairie Mollat",
];
const CLOTHES = ["Uniqlo", "Zara", "Celio"];

/**
 * Every row the demo holds, for the day it is built.
 */
export function buildDemoSample(today: string): DemoSample {
  const now = parts(today);
  const first = shiftMonth(now.year, now.month, -DEMO_MONTHS);
  const startsOn = iso(first.year, first.month, 1);

  const templates: DemoTemplate[] = [
    {
      key: "salary",
      categoryKey: CATEGORY_KEYS.salary,
      description: "Salaire",
      amount: 3200,
      recurrence: "monthly",
      dayOfMonth: 3,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "rent",
      categoryKey: CATEGORY_KEYS.rent,
      description: "Loyer",
      amount: 850,
      recurrence: "monthly",
      dayOfMonth: 5,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "transfer",
      categoryKey: CATEGORY_KEYS.transfer,
      description: "Virement PEA",
      amount: 200,
      recurrence: "monthly",
      dayOfMonth: 6,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "sport",
      categoryKey: CATEGORY_KEYS.sport,
      description: "Salle de sport",
      amount: 29,
      recurrence: "monthly",
      dayOfMonth: 8,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "internet",
      categoryKey: CATEGORY_KEYS.internet,
      description: "Internet",
      amount: 30,
      recurrence: "monthly",
      dayOfMonth: 10,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "savings",
      categoryKey: CATEGORY_KEYS.savings,
      description: "Livret A",
      amount: 150,
      recurrence: "monthly",
      dayOfMonth: 12,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "netflix",
      categoryKey: CATEGORY_KEYS.subscriptions,
      description: "Netflix",
      amount: 15,
      recurrence: "monthly",
      dayOfMonth: 15,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "electricity",
      categoryKey: CATEGORY_KEYS.electricity,
      description: "Électricité",
      amount: 64.8,
      recurrence: "monthly",
      dayOfMonth: 19,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "navigo",
      categoryKey: CATEGORY_KEYS.transport,
      description: "Navigo",
      amount: 88.8,
      recurrence: "monthly",
      dayOfMonth: 1,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "health",
      categoryKey: CATEGORY_KEYS.insurance,
      description: "Mutuelle",
      amount: 64,
      recurrence: "monthly",
      dayOfMonth: 25,
      dayOfWeek: null,
      instrumentSymbol: null,
      instrumentName: null,
      fundedByTransfer: false,
      startsOn,
    },
    {
      key: "pea-dca",
      categoryKey: CATEGORY_KEYS.peaDca,
      description: "DCA PEA",
      amount: 50,
      recurrence: "weekly",
      dayOfMonth: null,
      dayOfWeek: 5,
      instrumentSymbol: "CW8.PA",
      instrumentName: "Amundi MSCI World",
      fundedByTransfer: true,
      startsOn,
    },
  ];

  const transactions: DemoTransaction[] = [];
  const monthCloses: DemoMonthClose[] = [];
  /** The current account, as the closes will state it. */
  let balance = 1180;

  for (let back = DEMO_MONTHS; back >= 0; back -= 1) {
    const { year, month } = shiftMonth(now.year, now.month, -back);
    const last = daysIn(year, month);
    const next = random(year * 100 + month);
    const rows: DemoTransaction[] = [];

    for (const template of templates) {
      if (template.recurrence === "monthly") {
        const day = Math.min(template.dayOfMonth!, last);
        rows.push({
          categoryKey: template.categoryKey,
          templateKey: template.key,
          occurredOn: iso(year, month, day),
          amount: template.amount,
          note: template.description,
        });
      } else {
        for (let day = 1; day <= last; day += 1) {
          if (isoWeekday(year, month, day) === template.dayOfWeek) {
            rows.push({
              categoryKey: template.categoryKey,
              templateKey: template.key,
              occurredOn: iso(year, month, day),
              amount: template.amount,
              note: template.description,
            });
          }
        }
      }
    }

    // What no template says: the shops, the evenings out, the rest.
    const groceryDays = [2, 9, 16, 23, 29].map((day) =>
      Math.min(day + Math.floor(next() * 3), last),
    );
    for (const day of groceryDays) {
      rows.push({
        categoryKey: CATEGORY_KEYS.groceries,
        templateKey: null,
        occurredOn: iso(year, month, day),
        amount: between(next, 38, 86),
        note: pick(next, GROCERS),
      });
    }
    const outings = 2 + Math.floor(next() * 2);
    for (let index = 0; index < outings; index += 1) {
      rows.push({
        categoryKey: CATEGORY_KEYS.restaurants,
        templateKey: null,
        occurredOn: iso(
          year,
          month,
          Math.min(5 + index * 9 + Math.floor(next() * 5), last),
        ),
        amount: between(next, 14, 48),
        note: pick(next, RESTAURANTS),
      });
    }
    rows.push({
      categoryKey: CATEGORY_KEYS.leisure,
      templateKey: null,
      occurredOn: iso(
        year,
        month,
        Math.min(11 + Math.floor(next() * 12), last),
      ),
      amount: between(next, 12, 58),
      note: pick(next, LEISURE),
    });
    if (month % 2 === 0) {
      rows.push({
        categoryKey: CATEGORY_KEYS.clothes,
        templateKey: null,
        occurredOn: iso(
          year,
          month,
          Math.min(14 + Math.floor(next() * 10), last),
        ),
        amount: between(next, 35, 95),
        note: pick(next, CLOTHES),
      });
    }
    if (next() < 0.5) {
      rows.push({
        categoryKey: CATEGORY_KEYS.other,
        templateKey: null,
        occurredOn: iso(
          year,
          month,
          Math.min(3 + Math.floor(next() * 24), last),
        ),
        amount: between(next, 9, 40),
        note: pick(next, ["Pharmacie", "Pressing", "Cadeau", "La Poste"]),
      });
    }

    rows.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    const kept =
      back === 0 ? rows.filter((row) => row.occurredOn <= today) : rows;
    transactions.push(...kept);

    // The month's close: what the bank said on the 1st of the next month,
    // a little under what the rows add up to — what nobody writes down.
    if (back > 0) {
      for (const row of rows) {
        if (row.categoryKey === CATEGORY_KEYS.salary) {
          balance += row.amount;
        } else if (row.categoryKey !== CATEGORY_KEYS.peaDca) {
          // The DCA is paid out of the transfer, which is already counted.
          balance -= row.amount;
        }
      }
      balance = Math.round((balance - between(next, 18, 64)) * 100) / 100;
      const after = shiftMonth(year, month, 1);
      monthCloses.push({
        month: iso(year, month, 1),
        closingBalance: balance,
        observedOn: iso(after.year, after.month, 1),
      });
    }
  }

  const positions: DemoPosition[] = [
    {
      wallet: "pea",
      name: "Amundi MSCI World",
      initialBalance: 3600,
      currentValue: 4120,
      shareCount: 7.6,
      instrumentSymbol: "CW8.PA",
      instrumentName: "Amundi MSCI World",
      isin: "LU1681043599",
      ongoingCharge: 0.0038,
    },
    {
      wallet: "pea",
      name: "Amundi S&P 500",
      initialBalance: 1700,
      currentValue: 1910,
      shareCount: 36,
      instrumentSymbol: "PSP5.PA",
      instrumentName: "Amundi S&P 500",
      isin: "LU1681048804",
      ongoingCharge: 0.0015,
    },
    {
      wallet: "pea",
      name: "Amundi Emerging Markets",
      initialBalance: 700,
      currentValue: 770,
      shareCount: 28,
      instrumentSymbol: "PAEEM.PA",
      instrumentName: "Amundi MSCI Emerging Markets",
      isin: "LU1681045370",
      ongoingCharge: 0.002,
    },
    {
      wallet: "cto",
      name: "Vanguard FTSE All-World",
      initialBalance: 3800,
      currentValue: 4200,
      shareCount: 32,
      instrumentSymbol: "VWCE.DE",
      instrumentName: "Vanguard FTSE All-World",
      isin: "IE00BK5BQT80",
      ongoingCharge: 0.0022,
    },
    {
      wallet: "crypto",
      name: "Bitcoin",
      initialBalance: 1200,
      currentValue: 1480,
      shareCount: 0.0185,
      instrumentSymbol: "BTC-EUR",
      instrumentName: "Bitcoin",
      isin: null,
      ongoingCharge: null,
    },
  ];

  const walletPlans: DemoWalletPlan[] = [
    { wallet: "pea", openedOn: "2022-06-14", contributionCeiling: 150_000 },
    { wallet: "cto", openedOn: null, contributionCeiling: null },
    { wallet: "crypto", openedOn: null, contributionCeiling: null },
  ];

  const savingsAccounts: DemoSavingsAccount[] = [
    {
      kind: "livret_a",
      balance: 4650,
      balanceOn: today,
      annualRate: 0.017,
      categoryKey: CATEGORY_KEYS.savings,
    },
  ];

  const filingRules: DemoFilingRule[] = [
    {
      words: "CARREFOUR",
      categoryKey: CATEGORY_KEYS.groceries,
      direction: "out",
    },
    { words: "NAVIGO", categoryKey: CATEGORY_KEYS.transport, direction: "out" },
  ];

  // Inside the wallets: the lines bought over the year, one sold, what the
  // CTO's one dividend payer gave.
  const yearAgo = addDays(today, -365);
  const events: DemoEvent[] = [
    {
      wallet: "pea",
      kind: "buy",
      occurredOn: addDays(yearAgo, 10),
      instrumentName: "Amundi MSCI World",
      isin: "LU1681043599",
      quantity: 4,
      amount: 1840,
    },
    {
      wallet: "pea",
      kind: "buy",
      occurredOn: addDays(yearAgo, 130),
      instrumentName: "Amundi MSCI World",
      isin: "LU1681043599",
      quantity: 2,
      amount: 980,
    },
    {
      wallet: "pea",
      kind: "buy",
      occurredOn: addDays(yearAgo, 250),
      instrumentName: "Amundi MSCI World",
      isin: "LU1681043599",
      quantity: 2,
      amount: 1030,
    },
    {
      wallet: "pea",
      kind: "sell",
      occurredOn: addDays(yearAgo, 300),
      instrumentName: "Amundi MSCI World",
      isin: "LU1681043599",
      quantity: 1,
      amount: 538,
    },
    {
      wallet: "cto",
      kind: "buy",
      occurredOn: addDays(yearAgo, 40),
      instrumentName: "TotalEnergies",
      isin: "FR0000120271",
      quantity: 10,
      amount: 592,
    },
    {
      wallet: "cto",
      kind: "dividend",
      occurredOn: addDays(yearAgo, 110),
      instrumentName: "TotalEnergies",
      isin: "FR0000120271",
      quantity: null,
      amount: 7.9,
    },
    {
      wallet: "cto",
      kind: "dividend",
      occurredOn: addDays(yearAgo, 200),
      instrumentName: "TotalEnergies",
      isin: "FR0000120271",
      quantity: null,
      amount: 8.1,
    },
    {
      wallet: "cto",
      kind: "dividend",
      occurredOn: addDays(yearAgo, 290),
      instrumentName: "TotalEnergies",
      isin: "FR0000120271",
      quantity: null,
      amount: 8.1,
    },
    {
      wallet: "cto",
      kind: "fee",
      occurredOn: addDays(yearAgo, 40),
      instrumentName: "Frais de courtage",
      isin: "FR0000120271",
      quantity: null,
      amount: 2.5,
    },
  ].filter((event) => event.occurredOn <= today) as DemoEvent[];

  return {
    categories: demoCategories(),
    templates,
    transactions,
    positions,
    walletPlans,
    savingsAccounts,
    monthCloses,
    filingRules,
    events,
  };
}
