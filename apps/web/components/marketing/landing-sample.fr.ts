/**
 * The words in the sample month, in French.
 *
 * Text only. Every figure stays in `./landing-sample` and is shared by both
 * languages, because the mocks are cross-referenced — the calendar's dots are
 * the transaction list's rows, the spend split sums to `spent` — and a second
 * copy of the numbers is a second place for them to stop agreeing.
 *
 * The merchant names are localised too, and that is a choice rather than an
 * oversight: they are illustration, not data. A French visitor recognising
 * "Carrefour" and "EDF" reads the mock as a ledger; one reading "Landlord"
 * reads it as a translation.
 *
 * The prose in `read` quotes figures inline, which the real feature never
 * does — there the model names a figure and the app substitutes it. Here it
 * is a picture of the finished sentence, so the amounts are written out, and
 * they are written the French way.
 */
export const landingSampleFr = {
  monthLabel: "mars 2026",
  planByLabel: "mars 2027",

  /** In the order `landingSample.transactions` holds them. */
  transactions: [
    { name: "Acme SAS", meta: "Salaire" },
    { name: "Propriétaire", meta: "Loyer" },
    { name: "Carrefour", meta: "Courses" },
    { name: "Fonds d'urgence", meta: "Épargne" },
    { name: "DCA PEA", meta: "Investissements" },
    { name: "Électricité", meta: "Charges", dayLabel: "Aujourd'hui" },
  ],

  /**
   * In the order `landingSample.templates` holds them.
   *
   * `schedule` and not `frequency`: the schedule line is what the Charges
   * mock actually prints, and it used to come from a lookup table keyed on
   * the English name — so in French every template rendered a blank line
   * where "Mensuel · le 3" belongs. The cadence the arithmetic needs stays in
   * the English file, where no translation can reach it.
   */
  recurring: [
    { name: "Salaire", schedule: "Mensuel · le 3" },
    { name: "Loyer", schedule: "Mensuel · le 5" },
    { name: "DCA PEA", schedule: "Hebdomadaire · vendredi" },
    { name: "Netflix", schedule: "Mensuel · le 15" },
    { name: "Fonds d'urgence", schedule: "Mensuel · le 12" },
    { name: "Internet", schedule: "Mensuel · le 10" },
    { name: "Mutuelle", schedule: "Mensuel · le 25" },
  ],

  close: {
    monthLabel: "février 2026",
    readingDay: "le 8",
  },

  read: {
    writtenOn: "19 mars",
    headline:
      "Mars tient, et la part qui ne tient pas est celle que vous n'avez pas enregistrée.",
    observations: [
      "Vous êtes à +1 247 € sur le mois à douze jours de la fin, devant là où février en était le même jour.",
      "Les dépenses non enregistrées de février se montent à 218 € — dans votre marge de 260 €, mais c'est la plus grosse ligne pour laquelle vous n'avez aucune écriture.",
      "Le logement, à 850 €, est inchangé pour le quatrième mois et représente maintenant 59 % de ce que vous dépensez.",
    ],
    suggestions: [
      "Les courses en sont à 218 € à douze jours de la fin. Noter les petits achats cette semaine montrerait si la ligne non enregistrée, c'est aussi les courses.",
    ],
    standing: "Écrit aujourd'hui. Rien n'a bougé depuis.",
  },

  property: {
    name: "Studio, Lyon 7e",
    kindLine: "Appartement · Location meublée · 24 m²",
  },

  questions: {
    exchanges: [
      {
        question: "Combien ai-je dépensé en courses ce mois-ci ?",
        answer: [
          "Les courses en sont à {spent} en mars.",
          "Au même jour de février, c'était {before}.",
        ],
      },
      {
        question: "Quel est mon plus gros abonnement ?",
        answer: ["Netflix, à {netflix} par mois — le seul que vous ayez."],
      },
    ],
  },

  /** In the order `landingSample.together.rows` holds them. */
  together: {
    name: "Commun",
    me: "Moi",
    rows: [
      { meta: "Courses" },
      { meta: "Internet" },
      { meta: "Restaurants" },
      { name: "Versement de B.", meta: "Virement" },
      { name: "Versement de A.", meta: "Virement" },
    ],
  },

  /** What is still to leave, in the order `landingSample.bearingMonth.upcoming` holds it. */
  upcoming: ["DCA PEA", "Livret A", "Mutuelle", "DCA PEA"],

  /** The PEA's lines, in the order `landingSample.pea.positions` holds them. */
  peaPositions: ["ETF MSCI World", "ETF S&P 500", "ETF Pays émergents"],

  spendByCategory: [
    "Logement",
    "Courses",
    "Transports",
    "Charges",
    "Tout le reste",
  ],
};
