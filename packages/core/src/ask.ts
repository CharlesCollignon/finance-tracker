import type { AskChatBody } from "./ask-chat";
import { type Locale } from "./i18n/locale";
import { type MonthFact } from "./month-facts";
import { factSegments, type ReadSegment } from "./month-read";

/**
 * Ask Pluclair (`docs/plans/EVERYDAY_PLAN.md`, phase 7): a question about
 * one's own money, and what a conversation keeps of it.
 *
 * Since 2026-10-10 a question is answered as a conversation
 * (`./ask-chat`). The first version's answers — sentences with `{{fact:id}}`
 * holes the app filled, or a search's rows — stay drawable for the thirty
 * days a conversation is kept, so their shapes are here with the
 * conversation's own.
 *
 * Pure and free of any secret: bundled into the phone with the rest of core.
 */

/** Longest question taken, as typed. */
export const MAX_ASK_QUESTION = 1000;

/** How long a conversation is kept (migration 064). */
export const ASK_KEEP_DAYS = 30;

/** One row of a search answer: the app's words and the app's figures. */
export interface AskSearchRow {
  occurredOn: string;
  note: string;
  category: string;
  /** Signed: money out is negative. */
  amount: number;
}

/**
 * What an answer is, as stored (`ask_messages.body`) and drawn: a
 * conversation's answer (`chat`), or one of the first version's, which
 * carried the figures they were written from.
 */
export type AskAnswerBody =
  | AskChatBody
  | {
      kind: "facts";
      sentences: string[];
      facts: MonthFact[];
      /** The question asked what to do: the answer said Pluclair does not. */
      advice: boolean;
      locale: Locale;
      model: string;
    }
  | {
      kind: "search";
      query: string;
      rows: AskSearchRow[];
      /** Every row found, beyond the ones listed. */
      count: number;
      /** What the rows found moved, out less in. */
      spent: number;
      more: boolean;
      locale: Locale;
    }
  | {
      kind: "outside" | "empty";
      advice: boolean;
      locale: Locale;
    };

export interface AskQuestionBody {
  text: string;
}

/** A first-version answer's sentences, with their figures written in. */
export function renderAskSentences(
  body: Extract<AskAnswerBody, { kind: "facts" }>,
  formatMoney: (amount: number) => string,
): ReadSegment[][] {
  return body.sentences
    .map((sentence) =>
      factSegments(sentence, { facts: body.facts }, formatMoney, body.locale),
    )
    .filter((segments): segments is ReadSegment[] => segments !== null);
}

/** A conversation's title: its first question, short enough for a list. */
export function askTitle(question: string): string {
  const flat = question.replace(/\s+/g, " ").trim();
  return flat.length <= 80 ? flat : `${flat.slice(0, 79).trimEnd()}…`;
}
