/**
 * Just enough XML to read a bank's statement (CAMT), a spreadsheet's sheet
 * (XLSX, ODS) or a table pasted from a web page: elements by their local
 * name — namespace prefixes dropped — their attributes and their text.
 * Tolerant rather than strict: a file a bank wrote is read as far as it
 * makes sense, and a malformed tail is left out rather than refused.
 */

export interface XmlElement {
  /** The local name, without its prefix: `Ntry` for `ns2:Ntry`. */
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** The text directly inside, entities decoded. */
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  euro: "€",
};

/** `&amp;`, `&#233;`, `&#xE9;`, `&eacute;`… as text. */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : whole;
      }
      const named = NAMED_ENTITIES[body.toLowerCase()];
      if (named) {
        return named;
      }
      // The Latin letters a French page names: é, è, à, ç, ô…
      const accented = /^([a-z])(acute|grave|circ|uml|cedil)$/i.exec(body);
      if (accented) {
        const mark = {
          acute: "́",
          grave: "̀",
          circ: "̂",
          uml: "̈",
          cedil: "̧",
        }[accented[2]!.toLowerCase() as "acute"];
        return `${accented[1]}${mark}`.normalize("NFC");
      }
      return whole;
    },
  );
}

function localName(name: string): string {
  const colon = name.indexOf(":");
  return colon === -1 ? name : name.slice(colon + 1);
}

const ATTRIBUTE = /([^\s=/>]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function readAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[localName(match[1]!)] = decodeEntities(value);
  }
  return attributes;
}

/** Elements HTML leaves open; closed at once so the tree stays sound. */
const VOID = new Set(["br", "img", "input", "meta", "link", "hr", "col"]);

/**
 * The document as a tree under a synthetic root. Comments, processing
 * instructions and doctypes are skipped; CDATA is text.
 */
export function parseXml(source: string, { html = false } = {}): XmlElement {
  const root: XmlElement = {
    name: "#root",
    attributes: {},
    children: [],
    text: "",
  };
  const stack: XmlElement[] = [root];
  const tag =
    /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][^>]*>|<\/\s*([^\s>]+)\s*>|<([^\s/>]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let last = 0;
  for (const match of source.matchAll(tag)) {
    const top = stack[stack.length - 1]!;
    const between = source.slice(last, match.index);
    if (between) {
      top.text += decodeEntities(between);
    }
    last = match.index! + match[0].length;
    if (match[1] !== undefined) {
      top.text += match[1];
    } else if (match[2] !== undefined) {
      const name = localName(match[2]);
      const comparable = html ? name.toLowerCase() : name;
      // Close up to the matching element; a stray closing tag is ignored.
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        const open = stack[depth]!.name;
        if ((html ? open.toLowerCase() : open) === comparable) {
          stack.length = depth;
          break;
        }
      }
    } else if (match[3] !== undefined) {
      const name = localName(match[3]);
      const element: XmlElement = {
        name,
        attributes: readAttributes(match[4] ?? ""),
        children: [],
        text: "",
      };
      top.children.push(element);
      const selfClosing =
        match[5] === "/" || (html && VOID.has(name.toLowerCase()));
      if (!selfClosing) {
        stack.push(element);
      }
    }
  }
  const tail = source.slice(last);
  if (tail) {
    stack[stack.length - 1]!.text += decodeEntities(tail);
  }
  return root;
}

/** Every element named `name` under `element`, at any depth, in order. */
export function findAll(
  element: XmlElement,
  name: string,
  { ignoreCase = false } = {},
): XmlElement[] {
  const found: XmlElement[] = [];
  const wanted = ignoreCase ? name.toLowerCase() : name;
  const walk = (node: XmlElement) => {
    for (const child of node.children) {
      if ((ignoreCase ? child.name.toLowerCase() : child.name) === wanted) {
        found.push(child);
      }
      walk(child);
    }
  };
  walk(element);
  return found;
}

/** The first element down `path` (`["Acct", "Id", "IBAN"]`), or null. */
export function child(
  element: XmlElement | null | undefined,
  ...path: string[]
): XmlElement | null {
  let node: XmlElement | null = element ?? null;
  for (const name of path) {
    node = node?.children.find((candidate) => candidate.name === name) ?? null;
  }
  return node;
}

/** The text at `path` under `element`, trimmed, or "" when there is none. */
export function textAt(
  element: XmlElement | null | undefined,
  ...path: string[]
): string {
  return child(element, ...path)?.text.trim() ?? "";
}

/** All the text inside an element, its children's included, in order. */
export function allText(element: XmlElement): string {
  let text = element.text;
  for (const node of element.children) {
    text += allText(node);
  }
  return text;
}
