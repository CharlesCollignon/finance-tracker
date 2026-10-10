import { FIGURE_PATTERN, figureKey } from "./ask-figures";

/**
 * The little Markdown an Ask Pluclair answer is written in, read into blocks
 * both apps draw with their own components (`./ask-chat`).
 *
 * Headings, paragraphs, lists, tables, quotes and rules; bold, italics and
 * code inside them. Nothing else: no links, images or HTML — what the model
 * writes as one is shown as its text. Lenient by necessity, because the
 * answer is read while it is still being written: an unclosed `**` is two
 * asterisks until its partner arrives, and a table is a paragraph until its
 * separator line does.
 *
 * Every amount and percentage is its own inline, so a screen can blur it
 * with the others and mark the ones the app could not find (`./ask-figures`).
 */

export type AskInline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: AskInline[] }
  | { kind: "em"; children: AskInline[] }
  | { kind: "code"; text: string }
  | { kind: "figure"; text: string; traced: boolean };

export type AskAlign = "left" | "center" | "right";

export type AskBlock =
  | { kind: "heading"; level: 2 | 3; inline: AskInline[] }
  | { kind: "paragraph"; inline: AskInline[] }
  | { kind: "list"; ordered: boolean; start: number; items: AskInline[][] }
  | {
      kind: "table";
      header: AskInline[][];
      align: AskAlign[];
      rows: AskInline[][][];
    }
  | { kind: "quote"; inline: AskInline[] }
  | { kind: "rule" };

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/**
 * An answer's blocks. `untraced` holds the figures the app could not find,
 * as `untracedFigures` wrote them.
 */
export function parseAskMarkdown(
  markdown: string,
  untraced: readonly string[] = [],
): AskBlock[] {
  const unknown = new Set(untraced.map(figureKey));
  const inline = (text: string) => parseInline(text, unknown);
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: AskBlock[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: {
    ordered: boolean;
    start: number;
    items: string[];
  } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", inline: inline(paragraph.join(" ")) });
      paragraph = [];
    }
    if (quote.length > 0) {
      blocks.push({ kind: "quote", inline: inline(quote.join(" ")) });
      quote = [];
    }
    if (list) {
      blocks.push({
        kind: "list",
        ordered: list.ordered,
        start: list.start,
        items: list.items.map(inline),
      });
      list = null;
    }
  };

  for (let at = 0; at < lines.length; at++) {
    const line = lines[at]!;
    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1]!.length <= 2 ? 2 : 3,
        inline: inline(heading[2]!),
      });
      continue;
    }

    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }

    // A table: a row of cells, then the separator line under it.
    if (line.includes("|") && TABLE_SEPARATOR.test(lines[at + 1] ?? "")) {
      flush();
      const header = cells(line);
      const align = cells(lines[at + 1]!).map(alignOf);
      const rows: AskInline[][][] = [];
      at += 2;
      while (at < lines.length && lines[at]!.includes("|")) {
        const row = cells(lines[at]!);
        rows.push(header.map((_, column) => inline(row[column] ?? "")));
        at += 1;
      }
      at -= 1;
      blocks.push({
        kind: "table",
        header: header.map(inline),
        align: header.map((_, column) => align[column] ?? "left"),
        rows,
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = ordered !== null;
      const text = bullet ? bullet[2]! : ordered![3]!;
      if (paragraph.length > 0 || quote.length > 0) {
        flush();
      }
      // A nested item joins its parent's list: one level is drawn.
      const nested = (bullet ?? ordered)![1]!.length >= 2;
      if (!list || (list.ordered !== isOrdered && !nested)) {
        flush();
        list = {
          ordered: isOrdered,
          start: ordered ? Number(ordered[2]) : 1,
          items: [],
        };
      }
      list.items.push(text);
      continue;
    }

    const quoted = QUOTE.exec(line);
    if (quoted) {
      if (paragraph.length > 0 || list) {
        flush();
      }
      quote.push(quoted[1]!);
      continue;
    }

    // A line under a list item, indented or not, carries the item on.
    if (list && list.items.length > 0) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (quote.length > 0) {
      quote.push(line.trim());
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** A table row's cells, the outer pipes dropped. */
function cells(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) {
    row = row.slice(1);
  }
  if (row.endsWith("|")) {
    row = row.slice(0, -1);
  }
  return row.split("|").map((cell) => cell.trim());
}

function alignOf(separator: string): AskAlign {
  const left = separator.startsWith(":");
  const right = separator.endsWith(":");
  return left && right ? "center" : right ? "right" : "left";
}

/**
 * Bold, italics, code and links, earliest first; what is left is text, its
 * figures split out. An opening mark with no partner stays as written.
 */
const INLINE =
  /`([^`]+)`|\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|__(?=\S)([\s\S]+?)(?<=\S)__|\*(?=[^\s*])([\s\S]+?)(?<=[^\s*])\*(?!\*)|(?<![\w])_(?=\S)([\s\S]+?)(?<=\S)_(?![\w])|\[([^\]]+)\]\([^)]*\)/g;

export function parseInline(
  text: string,
  untraced: ReadonlySet<string> = new Set(),
): AskInline[] {
  const out: AskInline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) {
      out.push(...withFigures(text.slice(last, match.index), untraced));
    }
    if (match[1] !== undefined) {
      out.push({ kind: "code", text: match[1] });
    } else if (match[2] !== undefined || match[3] !== undefined) {
      out.push({
        kind: "strong",
        children: parseInline((match[2] ?? match[3])!, untraced),
      });
    } else if (match[4] !== undefined || match[5] !== undefined) {
      out.push({
        kind: "em",
        children: parseInline((match[4] ?? match[5])!, untraced),
      });
    } else {
      // A link is shown as its words: an answer sends no one anywhere.
      out.push(...withFigures(match[6]!, untraced));
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    out.push(...withFigures(text.slice(last), untraced));
  }
  return out;
}

function withFigures(text: string, untraced: ReadonlySet<string>): AskInline[] {
  const out: AskInline[] = [];
  let last = 0;
  for (const match of text.matchAll(FIGURE_PATTERN)) {
    if (match.index > last) {
      out.push({ kind: "text", text: text.slice(last, match.index) });
    }
    out.push({
      kind: "figure",
      text: match[0],
      traced: !untraced.has(figureKey(match[0])),
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "text", text: text.slice(last) });
  }
  return out;
}
