/**
 * « Opérations »: what happened inside a wallet — a buy, a sale, a
 * dividend, a fee — typed or read off the broker's export, and what
 * follows: the realised gains and the dividends by year
 * (`@finance/core/investment-events`, Phase 9 of
 * `docs/plans/REFERENCE_APP_PLAN.md`). `en.ts` mounts it as `events`.
 */
export const eventsEn = {
  /** The sheet on a wallet, and the button that opens it. */
  open: "Operations",
  intro:
    "What happened inside the account: a line bought or sold, a dividend received, a fee taken. Typed here, or read off the broker's export.",
  empty: "No operation yet",
  emptyBody:
    "Type one, or read the broker's export: a CSV or a spreadsheet of the account's movements.",
  count: { one: "{count} operation", other: "{count} operations" },
  fromFile: "from a file",
  /** The form. */
  new: "New operation",
  kind: "Kind",
  kindBuy: "Bought",
  kindSell: "Sold",
  kindDividend: "Dividend",
  kindFee: "Fee",
  date: "Date",
  instrument: "Line",
  instrumentPlaceholder: "e.g. Amundi MSCI World",
  isin: "ISIN",
  isinHint: "Optional: the twelve characters on the broker's statement.",
  isinInvalid: "An ISIN is two letters, nine letters or digits, then a digit",
  quantity: "Shares or units",
  amount: "Amount",
  amountBuy: "What it cost, fees included",
  amountSell: "What it brought in, fees deducted",
  amountDividend: "What was received, net",
  amountFee: "What was taken",
  note: "Note",
  add: "Add the operation",
  adding: "Adding…",
  added: "Operation added",
  delete: "Delete",
  deleteNamed: "Delete the operation of {date}",
  deleted: "Operation deleted",
  close: "Close",
  /** The broker's file. */
  importFile: "Read the broker's export",
  importing: "Reading…",
  importHint:
    "A CSV or a spreadsheet of the account's movements, as the broker gives it. A line already read is never added twice.",
  importRead: {
    one: "{count} operation read",
    other: "{count} operations read",
  },
  importSkipped: {
    one: "{count} line set aside: not an operation",
    other: "{count} lines set aside: not operations",
  },
  importConfirm: "Add them",
  importNone: "Nothing to add",
  imported: {
    one: "{count} operation added",
    other: "{count} operations added",
  },
  importedKnown: {
    one: "{count} already known",
    other: "{count} already known",
  },
  importNoTable:
    "This file is not a table the app can read. A CSV or a spreadsheet is.",
  importNoColumns:
    "No header naming a date and an amount was found in this file.",
  importEmpty: "This file is empty.",
  importSynthetic:
    "Read by the names of the columns and the words of each line, in French or English, and built on sample exports: check the first file read.",
  /** The Analyse card. */
  cardTitle: "Dividends and realised gains",
  cardEmpty:
    "Nothing yet. Operations typed, or read off the broker's export, show here by year.",
  cardBody:
    "Each sale is set against the oldest purchases of the same line still held, first in first out, as the tax office reads them. Dividends and fees are what was received and taken, net.",
  gains: "Realised gains",
  dividends: "Dividends",
  fees: "Fees",
  proceeds: "Sold for",
  basis: "Had cost",
  uncovered: {
    one: "{count} sale without all its purchases recorded: its gain is overstated by their cost.",
    other:
      "{count} sales without all their purchases recorded: their gain is overstated by their cost.",
  },
};
