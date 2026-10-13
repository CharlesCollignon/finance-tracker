import { strFromU8, unzipSync } from "fflate";
import { excelSerialDate } from "./values";
import { allText, child, findAll, parseXml, type XmlElement } from "./xml";

/**
 * Tables out of what is not a CSV: an HTML page's table (a bank's « Excel »
 * export is often one, and so is what is copied from its website), an
 * `.xlsx` workbook, an `.ods` spreadsheet. Each gives rows of strings for
 * `readTable`, the first sheet or the largest table, with dates written as
 * dates rather than as a spreadsheet's day numbers.
 */

/* -------------------------------------------------------------------- HTML */

export function isHtmlTable(text: string): boolean {
  return /<table[\s>]/i.test(text.slice(0, 200_000));
}

function cellText(element: XmlElement): string {
  return allText(element).replace(/\s+/g, " ").trim();
}

/**
 * The rows of the page's largest table, and the page's text before it (a
 * heading that names the account, a balance) for `readTable`'s preamble.
 */
export function htmlTable(text: string): {
  rows: string[][];
  preamble: string;
} {
  const root = parseXml(text, { html: true });
  const tables = findAll(root, "table", { ignoreCase: true });
  let best: string[][] = [];
  for (const table of tables) {
    const rows = findAll(table, "tr", { ignoreCase: true }).map((row) =>
      row.children
        .filter((cell) => /^t[dh]$/i.test(cell.name))
        .flatMap((cell) => {
          const span = Math.min(Number(cell.attributes.colspan ?? 1) || 1, 20);
          return [cellText(cell), ...Array<string>(span - 1).fill("")];
        }),
    );
    if (rows.length > best.length) {
      best = rows;
    }
  }
  const before = text.split(/<table[\s>]/i)[0] ?? "";
  const preamble = cellText(parseXml(before, { html: true }));
  return { rows: best, preamble };
}

/* -------------------------------------------------------------------- XLSX */

export function isZip(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/** Which kind of spreadsheet a zip holds, if any. */
export function spreadsheetKind(bytes: Uint8Array): "xlsx" | "ods" | null {
  try {
    const files = unzipSync(bytes, {
      filter: (file) =>
        file.name === "xl/workbook.xml" || file.name === "mimetype",
    });
    if (files["xl/workbook.xml"]) {
      return "xlsx";
    }
    const mimetype = files.mimetype ? strFromU8(files.mimetype) : "";
    return mimetype.includes("opendocument.spreadsheet") ? "ods" : null;
  } catch {
    return null;
  }
}

/** Column letters to an index: `A` → 0, `AB` → 27. */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** Number formats Excel itself numbers as dates. */
const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);

/** Which cell styles show a date, read from `styles.xml`. */
function dateStyles(styles: XmlElement | null): Set<number> {
  const dates = new Set<number>();
  if (!styles) {
    return dates;
  }
  const custom = new Set<number>();
  for (const format of findAll(styles, "numFmt")) {
    const code = (format.attributes.formatCode ?? "")
      .toLowerCase()
      .replace(/"[^"]*"|\[[^\]]*\]/g, "");
    if (/[dy]/.test(code) && !/^[#0.,% ]+$/.test(code)) {
      custom.add(Number(format.attributes.numFmtId));
    }
  }
  const xfs = findAll(styles, "cellXfs")[0];
  xfs?.children
    .filter((node) => node.name === "xf")
    .forEach((xf, index) => {
      const id = Number(xf.attributes.numFmtId ?? 0);
      if (BUILT_IN_DATE_FORMATS.has(id) || custom.has(id)) {
        dates.add(index);
      }
    });
  return dates;
}

/** The first sheet of a workbook, as rows of strings. */
export function xlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, {
    filter: (file) =>
      file.name === "xl/workbook.xml" ||
      file.name === "xl/_rels/workbook.xml.rels" ||
      file.name === "xl/sharedStrings.xml" ||
      file.name === "xl/styles.xml" ||
      file.name.startsWith("xl/worksheets/"),
  });
  const read = (name: string) =>
    files[name] ? parseXml(strFromU8(files[name]!)) : null;

  const workbook = read("xl/workbook.xml");
  const relations = read("xl/_rels/workbook.xml.rels");
  const firstSheet = workbook ? findAll(workbook, "sheet")[0] : undefined;
  const relationId = firstSheet?.attributes.id;
  const target = relations
    ? findAll(relations, "Relationship").find(
        (relation) => relation.attributes.Id === relationId,
      )?.attributes.Target
    : undefined;
  const sheetPath = target
    ? `xl/${target.replace(/^\/?xl\//, "").replace(/^\//, "")}`
    : Object.keys(files)
        .filter((name) => name.startsWith("xl/worksheets/sheet"))
        .sort()[0];
  const sheet = sheetPath ? read(sheetPath) : null;
  if (!sheet) {
    return [];
  }

  const strings = read("xl/sharedStrings.xml");
  const shared = strings
    ? findAll(strings, "si").map((item) =>
        findAll(item, "t")
          .map((node) => node.text)
          .join(""),
      )
    : [];
  const dates = dateStyles(read("xl/styles.xml"));

  const rows: string[][] = [];
  for (const row of findAll(sheet, "row")) {
    const cells: string[] = [];
    for (const cell of row.children.filter((node) => node.name === "c")) {
      const index = columnIndex(cell.attributes.r ?? "");
      const type = cell.attributes.t;
      const value = child(cell, "v")?.text ?? "";
      let text: string;
      if (type === "s") {
        text = shared[Number(value)] ?? "";
      } else if (type === "inlineStr") {
        text = findAll(cell, "t")
          .map((node) => node.text)
          .join("");
      } else if (type === "str" || type === "b" || type === "e") {
        text = value;
      } else if (value !== "" && dates.has(Number(cell.attributes.s ?? -1))) {
        text = excelSerialDate(Number(value)) ?? value;
      } else {
        text = value;
      }
      while (cells.length < index) {
        cells.push("");
      }
      cells[index] = text;
    }
    rows.push(cells);
  }
  return rows;
}

/* --------------------------------------------------------------------- ODS */

/** The first table of an OpenDocument spreadsheet, as rows of strings. */
export function odsRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, {
    filter: (file) => file.name === "content.xml",
  });
  if (!files["content.xml"]) {
    return [];
  }
  const root = parseXml(strFromU8(files["content.xml"]));
  const table = findAll(root, "table")[0];
  if (!table) {
    return [];
  }
  const rows: string[][] = [];
  for (const row of findAll(table, "table-row")) {
    const cells: string[] = [];
    for (const cell of row.children.filter(
      (node) =>
        node.name === "table-cell" || node.name === "covered-table-cell",
    )) {
      const repeat = Math.min(
        Number(cell.attributes["number-columns-repeated"] ?? 1) || 1,
        50,
      );
      const kind = cell.attributes["value-type"];
      const text =
        kind === "date"
          ? (cell.attributes["date-value"] ?? "").slice(0, 10)
          : kind === "float" || kind === "currency" || kind === "percentage"
            ? (cell.attributes.value ?? "")
            : findAll(cell, "p")
                .map((paragraph) => allText(paragraph))
                .join(" ");
      for (let times = 0; times < repeat; times += 1) {
        cells.push(text);
      }
    }
    const repeatRows = Math.min(
      Number(row.attributes["number-rows-repeated"] ?? 1) || 1,
      5,
    );
    for (let times = 0; times < repeatRows; times += 1) {
      rows.push([...cells]);
    }
  }
  // A sheet's thousand empty rows at the bottom are not data.
  while (
    rows.length > 0 &&
    rows[rows.length - 1]!.every((value) => value.trim() === "")
  ) {
    rows.pop();
  }
  return rows;
}
