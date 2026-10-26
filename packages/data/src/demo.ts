import { todayIsoLocal } from "@finance/core/constants";
import { buildDemoSample } from "@finance/core/demo-sample";

import { deleteAllUserData } from "./account";
import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * The demo account, rebuilt (migration 081): everything the person wrote
 * goes, and the sample comes back built for today — so the demo always
 * reads as this month. Run under the service role, the only role the
 * demo's tables let write (`refuse_demo_write`); the nightly cron and
 * `scripts/seed-demo.mjs` both come here.
 */

export interface DemoCounts {
  categories: number;
  templates: number;
  transactions: number;
  positions: number;
  events: number;
}

/** Rows at a time: PostgREST takes a few thousand, the sample is a few hundred. */
const CHUNK = 500;

async function insertAll<T>(
  rows: readonly T[],
  insert: (chunk: T[]) => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    const { error } = await insert(rows.slice(index, index + CHUNK));
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function resetDemo(
  db: Db,
  userId: string,
  today: string = todayIsoLocal(),
): Promise<DemoCounts> {
  const sample = buildDemoSample(today);

  // What the account wipe knows, then what came after it.
  await deleteAllUserData(db, userId);
  for (const table of [
    "month_closes",
    "filing_rules",
    "investment_events",
    "wallet_plans",
    "bearing_arrangements",
    "month_reads",
    "category_reads",
    "wallet_reads",
  ] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error && !isMissingSchema(error)) {
      throw new Error(error.message);
    }
  }

  // Categories first: everything else points at them.
  const { data: categoryRows, error: categoriesError } = await db
    .from("categories")
    .insert(
      sample.categories.map((category) => ({
        user_id: userId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        counts_toward_summary: category.countsTowardSummary,
      })),
    )
    .select("id, name, type");
  if (categoriesError) {
    throw new Error(categoriesError.message);
  }
  const categoryId = new Map(
    (categoryRows ?? []).map((row) => [`${row.type}:${row.name}`, row.id]),
  );
  const categoryFor = (key: string): string => {
    const id = categoryId.get(key);
    if (!id) {
      throw new Error(`demo: no category for ${key}`);
    }
    return id;
  };

  const { data: templateRows, error: templatesError } = await db
    .from("recurring_templates")
    .insert(
      sample.templates.map((template) => ({
        user_id: userId,
        category_id: categoryFor(template.categoryKey),
        description: template.description,
        amount: template.amount,
        recurrence: template.recurrence,
        day_of_month: template.dayOfMonth,
        day_of_week: template.dayOfWeek,
        instrument_symbol: template.instrumentSymbol,
        instrument_name: template.instrumentName,
        funded_by_transfer: template.fundedByTransfer,
        starts_on: template.startsOn,
        active: true,
      })),
    )
    .select("id, description");
  if (templatesError) {
    throw new Error(templatesError.message);
  }
  const templateId = new Map(
    sample.templates.map((template) => [
      template.key,
      (templateRows ?? []).find(
        (row) => row.description === template.description,
      )?.id ?? null,
    ]),
  );

  await insertAll(sample.transactions, (chunk) =>
    db.from("transactions").insert(
      chunk.map((row) => ({
        user_id: userId,
        category_id: categoryFor(row.categoryKey),
        recurring_template_id: row.templateKey
          ? (templateId.get(row.templateKey) ?? null)
          : null,
        occurred_on: row.occurredOn,
        amount: row.amount,
        note: row.note,
      })),
    ),
  );

  await insertAll(sample.positions, (chunk) =>
    db.from("investment_positions").insert(
      chunk.map((position) => ({
        user_id: userId,
        wallet: position.wallet,
        name: position.name,
        initial_balance: position.initialBalance,
        current_value: position.currentValue,
        share_count: position.shareCount,
        instrument_symbol: position.instrumentSymbol,
        instrument_name: position.instrumentName,
        isin: position.isin,
        ongoing_charge: position.ongoingCharge,
        value_pinned: true,
      })),
    ),
  );

  await insertAll(sample.walletPlans, (chunk) =>
    db.from("wallet_plans").insert(
      chunk.map((plan) => ({
        user_id: userId,
        wallet: plan.wallet,
        shown: true,
        opened_on: plan.openedOn,
        contribution_ceiling: plan.contributionCeiling,
      })),
    ),
  );

  await insertAll(sample.savingsAccounts, (chunk) =>
    db.from("savings_accounts").insert(
      chunk.map((account) => ({
        user_id: userId,
        kind: account.kind,
        balance: account.balance,
        balance_on: account.balanceOn,
        annual_rate: account.annualRate,
        category_id: categoryFor(account.categoryKey),
      })),
    ),
  );

  await insertAll(sample.monthCloses, (chunk) =>
    db.from("month_closes").insert(
      chunk.map((close) => ({
        user_id: userId,
        month: close.month,
        closing_balance: close.closingBalance,
        observed_on: close.observedOn,
        balance_source: "manual" as const,
      })),
    ),
  );

  await insertAll(sample.filingRules, (chunk) =>
    db.from("filing_rules").insert(
      chunk.map((rule) => ({
        user_id: userId,
        words: rule.words,
        category_id: categoryFor(rule.categoryKey),
        direction: rule.direction,
      })),
    ),
  );

  await insertAll(sample.events, (chunk) =>
    db.from("investment_events").insert(
      chunk.map((event) => ({
        user_id: userId,
        wallet: event.wallet,
        kind: event.kind,
        occurred_on: event.occurredOn,
        instrument_name: event.instrumentName,
        isin: event.isin,
        quantity: event.quantity,
        amount: event.amount,
        source: "manual" as const,
      })),
    ),
  );

  // French, and never counted among the readers.
  const { error: preferencesError } = await db.from("user_preferences").upsert(
    {
      user_id: userId,
      locale: "fr",
      measure_audience: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (preferencesError && !isMissingSchema(preferencesError)) {
    throw new Error(preferencesError.message);
  }

  return {
    categories: sample.categories.length,
    templates: sample.templates.length,
    transactions: sample.transactions.length,
    positions: sample.positions.length,
    events: sample.events.length,
  };
}
