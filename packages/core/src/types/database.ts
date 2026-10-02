import type { BudgetViewMode } from "../constants";
import type { Locale } from "../i18n/locale";
import type { Database as GeneratedDatabase } from "./database.generated";

export type CategoryType = "income" | "expense" | "savings" | "investment";

export type Recurrence = "monthly" | "weekly" | "yearly";

export type PricingType = "fixed" | "shares";

export type WalletId = "pea" | "cto" | "av" | "per" | "crypto";

/** A kind of savings account — see migration 046. */
export type SavingsAccountKind =
  "livret_a" | "ldds" | "lep" | "pel" | "cel" | "livret";

/** What a property is — see migration 049. Only a home has a market. */
export type PropertyKind = "apartment" | "house" | "other";

/** How a property is used — see migration 049. */
export type PropertyUsage =
  "main_home" | "second_home" | "rental_bare" | "rental_furnished";

/** Paid down month by month, or interest only and the principal at the end. */
export type LoanKind = "amortising" | "in_fine";

/**
 * The first months of a loan, when the principal is not repaid yet: with a
 * partial deferral the interest is paid, with a total one nothing is, and
 * the interest is added to what is owed.
 */
export type DeferralKind = "none" | "partial" | "total";

/** What the bank kept after an early repayment: the payment or the end. */
export type KnownOutstandingKeeps = "payment" | "term";

/** Where a user's bank connection stands — see migration 041. */
export type BankConnectionStatus =
  "active" | "expired" | "paused" | "revoked" | "error";

export type { Json } from "./database.generated";

type Generated = GeneratedDatabase["public"];
type GeneratedTables = Generated["Tables"];

/**
 * A row, insert or update shape with some of its columns narrowed.
 *
 * Optional stays optional and nullable stays nullable: only the type of the
 * value changes. A homomorphic mapped type keeps the `?` of every key it
 * walks, which is what lets one helper serve all three shapes.
 */
type Narrow<Shape, Columns> = {
  [K in keyof Shape]: K extends keyof Columns
    ? null extends Shape[K]
      ? Columns[K] | null
      : Columns[K]
    : Shape[K];
};

type NarrowTable<
  Name extends keyof GeneratedTables,
  Columns,
  Writes = Columns,
> = {
  Row: Narrow<GeneratedTables[Name]["Row"], Columns>;
  Insert: Narrow<GeneratedTables[Name]["Insert"], Writes>;
  Update: Narrow<GeneratedTables[Name]["Update"], Writes>;
  Relationships: GeneratedTables[Name]["Relationships"];
};

/**
 * The columns a CHECK constraint limits to a few values, which the database
 * itself reports as plain text. Real Postgres enums — a category's type, a
 * recurrence, a pricing, a wallet — come through generated already.
 */
interface Narrowed {
  bank_connections: { status: BankConnectionStatus };
  bank_feed_items: {
    direction: "in" | "out";
    status: "pending" | "imported" | "ignored";
  };
  month_closes: { balance_source: "manual" | "bank" };
  month_reads: { source: "pressed" | "auto"; locale: Locale };
  savings_accounts: { kind: SavingsAccountKind };
  properties: { kind: PropertyKind; usage: PropertyUsage };
  property_market_readings: { scope: "radius" | "commune" };
  property_loans: {
    kind: LoanKind;
    deferral_kind: DeferralKind;
    known_keeps: KnownOutstandingKeeps;
  };
  user_preferences: { locale: Locale };
  wallet_reads: { locale: Locale };
  category_reads: { locale: Locale };
  bearing_arrangements: { locale: Locale };
}

/**
 * Numeric columns the bank sync writes as the bank's own decimal string.
 * Postgres rounds "12.345" into numeric(12,2) exactly; parsing it into a
 * float first would not, so the string is the right thing to send — and the
 * generated types, which see only `numeric`, would forbid it.
 */
interface DecimalWrites {
  transactions: { amount: number | string };
  bank_feed_items: {
    amount: number | string;
    balance_after: number | string;
  };
  bank_accounts: { reported_balance: number | string };
}

type NarrowedOrWritten = keyof Narrowed | keyof DecimalWrites;

type Tables = Omit<GeneratedTables, NarrowedOrWritten> & {
  [Name in NarrowedOrWritten]: NarrowTable<
    Name,
    Name extends keyof Narrowed ? Narrowed[Name] : unknown,
    (Name extends keyof Narrowed ? Narrowed[Name] : unknown) &
      (Name extends keyof DecimalWrites ? DecimalWrites[Name] : unknown)
  >;
};

type GeneratedFunctions = Generated["Functions"];

/**
 * The arguments each function accepts as null. A Postgres function cannot
 * say that an argument may be null, so the generator types every one as
 * required and non-null; these are the ones the SQL takes null for — a read
 * with nothing in it, a model that was not named, a fund with no charge.
 */
interface NullableArgs {
  store_month_read:
    | "new_read"
    | "new_facts"
    | "new_digest"
    | "new_model"
    | "new_prompt_version"
    | "new_locale";
  store_bearing_arrangement:
    | "new_arrangement"
    | "new_facts"
    | "new_digest"
    | "new_model"
    | "new_prompt_version"
    | "new_locale";
  store_instrument_reading:
    | "new_charge"
    | "new_currency"
    | "new_coverage"
    | "new_model"
    | "new_asset_kind";
  store_wallet_read:
    | "new_read"
    | "new_facts"
    | "new_digest"
    | "new_dropped"
    | "new_model"
    | "new_prompt_version"
    | "new_locale"
    | "refused_delta";
  store_category_read:
    | "new_read"
    | "new_facts"
    | "new_digest"
    | "new_trimmed"
    | "new_model"
    | "new_prompt_version"
    | "new_locale"
    | "refused_delta";
  store_category_selection:
    | "new_selection"
    | "new_digest"
    | "new_model"
    | "new_prompt_version"
    | "refused_delta";
}

type WithNullable<Args, Keys> = {
  [K in keyof Args]: K extends Keys ? Args[K] | null : Args[K];
};

type Functions = Omit<GeneratedFunctions, keyof NullableArgs> & {
  [Name in keyof NullableArgs]: Omit<GeneratedFunctions[Name], "Args"> & {
    Args: WithNullable<GeneratedFunctions[Name]["Args"], NullableArgs[Name]>;
  };
};

/**
 * The schema the Supabase clients are typed with: generated from the
 * database (`./database.generated.ts`, `pnpm gen:types`), then narrowed.
 *
 * It used to be written by hand, and had drifted the way hand-kept copies
 * do — no `deleted_at` (migration 036), and `Relationships: []` on most
 * tables, which left every join untyped and every one of them cast. Generated,
 * the joins carry their types and a migration is one command away from the
 * types that match it.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<Generated, "Tables" | "Functions"> & {
    Tables: Tables;
    Functions: Functions;
  };
};

/** The columns of `instrument_reading_tallies`. */
export type InstrumentReadingTallyColumns =
  Tables["instrument_reading_tallies"]["Row"];

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type RecurringTemplate =
  Database["public"]["Tables"]["recurring_templates"]["Row"];
export type RecurringSkip =
  Database["public"]["Tables"]["recurring_skips"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type InvestmentPosition =
  Database["public"]["Tables"]["investment_positions"]["Row"];
export type WalletTransfer =
  Database["public"]["Tables"]["wallet_transfers"]["Row"];
export type WalletPlan = Database["public"]["Tables"]["wallet_plans"]["Row"];
export type SavingsAccount =
  Database["public"]["Tables"]["savings_accounts"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyLoan =
  Database["public"]["Tables"]["property_loans"]["Row"];
export type PropertyMarketReading =
  Database["public"]["Tables"]["property_market_readings"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type ExpoPushTokenRow =
  Database["public"]["Tables"]["expo_push_tokens"]["Row"];
export type BankFeedItem =
  Database["public"]["Tables"]["bank_feed_items"]["Row"];
export type BankAccount = Database["public"]["Tables"]["bank_accounts"]["Row"];
export type BankPullRow = Database["public"]["Tables"]["bank_pulls"]["Row"];
export type MonthReadRow = Database["public"]["Tables"]["month_reads"]["Row"];
export type InstrumentReadingRow =
  Database["public"]["Tables"]["instrument_readings"]["Row"];
export type InstrumentReadingTallyRow =
  Database["public"]["Tables"]["instrument_reading_tallies"]["Row"];
export type WalletReadRow = Database["public"]["Tables"]["wallet_reads"]["Row"];
export type CategoryReadRow =
  Database["public"]["Tables"]["category_reads"]["Row"];
export type CategoryReadTallyRow =
  Database["public"]["Tables"]["category_read_tallies"]["Row"];
export type CategorySelectionRow =
  Database["public"]["Tables"]["category_selections"]["Row"];
export type RecurringFulfilment =
  Database["public"]["Tables"]["recurring_fulfilments"]["Row"];
export type MonthClose = Database["public"]["Tables"]["month_closes"]["Row"];
export type MonthCloseSettings =
  Database["public"]["Tables"]["month_close_settings"]["Row"];
export type UserPreferences =
  Database["public"]["Tables"]["user_preferences"]["Row"];

export type RecurringTemplateWithCategory = RecurringTemplate & {
  categories: Pick<
    Category,
    "name" | "type" | "icon" | "counts_toward_summary"
  >;
};

export type TransactionWithCategory = Transaction & {
  categories: Pick<
    Category,
    "name" | "type" | "icon" | "counts_toward_summary"
  >;
};

export interface CategoryBreakdown {
  categoryId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  total: number;
}

export interface MonthlySummary {
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  investmentDeployments: number;
  remaining: number;
  budgetView: BudgetViewMode;
  expenseBreakdown: CategoryBreakdown[];
  savingsBreakdown: CategoryBreakdown[];
  investmentBreakdown: CategoryBreakdown[];
  investmentDeploymentBreakdown: CategoryBreakdown[];
}
