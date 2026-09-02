/**
 * Merchant category codes, mapped onto the categories this app ships with.
 *
 * An MCC is the one piece of categorisation the card networks do for us, and
 * it arrives on most card transactions. It is coarse — 5812 is every
 * restaurant from a canteen to a three-star — but coarse is exactly right
 * here: it only has to pick the drawer, and the user's own history is what
 * refines it afterwards.
 *
 * Mapped to category *names* rather than ids, because categories are the
 * user's and a name is the only stable thing to match on. A name that does
 * not exist in their list simply means no suggestion, which is the honest
 * outcome rather than a wrong drawer.
 */

/** Default category names, from DEFAULT_CATEGORIES in constants. */
export const MCC_CATEGORY_NAMES: Record<string, string> = {
  // Food shopping
  "5411": "Groceries",
  "5412": "Groceries",
  "5422": "Groceries",
  "5441": "Groceries",
  "5451": "Groceries",
  "5462": "Groceries",
  "5499": "Groceries",

  // Eating and drinking out — the spending this whole feed exists to catch.
  "5812": "Restaurants",
  "5814": "Restaurants",
  "5813": "Bars",

  // Getting about
  "4111": "Transportation",
  "4112": "Transportation",
  "4121": "Transportation",
  "4131": "Transportation",
  "4784": "Transportation",
  "4789": "Transportation",
  "5541": "Transportation",
  "5542": "Transportation",
  "7523": "Transportation",
  "7538": "Transportation",
  "7542": "Transportation",

  // Utilities and connectivity
  "4814": "Internet",
  "4816": "Internet",
  "4899": "Internet",
  "4900": "Electricity",

  // Recurring digital spend
  "5732": "Subscriptions",
  "5734": "Subscriptions",
  "5735": "Subscriptions",
  "5815": "Subscriptions",
  "5816": "Subscriptions",
  "5817": "Subscriptions",
  "5818": "Subscriptions",
  "7841": "Subscriptions",

  // Health and sport
  "7997": "Sport",
  "7991": "Sport",
  "7941": "Sport",
  "5940": "Sport",
  "5941": "Sport",

  // Insurance and property
  "6300": "Insurance",
  "6381": "Insurance",
  "6399": "Insurance",

  // Bank charges
  "6012": "Bank card fees",
  "6010": "Bank card fees",
};

/**
 * Codes that must never auto-categorise, whatever the merchant history says.
 *
 * A cash withdrawal is not spending — the money moves from one pocket to
 * another and is spent later, invisibly, which is the very thing the month
 * close measures. Booking it as an expense would double-count it against
 * whatever the cash actually bought.
 */
export const MCC_NEVER_AUTOMATIC = new Set(["6011", "6051", "4829", "6540"]);

/** The category name this code suggests, if any. */
export function categoryNameForMcc(
  mcc: string | null | undefined,
): string | null {
  if (!mcc) {
    return null;
  }
  return MCC_CATEGORY_NAMES[mcc.trim()] ?? null;
}

/** Whether this code is one the user must always look at. */
export function mccNeedsReview(mcc: string | null | undefined): boolean {
  return mcc ? MCC_NEVER_AUTOMATIC.has(mcc.trim()) : false;
}
