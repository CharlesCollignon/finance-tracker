/**
 * What the writer is asked about one category.
 *
 * The third prompt in this codebase and the third to inherit the same two
 * jobs from `month-read-prompt.ts`. The first is describing figures. The
 * second is keeping a language model inside a vocabulary this app has spent a
 * lot of effort fixing: a read that calls a normal month an "average", or a
 * heavy month an "anomaly", contradicts every label printed around it, and
 * the reader has no way to tell which of the two is wrong.
 *
 * Everything learned over there carries across unchanged, and is repeated
 * here only because each point is load-bearing:
 *
 *   The figure rule is stated first and repeated as the last line. Not
 *   belt-and-braces for its own sake — instruction adherence decays across a
 *   long system message, and this is the one rule whose failure is expensive.
 *
 *   The naming rule sits beside it in both positions. Stated once in the
 *   middle it was ignored by every model tried, and the figure rule beside it
 *   was obeyed by all of them. Position is doing more work than wording.
 *
 *   The figures themselves go through `factLines`, which `month-read-prompt`
 *   exports widened past `MonthFacts` precisely so a second prompt can use
 *   it. This is the third caller. Two prompts describing figures two ways is
 *   two sets of parsing habits to get right in a model that has only one.
 *
 * Two rules are new, and both answer what this surface already shows. The
 * panel draws twelve bars and prints a findings sentence above them, so a
 * read that says "your spending has climbed" has spent its whole budget
 * restating what is directly above it. And it carries the category's name in
 * its heading, so there is no title to write — which is why `CategoryRead`
 * has no headline field for one to go in.
 *
 * The version constant is stored on each read, so a read written under an
 * older prompt is identifiable. It deliberately does not invalidate anything:
 * re-writing every stored read because the prompt was tweaked would spend a
 * user's whole allowance on a change they did not ask for.
 */

import type { CategoryFacts } from "./category-facts";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import type { MonthReadRequest } from "./month-read";
import { factLines, missingLines } from "./month-read-prompt";
import type { CategoryType } from "./types/database";

export const CATEGORY_READ_PROMPT_VERSION = 1;

/* -------------------------------------------------------------- English */

/** Word for word the month read's, because the rule is about figures. */
const FIGURE_RULE_EN =
  "Every figure you mention must be written as {{fact:id}}, using an id from " +
  "the list you are given. Never write a number yourself — not a digit, not " +
  "a spelled-out amount, not a sum, a difference, a percentage or a target " +
  "of your own. If something you want to say needs a figure that is not in " +
  "the list, say it without the figure or do not say it.";

/**
 * The mistake the figure rule invites, in this pack's own terms.
 *
 * Told to write every figure as a placeholder, a model starts using the
 * placeholder *as the name of the thing*. The second half is the sharper trap
 * here: this pack carries a level (`normal`) and two distances from it
 * (`drift`, `odd-month`), and a model that wants a distance and has only a
 * level will point at the level and call it the distance. Every figure real,
 * the sentence false. `month-facts.ts` answers that class of error by
 * supplying the derived figure, and this sentence is the belt to that braces.
 *
 * The examples use `normal`, and deliberately: it is the one datum a category
 * pack always carries. An earlier prompt elsewhere demonstrated the shape
 * with a made-up id, the next answer cited it verbatim, and the verifier
 * refused the read.
 */
const NAMING_RULE_EN =
  "A placeholder is a number, not a name. Name the category, the month or " +
  'the cap in words, and put the figure beside it: "an ordinary month costs ' +
  'you {{fact:normal}}", never "the {{fact:normal}} has gone up". Each ' +
  "figure's label is in the list; use those words for the name. And use each " +
  'figure for what its label says it is: "{{fact:normal}} above what you ' +
  'usually spend" points at a normal month and calls it the distance from ' +
  "one, which is a different thing.";

const BASIS_RULE_EN =
  "Each observation and suggestion carries a basis: the ids it rests on, " +
  'written bare — "normal", not "{{fact:normal}}". Every id you use in the ' +
  "text must be listed there, and list nothing you did not use.";

/**
 * The words this app uses, and the ones it refuses.
 *
 * The first five are `month-read-prompt.ts`'s block, lifted from CONTEXT.md
 * rather than paraphrased, and carried here whole rather than trimmed to what
 * this pack contains: a category read still talks about money set aside and
 * about months being closed, and the terms it must not reach for are the same
 * terms.
 *
 * The last three are this surface's. The first two are the ones it cannot do
 * without — the app has a word for the median month and a word for a run
 * going one way, and a model left to its own devices will write "average" and
 * "anomaly" beside labels that say neither. The third is a collision rather
 * than a preference: this app already has an "allowance", it is a cap on
 * unrecorded spending, and it is not this. Both directions are pinned, here
 * and in the entry above.
 */
const VOCABULARY_EN = [
  '"Unrecorded spending" — what a balance proves left the account that no ' +
    "entry explains. It is measured, not estimated, and never negative. " +
    'Never call it a "leak", "untracked" or "missing".',
  '"Kept" — the cash a month left in the account plus everything ' +
    'deliberately set aside. Never call it "saved", "surplus" or "profit".',
  '"Unrecorded allowance" — a cap on unrecorded spending, set from this ' +
    'person\'s own history. Never call it a "budget", "target" or "limit".',
  '"Month close" — recording what the account held and what follows from ' +
    'it. Never call it a "reconciliation" or "month end".',
  'A projection of charges already scheduled is not a "forecast".',
  '"A normal month" — the median of this category\'s recent months, and what ' +
    'every comparison here is measured against. Never call it an "average", ' +
    'a "baseline", a "typical month" or a "trend".',
  'Nothing here is an "anomaly", an "alert", an "outlier" or a "spike". A ' +
    "month sitting far from normal is an unusual month, and a run that has " +
    'been going one way has "drifted".',
  '"Cap" — a monthly ceiling set on this one category. Never call it a ' +
    '"budget", a "target", a "limit" or an "allowance"; the unrecorded ' +
    "allowance is a different feature.",
];

/**
 * The rule this surface most needs, and the reason it is not obvious.
 *
 * The panel already draws the category's months as bars and prints a findings
 * sentence above them — "has climbed for five months running". A model handed
 * the same figures and asked for a read will, unprompted, write that sentence
 * again in its own words, six millimetres below. Naming the failure is what
 * stops it; asking for "a useful read" does not, because the model believes
 * restating the chart is useful.
 */
const PANEL_RULE_EN = [
  "The panel above already draws this category's months and says in a",
  "sentence what has moved. A read must add what neither of those says: what",
  "a month is worth against a normal one, what it is a consequence of, or",
  "what is worth doing about it. Do not restate the chart.",
];

const SUGGESTIONS_EN = [
  "Say what to change about this category. Name a cut, a cap, a habit or",
  "something to check, and point at one of the figures you were given —",
  "advice that would fit anyone's category is not worth the space. Do not",
  "congratulate; a suggestion is advice, not encouragement. If there is",
  "nothing worth changing, write no suggestions at all.",
];

const CANNOT_KNOW_EN = [
  "What you cannot know, and must not pretend to:",
  "- You see one category's monthly totals and nothing else. You cannot see",
  "  individual payments, merchants, or which shop anything came from.",
  "- You cannot see the rest of this person's money — what they earn, what",
  "  their other categories cost, what their accounts hold.",
  "- You know nothing about this person's job security, dependents, debts,",
  "  risk tolerance or plans.",
  "- Give no product, tax or investment advice, and never suggest moving",
  "  money between real accounts.",
];

const SENSE_RULE_EN = [
  "Each figure says whether rising is good or bad. Do not treat a rise in a",
  'figure marked "rising is bad" as good news.',
];

const LENGTH_RULE_EN = [
  "At most two observations and two suggestions. Two sentences each, and no",
  "more. Write no title: the panel already names the category, so do not",
  "open by announcing which one this is.",
];

/* ------------------------------------------------------------ en français */

/**
 * The same rules, in French.
 *
 * Translated rather than bolted on as "now write in French", for the reason
 * `month-read-prompt.ts` gives at length: the vocabulary block's whole job is
 * to pin the words this app has chosen, and for a French read those are the
 * French words the panel itself prints. A model given the English glossary
 * and asked for French output invents its own French terms, which is exactly
 * the contradiction between prose and label the block exists to prevent.
 *
 * The structure is load-bearing and is preserved: the figure rule is still
 * stated first and last, and the naming rule still sits beside it in both
 * positions.
 */
const FIGURE_RULE_FR =
  "Chaque chiffre que vous mentionnez doit être écrit {{fact:id}}, en " +
  "utilisant un id de la liste qui vous est donnée. N'écrivez jamais un " +
  "nombre vous-même — ni un chiffre, ni un montant en lettres, ni une somme, " +
  "une différence, un pourcentage ou un objectif de votre invention. Si ce " +
  "que vous voulez dire demande un chiffre absent de la liste, dites-le sans " +
  "le chiffre, ou ne le dites pas.";

const NAMING_RULE_FR =
  "Un substitut est un nombre, pas un nom. Nommez la catégorie, le mois ou " +
  'le plafond en mots, et mettez le chiffre à côté : "un mois ordinaire ' +
  'vous coûte {{fact:normal}}", jamais "le {{fact:normal}} a augmenté". Le ' +
  "libellé de chaque chiffre figure dans la liste ; utilisez ces mots comme " +
  "nom. Et employez chaque chiffre pour ce que son libellé dit qu'il est : " +
  '"{{fact:normal}} de plus que d\'habitude" désigne un mois normal et ' +
  "l'appelle l'écart à ce mois normal, ce qui est autre chose.";

const BASIS_RULE_FR =
  "Chaque observation et chaque suggestion porte une base : les ids sur " +
  'lesquels elle repose, écrits nus — "normal", pas "{{fact:normal}}". Tout ' +
  "id que vous utilisez dans le texte doit y figurer, et n'y listez rien que " +
  "vous n'ayez utilisé.";

const VOCABULARY_FR = [
  '"Dépenses non enregistrées" — ce qu\'un solde prouve être sorti du compte ' +
    "et qu'aucune écriture n'explique. C'est mesuré, pas estimé, et jamais " +
    'négatif. Ne parlez jamais de "fuite", de "non suivi" ni de "manquant".',
  "\"Gardé\" — l'argent qu'un mois a laissé sur le compte plus tout ce qui a " +
    'été mis de côté délibérément. Ne dites jamais "économisé", ' +
    '"excédent" ni "bénéfice".',
  '"Enveloppe non enregistrée" — un plafond sur les dépenses non ' +
    "enregistrées, fixé d'après l'historique de cette personne. Ne l'appelez " +
    'jamais un "budget", un "objectif" ni une "limite".',
  '"Clôture du mois" — enregistrer ce que le compte contenait et ce qui en ' +
    'découle. Ne parlez jamais de "réconciliation" ni de "fin de mois".',
  "Une projection de charges déjà programmées n'est pas une " + '"prévision".',
  '"Un mois normal" — la médiane des derniers mois de cette catégorie, et ce ' +
    "à quoi toute comparaison est rapportée ici. Ne parlez jamais de " +
    '"moyenne", de "référence", d\'un "mois type" ni d\'une "tendance".',
  'Rien ici n\'est une "anomalie", une "alerte", une "valeur aberrante" ' +
    'ni un "pic". Un mois éloigné du normal est un mois inhabituel, et une ' +
    'série qui va dans le même sens a "dérivé".',
  '"Plafond" — une limite mensuelle posée sur cette seule catégorie. Ne ' +
    'l\'appelez jamais un "budget", un "objectif", une "limite" ni une ' +
    '"enveloppe" ; l\'enveloppe non enregistrée est une autre fonctionnalité.',
];

const PANEL_RULE_FR = [
  "Le panneau ci-dessus dessine déjà les mois de cette catégorie et dit en",
  "une phrase ce qui a bougé. Une lecture doit apporter ce qu'aucun des deux",
  "ne dit : ce que vaut un mois face à un mois normal, de quoi il découle, ou",
  "ce qu'il vaut la peine d'y faire. Ne répétez pas le graphique.",
];

const SUGGESTIONS_FR = [
  "Dites quoi changer dans cette catégorie. Nommez une coupe, un plafond,",
  "une habitude ou quelque chose à vérifier, et désignez l'un des chiffres",
  "qui vous ont été donnés — un conseil qui conviendrait à n'importe quelle",
  "catégorie ne vaut pas la place. Ne félicitez pas ; une suggestion est un",
  "conseil, pas un encouragement. S'il n'y a rien à changer, n'écrivez",
  "aucune suggestion.",
];

const CANNOT_KNOW_FR = [
  "Ce que vous ne pouvez pas savoir, et ne devez pas feindre de savoir :",
  "- Vous ne voyez que les totaux mensuels d'une seule catégorie. Ni les",
  "  paiements individuels, ni les commerçants, ni d'où vient quoi que ce",
  "  soit.",
  "- Vous ne voyez pas le reste de l'argent de cette personne — ce qu'elle",
  "  gagne, ce que coûtent ses autres catégories, ce que contiennent ses",
  "  comptes.",
  "- Vous ne savez rien de la sécurité de son emploi, de ses personnes à",
  "  charge, de ses dettes, de sa tolérance au risque ni de ses projets.",
  "- Ne donnez aucun conseil sur un produit, la fiscalité ou",
  "  l'investissement, et ne suggérez jamais de déplacer de l'argent entre",
  "  des comptes réels.",
];

const SENSE_RULE_FR = [
  "Chaque chiffre indique si une hausse est bonne ou mauvaise. Ne traitez",
  'pas la hausse d\'un chiffre marqué "une hausse est mauvaise" comme une',
  "bonne nouvelle.",
];

const LENGTH_RULE_FR = [
  "Au plus deux observations et deux suggestions. Deux phrases chacune, pas",
  "plus. N'écrivez pas de titre : le panneau nomme déjà la catégorie, ne",
  "commencez donc pas par annoncer laquelle.",
];

/* ------------------------------------------------------------- assembly */

interface PromptText {
  intro: readonly string[];
  figureRule: string;
  namingRule: string;
  basisRule: string;
  vocabularyHeading: string;
  vocabulary: readonly string[];
  panelRule: readonly string[];
  suggestions: readonly string[];
  cannotKnow: readonly string[];
  senseRule: readonly string[];
  lengthRule: readonly string[];
  /** What kind of money this category holds, in words. */
  typeWords: Record<CategoryType, string>;
  categoryLine: (name: string, kind: string, month: string) => string;
  factsHeading: string;
  missingHeading: string;
}

const PROMPT: Record<Locale, PromptText> = {
  en: {
    intro: [
      "You write a short read of one category in one person's own money, for",
      "them to read. Second person, no greeting, no sign-off, no emoji.",
    ],
    figureRule: FIGURE_RULE_EN,
    namingRule: NAMING_RULE_EN,
    basisRule: BASIS_RULE_EN,
    vocabularyHeading: "Use these words exactly, and avoid the ones marked:",
    vocabulary: VOCABULARY_EN,
    panelRule: PANEL_RULE_EN,
    suggestions: SUGGESTIONS_EN,
    cannotKnow: CANNOT_KNOW_EN,
    senseRule: SENSE_RULE_EN,
    lengthRule: LENGTH_RULE_EN,
    typeWords: {
      expense: "money going out",
      income: "money coming in",
      savings: "money set aside",
      investment: "money invested",
    },
    categoryLine: (name, kind, month) =>
      `Category: ${name} — ${kind}. The month on screen is ${month}.`,
    factsHeading:
      "Figures you may refer to — id | what it is | value | when it rises",
    missingHeading: "Not known, and why",
  },
  fr: {
    intro: [
      "Vous écrivez en français une courte lecture d'une catégorie de",
      "l'argent d'une personne, pour qu'elle la lise. Deuxième personne du",
      "pluriel, sans salutation, sans formule de fin, sans emoji.",
    ],
    figureRule: FIGURE_RULE_FR,
    namingRule: NAMING_RULE_FR,
    basisRule: BASIS_RULE_FR,
    vocabularyHeading:
      "Employez ces mots exactement, et évitez ceux qui sont signalés :",
    vocabulary: VOCABULARY_FR,
    panelRule: PANEL_RULE_FR,
    suggestions: SUGGESTIONS_FR,
    cannotKnow: CANNOT_KNOW_FR,
    senseRule: SENSE_RULE_FR,
    lengthRule: LENGTH_RULE_FR,
    typeWords: {
      expense: "de l'argent qui sort",
      income: "de l'argent qui entre",
      savings: "de l'argent mis de côté",
      investment: "de l'argent investi",
    },
    categoryLine: (name, kind, month) =>
      `Catégorie : ${name} — ${kind}. Le mois affiché est ${month}.`,
    factsHeading:
      "Chiffres auxquels vous pouvez vous référer — id | ce que c'est | valeur | quand il monte",
    missingHeading: "Non connu, et pourquoi",
  },
};

export interface BuildCategoryPromptOptions {
  /**
   * How money is written in the prompt. The server default is euro, and it is
   * safe for this to differ from the reader's chosen currency precisely
   * because nothing the model formats ever reaches a screen.
   */
  money: (amount: number) => string;
  /**
   * The language the read is written in.
   *
   * Not an instruction appended to an English prompt: the whole prompt
   * switches, because the glossary it enforces is the set of words the panel
   * around the prose actually prints. Stored on the read as well, so a read
   * written in French is still rendered with French labels after the reader
   * switches language.
   */
  locale?: Locale;
}

/**
 * Returns a `MonthReadRequest` rather than a type of its own.
 *
 * It is already exactly this: a system message, a user message, and the
 * language both are in, carried together so an adapter cannot send a French
 * prompt with an English response schema. A `CategoryReadRequest` identical
 * in every field would be a second name for one thing, and the adapters would
 * have to know which of the two they were holding.
 */
export function buildCategoryReadPrompt(
  facts: CategoryFacts,
  { money, locale = DEFAULT_LOCALE }: BuildCategoryPromptOptions,
): MonthReadRequest {
  const text = PROMPT[locale];

  const system = [
    ...text.intro,
    "",
    text.figureRule,
    text.namingRule,
    "",
    text.basisRule,
    "",
    text.vocabularyHeading,
    ...text.vocabulary.map((line) => `- ${line}`),
    "",
    ...text.panelRule,
    "",
    ...text.suggestions,
    "",
    ...text.cannotKnow,
    "",
    ...text.senseRule,
    "",
    // Stated in sentences rather than characters. The app caps a claim at a
    // length a panel can hold, and a model asked for "240 characters" cannot
    // count them; asked for two sentences, it lands inside the cap.
    ...text.lengthRule,
    "",
    // Last, for the same reason they are first.
    text.figureRule,
    text.namingRule,
  ].join("\n");

  const user = [
    text.categoryLine(
      facts.categoryName,
      text.typeWords[facts.type],
      facts.monthLabel,
    ),
    "",
    text.factsHeading,
    factLines(facts, money, locale),
    // Handed over deliberately. Telling a model what it does *not* know is
    // the cheapest way to stop it inventing an answer — and on this pack it
    // is load-bearing rather than merely helpful, because a drift that did
    // not clear its floor is listed here as "looked for, and there is none".
    // Without that line a model with a normal and a latest that differ will
    // announce a drift nobody measured.
    facts.missing.length > 0 ? "" : null,
    facts.missing.length > 0 ? text.missingHeading : null,
    facts.missing.length > 0 ? missingLines(facts, locale) : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { system, user, locale };
}
