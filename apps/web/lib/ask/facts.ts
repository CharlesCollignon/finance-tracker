import "server-only";
import {
  chargeFacts,
  cushionFacts,
  loanFacts,
  spendingFacts,
  walletFacts,
  type AskTool,
} from "@finance/core/ask";
import {
  formatMonthLabel,
  getMonthBounds,
  shiftMonth,
} from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  buildInvestmentPortfolio,
  portfolioQuoteSymbols,
} from "@finance/core/investment-positions";
import { INVESTMENT_WALLET_LABELS } from "@finance/core/investments";
import {
  loanSchedule,
  monthlyOutlay,
  outstandingOn,
} from "@finance/core/loan-schedule";
import { loanTermsFromRow } from "@finance/core/property";
import type { MonthFact } from "@finance/core/month-facts";
import { monthlyEquivalent } from "@finance/core/rental";
import { FRENCH_SAVINGS_2026 } from "@finance/core/savings-accounts";
import { readIncomeTotal, readSpendingByMonth } from "@finance/data/ask";
import { readCashBalance } from "@finance/data/bank-balance";
import { getCategories } from "@finance/data/categories";
import type { Db } from "@finance/data/client";
import {
  getInvestmentTransactions,
  getSavingsReserve,
} from "@finance/data/history";
import { getInvestmentPositions } from "@finance/data/positions";
import { getProperties } from "@finance/data/properties";
import { getSavingsAccounts } from "@finance/data/savings-accounts";
import { getRecurringTemplates } from "@finance/data/templates";
import { getCachedLiveQuotes } from "@/lib/queries/market-quotes";

/** Months the spending family reaches back, this one included. */
const SPENDING_MONTHS = 12;

/**
 * The figures a question asked for, family by family (`ASK_TOOLS`):
 * aggregates the app computes from the person's own rows, labelled in the
 * question's language. Read with the client handed in — the cookie session
 * on the web, the phone's token on its route — so row level security holds
 * either way.
 */
export async function gatherAskFacts(
  db: Db,
  userId: string,
  tools: readonly AskTool[],
  { today, locale }: { today: string; locale: Locale },
): Promise<MonthFact[]> {
  const t = translator(locale);
  const packs = await Promise.all(
    tools.map(async (tool): Promise<MonthFact[]> => {
      switch (tool) {
        case "month":
          return monthFacts(db, userId, today, locale);
        case "spending":
          return spending(db, userId, today, locale);
        case "charges": {
          const templates = await activeTemplates(db, userId);
          return chargeFacts(templates, {
            charge: (name) => t("ask.facts.charge", { name }),
            out: t("ask.facts.chargesOut"),
            in: t("ask.facts.chargesIn"),
          });
        }
        case "cushion":
          return cushion(db, userId, locale);
        case "wallets":
          return wallets(db, userId, today, locale);
        case "loans":
          return loans(db, userId, today, locale);
      }
    }),
  );
  return packs.flat();
}

/** The month in progress: what came in, what went out, the balance today. */
async function monthFacts(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<MonthFact[]> {
  const t = translator(locale);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const { start } = getMonthBounds(year, month);
  const label = formatMonthLabel(year, month, locale);
  const [spent, income, cash] = await Promise.all([
    readSpendingByMonth(db, userId, start, today),
    readIncomeTotal(db, userId, start, today),
    readCashBalance(db, userId, today).catch(() => null),
  ]);
  const facts: MonthFact[] = [
    {
      id: "month-spent",
      label: t("ask.facts.spentTotal", { month: label }),
      unit: "money",
      value: round(spent.reduce((sum, row) => sum + row.total, 0)),
      sense: "up-is-bad",
    },
    {
      id: "month-income",
      label: t("ask.facts.income", { month: label }),
      unit: "money",
      value: round(income),
      sense: "up-is-good",
    },
  ];
  if (cash?.ok) {
    facts.push({
      id: "balance-today",
      label: t("ask.facts.balanceToday"),
      unit: "money",
      value: round(cash.total),
      sense: "up-is-good",
    });
  }
  return facts;
}

async function spending(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<MonthFact[]> {
  const t = translator(locale);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const months = Array.from({ length: SPENDING_MONTHS }, (_, index) => {
    const at = shiftMonth(year, month, index - (SPENDING_MONTHS - 1));
    return {
      key: `${at.year}-${String(at.month).padStart(2, "0")}`,
      label: formatMonthLabel(at.year, at.month, locale),
    };
  });
  const first = shiftMonth(year, month, -(SPENDING_MONTHS - 1));
  const rows = await readSpendingByMonth(
    db,
    userId,
    getMonthBounds(first.year, first.month).start,
    today,
  );
  return spendingFacts(months, rows, {
    total: (label) => t("ask.facts.spentTotal", { month: label }),
    category: (name, label) =>
      t("ask.facts.spentCategory", { name, month: label }),
  });
}

/** The active recurring entries, each as a month's worth. */
async function activeTemplates(db: Db, userId: string) {
  const templates = await getRecurringTemplates(db, userId);
  return templates
    .filter(
      (template) =>
        template.active &&
        (template.categories.type === "expense" ||
          template.categories.type === "income"),
    )
    .map((template) => ({
      id: template.id,
      name: template.description || template.categories.name,
      monthly: monthlyEquivalent(Number(template.amount), template.recurrence),
      income: template.categories.type === "income",
    }));
}

/**
 * What is set aside — the declared accounts at hand, a PEL left out since a
 * withdrawal closes it, or else everything logged as savings — and the
 * months of recurring spending it covers.
 */
async function cushion(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<MonthFact[]> {
  const t = translator(locale);
  const [{ accounts }, templates] = await Promise.all([
    getSavingsAccounts(db, userId),
    activeTemplates(db, userId),
  ]);
  const savings =
    accounts.length > 0
      ? accounts
          .filter((read) => FRENCH_SAVINGS_2026[read.account.kind].liquid)
          .reduce(
            (sum, read) => sum + read.balance.balance + read.balance.added,
            0,
          )
      : await getSavingsReserve(db, userId);
  const fixed = templates
    .filter((template) => !template.income)
    .reduce((sum, template) => sum + template.monthly, 0);
  return cushionFacts(savings, fixed, {
    savings: t("ask.facts.savings"),
    months: t("ask.facts.cushionMonths"),
  });
}

async function wallets(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<MonthFact[]> {
  const t = translator(locale);
  const [categories, transactions, positions, templates] = await Promise.all([
    getCategories(db, userId, { includeArchived: true }),
    getInvestmentTransactions(db, userId),
    getInvestmentPositions(db, userId),
    getRecurringTemplates(db, userId),
  ]);
  const quotes = await getCachedLiveQuotes(
    portfolioQuoteSymbols(positions, templates),
  );
  const portfolio = buildInvestmentPortfolio(
    categories,
    transactions,
    positions,
    templates,
    quotes,
    locale,
    today,
    {},
  );
  return walletFacts(
    portfolio.columns
      .filter(
        (column) => column.totalInvested > 0 || column.totalMarketValue > 0,
      )
      .map((column) => ({
        id: column.walletId,
        name: INVESTMENT_WALLET_LABELS[column.walletId],
        value: column.totalMarketValue,
        invested: column.totalInvested,
      })),
    {
      value: (name) => t("ask.facts.walletValue", { name }),
      invested: (name) => t("ask.facts.walletInvested", { name }),
      total: t("ask.facts.walletsTotal"),
    },
  );
}

/** Each loan as it stands today, from its own schedule. */
async function loans(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<MonthFact[]> {
  const t = translator(locale);
  const { properties } = await getProperties(db, userId);
  const rows = properties.flatMap(({ property, loans: own }) =>
    own.map((loan) => {
      const terms = loanTermsFromRow(loan);
      const schedule = loanSchedule(terms);
      const ahead = schedule.filter((row) => row.on > today);
      const share = Number(loan.borrower_share);
      return {
        id: loan.id,
        name:
          own.length > 1 ? `${property.name} · ${loan.label}` : property.name,
        owed: outstandingOn(terms, schedule, today) * share,
        rate: Number(loan.annual_rate) * 100,
        monthly: monthlyOutlay(terms, schedule) * share,
        interestLeft: ahead.reduce((sum, row) => sum + row.interest, 0) * share,
        monthsLeft: ahead.length,
      };
    }),
  );
  return loanFacts(rows, {
    owed: (name) => t("ask.facts.loanOwed", { name }),
    rate: (name) => t("ask.facts.loanRate", { name }),
    monthly: (name) => t("ask.facts.loanMonthly", { name }),
    interestLeft: (name) => t("ask.facts.loanInterestLeft", { name }),
    monthsLeft: (name) => t("ask.facts.loanMonthsLeft", { name }),
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
