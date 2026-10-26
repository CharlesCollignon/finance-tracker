import { describe, expect, it } from "vitest";
import { receiptFromReading, receiptKind, receiptPath } from "./receipts";

describe("receiptKind", () => {
  it("tells a picture and a PDF by their first bytes", () => {
    expect(receiptKind(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toEqual({
      kind: "pdf",
      type: "application/pdf",
      extension: "pdf",
    });
    expect(receiptKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.type).toBe(
      "image/jpeg",
    );
    expect(receiptKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))?.extension).toBe(
      "png",
    );
    expect(receiptKind(new Uint8Array([0x00, 0x01]))).toBeNull();
  });
});

describe("receiptPath", () => {
  it("puts the file under the owner's folder and the row's", () => {
    expect(receiptPath("owner", "tx", "jpg", 1700000000000)).toBe(
      "owner/tx/1700000000000.jpg",
    );
  });
});

describe("receiptFromReading", () => {
  const today = "2026-10-26";

  it("keeps the three things a receipt says, cleaned", () => {
    expect(
      receiptFromReading(
        {
          receipt: true,
          merchant: "  Carrefour Market ",
          date: "2026-10-24",
          total: "12,30",
          currency: "EUR",
        },
        today,
      ),
    ).toEqual({
      merchant: "Carrefour Market",
      date: "2026-10-24",
      total: 12.3,
      currency: "EUR",
    });
  });

  it("drops a day after today, a day that is no day, and a total that is none", () => {
    expect(
      receiptFromReading(
        { receipt: true, merchant: "Lidl", date: "2026-11-01", total: "-3", currency: "xx" },
        today,
      ),
    ).toEqual({ merchant: "Lidl", date: null, total: null, currency: "EUR" });
    expect(
      receiptFromReading(
        { receipt: true, merchant: null, date: "yesterday", total: "0", currency: "EUR" },
        today,
      ),
    ).toBeNull();
  });

  it("answers nothing for a document that is no receipt", () => {
    expect(
      receiptFromReading(
        { receipt: false, merchant: "x", date: today, total: "1", currency: "EUR" },
        today,
      ),
    ).toBeNull();
    expect(receiptFromReading(null, today)).toBeNull();
  });
});
