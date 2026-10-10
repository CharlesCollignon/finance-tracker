import "server-only";
import { readToolArgs, type AskChatTool } from "@finance/core/ask-chat";
import { bankMerchantKey } from "@finance/core/bank-merchant";
import { calculate } from "@finance/core/calculator";
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
  loanTotals,
  monthlyOutlay,
  outstandingOn,
  type LoanPayment,
  type LoanTerms,
} from "@finance/core/loan-schedule";
import { loanTermsFromRow } from "@finance/core/property";
import {
  formatRecurrenceSchedule,
  getRecurringOccurrenceDates,
  occurrenceWithinSchedule,
} from "@finance/core/recurrence";
import { monthlyEquivalent } from "@finance/core/rental";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KIND_SHORT_KEYS,
} from "@finance/core/savings-accounts";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import {
  readLedgerRows,
  readMonthlyFlows,
  readSpendingByMonth,
  type AskLedgerRow,
} from "@finance/data/ask";
import { readBearingMonth } from "@finance/data/bearing-month";
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
import { getCachedLiveQuotes } from "../queries/market-quotes";

/**
 * What Ask Pluclair's tools do (`@finance/core/ask-chat`, `ASK_CHAT_TOOLS`):
 * each reads the person's own rows through the client handed in — the
 * cookie session on the web, the phone's token on its route — so row level
 * security holds either way, and hands back plain JSON for the model.
 *
 * Amounts are rounded to the cent, rates written as percentages, months as
 * YYYY-MM with their name beside. A tool that cannot answer says why in
 * words the model can pass on, rather than failing the question.
 */

export interface AskToolContext {
  db: Db;
  userId: string;
  /** YYYY-MM-DD. */
  today: string;
  locale: Locale;
}

/** What a call gave back: the JSON for the model, and whether it found anything. */
export interface AskToolResult {
  data: unknown;
  ok: boolean;
}

/** Longest span `cashflow` covers. */
const MAX_FLOW_MONTHS = 36;

export async function runAskTool(
  ctx: AskToolContext,
  name: AskChatTool,
  rawArgs: string,
): Promise<AskToolResult> {
  const args = readToolArgs(name, rawArgs);
  if (args === null) {
    return fail(
      `The arguments did not fit ${name}'s parameters. Check the dates (YYYY-MM or YYYY-MM-DD) and the allowed values.`,
    );
  }
  try {
    switch (name) {
      case "month":
        return await month(ctx, args as { month?: string });
      case "cashflow":
        return await cashflow(ctx, args as { from?: string; to?: string });
      case "categories":
        return await categories(
          ctx,
          args as { from?: string; to?: string; category?: string },
        );
      case "transactions":
        return await transactions(ctx, args as TransactionsArgs);
      case "merchants":
        return await merchants(
          ctx,
          args as { from?: string; to?: string; limit?: number },
        );
      case "recurring":
        return await recurring(ctx);
      case "savings":
        return await savings(ctx);
      case "investments":
        return await investments(ctx);
      case "loans":
        return await loans(ctx);
      case "loan_prepayment":
        return await loanPrepayment(
          ctx,
          args as {
            loan_id: string;
            amount: number;
            keep?: "payment" | "term";
          },
        );
      case "calculate":
        return calculator(args as { expression: string });
    }
  } catch (error) {
    // The tool's name, never the rows: what failed is enough to look into.
    console.warn(
      `[ask-tool] ${name} failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return fail("The app could not read this just now.");
  }
}

function fail(error: string): AskToolResult {
  return { data: { error }, ok: false };
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function percent(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------- the months */

const thisMonth = (today: string) => today.slice(0, 7);

function monthParts(key: string): { year: number; month: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** `count` months back from this one, this one included. */
function monthsBack(today: string, count: number): string {
  const { year, month } = monthParts(thisMonth(today));
  const at = shiftMonth(year, month, -(count - 1));
  return monthKey(at.year, at.month);
}

/** Every month from one to the other, both included, oldest first. */
function monthsBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  let { year, month } = monthParts(from);
  while (monthKey(year, month) <= to && keys.length <= MAX_FLOW_MONTHS * 4) {
    keys.push(monthKey(year, month));
    ({ year, month } = shiftMonth(year, month, 1));
  }
  return keys;
}

/** A span of months as days: its first day, and its last or today. */
function spanDays(
  from: string,
  to: string,
  today: string,
): { start: string; end: string } {
  const first = monthParts(from);
  const last = monthParts(to);
  const end = getMonthBounds(last.year, last.month).end;
  return {
    start: getMonthBounds(first.year, first.month).start,
    end: end > today ? today : end,
  };
}

function label(key: string, locale: Locale): string {
  const { year, month } = monthParts(key);
  return formatMonthLabel(year, month, locale);
}

/* -------------------------------------------------------------- the tools */

async function month(
  ctx: AskToolContext,
  { month: asked }: { month?: string },
): Promise<AskToolResult> {
  const key = asked ?? thisMonth(ctx.today);
  const { year, month: number } = monthParts(key);
  const read = await readBearingMonth(ctx.db, ctx.userId, {
    year,
    month: number,
    today: ctx.today,
    locale: ctx.locale,
    // What the wallets are worth is `investments`' to say.
    investedValue: async () => 0,
  });
  const balance = read.balance.basis === "balance" ? read.balance : null;
  return {
    ok: true,
    data: {
      month: key,
      label: label(key, ctx.locale),
      inProgress: key === thisMonth(ctx.today),
      income: money(read.income),
      spent: money(read.spent.total),
      spentLastMonthAtSamePoint:
        read.spent.previous === null ? null : money(read.spent.previous),
      topCategories: read.spending.top.map((category) => ({
        name: category.name,
        spent: money(category.total),
      })),
      otherCategoriesSpent: money(read.spending.rest),
      balance: balance
        ? {
            atStart: money(balance.start),
            today: balance.today === null ? null : money(balance.today),
            atEndPlanned: money(balance.end),
            lowestAhead: balance.lowest
              ? {
                  date: balance.lowest.date,
                  value: money(balance.lowest.value),
                }
              : null,
          }
        : null,
      leftToSpend: read.left
        ? {
            amount: money(read.left.amount),
            through: read.left.through,
            nextPayDay: read.left.payDay,
            perDay: read.left.perDay === null ? null : money(read.left.perDay),
          }
        : null,
      stillToCome: read.upcoming
        ? {
            out: money(read.upcoming.leaving),
            in: money(read.upcoming.arriving),
            items: read.upcoming.charges.slice(0, 25).map((charge) => ({
              name: charge.description || charge.name,
              date: charge.occurredOn,
              amount: money(
                charge.type === "income" ? charge.amount : -charge.amount,
              ),
            })),
          }
        : null,
      spendingByMonth: read.spent.trend.map((point) => ({
        month: point.monthKey,
        spent: money(point.total),
      })),
    },
  };
}

async function cashflow(
  ctx: AskToolContext,
  args: { from?: string; to?: string },
): Promise<AskToolResult> {
  const to = minKey(args.to ?? thisMonth(ctx.today), thisMonth(ctx.today));
  const from = args.from ?? monthsBack(ctx.today, 12);
  if (from > to) {
    return fail("`from` comes after `to`.");
  }
  const keys = monthsBetween(from, to);
  if (keys.length > MAX_FLOW_MONTHS) {
    return fail(`At most ${MAX_FLOW_MONTHS} months at once.`);
  }
  const { start, end } = spanDays(from, to, ctx.today);
  const flows = await readMonthlyFlows(ctx.db, ctx.userId, start, end);
  const byMonth = new Map(flows.map((flow) => [flow.monthKey, flow]));
  const months = keys.map((key) => {
    const flow = byMonth.get(key);
    const income = flow?.income ?? 0;
    const spent = flow?.expense ?? 0;
    return {
      month: key,
      label: label(key, ctx.locale),
      partial: key === thisMonth(ctx.today) || undefined,
      income: money(income),
      spent: money(spent),
      saved: money(flow?.savings ?? 0),
      invested: money(flow?.investment ?? 0),
      net: money(income - spent),
    };
  });
  const sum = (pick: (row: (typeof months)[number]) => number) =>
    money(months.reduce((total, row) => total + pick(row), 0));
  return {
    ok: flows.length > 0,
    data: {
      months,
      totals: {
        income: sum((row) => row.income),
        spent: sum((row) => row.spent),
        saved: sum((row) => row.saved),
        invested: sum((row) => row.invested),
        net: sum((row) => row.net),
      },
    },
  };
}

async function categories(
  ctx: AskToolContext,
  args: { from?: string; to?: string; category?: string },
): Promise<AskToolResult> {
  const to = minKey(args.to ?? thisMonth(ctx.today), thisMonth(ctx.today));
  const from = args.from ?? monthsBack(ctx.today, 3);
  if (from > to) {
    return fail("`from` comes after `to`.");
  }
  const keys = monthsBetween(from, to);
  const { start, end } = spanDays(from, to, ctx.today);
  const rows = await readSpendingByMonth(ctx.db, ctx.userId, start, end);

  if (args.category) {
    const wanted = fold(args.category);
    const matching = rows.filter((row) => fold(row.category).includes(wanted));
    if (matching.length === 0) {
      return {
        ok: false,
        data: {
          error: `No spending in a category named like « ${args.category} » over this span.`,
          categories: [...new Set(rows.map((row) => row.category))],
        },
      };
    }
    return {
      ok: true,
      data: {
        categories: [...new Set(matching.map((row) => row.category))],
        months: keys.map((key) => ({
          month: key,
          label: label(key, ctx.locale),
          partial: key === thisMonth(ctx.today) || undefined,
          spent: money(
            matching
              .filter((row) => row.monthKey === key)
              .reduce((sum, row) => sum + row.total, 0),
          ),
        })),
      },
    };
  }

  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.total);
  }
  const all = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return {
    ok: rows.length > 0,
    data: {
      from,
      to,
      months: keys.length,
      includesMonthInProgress: to === thisMonth(ctx.today),
      total: money(all),
      categories: [...totals.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([name, total]) => ({
          name,
          spent: money(total),
          sharePercent: all > 0 ? percent((total / all) * 100) : 0,
          perMonth: money(total / keys.length),
        })),
    },
  };
}

interface TransactionsArgs {
  query?: string;
  category?: string;
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  kind?: "expense" | "income" | "savings" | "investment" | "all";
  sort?: "recent" | "largest";
  limit?: number;
}

/** Money out is negative: what left the account, to a shop or to savings. */
function signed(row: AskLedgerRow): number {
  return row.type === "income" ? row.amount : -row.amount;
}

async function transactions(
  ctx: AskToolContext,
  args: TransactionsArgs,
): Promise<AskToolResult> {
  const rows = await readLedgerRows(ctx.db, ctx.userId, {
    query: args.query,
    category: args.category,
    from: args.from,
    to: args.to,
    min: args.min === undefined ? undefined : Math.abs(args.min),
    max: args.max === undefined ? undefined : Math.abs(args.max),
    type: args.kind === "all" ? undefined : args.kind,
  });
  const ordered =
    args.sort === "largest"
      ? [...rows].sort((a, b) => b.amount - a.amount)
      : rows;
  const shown = ordered.slice(0, args.limit ?? 20);
  return {
    ok: rows.length > 0,
    data: {
      matched: rows.length,
      total: money(rows.reduce((sum, row) => sum + signed(row), 0)),
      shown: shown.length,
      rows: shown.map((row) => ({
        date: row.occurredOn,
        label: row.note ?? row.category,
        category: row.category,
        amount: money(signed(row)),
      })),
    },
  };
}

async function merchants(
  ctx: AskToolContext,
  args: { from?: string; to?: string; limit?: number },
): Promise<AskToolResult> {
  const to = minKey(args.to ?? thisMonth(ctx.today), thisMonth(ctx.today));
  const from = args.from ?? monthsBack(ctx.today, 3);
  if (from > to) {
    return fail("`from` comes after `to`.");
  }
  const { start, end } = spanDays(from, to, ctx.today);
  const rows = await readLedgerRows(ctx.db, ctx.userId, {
    from: start,
    to: end,
    type: "expense",
  });
  const groups = new Map<
    string,
    { name: string; spent: number; payments: number; last: string }
  >();
  for (const row of rows) {
    const note = row.note?.trim() || row.category;
    const key = bankMerchantKey(note) || fold(note);
    const group = groups.get(key);
    if (group) {
      group.spent += row.amount;
      group.payments += 1;
    } else {
      // Rows come newest first: the first seen names the group and dates it.
      groups.set(key, {
        name: note.slice(0, 48),
        spent: row.amount,
        payments: 1,
        last: row.occurredOn,
      });
    }
  }
  return {
    ok: rows.length > 0,
    data: {
      from,
      to,
      merchants: [...groups.values()]
        .sort((a, b) => b.spent - a.spent)
        .slice(0, args.limit ?? 15)
        .map((group) => ({ ...group, spent: money(group.spent) })),
    },
  };
}

/** The next day a template falls on, within a year, or null. */
function nextDate(
  template: RecurringTemplateWithCategory,
  today: string,
): string | null {
  let { year, month } = monthParts(thisMonth(today));
  for (let step = 0; step < 13; step += 1) {
    const day = getRecurringOccurrenceDates(template, year, month).find(
      (date) =>
        date >= today &&
        occurrenceWithinSchedule(date, template.starts_on, template.ends_on),
    );
    if (day) {
      return day;
    }
    ({ year, month } = shiftMonth(year, month, 1));
  }
  return null;
}

async function recurring(ctx: AskToolContext): Promise<AskToolResult> {
  const templates = (await getRecurringTemplates(ctx.db, ctx.userId)).filter(
    (template) =>
      template.active && (!template.ends_on || template.ends_on >= ctx.today),
  );
  const items = templates.map((template) => ({
    name: template.description || template.categories.name,
    category: template.categories.name,
    kind: template.categories.type,
    amount: money(Number(template.amount)),
    rhythm: formatRecurrenceSchedule(template, ctx.locale),
    perMonth: money(
      monthlyEquivalent(Number(template.amount), template.recurrence),
    ),
    next: nextDate(template, ctx.today),
  }));
  const perMonth = (kind: string) =>
    money(
      items
        .filter((item) => item.kind === kind)
        .reduce((sum, item) => sum + item.perMonth, 0),
    );
  return {
    ok: items.length > 0,
    data: {
      items: items.sort((a, b) => b.perMonth - a.perMonth),
      perMonth: {
        income: perMonth("income"),
        expense: perMonth("expense"),
        savings: perMonth("savings"),
        investment: perMonth("investment"),
      },
    },
  };
}

async function savings(ctx: AskToolContext): Promise<AskToolResult> {
  const t = translator(ctx.locale);
  const [{ accounts }, templates] = await Promise.all([
    getSavingsAccounts(ctx.db, ctx.userId),
    getRecurringTemplates(ctx.db, ctx.userId),
  ]);
  const fixed = templates
    .filter(
      (template) => template.active && template.categories.type === "expense",
    )
    .reduce(
      (sum, template) =>
        sum + monthlyEquivalent(Number(template.amount), template.recurrence),
      0,
    );

  if (accounts.length === 0) {
    const reserve = await getSavingsReserve(ctx.db, ctx.userId);
    return {
      ok: reserve > 0,
      data: {
        accounts: [],
        note: "No savings account declared: this is everything logged as savings.",
        loggedAsSavings: money(reserve),
        fixedCostsPerMonth: money(fixed),
        monthsCovered: fixed > 0 ? percent(reserve / fixed) : null,
      },
    };
  }

  const rows = accounts.map((read) => {
    const preset = FRENCH_SAVINGS_2026[read.account.kind];
    const balance = read.balance.balance + read.balance.added;
    return {
      name: t(SAVINGS_KIND_SHORT_KEYS[read.account.kind]),
      balance: money(balance),
      ratePercent: percent(read.rate * 100),
      ceiling: preset.ceiling,
      roomUnderCeiling:
        preset.ceiling === null
          ? null
          : money(Math.max(0, preset.ceiling - balance)),
      atHand: preset.liquid,
      interestTaxPercent: percent(preset.taxOnInterest * 100),
    };
  });
  const atHand = rows
    .filter((row) => row.atHand)
    .reduce((sum, row) => sum + row.balance, 0);
  return {
    ok: true,
    data: {
      accounts: rows,
      total: money(rows.reduce((sum, row) => sum + row.balance, 0)),
      atHand: money(atHand),
      fixedCostsPerMonth: money(fixed),
      monthsCovered: fixed > 0 ? percent(atHand / fixed) : null,
    },
  };
}

async function investments(ctx: AskToolContext): Promise<AskToolResult> {
  const [categoryRows, transactionRows, positions, templates] =
    await Promise.all([
      getCategories(ctx.db, ctx.userId, { includeArchived: true }),
      getInvestmentTransactions(ctx.db, ctx.userId),
      getInvestmentPositions(ctx.db, ctx.userId),
      getRecurringTemplates(ctx.db, ctx.userId),
    ]);
  const quotes = await getCachedLiveQuotes(
    portfolioQuoteSymbols(positions, templates),
  );
  const portfolio = buildInvestmentPortfolio(
    categoryRows,
    transactionRows,
    positions,
    templates,
    quotes,
    ctx.locale,
    ctx.today,
    {},
  );
  const accounts = portfolio.columns
    .filter((column) => column.totalInvested > 0 || column.totalMarketValue > 0)
    .map((column) => ({
      account: INVESTMENT_WALLET_LABELS[column.walletId],
      value: money(column.totalMarketValue),
      invested: money(column.totalInvested),
      gain: money(column.totalGainLoss),
      gainPercent:
        column.totalInvested > 0
          ? percent((column.totalGainLoss / column.totalInvested) * 100)
          : null,
      holdings: [...column.items]
        .sort((a, b) => b.marketValue - a.marketValue)
        .slice(0, 8)
        .map((item) => ({
          name: item.instrumentName || item.name,
          value: money(item.marketValue),
          invested: money(item.totalInvested),
          gain: money(item.gainLoss),
          yearlyFeesPercent:
            item.ongoingCharge === null
              ? null
              : percent(item.ongoingCharge * 100),
        })),
    }));
  return {
    ok: accounts.length > 0,
    data: {
      accounts,
      total: {
        value: money(portfolio.totalMarketValue),
        invested: money(portfolio.totalInvested),
        gain: money(portfolio.totalGainLoss),
      },
    },
  };
}

interface LoanRead {
  id: string;
  name: string;
  terms: LoanTerms;
  schedule: LoanPayment[];
  share: number;
  fees: number;
}

async function readLoans(ctx: AskToolContext): Promise<LoanRead[]> {
  const { properties } = await getProperties(ctx.db, ctx.userId);
  return properties.flatMap(({ property, loans: own }) =>
    own.map((loan) => {
      const terms = loanTermsFromRow(loan);
      return {
        id: loan.id,
        name:
          own.length > 1 ? `${property.name} · ${loan.label}` : property.name,
        terms,
        schedule: loanSchedule(terms),
        share: Number(loan.borrower_share),
        fees: Number(loan.fees),
      };
    }),
  );
}

/** Where a schedule stands from today: what is owed, and what is still to pay. */
function ahead(
  terms: LoanTerms,
  schedule: readonly LoanPayment[],
  today: string,
) {
  const rows = schedule.filter((row) => row.on > today);
  return {
    owed: money(outstandingOn(terms, schedule, today)),
    monthsLeft: rows.length,
    endsOn: rows.at(-1)?.on ?? null,
    interestLeft: money(rows.reduce((sum, row) => sum + row.interest, 0)),
    insuranceLeft: money(rows.reduce((sum, row) => sum + row.insurance, 0)),
    nextPayment: rows[0] ? money(rows[0].payment + rows[0].insurance) : null,
  };
}

async function loans(ctx: AskToolContext): Promise<AskToolResult> {
  const reads = await readLoans(ctx);
  return {
    ok: reads.length > 0,
    data: {
      loans: reads.map((loan) => ({
        id: loan.id,
        name: loan.name,
        ...ahead(loan.terms, loan.schedule, ctx.today),
        ratePercent: percent(loan.terms.annualRate * 100),
        monthlyWithInsurance: money(monthlyOutlay(loan.terms, loan.schedule)),
        borrowed: money(loan.terms.principal),
        totalCost: loanTotals(loan.schedule, loan.fees).cost,
        yourSharePercent: percent(loan.share * 100),
      })),
      note: "Amounts are for the whole loan; yourSharePercent is the person's part of it.",
    },
  };
}

async function loanPrepayment(
  ctx: AskToolContext,
  args: { loan_id: string; amount: number; keep?: "payment" | "term" },
): Promise<AskToolResult> {
  const loan = (await readLoans(ctx)).find((read) => read.id === args.loan_id);
  if (!loan) {
    return fail("No loan with this id: call `loans` for the ids.");
  }
  const before = ahead(loan.terms, loan.schedule, ctx.today);
  if (before.owed <= 0) {
    return fail("This loan is already repaid.");
  }
  if (loan.terms.kind === "in_fine") {
    return fail(
      "An in-fine loan repays its capital at the end: an early repayment lowers the interest in proportion, which `calculate` can work out.",
    );
  }
  const keep = args.keep ?? "payment";
  const left = Math.max(0, before.owed - args.amount);
  const terms: LoanTerms = {
    ...loan.terms,
    known: { outstanding: left, on: ctx.today, keeps: keep },
  };
  const after = ahead(terms, loanSchedule(terms), ctx.today);
  return {
    ok: true,
    data: {
      loan: loan.name,
      repaidEarly: money(Math.min(args.amount, before.owed)),
      keep,
      before,
      after,
      interestSaved: money(before.interestLeft - after.interestLeft),
      insuranceSaved: money(before.insuranceLeft - after.insuranceLeft),
      monthsSooner: before.monthsLeft - after.monthsLeft,
      note: "Early-repayment fees are not counted.",
    },
  };
}

function calculator({ expression }: { expression: string }): AskToolResult {
  const result = calculate(expression);
  return result === null
    ? fail(
        "Not an expression the calculator reads: numbers with a point, + - * / % ^, parentheses, round, min, max, abs, sqrt.",
      )
    : { ok: true, data: { expression, result } };
}

/* ---------------------------------------------------------------- helpers */

function minKey(a: string, b: string): string {
  return a < b ? a : b;
}

/** Lower case, accents off: how a name the model typed is compared. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
