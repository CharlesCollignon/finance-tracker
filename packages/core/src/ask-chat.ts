import { z } from "zod";

import {
  renderAskSentences,
  type AskAnswerBody,
  type AskQuestionBody,
} from "./ask";
import { type Locale } from "./i18n/locale";

/**
 * Ask Pluclair as a conversation (2026-10-10): the model reads the question
 * with the conversation so far, asks the app for what it needs through
 * tools — as many as it needs, in as many rounds — and writes its answer in
 * Markdown, as long as the question deserves.
 *
 * What changed from the first version (`./ask`), at the owner's call: the
 * model writes its own figures and the app checks them afterwards
 * (`./ask-figures`) instead of forbidding them; it may explain, compare,
 * simulate, give rules of thumb and budgeting tips — tiers 0 to 3 of
 * `docs/plans/PLUCLAIR_UPGRADE_PLAN.md` — but never a product, a fund or an
 * allocation, which French law reserves to a licensed adviser; and a tool
 * may hand over single entries when the question is about them.
 *
 * Pure and free of any secret: the tools are described here and run on the
 * web's server (`apps/web/lib/ask/tools.ts`).
 */

/** Rounds of tools before the model must answer with what it has. */
export const MAX_ASK_ROUNDS = 6;

/** Earlier exchanges the model reads with a question. */
const HISTORY_EXCHANGES = 8;

/** Most entries one call to `transactions` hands over. */
export const MAX_ASK_ROWS = 50;

const MONTH = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .describe("A month, YYYY-MM.");
const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("A day, YYYY-MM-DD.");

/**
 * What the model may call, by name: each one's purpose for the model, and
 * the arguments it takes. Every amount a tool returns is in the reader's
 * currency; a rate is a percentage (3.5 for 3.5 %).
 */
export const ASK_CHAT_TOOLS = {
  month: {
    description:
      "One month at a glance: income and spending recorded, spending compared with the previous month at the same point, the top spending categories, the account balance today and its lowest point ahead, what is left to spend until the next pay day, and the charges still to come. Defaults to the month in progress.",
    args: z.object({ month: MONTH.optional() }).strict(),
  },
  cashflow: {
    description:
      "Month by month over a span: income, spending, what was saved or invested, and the net (income minus spending). Defaults to the last 12 months; at most 36.",
    args: z.object({ from: MONTH.optional(), to: MONTH.optional() }).strict(),
  },
  categories: {
    description:
      "Spending by category over a span, largest first, with each category's share and monthly average. With `category`, that category month by month instead. Defaults to the last 3 months.",
    args: z
      .object({
        from: MONTH.optional(),
        to: MONTH.optional(),
        category: z
          .string()
          .max(60)
          .optional()
          .describe("Part of a category's name, to follow it month by month."),
      })
      .strict(),
  },
  transactions: {
    description: `Single entries of the ledger: date, label (where the bank puts the shop or payee), category and signed amount (money out is negative), with how many matched and their total. Filter by words in the label, a category, dates, amounts or kind; sort by date or by size. At most ${MAX_ASK_ROWS}.`,
    args: z
      .object({
        query: z
          .string()
          .max(60)
          .optional()
          .describe("Words in the label: a shop, a payee, a subscription."),
        category: z
          .string()
          .max(60)
          .optional()
          .describe("Part of a category's name."),
        from: DAY.optional(),
        to: DAY.optional(),
        min: z.number().optional().describe("Smallest amount, unsigned."),
        max: z.number().optional().describe("Largest amount, unsigned."),
        kind: z
          .enum(["expense", "income", "savings", "investment", "all"])
          .optional()
          .describe("Defaults to all."),
        sort: z
          .enum(["recent", "largest"])
          .optional()
          .describe("Defaults to recent."),
        limit: z.number().int().min(1).max(MAX_ASK_ROWS).optional(),
      })
      .strict(),
  },
  merchants: {
    description:
      "Where spending goes by shop or payee over a span, largest first: each one's total, number of payments and last date. Defaults to the last 3 months.",
    args: z
      .object({
        from: MONTH.optional(),
        to: MONTH.optional(),
        limit: z.number().int().min(1).max(30).optional(),
      })
      .strict(),
  },
  recurring: {
    description:
      "The recurring entries the person declared — salary, rent, subscriptions, loans, transfers to savings or investments: each one's amount, rhythm, monthly equivalent and next date, and the monthly totals in and out.",
    args: z.object({}).strict(),
  },
  savings: {
    description:
      "The savings accounts (Livret A, LDDS, LEP, PEL…): each one's balance, its regulated rate and ceiling, and how many months of fixed costs the money at hand covers.",
    args: z.object({}).strict(),
  },
  investments: {
    description:
      "The investment accounts (PEA, CTO, life insurance, PER, crypto): each one's value today, what went in, the gain and its percentage, and the largest holdings.",
    args: z.object({}).strict(),
  },
  loans: {
    description:
      "Each loan: what is left to repay, the rate, the monthly payment with insurance, the interest still to pay, the months left and the end date. Each carries an id for `loan_prepayment`.",
    args: z.object({}).strict(),
  },
  loan_prepayment: {
    description:
      "What repaying part of a loan early would change, from its real schedule: the interest saved, and either the new end date (same monthly payment) or the new monthly payment (same end date). Early-repayment fees are not counted.",
    args: z
      .object({
        loan_id: z.string().describe("The id `loans` gave."),
        amount: z.number().positive().describe("The sum repaid early."),
        keep: z
          .enum(["payment", "term"])
          .optional()
          .describe(
            "payment: same monthly payment, ends sooner (default). term: same end date, lower payment.",
          ),
      })
      .strict(),
  },
  calculate: {
    description:
      "Arithmetic, exactly: + - * / % ^, parentheses, round(x, digits), min, max, abs, sqrt. Use it for every sum, difference, average, percentage or projection instead of computing in your head. Decimals with a point.",
    args: z
      .object({
        expression: z
          .string()
          .max(400)
          .describe("For example (1234.56 - 980) / 980 * 100"),
      })
      .strict(),
  },
} as const;

export type AskChatTool = keyof typeof ASK_CHAT_TOOLS;

export const ASK_CHAT_TOOL_NAMES = Object.keys(ASK_CHAT_TOOLS) as AskChatTool[];

/** The tools as a chat completion's `tools` takes them. */
export function askChatToolDefinitions() {
  return ASK_CHAT_TOOL_NAMES.map((name) => {
    const { $schema: _schema, ...parameters } = z.toJSONSchema(
      ASK_CHAT_TOOLS[name].args,
      { io: "input" },
    ) as Record<string, unknown>;
    return {
      type: "function" as const,
      function: {
        name,
        description: ASK_CHAT_TOOLS[name].description,
        parameters,
      },
    };
  });
}

export function isAskChatTool(name: string): name is AskChatTool {
  return Object.hasOwn(ASK_CHAT_TOOLS, name);
}

/**
 * A call's arguments as the tool will take them, or null: the model sends
 * them as a JSON string, sometimes empty for a tool that takes none.
 */
export function readToolArgs<T extends AskChatTool>(
  name: T,
  raw: string,
): z.infer<(typeof ASK_CHAT_TOOLS)[T]["args"]> | null {
  let value: unknown;
  try {
    value = raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = ASK_CHAT_TOOLS[name].args.safeParse(value);
  return parsed.success
    ? (parsed.data as z.infer<(typeof ASK_CHAT_TOOLS)[T]["args"]>)
    : null;
}

/* ---------------------------------------------------------------- the body */

/** One tool the answer drew on, for the screen's « what was looked at ». */
export interface AskChatStep {
  tool: AskChatTool;
  /** Whether the tool gave something back. */
  ok: boolean;
}

/** An answer as the conversation keeps it (`ask_messages.body`). */
export interface AskChatBody {
  kind: "chat";
  markdown: string;
  steps: AskChatStep[];
  /** Figures the app found in nothing it handed over (`untracedFigures`). */
  untraced: string[];
  locale: Locale;
  model: string;
}

/** What the screen is told while a question is answered, a line each. */
export type AskStreamEvent =
  | { type: "step"; tool: AskChatTool }
  | { type: "text"; text: string }
  /** The words so far were the model thinking aloud before a tool: gone. */
  | { type: "reset" }
  | { type: "done"; conversationId: string }
  | { type: "error"; message: string };

/* ------------------------------------------------------------- the history */

export interface AskChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The conversation so far as the model reads it: the last few exchanges,
 * each answer as it was shown. Answers from the first version are written
 * out in words, their figures filled in.
 */
export function askChatHistory(
  messages: readonly (
    | { role: "question"; body: AskQuestionBody }
    | { role: "answer"; body: AskAnswerBody }
  )[],
  formatMoney: (amount: number) => string,
): AskChatTurn[] {
  const turns: AskChatTurn[] = messages.map((message) =>
    message.role === "question"
      ? { role: "user", content: message.body.text }
      : { role: "assistant", content: answerText(message.body, formatMoney) },
  );
  // Whole exchanges only, so the history never opens on an answer.
  const kept = turns.slice(-HISTORY_EXCHANGES * 2);
  return kept[0]?.role === "assistant" ? kept.slice(1) : kept;
}

function answerText(
  body: AskAnswerBody,
  formatMoney: (amount: number) => string,
): string {
  switch (body.kind) {
    case "chat":
      return body.markdown;
    case "facts":
      return renderAskSentences(body, formatMoney)
        .map((segments) =>
          segments
            .map((segment) =>
              segment.kind === "text" ? segment.text : segment.display,
            )
            .join(""),
        )
        .join(" ");
    case "search":
      return `${body.count} × « ${body.query} » : ${formatMoney(body.spent)}`;
    case "outside":
    case "empty":
      return "…";
  }
}

/* -------------------------------------------------------------- the prompt */

/** What the model is told before the conversation. */
export function askChatSystem({
  locale,
  today,
  currency,
}: {
  locale: Locale;
  /** YYYY-MM-DD. */
  today: string;
  /** The reader's currency code: amounts are written in it. */
  currency: string;
}): string {
  const text = SYSTEM[locale];
  return [
    text.intro,
    "",
    text.today(today, currency),
    "",
    text.dataHeading,
    ...text.data.map((line) => `- ${line}`),
    "",
    text.answerHeading,
    ...text.answer.map((line) => `- ${line}`),
    "",
    text.limitsHeading,
    ...text.limits.map((line) => `- ${line}`),
  ].join("\n");
}

interface SystemPrompt {
  intro: string;
  today: (today: string, currency: string) => string;
  dataHeading: string;
  data: string[];
  answerHeading: string;
  answer: string[];
  limitsHeading: string;
  limits: string[];
}

const SYSTEM: Record<Locale, SystemPrompt> = {
  fr: {
    intro:
      "Vous êtes l'assistant de Pluclair, une application française de finances personnelles. Vous parlez avec une personne de son propre argent, en français et en la vouvoyant, comme un ami calé en finances : clair, précis, chaleureux, sans jargon inutile.",
    today: (today, currency) =>
      `Aujourd'hui : ${today}. Les montants sont en ${currency}.`,
    dataHeading: "Les données",
    data: [
      "Vous ne connaissez de son argent que ce que les outils vous rendent. Avant de répondre à une question sur ses chiffres, appelez ceux qu'il faut — plusieurs, et en même temps quand c'est possible. N'inventez jamais un chiffre, une opération ou un compte.",
      "Appelez les outils sans écrire de texte avant : la réponse vient une fois les chiffres en main.",
      "Pour tout calcul — somme, écart, moyenne, pourcentage, projection —, utilisez l'outil calculate plutôt que de calculer de tête.",
      "Si un outil ne rend rien, dites simplement que l'application ne contient pas encore ce qu'il faudrait, et ce que la personne pourrait y ajouter.",
      "Dans les opérations, une sortie est négative ; dans les totaux de dépenses, elle est positive.",
    ],
    answerHeading: "La réponse",
    answer: [
      "Commencez par la réponse elle-même, en une ou deux phrases. Développez ensuite autant que la question le mérite : le contexte, la comparaison avec les mois précédents, ce qui ressort, ce qui l'explique.",
      "Une question simple appelle une réponse courte ; une question d'analyse, une vraie analyse.",
      "Écrivez en Markdown : des intertitres ### courts quand la réponse est longue, des listes, du **gras** pour les chiffres clés, un tableau pour comparer plusieurs mois ou catégories. Pas de lien, pas d'image.",
      "Écrivez les montants à la française, « 1 234,56 € », et les pourcentages « 12,5 % ».",
      "Quand c'est utile, terminez par une question que la personne pourrait poser ensuite.",
    ],
    limitsHeading: "Ce que vous pouvez dire, et ce que vous ne dites pas",
    limits: [
      "Vous pouvez expliquer, comparer, simuler (« avec 100 € de plus par mois… »), donner des repères généraux présentés comme tels (« on garde souvent 3 à 6 mois de dépenses de côté »), et proposer des pistes concrètes sur le budget et l'épargne : réduire une catégorie, revoir un abonnement, mettre de côté chaque mois.",
      "Vous ne recommandez jamais un produit, un fonds, une action, un contrat, une banque ou un courtier précis, ni une répartition de placements personnalisée (« mettez 60 % en actions ») : c'est du conseil en investissement, réservé en France aux conseillers agréés. Si on vous le demande, donnez les éléments à peser et les chiffres qui comptent, et dites que le choix du produit revient à la personne ou à un conseiller agréé.",
      "Pas de conseil fiscal ou juridique personnalisé : vous pouvez rappeler une règle générale (plafond du Livret A, fiscalité d'un PEA de plus de 5 ans) en précisant qu'elle peut changer.",
      "Pour un remboursement anticipé de prêt, rappelez que la banque peut demander des indemnités : en France, au plus le plus faible de 6 mois d'intérêts sur la somme remboursée et de 3 % du capital restant dû.",
      "Si la question ne porte pas sur l'argent, répondez en une phrase et dites ce que vous savez faire.",
    ],
  },
  en: {
    intro:
      "You are the assistant in Pluclair, a French personal finance app. You talk with someone about their own money, in English, like a friend who knows finance well: clear, precise, warm, no needless jargon.",
    today: (today, currency) => `Today: ${today}. Amounts are in ${currency}.`,
    dataHeading: "The data",
    data: [
      "All you know of their money is what the tools return. Before answering a question about their figures, call the tools it needs — several, and at once where you can. Never invent a figure, an entry or an account.",
      "Call tools without writing text first: the answer comes once the figures are in hand.",
      "For every calculation — a sum, a difference, an average, a percentage, a projection — use the calculate tool instead of working it out in your head.",
      "If a tool returns nothing, say plainly that the app does not hold what it would take yet, and what the person could add.",
      "In entries, money out is negative; in spending totals, it is positive.",
    ],
    answerHeading: "The answer",
    answer: [
      "Start with the answer itself, in a sentence or two. Then go as deep as the question deserves: the context, how it compares with earlier months, what stands out, what explains it.",
      "A simple question gets a short answer; an analytical one gets a real analysis.",
      "Write in Markdown: short ### subheadings when the answer is long, lists, **bold** for the key figures, a table to compare several months or categories. No links, no images.",
      "Write amounts like « €1,234.56 » and percentages like « 12.5% ».",
      "Where it helps, end with a question the person might ask next.",
    ],
    limitsHeading: "What you may say, and what you don't",
    limits: [
      "You may explain, compare, simulate (« with €100 more a month… »), give general rules of thumb presented as such (« a common buffer is 3 to 6 months of spending »), and suggest concrete budgeting and saving steps: trimming a category, reviewing a subscription, setting money aside each month.",
      "You never recommend a specific product, fund, share, contract, bank or broker, nor a personal asset allocation (« put 60% in equities »): that is investment advice, which French law reserves to licensed advisers. If asked, set out what to weigh and the figures that matter, and say the choice of product is the person's or a licensed adviser's.",
      "No personal tax or legal advice: you may recall a general rule (the Livret A ceiling, how a PEA held over 5 years is taxed), noting it can change.",
      "For an early loan repayment, mention that the bank may charge a fee: in France, at most the lower of 6 months' interest on the sum repaid and 3% of the capital outstanding.",
      "If the question is not about money, answer in one sentence and say what you can do.",
    ],
  },
};
