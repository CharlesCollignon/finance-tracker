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

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
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

export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
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
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export type BudgetViewMode = "current" | "month_end";

export function parseBudgetViewMode(value?: string | null): BudgetViewMode {
  return value === "month_end" ? "month_end" : "current";
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
