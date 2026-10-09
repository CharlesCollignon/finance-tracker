import { z } from "zod";

import { type Locale } from "./i18n/locale";
import { findFact, type FactPack, type MonthFact } from "./month-facts";
import {
  citedIds,
  factSegments,
  visibleLength,
  writesAFigure,
  type ReadSegment,
} from "./month-read";
import { factLines } from "./month-read-prompt";

/**
 * Ask Pluclair (`docs/plans/EVERYDAY_PLAN.md`, phase 7): a question about
 * one's own money, answered in a few sentences whose every figure is the
 * app's.
 *
 * Two asks of the model, and the app in between. First the model reads the
 * question and says what it needs — some of the six families below, or the
 * search when the question is about a shop, or nothing when it is about
 * something else. Then the app gathers those figures, aggregates only, and
 * the model writes its answer with `{{fact:id}}` holes the app fills in, as
 * the month read does. A sentence that writes a number of its own, cites a
 * figure it was not given, or tells the person what to do is dropped before
 * anything is shown.
 *
 * Pure and free of any secret: bundled into the phone with the rest of core.
 */

/* --------------------------------------------------------------- the tools */

/**
 * What the model may ask for, by name. Each is a family of figures the app
 * computes and the prompt lists; none is a row of the ledger, and none
 * carries a shop.
 */
export const ASK_TOOLS = [
  /** The month in progress: what came in, went out, is left. */
  "month",
  /** Spending by month and by category, the last twelve months. */
  "spending",
  /** The recurring entries: each one's amount, and what they add up to. */
  "charges",
  /** What is set aside, and how many months of fixed costs it covers. */
  "cushion",
  /** Each investment account: what it is worth, what went in. */
  "wallets",
  /** Each loan: what is left to repay, its rate, its payment, its cost. */
  "loans",
] as const;

export type AskTool = (typeof ASK_TOOLS)[number];

/** How many families one question may draw on. */
export const MAX_ASK_TOOLS = 3;

/** Longest question taken, as typed. */
export const MAX_ASK_QUESTION = 300;

/** How long a conversation is kept (migration 064). */
export const ASK_KEEP_DAYS = 30;

/** Sentences an answer may hold. */
export const MAX_ASK_SENTENCES = 4;

/** Longest sentence, as a reader sees it. */
const MAX_SENTENCE_LENGTH = 320;

/* ---------------------------------------------------------------- the plan */

export const askPlanSchema = z.object({
  kind: z.enum(["facts", "search", "outside"]),
  tools: z.array(z.enum(ASK_TOOLS)),
  search: z.string(),
  advice: z.boolean(),
});

export interface AskPlan {
  kind: "facts" | "search" | "outside";
  tools: AskTool[];
  /** The shop or payee to look for; null unless `kind` is search. */
  search: string | null;
  advice: boolean;
}

/** The plan's response format, in the request's own language. */
export function askPlanJsonSchema(locale: Locale) {
  const words = PLAN_SCHEMA_WORDS[locale];
  return {
    type: "json_schema",
    json_schema: {
      name: "ask_plan",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "tools", "search", "advice"],
        properties: {
          kind: {
            type: "string",
            enum: ["facts", "search", "outside"],
            description: words.kind,
          },
          tools: {
            type: "array",
            items: { type: "string", enum: [...ASK_TOOLS] },
            description: words.tools,
          },
          search: { type: "string", description: words.search },
          advice: { type: "boolean", description: words.advice },
        },
      },
    },
  };
}

/**
 * The plan as the app will act on it, or null when it is not one: the tools
 * deduplicated and capped, a search kept only with words to search for.
 */
export function verifyAskPlan(raw: unknown): AskPlan | null {
  const parsed = askPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const plan = parsed.data;
  const search = plan.search.trim().slice(0, 60) || null;
  if (plan.kind === "search" && !search) {
    return null;
  }
  return {
    ...plan,
    tools: [...new Set(plan.tools)].slice(0, MAX_ASK_TOOLS),
    search: plan.kind === "search" ? search : null,
  };
}

/* -------------------------------------------------------------- the answer */

export const askAnswerSchema = z.object({
  sentences: z
    .array(z.object({ text: z.string(), basis: z.array(z.string()) }))
    .max(24),
});

export function askAnswerJsonSchema(locale: Locale) {
  const words = ANSWER_SCHEMA_WORDS[locale];
  return {
    type: "json_schema",
    json_schema: {
      name: "ask_answer",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["sentences"],
        properties: {
          sentences: {
            type: "array",
            description: words.sentences,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "basis"],
              properties: {
                text: { type: "string", description: words.text },
                basis: {
                  type: "array",
                  items: { type: "string" },
                  description: words.basis,
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Sentences that tell a person what to do with their money, in either
 * language. Pluclair states facts and does not advise: what a sentence like
 * these says is dropped, whatever figures it carries, and the answer to a
 * question asking for advice ends with a line saying so.
 *
 * A net rather than a proof, like the figure check: a model can advise in
 * words no pattern foresaw. The prompt forbids it first; this catches the
 * phrasings models actually reach for.
 */
const ADVICE = [
  /\bvous devriez\b/i,
  /\bvous pourriez (?:envisager|songer|penser)\b/i,
  /\bje (?:vous )?(?:conseille|recommande|suggère|déconseille)\b/i,
  /\bnous (?:vous )?(?:conseillons|recommandons|suggérons)\b/i,
  /\bil (?:vous )?(?:faudrait|faut que vous)\b/i,
  /\b(?:mieux vaut|il vaut mieux|il serait (?:sage|judicieux|préférable))\b/i,
  /\bil est (?:préférable|conseillé|recommandé|judicieux)\b/i,
  /\bmon conseil\b/i,
  /\byou should\b/i,
  /\byou (?:might|could) (?:want to|consider)\b/i,
  /\bI (?:would )?(?:recommend|suggest|advise)\b/i,
  /\bwe (?:recommend|suggest|advise)\b/i,
  /\bit (?:would be|is) (?:better|wise|advisable|best)\b/i,
  /\bmy advice\b/i,
  /\b(?:consider|try) (?:paying|investing|selling|buying|repaying|moving)\b/i,
];

/** Whether a sentence tells the person what to do. */
export function givesAdvice(text: string): boolean {
  return ADVICE.some((pattern) => pattern.test(text));
}

export type AskVerdict =
  | { ok: true; sentences: string[]; dropped: number }
  | { ok: false; reason: "shape" | "nothing-left" };

/**
 * The answer as it may be shown: each sentence citing only figures it was
 * given, writing none of its own, advising nothing, within a card's length.
 * A sentence that fails is dropped and the rest kept; none left, and there
 * is no answer.
 */
export function verifyAskAnswer(raw: unknown, pack: FactPack): AskVerdict {
  const parsed = askAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "shape" };
  }
  const kept: string[] = [];
  let dropped = 0;
  for (const sentence of parsed.data.sentences) {
    const text = sentence.text.trim();
    const cited = citedIds(text);
    const honest =
      text.length > 0 &&
      cited.every((id) => findFact(pack, id) !== null) &&
      !writesAFigure(text) &&
      !givesAdvice(text) &&
      visibleLength(text) <= MAX_SENTENCE_LENGTH;
    if (honest && kept.length < MAX_ASK_SENTENCES) {
      kept.push(text);
    } else {
      dropped += 1;
    }
  }
  return kept.length > 0
    ? { ok: true, sentences: kept, dropped }
    : { ok: false, reason: "nothing-left" };
}

/* ------------------------------------------------------------ what is kept */

/** One row of a search answer: the app's words and the app's figures. */
export interface AskSearchRow {
  occurredOn: string;
  note: string;
  category: string;
  /** Signed: money out is negative. */
  amount: number;
}

/**
 * What an answer is, as stored (`ask_messages.body`) and drawn. The figures
 * travel with the sentences: an answer is a moment of a conversation, read
 * against the figures it was written from.
 */
export type AskAnswerBody =
  | {
      kind: "facts";
      sentences: string[];
      facts: MonthFact[];
      /** The question asked what to do: the answer says Pluclair does not. */
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

/** An answer's sentences, with their figures written in. */
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

/* ------------------------------------------------------------- the figures */

/** A month as the spending family names it. */
export interface AskMonth {
  /** YYYY-MM. */
  key: string;
  /** « mars 2026 ». */
  label: string;
}

/** How many categories the spending family names, by what they spent. */
const SPENDING_CATEGORIES = 8;

/**
 * Spending by month, and by category for the largest few: totals only, the
 * twelve months asked for, in the app's words.
 */
export function spendingFacts(
  months: readonly AskMonth[],
  rows: readonly {
    monthKey: string;
    categoryId: string;
    category: string;
    total: number;
  }[],
  words: {
    total: (month: string) => string;
    category: (name: string, month: string) => string;
  },
): MonthFact[] {
  const byCategory = new Map<string, { name: string; total: number }>();
  for (const row of rows) {
    const entry = byCategory.get(row.categoryId) ?? {
      name: row.category,
      total: 0,
    };
    entry.total += row.total;
    byCategory.set(row.categoryId, entry);
  }
  const named = new Set(
    [...byCategory.entries()]
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, SPENDING_CATEGORIES)
      .map(([id]) => id),
  );

  const facts: MonthFact[] = [];
  for (const month of months) {
    const inMonth = rows.filter((row) => row.monthKey === month.key);
    facts.push({
      id: `spent:${month.key}`,
      label: words.total(month.label),
      unit: "money",
      value: round(inMonth.reduce((sum, row) => sum + row.total, 0)),
      sense: "up-is-bad",
    });
    for (const row of inMonth) {
      if (named.has(row.categoryId) && row.total > 0) {
        facts.push({
          id: `spent:${month.key}:${row.categoryId}`,
          label: words.category(row.category, month.label),
          unit: "money",
          value: round(row.total),
          sense: "up-is-bad",
        });
      }
    }
  }
  return facts;
}

/** The recurring entries, each at its monthly amount, and their sums. */
export function chargeFacts(
  charges: readonly {
    id: string;
    name: string;
    /** What it comes to in a month, whatever its rhythm. */
    monthly: number;
    income: boolean;
  }[],
  words: {
    charge: (name: string) => string;
    out: string;
    in: string;
  },
): MonthFact[] {
  const facts: MonthFact[] = charges.map((charge) => ({
    id: `charge:${charge.id}`,
    label: words.charge(charge.name),
    unit: "money",
    value: round(charge.monthly),
    sense: charge.income ? "up-is-good" : "up-is-bad",
  }));
  facts.push(
    {
      id: "charges-out",
      label: words.out,
      unit: "money",
      value: round(
        charges
          .filter((charge) => !charge.income)
          .reduce((sum, charge) => sum + charge.monthly, 0),
      ),
      sense: "up-is-bad",
    },
    {
      id: "charges-in",
      label: words.in,
      unit: "money",
      value: round(
        charges
          .filter((charge) => charge.income)
          .reduce((sum, charge) => sum + charge.monthly, 0),
      ),
      sense: "up-is-good",
    },
  );
  return facts;
}

/** What is set aside, and the months of fixed costs it covers. */
export function cushionFacts(
  savings: number,
  monthlyFixed: number,
  words: { savings: string; months: string },
): MonthFact[] {
  const facts: MonthFact[] = [
    {
      id: "savings",
      label: words.savings,
      unit: "money",
      value: round(savings),
      sense: "up-is-good",
    },
  ];
  if (monthlyFixed > 0) {
    facts.push({
      id: "cushion-months",
      label: words.months,
      unit: "months",
      value: Math.round((savings / monthlyFixed) * 10) / 10,
      sense: "up-is-good",
    });
  }
  return facts;
}

/** Each investment account: what it is worth and what went into it. */
export function walletFacts(
  wallets: readonly {
    id: string;
    name: string;
    value: number;
    invested: number;
  }[],
  words: {
    value: (name: string) => string;
    invested: (name: string) => string;
    total: string;
  },
): MonthFact[] {
  const facts: MonthFact[] = [];
  for (const wallet of wallets) {
    facts.push(
      {
        id: `wallet:${wallet.id}`,
        label: words.value(wallet.name),
        unit: "money",
        value: round(wallet.value),
        sense: "up-is-good",
      },
      {
        id: `wallet:${wallet.id}:invested`,
        label: words.invested(wallet.name),
        unit: "money",
        value: round(wallet.invested),
        sense: "neutral",
      },
    );
  }
  facts.push({
    id: "wallets",
    label: words.total,
    unit: "money",
    value: round(wallets.reduce((sum, wallet) => sum + wallet.value, 0)),
    sense: "up-is-good",
  });
  return facts;
}

/**
 * Each loan: what is left to repay, its rate, its payment, the interest
 * still to pay, the months left. What a question about repaying early needs
 * to be answered with facts rather than a recommendation.
 */
export function loanFacts(
  loans: readonly {
    id: string;
    name: string;
    owed: number;
    /** Percent a year. */
    rate: number;
    monthly: number;
    interestLeft: number;
    monthsLeft: number;
  }[],
  words: {
    owed: (name: string) => string;
    rate: (name: string) => string;
    monthly: (name: string) => string;
    interestLeft: (name: string) => string;
    monthsLeft: (name: string) => string;
  },
): MonthFact[] {
  return loans.flatMap((loan): MonthFact[] => [
    {
      id: `loan:${loan.id}:owed`,
      label: words.owed(loan.name),
      unit: "money",
      value: round(loan.owed),
      sense: "up-is-bad",
    },
    {
      id: `loan:${loan.id}:rate`,
      label: words.rate(loan.name),
      unit: "percent",
      value: Math.round(loan.rate * 100) / 100,
      sense: "up-is-bad",
    },
    {
      id: `loan:${loan.id}:monthly`,
      label: words.monthly(loan.name),
      unit: "money",
      value: round(loan.monthly),
      sense: "neutral",
    },
    {
      id: `loan:${loan.id}:interest-left`,
      label: words.interestLeft(loan.name),
      unit: "money",
      value: round(loan.interestLeft),
      sense: "up-is-bad",
    },
    {
      id: `loan:${loan.id}:months-left`,
      label: words.monthsLeft(loan.name),
      unit: "count",
      value: loan.monthsLeft,
      sense: "neutral",
    },
  ]);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------- the prompts */

export interface AskRequest {
  system: string;
  user: string;
  locale: Locale;
}

/** The first ask: what does this question need? */
export function buildAskPlanRequest(
  question: string,
  locale: Locale,
): AskRequest {
  const text = PLAN_PROMPT[locale];
  return {
    system: [
      ...text.intro,
      "",
      text.toolsHeading,
      ...ASK_TOOLS.map((tool) => `- ${tool}: ${text.tools[tool]}`),
      "",
      ...text.rules,
    ].join("\n"),
    user: question,
    locale,
  };
}

/** The second ask: answer, with only these figures. */
export function buildAskAnswerRequest(
  question: string,
  pack: FactPack,
  {
    money,
    locale,
    advice,
  }: {
    money: (amount: number) => string;
    locale: Locale;
    advice: boolean;
  },
): AskRequest {
  const text = ANSWER_PROMPT[locale];
  return {
    system: [
      ...text.intro,
      "",
      text.figureRule,
      text.namingRule,
      text.basisRule,
      "",
      ...text.noAdvice,
      advice ? text.adviceQuestion : "",
      "",
      ...text.length,
      "",
      text.figureRule,
    ]
      .filter((line) => line !== "")
      .join("\n"),
    user: [
      text.questionHeading,
      question,
      "",
      text.factsHeading,
      factLines(pack, money, locale),
    ].join("\n"),
    locale,
  };
}

/* ------------------------------------------------------------- their words */

const PLAN_SCHEMA_WORDS: Record<
  Locale,
  { kind: string; tools: string; search: string; advice: string }
> = {
  en: {
    kind:
      '"facts" when the question is about this person\'s money in general; ' +
      '"search" when it is about a shop, a payee or one kind of purchase; ' +
      '"outside" when it is not about their money at all.',
    tools:
      "For facts: the families of figures the answer needs, at most three.",
    search:
      "For search: the shop or payee to look for, as the person wrote it. " +
      "Empty otherwise.",
    advice:
      "Whether the question asks what the person should do with their money.",
  },
  fr: {
    kind:
      "« facts » si la question porte sur l'argent de la personne en général ; " +
      "« search » si elle porte sur un commerce, un bénéficiaire ou un type " +
      "d'achat ; « outside » si elle ne porte pas sur son argent.",
    tools:
      "Pour facts : les familles de chiffres nécessaires à la réponse, trois " +
      "au plus.",
    search:
      "Pour search : le commerce ou le bénéficiaire à chercher, tel que la " +
      "personne l'a écrit. Vide sinon.",
    advice:
      "Si la question demande ce que la personne devrait faire de son argent.",
  },
};

const ANSWER_SCHEMA_WORDS: Record<
  Locale,
  { sentences: string; text: string; basis: string }
> = {
  en: {
    sentences: "The answer, as at most four short sentences.",
    text: "One sentence. Every figure written as {{fact:id}}.",
    basis:
      'The ids the sentence uses, bare: "expenses", not "{{fact:expenses}}".',
  },
  fr: {
    sentences: "La réponse, en quatre phrases courtes au plus.",
    text: "Une phrase. Chaque chiffre écrit {{fact:id}}.",
    basis:
      "Les identifiants utilisés par la phrase, nus : « expenses », pas " +
      "« {{fact:expenses}} ».",
  },
};

interface PlanPrompt {
  intro: string[];
  toolsHeading: string;
  tools: Record<AskTool, string>;
  rules: string[];
}

const PLAN_PROMPT: Record<Locale, PlanPrompt> = {
  en: {
    intro: [
      "You route a question someone asks about their own money, in a " +
        "personal finance app. You do not answer it: you say what answering " +
        "it needs.",
    ],
    toolsHeading: "The families of figures the app can hand over:",
    tools: {
      month:
        "the month in progress — income, spending, what is left, the balance",
      spending: "spending by month and by category over the last twelve months",
      charges: "the recurring entries, each with its monthly amount",
      cushion:
        "what is set aside, and how many months of fixed costs it covers",
      wallets: "each investment account: its value and what went in",
      loans:
        "each loan: what is left to repay, its rate, its payment, the " +
        "interest still to pay",
    },
    rules: [
      "Choose search, not facts, when the question names a shop, a payee or " +
        "a single kind of purchase (« how much at Carrefour », « my Netflix »).",
      "Choose outside when the question is not about this person's money.",
      "Mark advice true when the question asks what they should do — repay, " +
        "invest, sell, buy, move money — even politely.",
    ],
  },
  fr: {
    intro: [
      "Vous orientez une question qu'une personne pose sur son propre argent, " +
        "dans une application de finances personnelles. Vous n'y répondez " +
        "pas : vous dites ce qu'il faut pour y répondre.",
    ],
    toolsHeading: "Les familles de chiffres que l'application peut fournir :",
    tools: {
      month: "le mois en cours — revenus, dépenses, ce qui reste, le solde",
      spending:
        "les dépenses par mois et par catégorie sur les douze derniers mois",
      charges: "les opérations récurrentes, chacune avec son montant mensuel",
      cushion:
        "ce qui est mis de côté, et combien de mois de dépenses fixes cela " +
        "couvre",
      wallets: "chaque compte de placement : sa valeur et ce qui y a été versé",
      loans:
        "chaque prêt : ce qu'il reste à rembourser, son taux, sa mensualité, " +
        "les intérêts restant à payer",
    },
    rules: [
      "Choisissez search, pas facts, quand la question nomme un commerce, un " +
        "bénéficiaire ou un seul type d'achat (« combien chez Carrefour », " +
        "« mon abonnement Netflix »).",
      "Choisissez outside quand la question ne porte pas sur l'argent de " +
        "cette personne.",
      "Mettez advice à true quand la question demande ce qu'elle devrait " +
        "faire — rembourser, placer, vendre, acheter, déplacer de l'argent — " +
        "même poliment.",
    ],
  },
};

interface AnswerPrompt {
  intro: string[];
  figureRule: string;
  namingRule: string;
  basisRule: string;
  noAdvice: string[];
  adviceQuestion: string;
  length: string[];
  questionHeading: string;
  factsHeading: string;
}

const ANSWER_PROMPT: Record<Locale, AnswerPrompt> = {
  en: {
    intro: [
      "You answer a question someone asks about their own money, in a " +
        "personal finance app, using only the figures listed. Plain words, " +
        "the way a careful friend would put it.",
    ],
    figureRule:
      "Every figure you mention must be written as {{fact:id}}, using an id " +
      "from the list. Never write a number yourself — not a digit, not a " +
      "spelled-out amount, not a sum, a difference or a percentage of your " +
      "own. If the answer needs a figure that is not listed, say so without it.",
    namingRule:
      "A placeholder is a number, not a name: name the thing in words and put " +
      'its figure beside it — "groceries came to {{fact:spent:2026-03:c1}}".',
    basisRule: "Each sentence carries a basis: the ids it uses, written bare.",
    noAdvice: [
      "You never advise. Do not tell the person what they should do, " +
        "recommend, suggest or discourage anything, or say what would be " +
        "better or wiser. State what the figures show and stop there.",
    ],
    adviceQuestion:
      "This question asks for advice. Give the figures that bear on it — what " +
      "is left to repay, the rate, the cost still to come, the savings — and " +
      "nothing about what to do.",
    length: [
      "At most four sentences, each one short.",
      "If the figures do not answer the question, say plainly that the app " +
        "does not hold what would answer it.",
    ],
    questionHeading: "The question:",
    factsHeading: "The figures (id | label | value | which way is good):",
  },
  fr: {
    intro: [
      "Vous répondez à une question qu'une personne pose sur son propre " +
        "argent, dans une application de finances personnelles, avec les " +
        "seuls chiffres fournis. Des mots simples, comme le dirait un ami " +
        "attentif. En français.",
    ],
    figureRule:
      "Chaque chiffre mentionné doit être écrit {{fact:id}}, avec un " +
      "identifiant de la liste. N'écrivez jamais de nombre vous-même — ni " +
      "chiffre, ni montant en lettres, ni somme, différence ou pourcentage de " +
      "votre cru. Si la réponse demande un chiffre absent de la liste, dites-" +
      "le sans le chiffre.",
    namingRule:
      "Un repère est un nombre, pas un nom : nommez la chose en mots et mettez " +
      "son chiffre à côté — « les courses ont coûté " +
      "{{fact:spent:2026-03:c1}} ».",
    basisRule:
      "Chaque phrase porte une base : les identifiants qu'elle utilise, nus.",
    noAdvice: [
      "Vous ne conseillez jamais. Ne dites pas à la personne ce qu'elle " +
        "devrait faire, ne recommandez, ne suggérez ni ne déconseillez rien, " +
        "ne dites pas ce qui serait mieux ou plus sage. Dites ce que montrent " +
        "les chiffres, et arrêtez-vous là.",
    ],
    adviceQuestion:
      "Cette question demande un conseil. Donnez les chiffres qui la " +
      "concernent — ce qu'il reste à rembourser, le taux, le coût à venir, " +
      "l'épargne — et rien sur ce qu'il faudrait faire.",
    length: [
      "Quatre phrases au plus, chacune courte.",
      "Si les chiffres ne répondent pas à la question, dites simplement que " +
        "l'application ne contient pas de quoi y répondre.",
    ],
    questionHeading: "La question :",
    factsHeading:
      "Les chiffres (identifiant | libellé | valeur | sens favorable) :",
  },
};
