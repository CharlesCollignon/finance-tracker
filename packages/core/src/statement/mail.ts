import type { BankId } from "./banks";
import type { RawLine } from "./model";
import { makeLine } from "./table";
import { monthNumber, strictAmount, strictDate } from "./values";

/**
 * What a bank's e-mail says, forwarded to the person's own Pluclair address
 * (`docs/plans/STATEMENTS_PLAN.md`, Phase 4): which bank sent it, the
 * confirmation a mail service sends before it forwards anything, and the
 * one operation an alert e-mail announces — « Paiement par carte de 23,50 €
 * chez MONOP le 12/10 » — as a line the day it happens.
 *
 * Read carefully, and only so far: an e-mail is a bank's alert when its
 * sender is a bank and one amount in it plainly went out or came in. A
 * balance, a ceiling, a notice that a statement is ready, an advertisement
 * — nothing that is not one operation becomes a line. What is not
 * understood is counted, never guessed, and never kept.
 */

/** The domains each bank's e-mails come from, without the « www. ». */
const BANK_SENDERS: Record<BankId, readonly string[]> = {
  boursobank: [
    "boursobank.com",
    "boursobank.fr",
    "boursorama.com",
    "boursorama.fr",
  ],
  "credit-agricole": ["credit-agricole.fr", "credit-agricole.com"],
  "bnp-paribas": ["bnpparibas.com", "bnpparibas.fr", "bnpparibas"],
  "societe-generale": ["societegenerale.fr", "societegenerale.com", "sg.fr"],
  lcl: ["lcl.fr", "lcl.com"],
  "caisse-epargne": ["caisse-epargne.fr"],
  "banque-populaire": ["banquepopulaire.fr"],
  "credit-mutuel": [
    "creditmutuel.fr",
    "creditmutuel.com",
    "cmne.fr",
    "cmso.com",
  ],
  cic: ["cic.fr"],
  "la-banque-postale": ["labanquepostale.fr"],
  fortuneo: ["fortuneo.fr", "fortuneo.com"],
  "hello-bank": ["hellobank.fr"],
  monabanq: ["monabanq.com"],
  hsbc: ["hsbc.fr", "hsbc.com"],
  revolut: ["revolut.com"],
  n26: ["n26.com"],
  qonto: ["qonto.com"],
  shine: ["shine.fr"],
  nickel: ["nickel.eu", "compte-nickel.fr"],
  sumeria: ["sumeria.eu", "lydia-app.com"],
};

/** The bank an address writes from: its domain, or one under it. */
export function bankFromSender(
  address: string | null | undefined,
): BankId | null {
  const domain = /@([a-z0-9.-]+)/i
    .exec(address ?? "")?.[1]
    ?.toLowerCase()
    .replace(/\.$/, "");
  if (!domain) {
    return null;
  }
  for (const [bank, domains] of Object.entries(BANK_SENDERS) as [
    BankId,
    readonly string[],
  ][]) {
    if (domains.some((one) => domain === one || domain.endsWith(`.${one}`))) {
      return bank;
    }
  }
  // Each Crédit Agricole region writes from its own: ca-paris.fr, ca-alsace-vosges.fr…
  return /(^|\.)ca-[a-z-]+\.fr$/.test(domain) ? "credit-agricole" : null;
}

/**
 * The bank behind an e-mail: its sender, or — for one the person forwarded
 * by hand, which comes from their own address — the sender its forwarded
 * header names (« De : BoursoBank <alertes@boursobank.com> »).
 */
export function bankOfMail(mail: {
  from: string;
  text: string;
}): BankId | null {
  const direct = bankFromSender(mail.from);
  if (direct) {
    return direct;
  }
  for (const match of mail.text
    .slice(0, 6000)
    .matchAll(/^\s*>?\s*(?:de|from|exp[ée]diteur)\s*:\s*([^\n]+)$/gim)) {
    const bank = bankFromSender(match[1]);
    if (bank) {
      return bank;
    }
  }
  return null;
}

/**
 * Gmail's « confirm forwarding » e-mail, sent to the Pluclair address
 * before Gmail forwards anything: its code, and the link that confirms in
 * one tap — shown in the app the moment it arrives.
 */
export function forwardingConfirmation(mail: {
  from: string;
  subject: string;
  text: string;
}): { code: string | null; link: string | null } | null {
  if (!/forwarding-noreply@google\.com/i.test(mail.from)) {
    return null;
  }
  const code = /\b(\d{9})\b/.exec(`${mail.subject}\n${mail.text}`)?.[1] ?? null;
  const link =
    /https:\/\/(?:mail-settings|isolated\.mail|mail)\.google\.com\/mail\/(?:u\/\d+\/)?vf-[^\s"'<>)]+/.exec(
      mail.text,
    )?.[0] ?? null;
  return code || link ? { code, link } : null;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  euro: "€",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  ucirc: "û",
  ugrave: "ù",
  icirc: "î",
  Eacute: "É",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
};

/** An HTML e-mail as plain text: its words, a line per block, entities read. */
export function mailText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name] ?? whole)
    .replace(/[ \t  ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** An amount said in euros: « 23,50 € », « 1 234,56 EUR », « 12.30 euros ». */
const EURO_AMOUNT =
  /([+-]?\s?\d{1,3}(?:[  . ]\d{3})*(?:[.,]\d{1,2})?|[+-]?\s?\d+(?:[.,]\d{1,2})?)\s?(?:€|eur\b|euros?\b)/gi;

/** Words that make an amount something else than a movement. */
const NOT_A_MOVE =
  /\b(solde|plafond|d[ée]couvert|seuil|limite|disponible|encours|en cours|autorisation|frais estim|taux)\b/i;

/** Words that say money came in. */
const MONEY_IN =
  /\b(rembours\w*|cr[ée]dit(?:[ée]e?s?)?|vous avez re[çc]u|re[çc]u de|virement re[çc]u|en votre faveur|versement|encaissement|d[ée]p[ôo]t)\b/i;

/** Words that say money went out. */
const MONEY_OUT =
  /\b(paiement|pay[ée]e?|achat|d[ée]bit(?:[ée]e?s?)?|pr[ée]l[èe]vement|pr[ée]lev[ée]e?|retrait|virement (?:[ée]mis|envoy[ée]|vers)|d[ée]pense|transaction par carte|op[ée]ration (?:par )?carte)\b/i;

/** Who the money went to, or came from, as the e-mail names them. */
const COUNTERPARTY = [
  /\b(?:commer[çc]ant|b[ée]n[ée]ficiaire|libell[ée]|[ée]metteur|marchand|description|chez qui)\s*:\s*([^\n]{2,60})/i,
  // Not from a digit: « virement de 2 500 € de la part de ACME » names ACME.
  /\b(?:chez|aupr[èe]s de|au profit de|à destination de|de la part de|re[çc]u de|virement de|[ée]mis par)\s+([^\d\n,;:][^\n,;:]{1,59}?)(?=\s+(?:le|du|pour|avec|sur|a [ée]t[ée]|est|depuis|d['’]un|d['’]une|via)(?=[\s,.;]|$)|[\n,;:]|\.(?:\s|$)|$)/i,
];

/** A card's or an account's last four digits: « carte **** 4821 », « compte n°…4821 ». */
const TAIL =
  /(?:carte|compte|cb)[^\n\d]{0,30}?(?:n[°o]\s*|\*+\s*|x{2,}\s*|•+\s*|…\s*|se terminant par\s*|finissant par\s*)(?:\d+[ *x•…]+)?(\d{4})\b/i;

function dayOf(context: string, receivedOn: string): string {
  const received = new Date(`${receivedOn}T00:00:00Z`);
  const year = received.getUTCFullYear();
  const pick = (iso: string | null): string | null => {
    if (!iso) return null;
    const date = new Date(`${iso}T00:00:00Z`);
    const days = (received.getTime() - date.getTime()) / 86_400_000;
    return days >= -1 && days <= 31 ? iso : null;
  };
  const full = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/.exec(context);
  if (full) {
    const found = pick(strictDate(full[1]!));
    if (found) return found;
  }
  const short = /\b(?:le\s+)?(\d{1,2})[/.](\d{1,2})\b(?![/.]\d)/.exec(context);
  if (short) {
    const month = Number(short[2]);
    const iso = strictDate(
      `${month > received.getUTCMonth() + 1 ? year - 1 : year}-${String(month).padStart(2, "0")}-${short[1]!.padStart(2, "0")}`,
    );
    const found = pick(iso);
    if (found) return found;
  }
  const named =
    /\b(?:le\s+)(\d{1,2})(?:er)?\s+([a-zéû]{3,9})\.?(?:\s+(\d{4}))?/i.exec(
      context,
    );
  if (named) {
    const month = monthNumber(named[2]!);
    if (month) {
      const found = pick(
        strictDate(
          `${named[3] ?? (month > received.getUTCMonth() + 1 ? year - 1 : year)}-${String(month).padStart(2, "0")}-${named[1]!.padStart(2, "0")}`,
        ),
      );
      if (found) return found;
    }
  }
  return receivedOn;
}

/** The sentence an amount sits in: from the line or stop before it to the one after. */
function sentenceAround(text: string, at: number, length: number): string {
  const before = text.slice(0, at);
  const start = Math.max(
    before.lastIndexOf("\n"),
    before.search(/[.!?]\s[^.!?]*$/) + 1,
    0,
  );
  const rest = text.slice(at + length);
  const end = rest.search(/\n|[.!?](?:\s|$)/);
  return text
    .slice(start, at + length + (end === -1 ? rest.length : end))
    .trim();
}

/** The two lines either side of the amount's own: a labelled e-mail's block. */
function linesAround(text: string, at: number): string {
  let start = at;
  for (let count = 0; count < 3 && start > 0; count += 1) {
    start = text.lastIndexOf("\n", start - 1);
    if (start === -1) {
      start = 0;
      break;
    }
  }
  let end = at;
  for (let count = 0; count < 3 && end !== -1; count += 1) {
    end = text.indexOf("\n", end + 1);
  }
  return text.slice(start, end === -1 ? text.length : end);
}

export interface MailAlert {
  /** The bank that sent it. */
  bank: BankId;
  /** The card's or account's last four digits, when the e-mail gives them. */
  tail: string | null;
  line: RawLine;
}

/**
 * The one operation a bank's alert e-mail announces, or null: not a bank's
 * e-mail, or no amount in it that plainly went one way. Its words are the
 * counterparty's where the e-mail names them, the sentence itself
 * otherwise; its day the one it states, or the day it arrived.
 */
export function alertOf(mail: {
  from: string;
  subject: string;
  text: string;
  receivedOn: string;
}): MailAlert | null {
  const bank = bankOfMail(mail);
  if (!bank) {
    return null;
  }
  return alertInText(bank, `${mail.subject}\n${mail.text}`, mail.receivedOn);
}

/**
 * The one operation a bank's words announce, wherever they came from — an
 * e-mail, or a notification on the phone (`notification.ts`) — or null:
 * no amount in them that plainly went one way.
 */
export function alertInText(
  bank: BankId,
  words: string,
  receivedOn: string,
): MailAlert | null {
  const text = words.slice(0, 4000);

  for (const match of text.matchAll(EURO_AMOUNT)) {
    const at = match.index ?? 0;
    const sentence = sentenceAround(text, at, match[0].length);
    // What the amount's own line says just before it: « Solde : », « plafond de ».
    const lead = text.slice(
      Math.max(0, at - 60, text.lastIndexOf("\n", at - 1) + 1),
      at,
    );
    if (
      NOT_A_MOVE.test(lead) ||
      (NOT_A_MOVE.test(sentence) &&
        !MONEY_OUT.test(sentence) &&
        !MONEY_IN.test(sentence))
    ) {
      continue;
    }
    // A labelled e-mail says the way on another line: « Type : Prélèvement ».
    const near =
      MONEY_IN.test(sentence) || MONEY_OUT.test(sentence)
        ? sentence
        : linesAround(text, at);
    const goesIn = MONEY_IN.test(near);
    const goesOut = MONEY_OUT.test(near);
    // A refund of a payment is money in; otherwise both, or neither, is no answer.
    const direction = /\brembours/i.test(near)
      ? "in"
      : goesIn && !goesOut
        ? "in"
        : goesOut && !goesIn
          ? "out"
          : null;
    if (!direction) {
      continue;
    }
    const amount = strictAmount(match[1]!.replace(/\s/g, ""));
    if (amount === null || amount === 0) {
      continue;
    }
    const counterparty =
      COUNTERPARTY.map(
        (pattern) => pattern.exec(sentence) ?? pattern.exec(text),
      )
        .find((found) => found)?.[1]
        ?.trim()
        .replace(/\s+/g, " ") ?? null;
    const line = makeLine({
      date: dayOf(sentence, receivedOn),
      amount: direction === "out" ? -Math.abs(amount) : Math.abs(amount),
      label: counterparty ?? sentence.slice(0, 140),
      counterparty,
      currency: "EUR",
    });
    if (!line) {
      continue;
    }
    const tail =
      TAIL.exec(text)?.[1] ??
      /(?:compte|carte)[^\n\d]{0,30}?n[°o]\s*\d{2,}(\d{4})\b/i.exec(
        text,
      )?.[1] ??
      null;
    return { bank, tail, line };
  }
  return null;
}
