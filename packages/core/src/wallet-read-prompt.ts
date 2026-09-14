/**
 * What the reader of the wallets is asked.
 *
 * Built on `month-read-prompt.ts` and reusing its `factLines` and
 * `missingLines`, because the figure discipline is the same discipline and a
 * second rendering of a fact list would be a second thing to keep in step.
 *
 * Three rules exist here that do not exist there, and each one is a specific
 * failure this subject invites:
 *
 *   - **No percentages, only a weight class.** A model asked to propose an
 *     allocation will write percentages, and percentages are the one thing it
 *     may never write. It is given five ordinal classes instead and the app
 *     turns them into weights.
 *   - **The overlap figure is a floor.** `writesAFigure` catches digits; it
 *     does not catch "about a fifth". A model handed a lower bound will
 *     restate it as a measurement unless told not to, and that restatement is
 *     the most misleading sentence this feature could produce.
 *   - **Geography is not currency.** The app knows where the companies are.
 *     It knows nothing about currency exposure, and a model given country
 *     weights volunteers a claim about the dollar within a sentence or two.
 *
 * The figure rule is stated first and repeated last, for the reason
 * `month-read-prompt.ts` records: instruction adherence decays across a long
 * system message, and this is the rule whose failure is expensive.
 */

import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { factLines, missingLines } from "./month-read-prompt";
import { shortlistForWrapper } from "./etf-shortlist";
import { INVESTMENT_WALLET_LABELS } from "./investments";
import { formatCharge } from "./fund-costs";
import type { InvestmentWalletId } from "./investments";
import type { LookThrough } from "./look-through";
import type { LookThroughFacts } from "./look-through-facts";
import type { WalletReadRequest } from "./wallet-read";

export const WALLET_READ_PROMPT_VERSION = 1;

export interface BuildWalletPromptOptions {
  money: (amount: number) => string;
  locale?: Locale;
  /** The wrappers this person actually holds something in. */
  wallets: InvestmentWalletId[];
}

/**
 * The catalogue, written out for the prompt.
 *
 * Handed over in full rather than summarised, which is what makes refusing an
 * ISIN outside it defensible: the model cannot have been expected to know
 * about something it was not shown, and it was shown everything.
 */
function catalogueLines(
  wallets: InvestmentWalletId[],
  locale: Locale,
): string {
  const offered = new Map<string, string>();

  for (const wallet of wallets.length > 0 ? wallets : (["cto"] as const)) {
    for (const entry of shortlistForWrapper(wallet)) {
      const charge =
        entry.terHint === null
          ? locale === "fr"
            ? "frais inconnus"
            : "charge unknown"
          : formatCharge(entry.terHint.charge);
      const wrappers = entry.wrappers
        .map((id) => INVESTMENT_WALLET_LABELS[id])
        .join("/");
      offered.set(
        entry.isin,
        `  ${entry.isin} | ${entry.name} | ${entry.index} | ${charge} | ${wrappers}`,
      );
    }
  }

  return [...offered.values()].join("\n");
}

function collisionLines(lookThrough: LookThrough, locale: Locale): string {
  if (lookThrough.indexCollisions.length === 0) {
    return locale === "fr"
      ? "  aucune paire ne suit le même indice ni un indice imbriqué"
      : "  no pair tracks the same or a nested index";
  }

  return lookThrough.indexCollisions
    .map((collision) =>
      locale === "fr"
        ? `  ${collision.names[0]} (${collision.indexes[0]}) et ${collision.names[1]} (${collision.indexes[1]})` +
          (collision.identical ? " — le même indice" : " — indices imbriqués")
        : `  ${collision.names[0]} (${collision.indexes[0]}) and ${collision.names[1]} (${collision.indexes[1]})` +
          (collision.identical ? " — the same index" : " — nested indices"),
    )
    .join("\n");
}

function wrapperLines(lookThrough: LookThrough, locale: Locale): string | null {
  if (lookThrough.eligibility.length === 0) {
    return null;
  }
  return lookThrough.eligibility
    .map((issue) => {
      const allowed = issue.allowedIn
        .map((id) => INVESTMENT_WALLET_LABELS[id])
        .join("/");
      return locale === "fr"
        ? `  ${issue.name} est dans un ${INVESTMENT_WALLET_LABELS[issue.walletId]} mais n'est éligible qu'au ${allowed}`
        : `  ${issue.name} sits in a ${INVESTMENT_WALLET_LABELS[issue.walletId]} but is only eligible for ${allowed}`;
    })
    .join("\n");
}

const EN = {
  intro: [
    "You are reading one person's investment positions and saying what you " +
      "make of them. You are writing for the person whose money it is, who " +
      "can see every figure you cite on the same screen.",
    "",
    "This is not advice. Describe what is there, say what it implies, and " +
      "where you suggest something, say why. Do not tell anyone what they " +
      "ought to do with their money, do not predict a return, and do not " +
      "claim anything is safe.",
  ],
  figureRule:
    "Every figure you mention must be written as {{fact:id}}, using an id " +
    "from the list you are given. Never write a number yourself — not a " +
    "digit, not a spelled-out amount, not a share, a sum, a difference, a " +
    "percentage or a target of your own. Not 'about a fifth', not 'roughly " +
    "double', not 'a third of it'. If something you want to say needs a " +
    "figure that is not in the list, say it without the figure or do not say " +
    "it.",
  weightRule:
    "You never write an allocation percentage. For each instrument you " +
    "suggest, choose a weightClass instead: 'lead' (the holding the " +
    "portfolio is built around), 'support' (a substantial second position), " +
    "'satellite' (a small deliberate tilt), 'trim' (keep but reduce) or " +
    "'exit' (stop holding). The app turns those into percentages itself.",
  instrumentRule:
    "Every instrument you suggest must be one of the ISINs in the catalogue " +
    "below, copied exactly, and placed in a wrapper that line says it is " +
    "eligible for. Do not name a fund that is not in the catalogue, however " +
    "well known — if the right answer is not there, suggest nothing and say " +
    "what is missing instead. Do not write the fund's name; the app prints " +
    "it from the ISIN.",
  overlapRule:
    "Where you are told two holdings share companies, that figure is a " +
    "floor: only each fund's published largest holdings were compared, so " +
    "the real overlap is higher and may be much higher. Never restate it as " +
    "an amount or a share, and never imply it is small. The indices two " +
    "funds track are the reliable signal — if one index contains the other, " +
    "say they are not diversifying each other and leave the figure alone.",
  currencyRule:
    "Country weights say where the companies are. They say nothing about " +
    "what currency anyone is paid in or exposed to. Do not mention currency " +
    "risk, the dollar, or hedging — the data does not support it.",
  basisRule:
    "Each observation and suggestion lists in `basis` the ids of the figures " +
    "it rests on. Put every id you cite in the text into the basis too. Use " +
    "the bare id in basis — `us-share`, not `{{fact:us-share}}`.",
  vocabularyHeading: "Use this app's words:",
  vocabulary: [
    "a **wallet** is where invested value sits — a PEA, a CTO, an " +
      "assurance-vie, a PER, crypto. Never 'account', 'portfolio' or 'broker'.",
    "an **investment position** is the holding of one thing inside one " +
      "wallet. Never 'holding', 'asset' or 'line'.",
    "an **instrument** is something tradeable, identified by its ISIN. " +
      "Never 'ticker', 'security' or 'product'.",
    "the **look-through** is what the positions are made of once resolved to " +
      "their constituents. Never 'x-ray', 'breakdown' or 'drill-down'.",
    "never call any of this an analysis, a report, a summary or an insight.",
  ],
  shape: [
    "Write:",
    "- one `headline`: a single short line saying the most important thing.",
    "- up to four `observations`, each with a `tone` of 'good', 'neutral' or " +
      "'watch'. Say what is true and why it matters. The most useful " +
      "observations are usually about concentration nobody chose, doubling " +
      "up, and what the charges come to.",
    "- up to four `suggestions`, each with an `effort` of 'now', " +
      "'this-month' or 'habit', plus `isin`, `role`, `wallet` and " +
      "`weightClass`. Suggest nothing unless the look-through gives you a " +
      "reason to.",
  ],
  honesty: [
    "If part of the value has not been read, every share you are given is " +
      "worked out over the part that has. Say so rather than describing the " +
      "portfolio as if it were fully known, and never state an absence — an " +
      "unread instrument is unknown, not empty.",
  ],
  lengthRule: [
    "The headline is one line. Each observation and suggestion is one or two " +
      "sentences.",
  ],
  positionsHeading: "The positions:",
  factsHeading: "The figures, as id | what it is | value:",
  missingHeading: "Not available, and why:",
  catalogueHeading: "The instruments you may suggest, as ISIN | name | index | charge | wrappers:",
  collisionsHeading: "Holdings tracking the same or a nested index:",
  wrapperHeading: "Holdings sitting in a wrapper they are not eligible for:",
};

const FR = {
  intro: [
    "Vous lisez les positions d'investissement d'une personne et dites ce " +
      "que vous en pensez. Vous écrivez pour celle dont c'est l'argent, qui " +
      "voit sur le même écran chaque chiffre que vous citez.",
    "",
    "Ce n'est pas un conseil. Décrivez ce qui est là, dites ce que cela " +
      "implique, et quand vous suggérez quelque chose, dites pourquoi. Ne " +
      "dites à personne ce qu'il devrait faire de son argent, ne prédisez " +
      "aucun rendement, et n'affirmez pas que quoi que ce soit est sûr.",
  ],
  figureRule:
    "Chaque chiffre que vous mentionnez doit être écrit {{fact:id}}, avec un " +
    "id de la liste fournie. N'écrivez jamais de nombre vous-même — ni " +
    "chiffre, ni montant en lettres, ni part, ni somme, ni écart, ni " +
    "pourcentage, ni cible de votre cru. Ni « environ un cinquième », ni " +
    "« presque le double », ni « un tiers ». Si ce que vous voulez dire " +
    "exige un chiffre absent de la liste, dites-le sans le chiffre ou ne le " +
    "dites pas.",
  weightRule:
    "Vous n'écrivez jamais de pourcentage de répartition. Pour chaque " +
    "instrument suggéré, choisissez plutôt un weightClass : « lead » (la " +
    "ligne autour de laquelle le portefeuille est bâti), « support » (une " +
    "deuxième position substantielle), « satellite » (un petit pari " +
    "assumé), « trim » (garder mais réduire) ou « exit » (cesser de " +
    "détenir). L'app en fait elle-même des pourcentages.",
  instrumentRule:
    "Chaque instrument suggéré doit être un des ISIN du catalogue " +
    "ci-dessous, copié exactement, et placé dans une enveloppe que cette " +
    "ligne déclare éligible. Ne nommez pas un fonds absent du catalogue, " +
    "même très connu — si la bonne réponse n'y est pas, ne suggérez rien et " +
    "dites ce qui manque. N'écrivez pas le nom du fonds : l'app l'imprime à " +
    "partir de l'ISIN.",
  overlapRule:
    "Quand on vous dit que deux lignes partagent des sociétés, ce chiffre " +
    "est un plancher : seules les plus grosses lignes publiées de chaque " +
    "fonds ont été comparées, le chevauchement réel est donc supérieur et " +
    "peut l'être beaucoup. Ne le reformulez jamais en montant ni en part, " +
    "et ne laissez jamais entendre qu'il est faible. Les indices suivis " +
    "sont le signal fiable — si l'un contient l'autre, dites qu'ils ne se " +
    "diversifient pas mutuellement et laissez le chiffre tranquille.",
  currencyRule:
    "Les poids par pays disent où sont les sociétés. Ils ne disent rien de " +
    "la devise dans laquelle quiconque est payé ou exposé. Ne parlez pas de " +
    "risque de change, du dollar, ni de couverture : les données ne le " +
    "permettent pas.",
  basisRule:
    "Chaque observation et suggestion liste dans `basis` les ids des " +
    "chiffres sur lesquels elle repose. Mettez aussi dans `basis` tout id " +
    "cité dans le texte. Utilisez l'id nu dans `basis` — `us-share`, pas " +
    "`{{fact:us-share}}`.",
  vocabularyHeading: "Employez les mots de cette app :",
  vocabulary: [
    "un **portefeuille** (wallet) est là où l'encours investi se trouve — " +
      "PEA, CTO, assurance-vie, PER, crypto. Jamais « compte » ni « courtier ».",
    "une **position** est la détention d'une chose dans un portefeuille. " +
      "Jamais « ligne » ni « actif ».",
    "un **instrument** est quelque chose de négociable, identifié par son " +
      "ISIN. Jamais « ticker », « titre » ni « produit ».",
    "la **transparence** (look-through) est ce dont les positions sont " +
      "faites une fois résolues en leurs composants.",
    "n'appelez jamais cela une analyse, un rapport, une synthèse ni un " +
      "insight.",
  ],
  shape: [
    "Écrivez :",
    "- un `headline` : une seule ligne courte disant le plus important.",
    "- jusqu'à quatre `observations`, chacune avec un `tone` « good », " +
      "« neutral » ou « watch ». Dites ce qui est vrai et pourquoi cela " +
      "compte. Les observations les plus utiles portent en général sur une " +
      "concentration que personne n'a choisie, les doublons, et ce que les " +
      "frais représentent.",
    "- jusqu'à quatre `suggestions`, chacune avec un `effort` « now », " +
      "« this-month » ou « habit », plus `isin`, `role`, `wallet` et " +
      "`weightClass`. Ne suggérez rien si la transparence ne vous en donne " +
      "pas la raison.",
  ],
  honesty: [
    "Si une partie de l'encours n'a pas été lue, chaque part fournie est " +
      "calculée sur la partie qui l'a été. Dites-le plutôt que de décrire le " +
      "portefeuille comme s'il était entièrement connu, et n'affirmez jamais " +
      "une absence : un instrument non lu est inconnu, pas vide.",
  ],
  lengthRule: [
    "Le titre fait une ligne. Chaque observation et suggestion fait une ou " +
      "deux phrases.",
  ],
  positionsHeading: "Les positions :",
  factsHeading: "Les chiffres, sous la forme id | ce que c'est | valeur :",
  missingHeading: "Non disponible, et pourquoi :",
  catalogueHeading:
    "Les instruments que vous pouvez suggérer, sous la forme ISIN | nom | indice | frais | enveloppes :",
  collisionsHeading: "Lignes suivant le même indice ou un indice imbriqué :",
  wrapperHeading:
    "Lignes placées dans une enveloppe pour laquelle elles ne sont pas éligibles :",
};

const PROMPT = { en: EN, fr: FR } as const;

export function buildWalletReadPrompt(
  facts: LookThroughFacts,
  lookThrough: LookThrough,
  { money, locale = DEFAULT_LOCALE, wallets }: BuildWalletPromptOptions,
): WalletReadRequest {
  const text = PROMPT[locale];

  const system = [
    ...text.intro,
    "",
    text.figureRule,
    text.weightRule,
    "",
    text.instrumentRule,
    "",
    text.overlapRule,
    "",
    text.currencyRule,
    "",
    text.basisRule,
    "",
    text.vocabularyHeading,
    ...text.vocabulary.map((line) => `- ${line}`),
    "",
    ...text.shape,
    "",
    ...text.honesty,
    "",
    // Stated in sentences rather than characters, for the reason
    // `month-read-prompt.ts` records: a model asked for "240 characters"
    // cannot count them, and asked for two sentences lands inside the cap.
    ...text.lengthRule,
    "",
    // Repeated last. These are the two rules whose failure costs the most,
    // and adherence decays across a long system message.
    text.figureRule,
    text.weightRule,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const wrapperIssues = wrapperLines(lookThrough, locale);

  const user = [
    text.factsHeading,
    factLines(facts, money, locale),
    facts.missing.length > 0 ? "" : null,
    facts.missing.length > 0 ? text.missingHeading : null,
    facts.missing.length > 0 ? missingLines(facts, locale) : null,
    "",
    text.collisionsHeading,
    collisionLines(lookThrough, locale),
    wrapperIssues === null ? null : "",
    wrapperIssues === null ? null : text.wrapperHeading,
    wrapperIssues,
    "",
    text.catalogueHeading,
    catalogueLines(wallets, locale),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { system, user, locale };
}
