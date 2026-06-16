export const DEFAULT_CATEGORIES = [
  { name: "Salary", type: "income" as const, icon: "wallet" },
  { name: "Electricity", type: "expense" as const, icon: "lightning" },
  { name: "Internet", type: "expense" as const, icon: "wifi" },
  { name: "Condo fees", type: "expense" as const, icon: "buildings" },
  { name: "Loan repayment", type: "expense" as const, icon: "bank" },
  { name: "Insurance", type: "expense" as const, icon: "shield" },
  { name: "Groceries", type: "expense" as const, icon: "shopping-cart" },
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

export function getMonthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function parseMonthParams(
  yearParam?: string,
  monthParam?: string,
): { year: number; month: number } {
  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
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

export function monthSearchParams(year: number, month: number): string {
  return `?y=${year}&m=${month}`;
}
