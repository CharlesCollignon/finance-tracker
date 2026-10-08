// Strips what names a person from a real bank export, keeping its layout, so
// it can become a test file for the import (docs/plans/EVERYDAY_PLAN.md,
// phase 2: a bank's preset or PDF layout is added only once its export is
// here).
//
//   node scripts/anonymise-statement.mjs <export> [--name "Prénom Nom"]... [--out <file>]
//
// Writes `<export>.anon.<ext>` (or `--out`) in the export's own encoding —
// UTF-8 or Windows-1252, which is part of what the test should see — and
// prints what it replaced. Read the result before committing it: a name the
// patterns below do not know is still in it, which is what `--name` is for.
//
// Kept: the dates, the amounts, the shops, the column names, the lines above
// the header, the separators. Replaced, by something of the same shape:
//   - IBANs and BICs' account parts, card and account numbers (any run of
//     eight digits or more), OFX's ACCTID / BANKID / BRANCHID;
//   - e-mail addresses and French phone numbers;
//   - a street address (« 12 RUE … ») and a postcode with its town;
//   - a title and the words after it (« M. JEAN DUPONT », « MME … »);
//   - every name passed with `--name`, accents and case ignored.

import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

/* ---------------------------------------------------------------- encoding */

const WINDOWS_1252_HIGH = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};
const WINDOWS_1252_BACK = Object.fromEntries(
  Object.entries(WINDOWS_1252_HIGH).map(([byte, point]) => [
    point,
    Number(byte),
  ]),
);

function decode(bytes) {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
    };
  } catch {
    const text = Array.from(bytes, (byte) =>
      String.fromCodePoint(WINDOWS_1252_HIGH[byte] ?? byte),
    ).join("");
    return { text, encoding: "windows-1252" };
  }
}

function encode(text, encoding) {
  if (encoding === "utf-8") {
    return new TextEncoder().encode(text);
  }
  return Uint8Array.from(Array.from(text), (char) => {
    const point = char.codePointAt(0);
    const byte = WINDOWS_1252_BACK[point] ?? point;
    if (byte > 0xff) {
      throw new Error(`« ${char} » has no Windows-1252 byte`);
    }
    return byte;
  });
}

/* -------------------------------------------------------------- arguments */

const args = process.argv.slice(2);
const names = [];
let input = null;
let output = null;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--name") {
    names.push(args[++index]);
  } else if (args[index] === "--out") {
    output = args[++index];
  } else {
    input = args[index];
  }
}
if (!input) {
  console.error(
    'Usage: node scripts/anonymise-statement.mjs <export> [--name "Prénom Nom"]... [--out <file>]',
  );
  process.exit(1);
}
output ??= input.replace(
  new RegExp(`${extname(input)}$`),
  `.anon${extname(input)}`,
);

/* ------------------------------------------------------------ replacements */

const replaced = new Map();
function count(kind) {
  replaced.set(kind, (replaced.get(kind) ?? 0) + 1);
}

/** Digits to zeros and letters to X, so the shape — and the column — stays. */
function sameShape(value) {
  return value.replace(/\d/g, "0").replace(/[A-Za-z]/g, "X");
}

function stripAccents(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const { text, encoding } = decode(readFileSync(input));
let out = text;

// OFX account fields.
out = out.replace(
  /(<(ACCTID|BANKID|BRANCHID)>)([^<\r\n]+)/gi,
  (_, tag, _name, value) => {
    count("OFX account field");
    return tag + sameShape(value);
  },
);

// IBANs, before the digit runs they contain.
out = out.replace(
  /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
  (iban) => {
    count("IBAN");
    return iban.slice(0, 2) + sameShape(iban.slice(2));
  },
);

// E-mail addresses and French phone numbers.
out = out.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => {
  count("e-mail");
  return "adresse@exemple.fr";
});
out = out.replace(
  /(?<!\d)(?:\+33\s?|0)[1-9](?:[ .-]?\d{2}){4}(?!\d)/g,
  (phone) => {
    count("phone");
    return sameShape(phone);
  },
);

// Card and account numbers: eight digits or more in a row, or groups of four
// separated by spaces — but never a date or an amount, which have
// separators of their own, nor a short number after a card's digits.
out = out.replace(
  /(?<![\d,.])(?:\d{4}(?: \d{4}){1,4}(?: \d{1,3})?|\d{8,})(?![\d,.])/g,
  (digits) => {
    count("account or card number");
    return sameShape(digits);
  },
);

// A street address and a postcode with its town.
out = out.replace(
  /\b\d{1,4}(?:\s?(?:BIS|TER))?,?\s+(?:RUE|AVENUE|AV|BD|BOULEVARD|ALLEE|ALLÉE|CHEMIN|PLACE|IMPASSE|QUAI|COURS|ROUTE|LOT|RESIDENCE|RÉSIDENCE)\b[^;,\t\r\n"]*/gi,
  () => {
    count("street address");
    return "1 RUE DE L'EXEMPLE";
  },
);
out = out.replace(/\b(?:F-)?\d{5}\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿ' -]{2,}\b/g, () => {
  count("postcode and town");
  return "75000 VILLE";
});

// A title and the words after it.
out = out.replace(
  /\b(M\.?|MR|MME|MLLE|MONSIEUR|MADAME|MADEMOISELLE)(\s+)(?:(?:OU|ET)\s+(?:M\.?|MR|MME|MLLE)\s+)?(?:[A-ZÀ-Ÿ][A-ZÀ-Ÿ'-]+\s?){1,3}/g,
  (whole, title, space) => {
    count("title and name");
    return `${title}${space}NOM${/\s$/.test(whole) ? " " : ""}`;
  },
);

// Every name given, whole words, accents and case ignored.
for (const name of names) {
  for (const word of name.split(/\s+/).filter((part) => part.length > 1)) {
    const escaped = stripAccents(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu");
    // Matched on the accent-free text, replaced in the real one: both have
    // the same length when the text is in composed form, as exports are.
    const plain = stripAccents(out.normalize("NFC"));
    out = out.normalize("NFC");
    let rebuilt = "";
    let last = 0;
    for (const match of plain.matchAll(pattern)) {
      count("given name");
      rebuilt += out.slice(last, match.index) + "NOM";
      last = match.index + match[0].length;
    }
    out = rebuilt + out.slice(last);
  }
}

writeFileSync(output, encode(out, encoding));

console.log(`${input} → ${output} (${encoding})`);
for (const [kind, times] of replaced) {
  console.log(`  ${times} × ${kind}`);
}
console.log(
  "Read it before committing: a name these patterns do not know is still in it.",
);
