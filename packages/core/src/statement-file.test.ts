import { describe, expect, it } from "vitest";

import { decodeStatement } from "./statement-file";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("decodeStatement", () => {
  it("reads UTF-8, dropping a byte order mark", () => {
    // BOM, "Libellé" in UTF-8.
    expect(
      decodeStatement(
        bytes(0xef, 0xbb, 0xbf, 0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xc3, 0xa9),
      ),
    ).toBe("Libellé");
  });

  it("reads Windows-1252 where the bytes are not UTF-8", () => {
    // "Libellé ; 12 €" with é as 0xE9 and € as 0x80.
    expect(
      decodeStatement(
        bytes(
          0x4c,
          0x69,
          0x62,
          0x65,
          0x6c,
          0x6c,
          0xe9,
          0x3b,
          0x31,
          0x32,
          0x20,
          0x80,
        ),
      ),
    ).toBe("Libellé;12 €");
  });
});
