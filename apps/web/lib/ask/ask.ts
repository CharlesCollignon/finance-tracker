import "server-only";
import {
  ASK_QUESTIONS_PER_MONTH,
  askTitle,
  buildAskAnswerRequest,
  buildAskPlanRequest,
  MAX_ASK_QUESTION,
  verifyAskAnswer,
  verifyAskPlan,
  type AskAnswerBody,
} from "@finance/core/ask";
import { formatCurrency, todayIsoLocal } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  questionsAsked,
  recordExchange,
  refundQuestion,
  reserveQuestion,
} from "@finance/data/ask";
import type { Db } from "@finance/data/client";
import { searchAllMonths } from "@finance/data/ledger-search";
import { readSource, type ReadSource } from "@/lib/ai/read-source";
import { ACCOUNT_ALLOWANCE, writerFor } from "@/lib/ai/writer";
import { gatherAskFacts } from "@/lib/ask/facts";
import { ASK_ANSWER_SOURCE, ASK_PLAN_SOURCE } from "@/lib/ask/client";

/** How many rows a search answer lists. */
const SEARCH_ROWS = 10;

export interface AskOutcome {
  /** The conversation the exchange was written into, or null if none was. */
  conversationId: string | null;
  /** What to say instead of an answer, when there is none. */
  message: string | null;
  /** Questions left this month on Pluclair's key; null on one's own account. */
  questionsLeft: number | null;
}

/**
 * One question, asked and answered (`@finance/core/ask`).
 *
 * The month's count is taken before the model is asked and handed back when
 * it could not be reached; an answer that came back and was thrown away was
 * paid for and stays counted. Every answer that is shown is stored, with the
 * figures it was written from.
 *
 * Always the person's own money, under « Commun » too: a space has no
 * conversations to begin with.
 */
export async function askQuestion(
  db: Db,
  userId: string,
  {
    question,
    conversationId,
    locale,
  }: { question: string; conversationId: string | null; locale: Locale },
): Promise<AskOutcome> {
  const t = translator(locale);
  const text = question.trim();
  const today = todayIsoLocal();
  if (text.length === 0 || text.length > MAX_ASK_QUESTION) {
    return {
      conversationId,
      message: t("ask.tooLong", { max: MAX_ASK_QUESTION }),
      questionsLeft: null,
    };
  }

  const { writer, account } = await writerFor(userId, db);
  if (!writer) {
    return {
      conversationId,
      message: account ? t("aiAccount.connectFirst") : t("ask.noWriter"),
      questionsLeft: null,
    };
  }
  const allowance = account ? ACCOUNT_ALLOWANCE : ASK_QUESTIONS_PER_MONTH;
  const left = (asked: number) =>
    account ? null : Math.max(0, allowance - asked);

  const taken = await reserveQuestion(db, today, allowance);
  if (taken === null) {
    const asked = await questionsAsked(db, userId, today);
    return {
      conversationId,
      message: asked >= allowance ? t("ask.none") : t("ask.noWriter"),
      questionsLeft: left(asked),
    };
  }

  // Why no answer came, in the person's words: a busy service, a key or a
  // model refused, an account out of credit — or just none right now.
  const unanswered = (source: ReadSource): string => {
    switch (source.failure()) {
      case "busy":
        return t("ask.busy");
      case "refused":
        return account ? t("ask.accountRefused") : t("ask.keyRefused");
      case "no-credit":
        return t("ask.noCredit");
      default:
        return t("ask.noAnswer");
    }
  };

  const planSource = readSource(ASK_PLAN_SOURCE, writer);
  const planned = await planSource.write(buildAskPlanRequest(text, locale));
  if (planned === null) {
    // Never answered: nothing was spent, so the question is handed back.
    await refundQuestion(db, today);
    return {
      conversationId,
      message: unanswered(planSource),
      questionsLeft: left(taken - 1),
    };
  }
  const plan = verifyAskPlan(planned);
  if (!plan) {
    return {
      conversationId,
      message: t("ask.unusable"),
      questionsLeft: left(taken),
    };
  }

  let answer: AskAnswerBody;
  if (plan.kind === "outside") {
    answer = { kind: "outside", advice: plan.advice, locale };
  } else if (plan.kind === "search" && plan.search) {
    // A shop is the search's to answer: the rows themselves, and the app's
    // own sum of them.
    const found = await searchAllMonths(db, userId, plan.search);
    const signed = found.rows.map((row) => ({
      occurredOn: row.occurred_on,
      note: row.note ?? row.categories.name,
      category: row.categories.name,
      amount:
        row.categories.type === "income"
          ? Number(row.amount)
          : -Number(row.amount),
    }));
    answer = {
      kind: "search",
      query: plan.search,
      rows: signed.slice(0, SEARCH_ROWS),
      count: signed.length,
      spent:
        Math.round(-signed.reduce((sum, row) => sum + row.amount, 0) * 100) /
        100,
      more: found.more || signed.length > SEARCH_ROWS,
      locale,
    };
  } else {
    const facts = await gatherAskFacts(db, userId, plan.tools, {
      today,
      locale,
    });
    if (facts.length === 0) {
      answer = { kind: "empty", advice: plan.advice, locale };
    } else {
      const answerSource = readSource(ASK_ANSWER_SOURCE, writer);
      const raw = await answerSource.write(
        buildAskAnswerRequest(
          text,
          { facts },
          {
            // Nothing the model formats reaches a screen; the reader's
            // currency is applied when the answer is drawn.
            money: (amount) => formatCurrency(amount, "EUR", locale),
            locale,
            advice: plan.advice,
          },
        ),
      );
      if (raw === null) {
        await refundQuestion(db, today);
        return {
          conversationId,
          message: unanswered(answerSource),
          questionsLeft: left(taken - 1),
        };
      }
      const verdict = verifyAskAnswer(raw, { facts });
      if (!verdict.ok) {
        return {
          conversationId,
          message: t("ask.unusable"),
          questionsLeft: left(taken),
        };
      }
      answer = {
        kind: "facts",
        sentences: verdict.sentences,
        facts,
        advice: plan.advice,
        locale,
        model: writer.model,
      };
    }
  }

  const id = await recordExchange(db, userId, {
    conversationId,
    title: askTitle(text),
    question: { text },
    answer,
  });
  return { conversationId: id, message: null, questionsLeft: left(taken) };
}
