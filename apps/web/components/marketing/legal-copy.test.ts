import { describe, expect, it } from "vitest";

import { LEGAL_DRAFT, legalCopy } from "./legal-copy";
import { legalCopyFr } from "./legal-copy.fr";

function blanks(value: unknown): string[] {
  return JSON.stringify(value).match(/\[\[[^\]]*\]\]/g) ?? [];
}

describe("legal copy", () => {
  it("has the same sections, in the same order, in both languages", () => {
    for (const doc of ["privacy", "terms", "notice"] as const) {
      expect(legalCopyFr[doc].sections.map((section) => section.id)).toEqual(
        legalCopy[doc].sections.map((section) => section.id),
      );
    }
  });

  it("leaves the same number of blanks in both languages", () => {
    expect(blanks(legalCopyFr).length).toBe(blanks(legalCopy).length);
  });

  it("keeps no blank once the documents are final", () => {
    if (LEGAL_DRAFT) {
      return;
    }
    expect(blanks(legalCopy)).toEqual([]);
    expect(blanks(legalCopyFr)).toEqual([]);
  });
});
