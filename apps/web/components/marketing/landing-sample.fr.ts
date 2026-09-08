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
  onBudgetLabel: "Dans les clous",

  budgetLabel: "Courses",

  goalLabel: "Fonds d'urgence",
  goalTargetLabel: "décembre 2026",

  /** In the order `landingSample.transactions` holds them. */
  transactions: [
    { name: "Acme SAS", meta: "Salaire" },
    { name: "Propriétaire", meta: "Loyer" },
    { name: "Carrefour", meta: "Courses" },
    { name: "Fonds d'urgence", meta: "Épargne" },
    { name: "DCA PEA", meta: "Investissements" },
    { name: "Électricité", meta: "Charges", dayLabel: "Aujourd'hui" },
  ],

  recurring: [
    { name: "Salaire", frequency: "Mensuel" },
    { name: "Loyer", frequency: "Mensuel" },
    { name: "DCA PEA", frequency: "Hebdomadaire" },
    { name: "Netflix", frequency: "Mensuel" },
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
      "Il vous reste 1 247 € à douze jours de la fin, soit devant là où février en était le même jour.",
      "Les dépenses non enregistrées de février se montent à 218 € — dans votre enveloppe de 260 €, mais c'est la plus grosse ligne pour laquelle vous n'avez aucune écriture.",
      "Le logement, à 850 €, est inchangé pour le quatrième mois et représente maintenant 44 % de ce que vous dépensez.",
    ],
    suggestions: [
      "Les courses sont sous leur plafond de 600 € tous les mois depuis décembre. Un plafond plus bas vous dirait quelque chose que celui-ci ne peut pas dire.",
    ],
    standing: "Écrit aujourd'hui. Rien n'a bougé depuis.",
  },

  spendByCategory: [
    "Logement",
    "Investissements",
    "Épargne",
    "Courses",
    "Tout le reste",
  ],
};
