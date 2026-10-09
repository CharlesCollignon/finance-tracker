import { allRows } from "@finance/core/paging";
import type { AskAnswerBody, AskQuestionBody } from "@finance/core/ask";
import type { Json } from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchemaOrFunction } from "./schema";

/**
 * Ask Pluclair's storage (migration 064): a person's conversations, kept
 * thirty days, and the month's count of questions — a ceiling against a
 * runaway client. Shared by both apps: the phone reads and deletes through
 * here directly, and asks through the web's route, which opens the person's
 * AI account key.
 */

export interface AskConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export type AskMessage =
  | { id: string; role: "question"; body: AskQuestionBody; createdAt: string }
  | { id: string; role: "answer"; body: AskAnswerBody; createdAt: string };

/** The person's conversations, latest first; none before migration 064. */
export async function listConversations(
  db: Db,
  userId: string,
): Promise<AskConversation[]> {
  const { data, error } = await db
    .from("ask_conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}

/** One conversation's messages, oldest first. */
export async function getConversationMessages(
  db: Db,
  conversationId: string,
): Promise<AskMessage[]> {
  const { data, error } = await db
    .from("ask_messages")
    .select("id, role, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map(
    (row) =>
      ({
        id: row.id,
        role: row.role,
        body: row.body,
        createdAt: row.created_at,
      }) as AskMessage,
  );
}

/**
 * A question and its answer, written into a conversation — a new one,
 * titled by the question, when none is given. The conversation's id.
 */
export async function recordExchange(
  db: Db,
  userId: string,
  {
    conversationId,
    title,
    question,
    answer,
  }: {
    conversationId: string | null;
    title: string;
    question: AskQuestionBody;
    answer: AskAnswerBody;
  },
): Promise<string> {
  let id = conversationId;
  const now = new Date().toISOString();
  if (id) {
    const { error } = await db
      .from("ask_conversations")
      .update({ updated_at: now })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await db
      .from("ask_conversations")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    if (error) {
      throw error;
    }
    id = data.id;
  }
  // A beat apart, so the question always sorts before its answer.
  const answered = new Date(Date.now() + 1).toISOString();
  const { error } = await db.from("ask_messages").insert([
    {
      conversation_id: id,
      user_id: userId,
      role: "question",
      body: question as unknown as NonNullable<Json>,
      created_at: now,
    },
    {
      conversation_id: id,
      user_id: userId,
      role: "answer",
      body: answer as unknown as NonNullable<Json>,
      created_at: answered,
    },
  ]);
  if (error) {
    throw error;
  }
  return id;
}

/** A conversation, gone with its messages. */
export async function deleteConversation(
  db: Db,
  conversationId: string,
): Promise<void> {
  const { error } = await db
    .from("ask_conversations")
    .delete()
    .eq("id", conversationId);
  if (error && !isMissingSchemaOrFunction(error)) {
    throw error;
  }
}

/* ------------------------------------------------------------ the count */

/** The first day of a month, as the tally is keyed. */
export function tallyMonth(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/**
 * One question taken from the month, if it has room: the count after, or
 * null when it had none. Null too before migration 064, where nothing could
 * be counted — and a question that cannot be counted is not asked.
 */
export async function reserveQuestion(
  db: Db,
  today: string,
  allowance: number,
): Promise<number | null> {
  const { data, error } = await db.rpc("reserve_ask", {
    target_month: tallyMonth(today),
    allowance,
  });
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  return data ?? null;
}

/** A question the model never answered, handed back. Never fatal. */
export async function refundQuestion(db: Db, today: string): Promise<void> {
  try {
    await db.rpc("refund_ask", { target_month: tallyMonth(today) });
  } catch {
    // One question worse off beats an error on a press.
  }
}

/** The month's questions so far. */
export async function questionsAsked(
  db: Db,
  userId: string,
  today: string,
): Promise<number> {
  const { data, error } = await db
    .from("ask_tallies")
    .select("questions")
    .eq("user_id", userId)
    .eq("month", tallyMonth(today))
    .maybeSingle();
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return 0;
    }
    throw error;
  }
  return data?.questions ?? 0;
}

/* ---------------------------------------------------------- the spending */

/**
 * What each category spent each month, over a span of days: totals only,
 * for Ask Pluclair's spending family. Expense categories that count toward
 * the summary, as the spending figures elsewhere.
 */
export async function readSpendingByMonth(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<
  { monthKey: string; categoryId: string; category: string; total: number }[]
> {
  const rows = await allRows((start, end) =>
    db
      .from("transactions")
      .select(
        "occurred_on, amount, category_id, categories!inner(name, type, counts_toward_summary)",
      )
      .eq("user_id", userId)
      .eq("categories.type", "expense")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("id")
      .range(start, end),
  );
  const totals = new Map<
    string,
    { monthKey: string; categoryId: string; category: string; total: number }
  >();
  for (const row of rows) {
    if (row.categories.counts_toward_summary === false) {
      continue;
    }
    const monthKey = row.occurred_on.slice(0, 7);
    const key = `${monthKey}|${row.category_id}`;
    const entry = totals.get(key) ?? {
      monthKey,
      categoryId: row.category_id,
      category: row.categories.name,
      total: 0,
    };
    entry.total += Number(row.amount);
    totals.set(key, entry);
  }
  return [...totals.values()];
}

/** Income recorded over a span of days, as the month figures count it. */
export async function readIncomeTotal(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<number> {
  const rows = await allRows((start, end) =>
    db
      .from("transactions")
      .select("amount, categories!inner(type, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("categories.type", "income")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("id")
      .range(start, end),
  );
  return rows
    .filter((row) => row.categories.counts_toward_summary !== false)
    .reduce((sum, row) => sum + Number(row.amount), 0);
}
