/**
 * What Entraide masks in a question or an answer before it is published:
 * anything that looks like an IBAN, a card or account number, an email
 * address or a phone number (« Les règles d'Entraide », « Avant qu'un
 * message soit publié »). The writer is shown what was masked, in the
 * preview, before anything goes out.
 *
 * It errs on the side of masking — a number that only looks like a card's
 * is masked too — because what a wrong mask costs is a word, and what a
 * missed one costs is someone's bank details in a public, indexed page.
 * Amounts, dates, postcodes and article numbers are left alone. It is a
 * help, not a lock: the rules still say to leave such things out.
 */

export type MaskKind = "iban" | "card" | "account" | "email" | "phone";

/** What a masked span is replaced by, in the post itself — in French, the language of Entraide. */
export const MASK_LABEL: Record<MaskKind, string> = {
  iban: "[IBAN masqué]",
  card: "[carte masquée]",
  account: "[numéro masqué]",
  email: "[e-mail masqué]",
  phone: "[téléphone masqué]",
};

export interface MaskResult {
  text: string;
  /** Each kind found, once, in the order first met. */
  masked: MaskKind[];
}

// Two letters and two check digits, then 11 to 30 letters and digits,
// written whole or in groups of four. Case-insensitive: people type them
// in lower case too.
const IBAN =
  /\b[a-z]{2}\d{2}(?:[ \u00a0\u202f-]?[a-z0-9]{4}){2,7}(?:[ \u00a0\u202f-]?[a-z0-9]{1,4})?\b/gi;

const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

// French numbers (0X XX XX XX XX, +33 X XX XX XX XX, 0033…), with spaces,
// dots or dashes between the pairs, or none; and any other number written
// with a leading + and 8 to 15 digits.
const PHONE =
  /(?:(?<![\d+])(?:\+33|0033)[ \u00a0\u202f.-]?[1-9](?:[ \u00a0\u202f.-]?\d{2}){4}|(?<![\d,.])0[1-9](?:[ \u00a0\u202f.-]?\d{2}){4}|(?<![\w+])\+\d(?:[ \u00a0\u202f.-]?\d){7,14})(?![\d,])/g;

// A run of 11 or more digits, whole or grouped by spaces or dashes: a card
// number (13 to 19 digits that pass the Luhn check), or otherwise an
// account or customer number. Grouped thousands of a real amount never get
// this long.
const LONG_NUMBER = /(?<![\d,.])\d(?:[ \u00a0\u202f-]?\d){10,22}(?![\d,])/g;

function digitsOf(span: string): string {
  return span.replace(/\D/g, "");
}

/** The Luhn check every payment card number passes. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * An IBAN-shaped span is mostly digits after its country and check digits
 * (a French one has at least 12 among its 23): a run of words that happens
 * to start with two letters and two digits is not one.
 */
function looksLikeIban(span: string): boolean {
  const rest = span.replace(/[^a-z0-9]/gi, "").slice(4);
  return rest.length >= 11 && (rest.match(/\d/g)?.length ?? 0) >= 8;
}

export function maskPersonalData(text: string): MaskResult {
  const masked: MaskKind[] = [];
  const note = (kind: MaskKind) => {
    if (!masked.includes(kind)) {
      masked.push(kind);
    }
  };

  let out = text.replace(EMAIL, () => {
    note("email");
    return MASK_LABEL.email;
  });
  out = out.replace(IBAN, (span) => {
    if (!looksLikeIban(span)) {
      return span;
    }
    note("iban");
    return MASK_LABEL.iban;
  });
  out = out.replace(PHONE, () => {
    note("phone");
    return MASK_LABEL.phone;
  });
  out = out.replace(LONG_NUMBER, (span) => {
    const digits = digitsOf(span);
    const card =
      digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
    note(card ? "card" : "account");
    return card ? MASK_LABEL.card : MASK_LABEL.account;
  });
  return { text: out, masked };
}
