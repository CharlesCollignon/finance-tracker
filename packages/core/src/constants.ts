export const DEFAULT_CATEGORIES = [
  { name: "Salary", type: "income" as const, icon: "wallet" },
  { name: "Electricity", type: "expense" as const, icon: "lightning" },
  { name: "Internet", type: "expense" as const, icon: "wifi" },
  { name: "Condo fees", type: "expense" as const, icon: "buildings" },
  { name: "Loan repayment", type: "expense" as const, icon: "bank" },
  { name: "Bank card fees", type: "expense" as const, icon: "credit-card" },
  { name: "Insurance", type: "expense" as const, icon: "shield" },
  { name: "Groceries", type: "expense" as const, icon: "shopping-cart" },
  { name: "Sport", type: "expense" as const, icon: "barbell" },
  { name: "Transportation", type: "expense" as const, icon: "car" },
  {
    name: "Subscriptions",
    type: "expense" as const,
    icon: "television",
  },
  { name: "Taxe Foncière", type: "expense" as const, icon: "house" },
  { name: "Other", type: "expense" as const, icon: "dots-three" },
  { name: "Savings account", type: "savings" as const, icon: "piggy-bank" },
  {
    name: "Broker transfer",
    type: "investment" as const,
    icon: "bank",
    countsTowardSummary: true,
  },
  {
    name: "CTO weekly DCA",
    type: "investment" as const,
    icon: "chart-line",
    countsTowardSummary: false,
  },
  {
    name: "PEA monthly DCA",
    type: "investment" as const,
    icon: "trend-up",
    countsTowardSummary: false,
  },
  {
    name: "Bitstack weekly DCA",
    type: "investment" as const,
    icon: "currency-btc",
    countsTowardSummary: false,
  },
];

/**
 * Cash counted as invested for savings rate / Sankey:
 * max(broker transfers, wallet deployments) — one path, no double count.
 */
export function investedForSavingsRate(
  brokerTransfers: number,
  deployments: number,
): number {
  return Math.max(brokerTransfers, deployments);
}

/**
 * Personal savings rate:
 * (savings + max(broker transfers, deployments)) / income × 100.
 * Returns null when income is not positive.
 */
export function savingsRatePercent(
  savings: number,
  brokerTransfers: number,
  deployments: number,
  income: number,
): number | null {
  if (income <= 0) {
    return null;
  }
  const invested = investedForSavingsRate(brokerTransfers, deployments);
  return Math.round(((savings + invested) / income) * 1000) / 10;
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The two display currencies a user can pick between. Amounts are never
 * converted between them — this only changes how a number is labeled. */
export type CurrencyCode = "EUR" | "USD";

export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  EUR: "Euro (€)",
  USD: "US Dollar ($)",
};

/** Same formatting convention as `formatEuro`, generalized to the user's
 * chosen display currency. This is a display preference only — it does not
 * convert amounts, it just relabels them. */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The app is EUR/France-centric; anchor "today" to this timezone so
 * server (often UTC) and client agree on the calendar date. */
export const APP_TIME_ZONE = "Europe/Paris";

function nowInAppTimeZone(): { year: number; month: number; day: number } {
  // en-CA formats as YYYY-MM-DD.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/** Calendar date in the app timezone as YYYY-MM-DD. */
export function todayIsoLocal(): string {
  const { year, month, day } = nowInAppTimeZone();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Day and month names, written out rather than asked of Intl.
 *
 * `Intl.DateTimeFormat("en-GB", { month: "short" })` is not the same string
 * everywhere: Node 20 ships an ICU that says "Sep" and current Chrome says
 * "Sept", and the short weekday picks up a comma in one and not the other.
 * Every one of these labels is rendered inside a client component, so the two
 * disagreeing is a hydration mismatch — React throws away the server's tree
 * and redraws the page on the client. Fixed tables cost nothing and cannot
 * drift with a Node upgrade.
 */
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Exported for the month grid, which labels twelve buttons with them. */
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Sep 2026" — a month named next to its full year. */
export function formatMonthShortYear(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

/** "Sep 26" — the same, squeezed for an axis tick or a phone header. */
export function formatMonthCompact(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]} ${String(year).slice(-2)}`;
}

/** "Tuesday 1 September" — the unhurried form, for a calendar heading. */
export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = WEEKDAY_LONG[new Date(year, month - 1, day).getDay()];
  return `${weekday} ${day} ${MONTH_LONG[month - 1]}`;
}

/**
 * "Today", "Yesterday", or whatever `fallback` makes of the date.
 *
 * Anchored to the app timezone rather than the runtime's, so a page rendered
 * at half past midnight in Paris does not come back from a UTC server calling
 * the same row "Yesterday" while the browser calls it "Today" — which is a
 * hydration mismatch, not a cosmetic difference.
 */
export function relativeDayLabel(
  isoDate: string,
  fallback: (isoDate: string) => string,
): string {
  const today = todayIsoLocal();
  if (isoDate === today) {
    return "Today";
  }

  const [year, month, day] = today.split("-").map(Number);
  const previous = new Date(year, month - 1, day - 1);
  const yesterday = `${previous.getFullYear()}-${String(
    previous.getMonth() + 1,
  ).padStart(2, "0")}-${String(previous.getDate()).padStart(2, "0")}`;

  return isoDate === yesterday ? "Yesterday" : fallback(isoDate);
}

export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()];
  return `${weekday} ${day} ${MONTH_SHORT[month - 1]}`;
}

/** Compact day + month for toggles (e.g. "12 Aug"). */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTH_SHORT[month - 1]}`;
}

export function getMonthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** Current calendar month in the app timezone. */
export function getCurrentMonth(): { year: number; month: number } {
  const { year, month } = nowInAppTimeZone();
  return { year, month };
}

export function parseMonthParams(
  yearParam?: string,
  monthParam?: string,
): { year: number; month: number } {
  const now = nowInAppTimeZone();
  const year = yearParam ? Number(yearParam) : now.year;
  const month = monthParam ? Number(monthParam) : now.month;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return { year: now.year, month: now.month };
  }

  return { year, month };
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_LONG[month - 1]} ${year}`;
}

export type BudgetViewMode = "current" | "month_end";

export function parseBudgetViewMode(value?: string | null): BudgetViewMode {
  return value === "month_end" ? "month_end" : "current";
}

/** Label for Current / End of month toggles, including the cutoff date. */
export function budgetViewOptionLabel(
  mode: BudgetViewMode,
  year: number,
  month: number,
): string {
  if (mode === "month_end") {
    const { end } = getMonthBounds(year, month);
    return `End of month · ${formatDayMonth(end)}`;
  }
  return `Current · ${formatDayMonth(todayIsoLocal())}`;
}

export function budgetViewHint(view: BudgetViewMode): string {
  if (view === "month_end") {
    return "Includes all recurring due this month, including wallet DCA.";
  }

  return "Through today only — future expenses and DCA not counted yet.";
}

export function lastDayIsoOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function monthSearchParams(
  year: number,
  month: number,
  view?: BudgetViewMode,
): string {
  const params = new URLSearchParams();
  params.set("y", String(year));
  params.set("m", String(month));
  if (view === "month_end") {
    params.set("view", "month_end");
  }
  return `?${params.toString()}`;
}
