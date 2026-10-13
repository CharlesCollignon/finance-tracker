import "server-only";

import { isoDateInAppTimeZone } from "@finance/core/constants";
import {
  readPdfPages,
  type PdfPage,
  type PdfText,
  type Statement,
} from "@finance/core/statement";
import { getDocumentProxy } from "unpdf";

/**
 * A PDF statement opened on the server: each page's runs of text with where
 * they sit, for core to read as lines (`readPdfPages`). The PDF is read in
 * memory and let go of; nothing of it is kept.
 */

/** More pages than a year of monthly statements is not one statement. */
const MAX_PAGES = 60;

function statementWith(problem: Statement["problem"]): Statement {
  return { format: "pdf", bank: null, blocks: [], skipped: 0, problem, table: null };
}

/** The pages' text and places, top-left based; a reason when there are none. */
async function pdfPages(
  bytes: Uint8Array,
): Promise<PdfPage[] | "locked" | "broken"> {
  let document: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // A copy: pdf.js takes the buffer over.
    document = await getDocumentProxy(bytes.slice());
  } catch (error) {
    return (error as { name?: string } | null)?.name === "PasswordException"
      ? "locked"
      : "broken";
  }
  try {
    const pages: PdfPage[] = [];
    for (
      let number = 1;
      number <= Math.min(document.numPages, MAX_PAGES);
      number += 1
    ) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const texts: PdfText[] = [];
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") {
          continue;
        }
        const [, , c, d, e, f] = item.transform as number[];
        // The page's own turn and offset applied: y from the top, as read.
        const [x, y] = viewport.convertToViewportPoint(e!, f!);
        texts.push({
          x,
          y,
          width: item.width,
          height: Math.hypot(c!, d!) || item.height,
          text: item.str,
        });
      }
      pages.push({ texts });
      page.cleanup();
    }
    return pages;
  } catch {
    return "broken";
  } finally {
    await document.loadingTask.destroy();
  }
}

/** A PDF's bytes read as a statement. */
export async function readPdfStatement(bytes: Uint8Array): Promise<Statement> {
  const pages = await pdfPages(bytes);
  if (pages === "locked") {
    return statementWith("locked");
  }
  if (pages === "broken") {
    return statementWith("unreadable");
  }
  return readPdfPages(pages, { today: isoDateInAppTimeZone(new Date()) });
}
