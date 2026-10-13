import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readPdfStatement } from "./pdf";

/**
 * A real PDF, written by hand: one page per list of runs, each run of
 * Helvetica at a place (points from the bottom left, as PDFs count them).
 * Enough of the format for pdf.js to open it as it opens a bank's.
 */
function pdfOf(
  pages: { x: number; y: number; text: string; size?: number }[][],
): Uint8Array {
  const latin = (text: string) =>
    Buffer.from(
      text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
      "latin1",
    );
  const objects: Buffer[] = [];
  const add = (body: Buffer) => objects.push(body);
  add(
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ),
  );
  const pagesId = 2 + pages.length * 2;
  const kids: number[] = [];
  for (const runs of pages) {
    const stream = Buffer.concat([
      Buffer.from("BT\n"),
      ...runs.flatMap((run) => [
        Buffer.from(`/F1 ${run.size ?? 9} Tf 1 0 0 1 ${run.x} ${run.y} Tm (`),
        latin(run.text),
        Buffer.from(") Tj\n"),
      ]),
      Buffer.from("ET"),
    ]);
    add(
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),
        stream,
        Buffer.from("\nendstream"),
      ]),
    );
    const content = objects.length;
    add(
      Buffer.from(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${content} 0 R /Resources << /Font << /F1 1 0 R >> >> >>`,
      ),
    );
    kids.push(objects.length);
  }
  add(
    Buffer.from(
      `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`,
    ),
  );
  add(Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  const catalog = objects.length;

  const chunks = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let at = chunks[0]!.length;
  objects.forEach((body, index) => {
    offsets.push(at);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      body,
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(chunk);
    at += chunk.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  chunks.push(
    Buffer.from(
      `${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${at}\n%%EOF`,
    ),
  );
  return new Uint8Array(Buffer.concat(chunks));
}

/** A run whose right edge is at x, as amounts are set. */
function right(x: number, y: number, text: string) {
  return { x: x - text.length * 4.5, y, text };
}

describe("readPdfStatement", () => {
  it("reads a statement PDF through pdf.js, page after page", async () => {
    const statement = await readPdfStatement(
      pdfOf([
        [
          { x: 40, y: 800, text: "BoursoBank", size: 12 },
          { x: 40, y: 780, text: "Relevé de compte du 01/09/2026 au 30/09/2026" },
          { x: 40, y: 766, text: "IBAN : FR76 4061 8802 0000 0000 0000 123" },
          { x: 40, y: 700, text: "Date opération" },
          { x: 120, y: 700, text: "Libellé" },
          right(430, 700, "Débit"),
          right(520, 700, "Crédit"),
          { x: 40, y: 686, text: "SOLDE AU : 31/08/2026" },
          right(520, 686, "1 000,00"),
          { x: 40, y: 672, text: "02/09/2026" },
          { x: 120, y: 672, text: "CARTE 01/09/26 MONOPRIX PARIS" },
          right(430, 672, "12,30"),
          { x: 40, y: 658, text: "05/09/2026" },
          { x: 120, y: 658, text: "VIR SEPA RECU / DE: ACME SAS" },
          right(520, 658, "2 500,00"),
          { x: 120, y: 646, text: "MOTIF: SALAIRE SEPTEMBRE" },
        ],
        [
          { x: 40, y: 800, text: "Date opération" },
          { x: 120, y: 800, text: "Libellé" },
          right(430, 800, "Débit"),
          right(520, 800, "Crédit"),
          { x: 40, y: 786, text: "10/09/2026" },
          { x: 120, y: 786, text: "PRLV SEPA EDF" },
          right(430, 786, "85,40"),
          { x: 40, y: 772, text: "Nouveau solde en EUR :" },
          right(520, 772, "3 402,30"),
        ],
      ]),
    );

    expect(statement.problem).toBeNull();
    expect(statement.bank).toBe("boursobank");
    const block = statement.blocks[0]!;
    expect(
      block.lines.map((line) => [
        line.bookingDate,
        line.creditDebitIndicator,
        line.amount,
        line.remittanceInformation,
      ]),
    ).toEqual([
      ["2026-09-02", "DBIT", "12.30", "CARTE 01/09/26 MONOPRIX PARIS"],
      [
        "2026-09-05",
        "CRDT",
        "2500.00",
        "VIR SEPA RECU / DE: ACME SAS MOTIF: SALAIRE SEPTEMBRE",
      ],
      ["2026-09-10", "DBIT", "85.40", "PRLV SEPA EDF"],
    ]);
    expect(block.check).toEqual({ ok: true, gap: "0.00" });
  });

  it("says a PDF with no text is a scan", async () => {
    const statement = await readPdfStatement(pdfOf([[]]));
    expect(statement.problem).toBe("scanned");
  });

  it("says a file that only claims to be a PDF is unreadable", async () => {
    const statement = await readPdfStatement(
      new TextEncoder().encode("%PDF-1.4\nnot really"),
    );
    expect(statement.problem).toBe("unreadable");
  });
});
