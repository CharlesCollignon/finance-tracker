/**
 * « Déclaration de revenus » (`packages/core/src/tax-return.ts`): the page,
 * its boxes and the card Le point shows in April. `en.ts` mounts it as `tax`.
 */
export const taxEn = {
  title: "Tax return",
  intro:
    "Your {year} amounts, box by box, from what you recorded. Check each box on impots.gouv.fr: Pluclair does not fill in your return and gives no tax advice.",
  forms: "Boxes of the {forms} forms.",
  provisional:
    "The {forms} forms are not out yet: these are the {known} boxes. Check them when they come out.",
  verify: "Code to check on the form.",
  footer:
    "Pluclair adds up what you recorded. It works out no tax and no credit: your ceilings depend on your household.",
  year: "Income {year}",
  rows: { one: "One entry", other: "{count} entries" },
  none: "Nothing recorded for this box in {year}.",
  categoriesHint: "The categories whose entries go in this box.",
  noCategory: "No category yet",
  fromPer: "From your payments into your PER (Investments).",
  fromRentBare: "From the rents of your bare lets (Property).",
  fromRentFurnished: "From the rents of your furnished lets (Property).",
  seasonTitle: "Your tax return",
  seasonBody: "Your {year} amounts are ready, box by box.",
  seasonCta: "See them",
  profileLink: "Tax return",
  boxes: {
    "7UF": {
      label: "Gifts to bodies of general interest",
      rule: "66% reduction, within 20% of taxable income.",
    },
    "7UD": {
      label: "Gifts to help people in difficulty",
      rule: "75% reduction up to {ceiling}, the rest at 66%.",
    },
    "7DB": {
      label: "Employing someone at home",
      rule: "50% credit on what you paid, up to {ceiling} a year, raised by your household.",
    },
    "7GA": {
      label: "Childcare outside the home, first child under 6",
      rule: "50% credit, up to {ceiling} per child.",
    },
    "7GB": {
      label: "Childcare outside the home, second child under 6",
      rule: "50% credit, up to {ceiling} per child.",
    },
    "7GC": {
      label: "Childcare outside the home, third child under 6",
      rule: "50% credit, up to {ceiling} per child.",
    },
    "6NS": {
      label: "Payments into your PER",
      rule: "Deductible within the retirement ceiling shown on your tax notice.",
    },
    "4BE": {
      label: "Rents of a bare let (micro-foncier)",
      rule: "Gross rents; 30% is taken off, if they stay under {ceiling} a year.",
    },
    "5NI": {
      label: "Receipts of a furnished let (micro-BIC)",
      rule: "Gross receipts; 50% is taken off, up to {ceiling}.",
    },
  },
  note7UD2025: "Given from 14 October 2025: box 7UQ, up to €2,000.",
};
