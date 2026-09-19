/**
 * What the model is asked when someone wants the band re-ordered.
 *
 * The fourth prompt in this codebase, and the first that asks for a
 * *judgement about* figures rather than prose containing them. That changes
 * what it has to guard against, and what it does not:
 *
 *   It does not need the placeholder discipline, because nothing it returns
 *   is a sentence with a figure in it. The weights are already on the screen,
 *   beside the rows, in elements privacy mode can blur and the currency
 *   toggle can follow. So the figure rule here is the blunt one: write no
 *   number at all.
 *
 *   It does need the closed-catalogue rule, stated the way
 *   `wallet-read-prompt.ts` states it for ISINs — name only what you were
 *   given, and if the right answer is not in the list, do not invent one.
 *   The list is handed over in full, which is what makes refusing an id
 *   outside it defensible: the model was shown everything there was.
 *
 * The figures themselves go through `factLines`, which `month-read-prompt`
 * exports widened past `MonthFacts` precisely so that another prompt can use
 * it. This is its fourth caller. Two prompts describing figures two ways is
 * two sets of parsing habits to get right in a model that has only one.
 *
 * The weight is handed over **signed** — positive when the category moved up,
 * negative when it moved down — for the reason `category-facts.ts` records
 * about its own drift: `CategoryFinding.severity` is always positive with the
 * direction beside it, which suits a caption next to an arrow and not a
 * figure in a list. A model handed an unsigned weight has to be told the
 * direction in prose, and prose is what it gets wrong.
 *
 * The version constant is stored with each order, so one chosen under an
 * older prompt is identifiable. It deliberately invalidates nothing: the
 * digest already decides whether a stored order still stands.
 */

import { categorySense } from "./category-facts";
import type { CategoryFinding } from "./category-findings";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { MonthFact } from "./month-facts";
import type { MonthReadRequest } from "./month-read";
import { factLines } from "./month-read-prompt";
import { MAX_SELECTION_PICKS } from "./category-selection";

export const CATEGORY_SELECTION_PROMPT_VERSION = 1;

export interface BuildCategorySelectionPromptOptions {
  money: (amount: number) => string;
  locale?: Locale;
}

/**
 * The catalogue, as figures.
 *
 * Each finding becomes one `MonthFact` whose id is the finding's own — which
 * is what the model must copy back — and whose label is the sentence the
 * screen prints for it. Handing over the app's own wording rather than a
 * paraphrase means the model is choosing between the rows a reader will
 * actually see, not between descriptions of them.
 */
function findingFacts(
  findings: readonly CategoryFinding[],
  locale: Locale,
): MonthFact[] {
  const t = translator(locale);
  return findings.map((finding) => ({
    id: finding.id,
    label: `${finding.categoryName} — ${t(finding.messageKey, finding.params)}`,
    unit: "money" as const,
    value: finding.direction === "up" ? finding.severity : -finding.severity,
    sense: categorySense(finding.type),
  }));
}

const EN = {
  intro: [
    "You are ordering a short list of things that have moved in one person's " +
      "spending, so that what they should look at first comes first. You are " +
      "writing for the person whose money it is, who can see every figure on " +
      "the same screen.",
    "",
    "The app has already ordered this list by size, largest first. Your job " +
      "is the judgement size cannot make: what can actually be acted on. A " +
      "small drift in something discretionary is usually worth more " +
      "attention than a large one in a rent that is indexed and fixed, " +
      "because one of them can be changed this month and the other cannot.",
  ],
  catalogueRule:
    "Choose only from the ids in the list below, copied exactly. Do not " +
    "invent an id, do not adapt one, and do not name a category that is not " +
    "there — if something you would rather talk about is missing, it is " +
    "missing because nothing about it moved enough to say.",
  figureRule:
    "Write no number anywhere. Not a digit, not a spelled-out amount, not a " +
    "share, a sum, a difference or a percentage. Not 'about a third', not " +
    "'nearly double'. The amount for each line is already printed beside it " +
    "on the screen, so repeating it buys nothing and getting it wrong costs " +
    "everything.",
  shape: [
    "Answer with `picks`: the ids you choose, in the order you want them " +
      `read, most worth attention first. Name at most ${MAX_SELECTION_PICKS}, ` +
      "and fewer if fewer deserve it — a list padded to its limit is a list " +
      "that has stopped ranking.",
    "Each pick may carry a `remark`: one short clause saying why it leads. " +
      "Leave it empty rather than restating the line it sits under. A remark " +
      "is worth writing when it says something the sentence does not — that " +
      "this one is within the person's control, that two of them are the " +
      "same habit, that this one will keep happening.",
  ],
  vocabularyHeading: "Use this app's words:",
  vocabulary: [
    "a **category** is where money is recorded — groceries, rent, salary. " +
      "Never 'bucket', 'label' or 'tag'.",
    "what has moved is a **finding**, and the amount beside it is its " +
      "**weight**. Never call one an 'alert', an 'anomaly', an 'insight' or " +
      "an 'issue'.",
    "a rise is not a 'spike' and a fall is not a 'drop-off'.",
    "never call any of this an analysis, a report or a summary.",
  ],
  findingsHeading:
    "The findings, as id | category and what it did | weight | which way is " +
    "good. A negative weight went down, a positive one went up:",
};

const FR = {
  intro: [
    "Vous classez une courte liste de mouvements dans les dépenses d'une " +
      "personne, pour que ce qu'elle doit regarder en premier vienne en " +
      "premier. Vous écrivez pour celle dont c'est l'argent, qui voit sur le " +
      "même écran chacun des chiffres.",
    "",
    "L'app a déjà classé cette liste par taille, du plus gros au plus " +
      "petit. Votre travail est le jugement que la taille ne peut pas " +
      "porter : ce sur quoi on peut vraiment agir. Une petite dérive sur " +
      "quelque chose de discrétionnaire mérite en général plus d'attention " +
      "qu'une grosse sur un loyer indexé et fixe, parce que l'une peut être " +
      "changée ce mois-ci et l'autre non.",
  ],
  catalogueRule:
    "Ne choisissez que parmi les ids de la liste ci-dessous, copiés tels " +
    "quels. N'inventez pas d'id, n'en adaptez aucun, et ne nommez pas une " +
    "catégorie absente — si ce dont vous préféreriez parler n'y est pas, " +
    "c'est que rien n'y a assez bougé pour le dire.",
  figureRule:
    "N'écrivez aucun nombre, nulle part. Ni chiffre, ni montant en lettres, " +
    "ni part, ni somme, ni écart, ni pourcentage. Ni « environ un tiers », " +
    "ni « presque le double ». Le montant de chaque ligne est déjà imprimé " +
    "à côté sur l'écran : le répéter n'apporte rien et le rater coûte tout.",
  shape: [
    "Répondez avec `picks` : les ids choisis, dans l'ordre de lecture " +
      `souhaité, le plus digne d'attention en premier. Nommez-en ${MAX_SELECTION_PICKS} ` +
      "au plus, et moins si moins le méritent — une liste remplie jusqu'à sa " +
      "limite est une liste qui a cessé de classer.",
    "Chaque pick peut porter un `remark` : une courte proposition disant " +
      "pourquoi il passe devant. Laissez-le vide plutôt que de reformuler la " +
      "ligne qu'il accompagne. Un remark vaut d'être écrit quand il dit ce " +
      "que la phrase ne dit pas — que celui-ci est sous le contrôle de la " +
      "personne, que deux d'entre eux sont la même habitude, que celui-ci va " +
      "continuer.",
  ],
  vocabularyHeading: "Employez les mots de cette app :",
  vocabulary: [
    "une **catégorie** est là où l'argent est enregistré — courses, loyer, " +
      "salaire. Jamais « poste », « étiquette » ni « tag ».",
    "ce qui a bougé est un **constat**, et le montant à côté est son " +
      "**poids**. Ne l'appelez jamais « alerte », « anomalie », « insight » " +
      "ni « problème ».",
    "une hausse n'est pas un « pic » et une baisse n'est pas un " +
      "« décrochage ».",
    "n'appelez jamais cela une analyse, un rapport ni une synthèse.",
  ],
  findingsHeading:
    "Les constats, sous la forme id | catégorie et ce qu'elle a fait | poids " +
    "| quel sens est bon. Un poids négatif est une baisse, un poids positif " +
    "une hausse :",
};

const PROMPT = { en: EN, fr: FR } as const;

export function buildCategorySelectionPrompt(
  findings: readonly CategoryFinding[],
  { money, locale = DEFAULT_LOCALE }: BuildCategorySelectionPromptOptions,
): MonthReadRequest {
  const text = PROMPT[locale];

  const system = [
    ...text.intro,
    "",
    text.catalogueRule,
    text.figureRule,
    "",
    text.vocabularyHeading,
    ...text.vocabulary.map((line) => `- ${line}`),
    "",
    ...text.shape,
    "",
    // Repeated last. These are the two rules whose failure costs the most,
    // and adherence decays across a long system message — the finding
    // `month-read-prompt.ts` records having measured.
    text.catalogueRule,
    text.figureRule,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const user = [
    text.findingsHeading,
    factLines({ facts: findingFacts(findings, locale) }, money, locale),
  ].join("\n");

  return { system, user, locale };
}
