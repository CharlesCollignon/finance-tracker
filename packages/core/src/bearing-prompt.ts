/**
 * What the arranger is asked.
 *
 * A narrower job than a month read's, and the prompt is shorter because of
 * it: choose from a closed list, order it, and optionally add four words. No
 * suggestions, no observations, no paragraph. What carries over unchanged is
 * everything that was learned the hard way over there —
 *
 *   The figure rule is stated first and repeated as the last line, because
 *   instruction adherence decays across a long system message and this is the
 *   one rule whose failure is expensive.
 *
 *   The naming rule sits beside it in both positions. Stated once in the
 *   middle it was ignored by every model tried; position is doing more work
 *   than wording.
 *
 *   The vocabulary block is lifted from CONTEXT.md rather than paraphrased,
 *   because a caption that calls unrecorded spending a "leak" contradicts
 *   every label printed around it.
 *
 * One rule is new, and it is the one this surface most needs. A tile already
 * prints its figure and its label; a caption that says "your balance is
 * {{fact:on-hand}}" has spent four words restating what is directly above it.
 * So the caption is asked for the thing a figure cannot say about itself —
 * whether it is unusual, which way it is going, what it is close to — and
 * omitting it is explicitly the right answer when there is nothing like that
 * to say.
 *
 * The version constant is stored on each arrangement so one written under an
 * older prompt is identifiable. It deliberately invalidates nothing.
 */

import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import type { BearingFacts } from "./bearing-facts";
import type { ArrangementRequest } from "./bearing-read";
import { MAX_TILES } from "./bearing-tiles";
import { factLines, missingLines } from "./month-read-prompt";

export const BEARING_PROMPT_VERSION = 1;

/* -------------------------------------------------------------- English */

const FIGURE_RULE_EN =
  "Never write a number — not a digit, not a spelled-out amount, not a sum, " +
  "a difference, a percentage or a target of your own. If a caption needs a " +
  "figure, write it as {{fact:id}} using an id from the list, and list that " +
  "id in the caption's basis. If the figure you want is not in the list, say " +
  "it without the figure or leave the caption out.";

const NAMING_RULE_EN =
  "A placeholder is a number, not a name. Never open a caption with one, and " +
  "never use one as the subject of a phrase. Name the thing in words and put " +
  'the figure beside it if you need it at all: "third month over", not "the ' +
  '{{fact:unrecorded-so-far}} was high".';

/**
 * The mistake this surface invites, which the month read does not.
 *
 * The tile prints the label and the value already. A model given a figure and
 * asked for a caption will, unprompted, caption it with the figure — which
 * renders as the same number twice, six millimetres apart. Naming the failure
 * and giving permission to write nothing is what stops it; asking for "a
 * useful caption" does not, because the model believes restating the number
 * is useful.
 */
const CAPTION_RULE_EN = [
  "Each tile already shows its own label and its own value. A caption must",
  "add something neither of those says: that a figure is unusual, which way",
  "it has been moving, what it is close to, or what it is a consequence of.",
  "Six words at most.",
  "Most tiles should have no caption at all. Leave it empty rather than",
  "restating the figure, repeating the label, or writing filler like",
  '"steady" or "on track" that would be true of any number.',
];

const CHOOSING_RULE_EN = [
  `Choose at most ${MAX_TILES} figures and put them in the order they should`,
  "be read. First the thing this person would most want to act on, then what",
  "explains it, then the rest. Lead with anything that has gone wrong — an",
  "allowance breached, a portfolio out of line, entries left uncategorised —",
  "over anything that is merely healthy.",
  "Do not choose two figures that say the same thing.",
];

const VOCABULARY_EN = [
  '"Unrecorded spending" — what a balance proves left the account that no ' +
    "entry explains. It is measured, not estimated, and never negative. " +
    'Never call it a "leak", "untracked" or "missing".',
  '"Unrecorded allowance" — a cap on unrecorded spending, set from this ' +
    'person\'s own history. Never call it a "budget", "target" or "limit".',
  'A projection of charges already scheduled is not a "forecast".',
  'A wallet is where invested value sits. Never call it an "account", a ' +
    '"portfolio" or a "broker".',
  "The total of accounts and investments is not a net worth: this app " +
    "records no debts.",
];

const CANNOT_KNOW_EN = [
  "What you cannot know, and must not pretend to:",
  "- You see only the figures listed. You cannot see individual payments,",
  "  merchants, holdings by name beyond what a label states, or any account.",
  "- You know nothing about this person's job, dependents, debts, risk",
  "  tolerance or plans.",
  "- Give no product, tax or investment advice. Do not tell anyone to buy,",
  "  sell, rebalance or move money.",
];

const SENSE_RULE_EN = [
  "Each figure says whether rising is good or bad. Do not treat a rise in a",
  'figure marked "rising is bad" as good news.',
];

/* --------------------------------------------------------------- French */

const FIGURE_RULE_FR =
  "N'écrivez jamais de nombre — ni chiffre, ni montant en toutes lettres, ni " +
  "somme, différence, pourcentage ou objectif de votre invention. Si une " +
  "légende a besoin d'un chiffre, écrivez-le sous la forme {{fact:id}} avec " +
  "un id de la liste, et indiquez cet id dans le basis de la légende. Si le " +
  "chiffre voulu n'est pas dans la liste, dites-le sans le chiffre ou " +
  "omettez la légende.";

const NAMING_RULE_FR =
  "Un placeholder est un nombre, pas un nom. Ne commencez jamais une légende " +
  "par un placeholder et n'en faites jamais le sujet d'une phrase. Nommez la " +
  "chose en mots et mettez le chiffre à côté si besoin : \"troisième mois de " +
  'dépassement", pas "le {{fact:unrecorded-so-far}} était élevé".';

const CAPTION_RULE_FR = [
  "Chaque tuile affiche déjà son libellé et sa valeur. Une légende doit",
  "apporter ce qu'aucun des deux ne dit : qu'un chiffre est inhabituel, dans",
  "quel sens il évolue, de quoi il est proche, ou de quoi il découle.",
  "Six mots au plus.",
  "La plupart des tuiles ne doivent porter aucune légende. Laissez-la vide",
  "plutôt que de répéter le chiffre, de répéter le libellé, ou d'écrire un",
  'remplissage comme "stable" ou "dans les clous" qui vaudrait pour',
  "n'importe quel nombre.",
];

const CHOOSING_RULE_FR = [
  `Choisissez au plus ${MAX_TILES} chiffres et mettez-les dans l'ordre de`,
  "lecture. D'abord ce sur quoi cette personne voudrait le plus agir, puis ce",
  "qui l'explique, puis le reste. Commencez par ce qui ne va pas — une",
  "enveloppe dépassée, un portefeuille hors cible, des écritures sans",
  "catégorie — avant ce qui se porte simplement bien.",
  "Ne choisissez pas deux chiffres qui disent la même chose.",
];

const VOCABULARY_FR = [
  '"Dépenses non enregistrées" — ce qu\'un solde prouve être sorti du compte ' +
    "sans qu'aucune écriture l'explique. C'est mesuré, pas estimé, et jamais " +
    'négatif. Ne parlez jamais de "fuite" ni de "non suivi".',
  '"Enveloppe non enregistrée" — un plafond sur les dépenses non ' +
    "enregistrées, établi à partir de l'historique de cette personne. Ne " +
    'parlez jamais de "budget", d\'"objectif" ni de "limite".',
  "Une projection de charges déjà programmées n'est pas une \"prévision\".",
  "Un portefeuille est l'endroit où se trouve la valeur investie. Ne parlez " +
    'jamais de "compte" ni de "courtier".',
  "Le total des comptes et des investissements n'est pas un patrimoine net : " +
    "cette application n'enregistre aucune dette.",
];

const CANNOT_KNOW_FR = [
  "Ce que vous ne pouvez pas savoir, et ne devez pas feindre de savoir :",
  "- Vous ne voyez que les chiffres listés. Ni les paiements individuels, ni",
  "  les commerçants, ni aucun compte.",
  "- Vous ne savez rien de l'emploi de cette personne, de ses personnes à",
  "  charge, de ses dettes, de sa tolérance au risque ni de ses projets.",
  "- Ne donnez aucun conseil sur un produit, la fiscalité ou",
  "  l'investissement. Ne dites à personne d'acheter, de vendre, de",
  "  rééquilibrer ou de déplacer de l'argent.",
];

const SENSE_RULE_FR = [
  "Chaque chiffre indique si une hausse est bonne ou mauvaise. Ne traitez",
  'pas la hausse d\'un chiffre marqué "une hausse est mauvaise" comme une',
  "bonne nouvelle.",
];

/* ------------------------------------------------------------ assembly */

interface PromptText {
  intro: readonly string[];
  figureRule: string;
  namingRule: string;
  captionRule: readonly string[];
  choosingRule: readonly string[];
  vocabularyHeading: string;
  vocabulary: readonly string[];
  cannotKnow: readonly string[];
  senseRule: readonly string[];
  asOfLine: (date: string) => string;
  factsHeading: string;
  missingHeading: string;
}

const PROMPT: Record<Locale, PromptText> = {
  en: {
    intro: [
      "You arrange one screen of figures about one person's own money. You",
      "choose which figures lead and in what order. You never compute one.",
    ],
    figureRule: FIGURE_RULE_EN,
    namingRule: NAMING_RULE_EN,
    captionRule: CAPTION_RULE_EN,
    choosingRule: CHOOSING_RULE_EN,
    vocabularyHeading: "Use these words exactly, and avoid the ones marked:",
    vocabulary: VOCABULARY_EN,
    cannotKnow: CANNOT_KNOW_EN,
    senseRule: SENSE_RULE_EN,
    asOfLine: (date) => `The position as it stands on ${date}.`,
    factsHeading:
      "Figures you may choose from — id | what it is | value | when it rises",
    missingHeading: "Not known, and why. You may not choose these",
  },
  fr: {
    intro: [
      "Vous agencez en français un écran de chiffres sur l'argent d'une",
      "personne. Vous choisissez quels chiffres viennent en tête et dans quel",
      "ordre. Vous n'en calculez jamais aucun.",
    ],
    figureRule: FIGURE_RULE_FR,
    namingRule: NAMING_RULE_FR,
    captionRule: CAPTION_RULE_FR,
    choosingRule: CHOOSING_RULE_FR,
    vocabularyHeading:
      "Employez ces mots exactement, et évitez ceux qui sont signalés :",
    vocabulary: VOCABULARY_FR,
    cannotKnow: CANNOT_KNOW_FR,
    senseRule: SENSE_RULE_FR,
    asOfLine: (date) => `La position telle qu'elle est au ${date}.`,
    factsHeading:
      "Chiffres parmi lesquels choisir — id | ce que c'est | valeur | quand il monte",
    missingHeading:
      "Non connu, et pourquoi. Vous ne pouvez pas les choisir",
  },
};

export interface BuildArrangementPromptOptions {
  /**
   * How money is written in the prompt. Safe for this to differ from the
   * reader's chosen currency precisely because nothing the model formats
   * ever reaches a screen.
   */
  money: (amount: number) => string;
  locale?: Locale;
}

export function buildArrangementPrompt(
  facts: BearingFacts,
  { money, locale = DEFAULT_LOCALE }: BuildArrangementPromptOptions,
): ArrangementRequest {
  const text = PROMPT[locale];

  const system = [
    ...text.intro,
    "",
    text.figureRule,
    text.namingRule,
    "",
    ...text.choosingRule,
    "",
    ...text.captionRule,
    "",
    text.vocabularyHeading,
    ...text.vocabulary.map((line) => `- ${line}`),
    "",
    ...text.cannotKnow,
    "",
    ...text.senseRule,
    "",
    // Last, for the same reason it is first.
    text.figureRule,
    text.namingRule,
  ].join("\n");

  const user = [
    text.asOfLine(facts.asOf),
    "",
    text.factsHeading,
    factLines(facts, money, locale),
    // Handed over deliberately. Telling a model what it does *not* know is
    // the cheapest way to stop it inventing an answer, and here it doubles as
    // the boundary of the closed list it may choose from.
    facts.missing.length > 0 ? "" : null,
    facts.missing.length > 0 ? text.missingHeading : null,
    facts.missing.length > 0 ? missingLines(facts, locale) : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { system, user, locale };
}
