/**
 * What the writer is asked.
 *
 * Two jobs, and the second is the awkward one. The first is describing a
 * month's figures. The second is keeping a language model inside a vocabulary
 * this app has spent a lot of effort fixing: a read that calls a month close
 * a "reconciliation", or unrecorded spending a "leak", contradicts every
 * label printed around it, and the reader has no way to tell which of the two
 * is wrong.
 *
 * The figure rule is stated first and repeated as the last line. That is not
 * belt-and-braces for its own sake — instruction adherence decays across a
 * long system message, and this is the one rule whose failure is expensive.
 *
 * The naming rule sits beside it, in both positions, and for a measured
 * reason: stated once in the middle it was ignored by every model tried, and
 * the figure rule beside it was obeyed by all of them. Position is doing more
 * work here than wording.
 *
 * The version constant is stored on each read, so a read written under an
 * older prompt is identifiable. It deliberately does not invalidate anything:
 * re-writing every stored read because the prompt was tweaked would spend a
 * user's whole allowance on a change they did not ask for.
 */

import {
  formatFact,
  type FactPack,
  type MissingFact,
  type MissingReason,
  type MonthFact,
  type MonthFacts,
} from "./month-facts";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import type { MonthReadRequest } from "./month-read";

export const MONTH_READ_PROMPT_VERSION = 3;

const FIGURE_RULE_EN =
  "Every figure you mention must be written as {{fact:id}}, using an id from " +
  "the list you are given. Never write a number yourself — not a digit, not " +
  "a spelled-out amount, not a sum, a difference, a percentage or a target " +
  "of your own. If something you want to say needs a figure that is not in " +
  "the list, say it without the figure or do not say it.";

/**
 * The mistake the figure rule invites.
 *
 * Told to write every figure as a placeholder, a model starts using the
 * placeholder *as the name of the thing* — "cut {{fact:top-expense:c4}} by
 * {{fact:budget-left:b2}}", which renders as "cut 340,00 € by 60,00 €" and
 * tells the reader nothing about which category to cut. Observed, not
 * imagined: it is what the first live answers did.
 *
 * The example uses a real id, and deliberately. An earlier version showed the
 * shape with a made-up one, the next answer cited it verbatim, and the
 * verifier refused the read — an instruction that demonstrates an id has to
 * demonstrate one that exists.
 *
 * The second half is about a failure the figure rule does not cover, because
 * it is not a made-up number. A model that wants the overshoot and has only
 * the allowance will point at the allowance and call it the overshoot: every
 * figure real, the sentence false. `month-facts.ts` answers this properly by
 * supplying the derived figures, and this sentence is the belt to that
 * braces — the pack cannot anticipate every relationship a model might want.
 */
const NAMING_RULE_EN =
  "A placeholder is a number, not a name. Name the category, the cap or the " +
  'month in words, and put the figure beside it: "you spent ' +
  '{{fact:expenses}}", never "the {{fact:expenses}} was high". Each figure\'s ' +
  "label is in the list; use those words for the name. And use each figure " +
  'for what its label says it is: "exceeded the allowance by ' +
  '{{fact:unrecorded-allowance}}" points at the allowance and calls it the ' +
  "amount it was exceeded by, which is a different thing.";

/**
 * What `basis` is for, which the shape alone does not say.
 *
 * The declaration is what makes a claim checkable later — it is how the app
 * knows which figures a sentence rests on, and so whether it still stands
 * when one of them moves. A model given no explanation of the field fills it
 * with the placeholder form it was just taught; the app forgives that, and
 * this is the sentence that stops it happening in the first place.
 */
const BASIS_RULE_EN =
  "Each observation and suggestion carries a basis: the ids it rests on, " +
  'written bare — "expenses", not "{{fact:expenses}}". Every id you use in ' +
  "the text must be listed there, and list nothing you did not use.";

/**
 * The words this app uses, and the ones it refuses.
 *
 * Lifted from CONTEXT.md rather than paraphrased. Each pairing is there
 * because the wrong word is actively misleading, not merely off-brand:
 * "forecast" implies a prediction where the app means a projection of things
 * already scheduled, and "budget" for the allowance collides with the
 * per-category caps, which are a different feature.
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
];

/**
 * The three words that say which way a figure wants to move.
 *
 * Beside the line they annotate rather than in `PROMPT`, because they are
 * read once per figure and never on their own.
 */
const SENSE_WORDS: Record<Locale, Record<MonthFact["sense"], string>> = {
  en: {
    "up-is-good": "rising is good",
    "up-is-bad": "rising is bad",
    neutral: "neither good nor bad",
  },
  fr: {
    "up-is-good": "une hausse est bonne",
    "up-is-bad": "une hausse est mauvaise",
    neutral: "ni bonne ni mauvaise",
  },
};

/**
 * The line format a model is taught to read figures in.
 *
 * Exported, and widened past `MonthFacts`, because `bearing-prompt.ts` hands
 * over the same kind of list and the format is the part that must not differ.
 * Two prompts describing figures two ways is two sets of parsing habits to
 * get right in a model that only has one.
 */
export function factLines(
  facts: FactPack,
  formatMoney: (amount: number) => string,
  locale: Locale,
): string {
  return facts.facts
    .map((fact) => {
      const rise = SENSE_WORDS[locale][fact.sense];
      const note = fact.note ? ` | ${fact.note}` : "";
      return `  ${fact.id} | ${fact.label} | ${formatFact(fact, formatMoney, locale)} | ${rise}${note}`;
    })
    .join("\n");
}

/**
 * Exhaustive over `MissingReason`, and typed so it has to stay that way.
 *
 * A reason with no clause renders as `undefined` on a prompt line, which is
 * both a worse instruction than saying nothing and invisible until someone
 * reads a raw prompt. The Bearing's pack introduced three more reasons; these
 * two maps cover every one of them even though a month never emits the last
 * three, because the alternative is a map that is correct only by accident.
 */
const MISSING_WORDS_EN: Record<MissingReason, string> = {
  "no-bank": "no bank is connected, so this cannot be known",
  "no-close": "no month has been closed yet, so this cannot be measured",
  "no-cap": "no allowance has been set",
  "month-unfinished": "the month is not over yet",
  "not-recorded": "nothing was recorded for it",
  "no-target": "no target allocation has been set",
  "nothing-invested": "nothing is held, so there is no portfolio to say it of",
  "too-short": "it has been held too briefly for a rate to mean anything",
};

/** The same, for the figures that are not there and why. */
export function missingLines(
  facts: { missing: readonly MissingFact[] },
  locale: Locale,
): string {
  return facts.missing
    .map(
      (row) =>
        `  ${row.id} | ${row.label} | ${PROMPT[locale].missingWords[row.why]}`,
    )
    .join("\n");
}

/* ------------------------------------------------------------- en français */

/**
 * The same rules, in French.
 *
 * Translated rather than bolted on as "now write in French", and the reason
 * is the vocabulary block below. Its whole job is to pin the words this app
 * has chosen — and for a French read those are the French words, the ones
 * `facts.*` in `./i18n/messages/fr` prints on the card beside the prose. A
 * model given the English glossary and asked for French output invents its
 * own French terms, which is precisely the contradiction between prose and
 * label that the English block exists to prevent.
 *
 * The essays above each English constant explain *why* each rule is there,
 * and those reasons are the same in both languages, so they are not repeated
 * here. What is worth saying is that the structure is load-bearing and is
 * preserved: the figure rule is still stated first and last, and the naming
 * rule still sits beside it in both positions.
 */
const FIGURE_RULE_FR =
  "Chaque chiffre que vous mentionnez doit être écrit {{fact:id}}, en " +
  "utilisant un id de la liste qui vous est donnée. N'écrivez jamais un " +
  "nombre vous-même — ni un chiffre, ni un montant en lettres, ni une somme, " +
  "une différence, un pourcentage ou un objectif de votre invention. Si ce " +
  "que vous voulez dire demande un chiffre absent de la liste, dites-le sans " +
  "le chiffre, ou ne le dites pas.";

const NAMING_RULE_FR =
  "Un substitut est un nombre, pas un nom. Nommez la catégorie, le plafond " +
  'ou le mois en mots, et mettez le chiffre à côté : "vous avez dépensé ' +
  '{{fact:expenses}}", jamais "le {{fact:expenses}} était élevé". Le libellé ' +
  "de chaque chiffre figure dans la liste ; utilisez ces mots comme nom. Et " +
  "employez chaque chiffre pour ce que son libellé dit qu'il est : " +
  '"dépassé l\'enveloppe de {{fact:unrecorded-allowance}}" désigne ' +
  "l'enveloppe et l'appelle le montant du dépassement, ce qui est autre chose.";

const BASIS_RULE_FR =
  "Chaque observation et chaque suggestion porte une base : les ids sur " +
  'lesquels elle repose, écrits nus — "expenses", pas "{{fact:expenses}}". ' +
  "Tout id que vous utilisez dans le texte doit y figurer, et n'y listez " +
  "rien que vous n'ayez utilisé.";

/**
 * The French glossary.
 *
 * Each entry names the term the card prints and the words to refuse, exactly
 * as the English block does. The refused words are the French ones a model
 * actually reaches for: "fuite" for unrecorded spending, "économisé" for
 * kept, "budget" for the allowance — that last one colliding with the
 * per-category caps the same way the English "budget" does.
 */
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
];

const MISSING_WORDS_FR: Record<MissingReason, string> = {
  "no-bank": "aucune banque n'est connectée, cela ne peut donc pas être su",
  "no-close":
    "aucun mois n'a encore été clôturé, cela ne peut donc pas être mesuré",
  "no-cap": "aucune enveloppe n'a été fixée",
  "month-unfinished": "le mois n'est pas terminé",
  "not-recorded": "rien n'a été enregistré pour cela",
  "no-target": "aucune répartition cible n'a été fixée",
  "nothing-invested":
    "rien n'est détenu, il n'y a donc pas de portefeuille dont le dire",
  "too-short": "c'est détenu depuis trop peu de temps pour qu'un taux ait un sens",
};

/**
 * Everything the prompt says, per language.
 *
 * A record rather than a `t()` lookup because a system prompt is not UI copy:
 * it changes on a different clock, it is reviewed by whoever is tuning the
 * model rather than by whoever is writing labels, and each language's version
 * has to be readable end to end in one sitting to be reviewable at all —
 * which is the same argument the marketing copy makes for living in one file.
 */
interface PromptText {
  figureRule: string;
  namingRule: string;
  basisRule: string;
  vocabulary: readonly string[];
  missingWords: Record<MissingReason, string>;
  intro: readonly string[];
  vocabularyHeading: string;
  suggestions: readonly string[];
  cannotKnow: readonly string[];
  senseRule: readonly string[];
  provisional: string;
  settled: string;
  partial: string;
  lengthRule: readonly string[];
  monthLine: (label: string, provisional: boolean) => string;
  factsHeading: string;
  missingHeading: string;
}

const PROMPT: Record<Locale, PromptText> = {
  en: {
    figureRule: FIGURE_RULE_EN,
    namingRule: NAMING_RULE_EN,
    basisRule: BASIS_RULE_EN,
    vocabulary: VOCABULARY_EN,
    missingWords: MISSING_WORDS_EN,
    intro: [
      "You write a short read of one person's month with their own money, for",
      "them to read. Second person, no greeting, no sign-off, no emoji.",
    ],
    vocabularyHeading: "Use these words exactly, and avoid the ones marked:",
    suggestions: [
      "Say what to change. Name a cut, a cap, a habit or something to check.",
      "Every suggestion must point at a category, a cap or one of the figures",
      "you were given — advice that would fit anyone's month is not worth the",
      "space. Do not congratulate; a suggestion is advice, not encouragement.",
    ],
    cannotKnow: [
      "What you cannot know, and must not pretend to:",
      "- You see only the totals given. You cannot see individual payments,",
      "  merchants, or which shop anything came from.",
      "- You know nothing about this person's job security, dependents, debts,",
      "  risk tolerance or plans.",
      "- Give no product, tax or investment advice, and never suggest moving",
      "  money between real accounts.",
    ],
    senseRule: [
      "Each figure says whether rising is good or bad. Do not treat a rise in a",
      'figure marked "rising is bad" as good news.',
    ],
    provisional:
      'This month is still running. Say "so far" where it matters, and never speak of it as finished or of its unrecorded spending as settled.',
    settled: "This month is over, so its figures are settled.",
    partial:
      "The picture is incomplete — some entries are not yet categorised, or nothing has been closed. Say so rather than writing as though the categories were complete.",
    lengthRule: [
      "At most four observations and three suggestions. Two sentences each, and",
      "no more. The headline is one short clause.",
    ],
    monthLine: (label, provisional) =>
      `Month: ${label} (${provisional ? "still running" : "over"})`,
    factsHeading:
      "Figures you may refer to — id | what it is | value | when it rises",
    missingHeading: "Not known, and why",
  },
  fr: {
    figureRule: FIGURE_RULE_FR,
    namingRule: NAMING_RULE_FR,
    basisRule: BASIS_RULE_FR,
    vocabulary: VOCABULARY_FR,
    missingWords: MISSING_WORDS_FR,
    intro: [
      "Vous écrivez en français une courte lecture du mois d'une personne, sur",
      "son propre argent, pour qu'elle la lise. Deuxième personne du pluriel,",
      "sans salutation, sans formule de fin, sans emoji.",
    ],
    vocabularyHeading:
      "Employez ces mots exactement, et évitez ceux qui sont signalés :",
    suggestions: [
      "Dites quoi changer. Nommez une coupe, un plafond, une habitude ou",
      "quelque chose à vérifier. Chaque suggestion doit désigner une",
      "catégorie, un plafond ou l'un des chiffres qui vous ont été donnés — un",
      "conseil qui conviendrait au mois de n'importe qui ne vaut pas la place.",
      "Ne félicitez pas ; une suggestion est un conseil, pas un encouragement.",
    ],
    cannotKnow: [
      "Ce que vous ne pouvez pas savoir, et ne devez pas feindre de savoir :",
      "- Vous ne voyez que les totaux fournis. Vous ne voyez ni les paiements",
      "  individuels, ni les commerçants, ni d'où vient quoi que ce soit.",
      "- Vous ne savez rien de la sécurité de l'emploi de cette personne, de",
      "  ses personnes à charge, de ses dettes, de sa tolérance au risque ni",
      "  de ses projets.",
      "- Ne donnez aucun conseil sur un produit, la fiscalité ou",
      "  l'investissement, et ne suggérez jamais de déplacer de l'argent entre",
      "  des comptes réels.",
    ],
    senseRule: [
      "Chaque chiffre indique si une hausse est bonne ou mauvaise. Ne traitez",
      'pas la hausse d\'un chiffre marqué "une hausse est mauvaise" comme une',
      "bonne nouvelle.",
    ],
    provisional:
      'Ce mois est encore en cours. Dites "à ce jour" là où cela compte, et ne parlez jamais du mois comme terminé ni de ses dépenses non enregistrées comme définitives.',
    settled: "Ce mois est terminé, ses chiffres sont donc définitifs.",
    partial:
      "Le tableau est incomplet — certaines écritures n'ont pas encore de catégorie, ou rien n'a été clôturé. Dites-le plutôt que d'écrire comme si les catégories étaient complètes.",
    lengthRule: [
      "Au plus quatre observations et trois suggestions. Deux phrases chacune,",
      "pas plus. Le titre est une seule courte proposition.",
    ],
    monthLine: (label, provisional) =>
      `Mois : ${label} (${provisional ? "en cours" : "terminé"})`,
    factsHeading:
      "Chiffres auxquels vous pouvez vous référer — id | ce que c'est | valeur | quand il monte",
    missingHeading: "Non connu, et pourquoi",
  },
};

export interface BuildPromptOptions {
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
   * switches, because the glossary it enforces is the set of words the card
   * around the prose actually prints. See the comment above `FIGURE_RULE_FR`.
   *
   * Stored on the read as well, so a read written in French is still
   * rendered with French labels after the reader switches language.
   */
  locale?: Locale;
}

export function buildMonthReadPrompt(
  facts: MonthFacts,
  { money, locale = DEFAULT_LOCALE }: BuildPromptOptions,
): MonthReadRequest {
  const provisional = facts.state === "in-progress";
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
    ...text.suggestions,
    "",
    ...text.cannotKnow,
    "",
    ...text.senseRule,
    "",
    provisional ? text.provisional : text.settled,
    "",
    facts.coverage === "partial" ? text.partial : "",
    "",
    // Stated in sentences rather than characters. The app caps a claim at a
    // length a card can hold, and a model asked for "240 characters" cannot
    // count them; asked for two sentences, it lands inside the cap.
    ...text.lengthRule,
    "",
    text.figureRule,
    text.namingRule,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const user = [
    text.monthLine(facts.monthLabel, provisional),
    "",
    text.factsHeading,
    factLines(facts, money, locale),
    facts.missing.length > 0 ? "" : null,
    facts.missing.length > 0 ? text.missingHeading : null,
    facts.missing.length > 0 ? missingLines(facts, locale) : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { system, user, locale };
}
