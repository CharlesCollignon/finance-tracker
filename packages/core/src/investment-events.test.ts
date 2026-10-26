import { describe, expect, it } from "vitest";
import {
  dividendsByYear,
  feesByYear,
  readBrokerNumber,
  readBrokerRows,
  realisedGains,
  summariseEvents,
  type InvestmentEvent,
} from "./investment-events";

function event(
  partial: Partial<InvestmentEvent> & Pick<InvestmentEvent, "kind" | "amount">,
): InvestmentEvent {
  return {
    id:
      partial.id ??
      `${partial.kind}-${partial.occurredOn ?? ""}-${partial.amount}`,
    wallet: "pea",
    occurredOn: "2026-01-15",
    instrumentName: "Amundi MSCI World",
    instrumentSymbol: null,
    isin: "FR0014003I54",
    quantity: null,
    note: null,
    source: "manual",
    ...partial,
  };
}

describe("realisedGains", () => {
  it("sells against the oldest buys first, per wallet and year", () => {
    const gains = realisedGains([
      event({
        kind: "buy",
        occurredOn: "2024-02-01",
        quantity: 10,
        amount: 1000,
      }),
      event({
        kind: "buy",
        occurredOn: "2025-02-01",
        quantity: 10,
        amount: 1500,
      }),
      // Sold 15: the ten at 100 and five at 150 — basis 1750.
      event({
        kind: "sell",
        occurredOn: "2026-03-01",
        quantity: 15,
        amount: 2700,
      }),
    ]);
    expect(gains).toEqual([
      {
        wallet: "pea",
        year: 2026,
        proceeds: 2700,
        basis: 1750,
        gain: 950,
        uncoveredSells: 0,
      },
    ]);
  });

  it("keeps wallets and instruments apart", () => {
    const gains = realisedGains([
      event({
        kind: "buy",
        occurredOn: "2025-01-01",
        quantity: 1,
        amount: 100,
        isin: "FR0014003I54",
      }),
      event({
        kind: "buy",
        occurredOn: "2025-01-01",
        quantity: 1,
        amount: 50,
        isin: "IE00B4L5Y983",
      }),
      event({
        kind: "sell",
        occurredOn: "2025-06-01",
        quantity: 1,
        amount: 60,
        isin: "IE00B4L5Y983",
      }),
      event({
        kind: "buy",
        occurredOn: "2025-01-01",
        quantity: 1,
        amount: 100,
        wallet: "cto",
      }),
      event({
        kind: "sell",
        occurredOn: "2025-06-01",
        quantity: 1,
        amount: 90,
        wallet: "cto",
      }),
    ]);
    expect(gains).toEqual([
      {
        wallet: "cto",
        year: 2025,
        proceeds: 90,
        basis: 100,
        gain: -10,
        uncoveredSells: 0,
      },
      {
        wallet: "pea",
        year: 2025,
        proceeds: 60,
        basis: 50,
        gain: 10,
        uncoveredSells: 0,
      },
    ]);
  });

  it("says when a sell rests on buys nobody recorded", () => {
    const gains = realisedGains([
      event({
        kind: "buy",
        occurredOn: "2025-01-01",
        quantity: 2,
        amount: 200,
      }),
      event({
        kind: "sell",
        occurredOn: "2025-06-01",
        quantity: 5,
        amount: 600,
      }),
      event({
        kind: "sell",
        occurredOn: "2025-07-01",
        quantity: null,
        amount: 100,
      }),
    ]);
    expect(gains[0]).toMatchObject({
      proceeds: 700,
      basis: 200,
      gain: 500,
      uncoveredSells: 2,
    });
  });

  it("ignores dividends and fees, and a buy without a quantity", () => {
    expect(
      realisedGains([
        event({ kind: "dividend", amount: 12 }),
        event({ kind: "fee", amount: 2 }),
        event({ kind: "buy", quantity: null, amount: 100 }),
      ]),
    ).toEqual([]);
  });
});

describe("dividendsByYear and feesByYear", () => {
  it("sums each kind per wallet and year, newest year first", () => {
    const events = [
      event({ kind: "dividend", occurredOn: "2025-03-01", amount: 10.5 }),
      event({ kind: "dividend", occurredOn: "2025-09-01", amount: 11.25 }),
      event({ kind: "dividend", occurredOn: "2026-03-01", amount: 12 }),
      event({
        kind: "fee",
        occurredOn: "2026-01-01",
        amount: 1.99,
        wallet: "cto",
      }),
      event({ kind: "buy", occurredOn: "2026-01-01", amount: 100 }),
    ];
    expect(dividendsByYear(events)).toEqual([
      { wallet: "pea", year: 2026, amount: 12 },
      { wallet: "pea", year: 2025, amount: 21.75 },
    ]);
    expect(feesByYear(events)).toEqual([
      { wallet: "cto", year: 2026, amount: 1.99 },
    ]);
    expect(summariseEvents(events).years).toEqual([2026, 2025]);
  });
});

describe("readBrokerNumber", () => {
  it("reads French and English figures, signed either way", () => {
    expect(readBrokerNumber("1 234,56")).toBe(1234.56);
    expect(readBrokerNumber("1,234.56")).toBe(1234.56);
    expect(readBrokerNumber("-254.30")).toBe(-254.3);
    expect(readBrokerNumber("(12)")).toBe(-12);
    expect(readBrokerNumber("12,30 €")).toBe(12.3);
    expect(readBrokerNumber("1.234")).toBe(1.234);
    expect(readBrokerNumber("1.234.567")).toBe(1234567);
    expect(readBrokerNumber("")).toBeNull();
    expect(readBrokerNumber("-")).toBeNull();
    expect(readBrokerNumber("n/a")).toBeNull();
  });
});

describe("readBrokerRows", () => {
  const french = [
    ["Export du 26/10/2026"],
    [],
    [
      "Date opération",
      "Libellé",
      "Valeur",
      "Code ISIN",
      "Quantité",
      "Cours",
      "Montant net",
    ],
    [
      "02/03/2026",
      "Achat",
      "AMUNDI MSCI WORLD",
      "FR0014003I54",
      "10",
      "25,43",
      "-254,30",
    ],
    [
      "02/03/2026",
      "Achat",
      "AMUNDI MSCI WORLD",
      "FR0014003I54",
      "10",
      "25,43",
      "-254,30",
    ],
    [
      "15/06/2026",
      "Dividende",
      "AMUNDI MSCI WORLD",
      "FR0014003I54",
      "",
      "",
      "3,20",
    ],
    [
      "20/06/2026",
      "Vente",
      "AMUNDI MSCI WORLD",
      "FR0014003I54",
      "5",
      "27,10",
      "135,50",
    ],
    ["30/06/2026", "Droits de garde", "", "", "", "", "-4,00"],
    ["01/07/2026", "Virement reçu", "", "", "", "", "500,00"],
    ["pas une date", "", "", "", "", "", ""],
  ];

  it("reads a French export: the kinds by their words, two identical lines kept apart", () => {
    const reading = readBrokerRows(french, "pea");
    expect(reading.problem).toBeNull();
    expect(reading.skipped).toBe(2);
    expect(
      reading.events.map((e) => [e.kind, e.occurredOn, e.quantity, e.amount]),
    ).toEqual([
      ["buy", "2026-03-02", 10, 254.3],
      ["buy", "2026-03-02", 10, 254.3],
      ["dividend", "2026-06-15", null, 3.2],
      ["sell", "2026-06-20", 5, 135.5],
      ["fee", "2026-06-30", null, 4],
    ]);
    expect(reading.events[0]!.fingerprint).toBe(
      "2026-03-02|buy|254.30|FR0014003I54|0",
    );
    expect(reading.events[1]!.fingerprint).toBe(
      "2026-03-02|buy|254.30|FR0014003I54|1",
    );
    expect(reading.events[0]!.isin).toBe("FR0014003I54");
    expect(reading.events[0]!.instrumentName).toBe("AMUNDI MSCI WORLD");
    expect(reading.events[0]!.note).toBe("Achat");
    expect(reading.events[4]!.instrumentName).toBe("Droits de garde");
    expect(reading.events.every((e) => e.wallet === "pea")).toBe(true);
  });

  it("reads an English export with no word for the kind: the signs decide, the amount from price and quantity", () => {
    const reading = readBrokerRows(
      [
        ["Date", "Time", "Product", "ISIN", "Quantity", "Price", "Total"],
        [
          "2026-01-10",
          "09:31",
          "VANGUARD FTSE AW",
          "IE00B3RBWM25",
          "3",
          "110.20",
          "-330.60",
        ],
        [
          "2026-04-10",
          "15:02",
          "VANGUARD FTSE AW",
          "IE00B3RBWM25",
          "-1",
          "120.00",
          "120.00",
        ],
        [
          "2026-05-10",
          "15:02",
          "VANGUARD FTSE AW",
          "IE00B3RBWM25",
          "2",
          "115.00",
          "",
        ],
      ],
      "cto",
    );
    expect(reading.events.map((e) => [e.kind, e.quantity, e.amount])).toEqual([
      ["buy", 3, 330.6],
      ["sell", 1, 120],
      ["buy", 2, 230],
    ]);
    expect(reading.events[0]!.note).toBeNull();
  });

  it("reads month-first dates when a line can only be that", () => {
    const reading = readBrokerRows(
      [
        ["Trade date", "Transaction type", "Security", "Amount"],
        ["10/25/2026", "Dividend", "ACME CORP", "4.50"],
        ["01/05/2026", "Buy", "ACME CORP", "-100.00"],
      ],
      "cto",
    );
    expect(reading.events.map((e) => e.occurredOn)).toEqual([
      "2026-10-25",
      "2026-01-05",
    ]);
  });

  it("says when there is no header to read, or nothing at all", () => {
    expect(
      readBrokerRows(
        [
          ["a", "b"],
          ["c", "d"],
        ],
        "pea",
      ).problem,
    ).toBe("columns");
    expect(readBrokerRows([[""], []], "pea").problem).toBe("empty");
    // A date alone is a calendar, not a statement of what moved.
    expect(
      readBrokerRows(
        [
          ["Date", "Libellé"],
          ["01/01/2026", "x"],
        ],
        "pea",
      ).problem,
    ).toBe("columns");
  });
});
