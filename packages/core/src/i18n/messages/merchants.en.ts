/**
 * « Par commerce »: every place the money went, one card a shop
 * (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 4). `en.ts` mounts it as
 * `merchants`.
 */
export const merchantsEn = {
  intro:
    "Every place your money went in the last twelve months, by what you spent there.",
  searchLabel: "Find a shop",
  searchPlaceholder: "A shop, a category",
  empty: "Nothing to show yet",
  emptyBody:
    "Shops appear as you record what you spend, or bring your statement.",
  noMatch: "No shop with these words",
  noMatchBody: "Try fewer letters, or another word.",
  visits: { one: "{count} time", other: "{count} times" },
  lastOn: "Last on {date}",
  normal: "{amount} in a normal month",
  perVisit: "{amount} a time",
  total: "{amount} over 12 months",
  mixed: "Filed under several categories",
  open: "Open {name}",
  moreRows: { one: "+{count} more", other: "+{count} more" },
  chartLabel: "Month by month, the last twelve",
  count: { one: "{count} shop", other: "{count} shops" },
};
