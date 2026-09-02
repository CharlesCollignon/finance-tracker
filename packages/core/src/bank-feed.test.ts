import { describe, expect, it } from "vitest";

import {
  AUTO_MERCHANT_THRESHOLD,
  decide,
  indexCategoriesByName,
  planFeed,
  toCandidate,
  type BankTransaction,
} from "./bank-feed";
import { buildMerchantIndex } from "./merchant-memory";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function bank(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: "prov-1",
    amount: "42.10",
    currency: "EUR",
    creditDebitIndicator: "DBIT",
    bookingDate: "2026-09-12",
    valueDate: null,
    transactionDate: null,
    creditorName: "CARREFOUR MARKET",
    creditorIban: null,
    debtorName: null,
    debtorIban: null,
    remittanceInformation: null,
    merchantCategoryCode: "5411",
    ...overrides,
  };
}

function tx(
  note: string,
  categoryId: string,
  categoryName: string,
  type: CategoryType,
  occurredOn = "2026-08-01",
): TransactionWithCategory {
  return {
    id: `tx-${Math.random()}`,
    user_id: "u",
    category_id: categoryId,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount: 10,
    note,
    created_at: "2026-08-01T00:00:00.000Z",
    categories: {
      name: categoryName,
      type,
      icon: null,
      counts_toward_summary: true,
    },
  };
}

const CATEGORIES = indexCategoriesByName([
  { id: "cat-groceries", name: "Groceries" },
  { id: "cat-transport", name: "Transportation" },
  { id: "cat-subs", name: "Subscriptions" },
]);
const NO_MERCHANTS = buildMerchantIndex([]);

describe("toCandidate", () => {
  it("reads a card payment as money going out", () => {
    expect(toCandidate(bank())).toMatchObject({
      providerId: "prov-1",
      occurredOn: "2026-09-12",
      amount: "42.10",
      direction: "out",
      counterparty: "CARREFOUR MARKET",
      note: "CARREFOUR MARKET",
    });
  });

  it("keeps the amount as the bank stated it, never as a float", () => {
    const candidate = toCandidate(bank({ amount: "1234567.89" }));
    expect(candidate?.amount).toBe("1234567.89");
    expect(typeof candidate?.amount).toBe("string");
  });

  it("strips the sign but keeps the direction from it when the bank sets no indicator", () => {
    const candidate = toCandidate(
      bank({ creditDebitIndicator: "", amount: "-19.99" }),
    );
    expect(candidate).toMatchObject({ amount: "19.99", direction: "out" });
  });

  it("refuses a row whose direction cannot be established", () => {
    // Booking a salary as an expense is worse than dropping the row.
    expect(
      toCandidate(bank({ creditDebitIndicator: "", amount: "19.99" })),
    ).toBeNull();
  });

  it("names the payer, not the merchant, on money arriving", () => {
    expect(
      toCandidate(
        bank({
          creditDebitIndicator: "CRDT",
          creditorName: null,
          debtorName: "EMPLOYER SA",
        }),
      ),
    ).toMatchObject({ direction: "in", counterparty: "EMPLOYER SA" });
  });

  it("falls back through the dates the bank may or may not set", () => {
    expect(
      toCandidate(bank({ bookingDate: null, valueDate: "2026-09-10" }))
        ?.occurredOn,
    ).toBe("2026-09-10");
    expect(
      toCandidate(
        bank({
          bookingDate: null,
          valueDate: null,
          transactionDate: "2026-09-09",
        }),
      )?.occurredOn,
    ).toBe("2026-09-09");
  });

  it("drops a row with no usable date, amount or sane decimal", () => {
    expect(toCandidate(bank({ bookingDate: null }))).toBeNull();
    expect(toCandidate(bank({ amount: "0.00" }))).toBeNull();
    expect(toCandidate(bank({ amount: "not a number" }))).toBeNull();
    expect(toCandidate(bank({ amount: "1.234" }))).toBeNull();
  });

  it("drops a movement between the user's own accounts", () => {
    const own = new Set(["FR7630006000011234567890189"]);
    const moved = bank({ creditorIban: "FR76 3000 6000 0112 3456 7890 189" });
    expect(toCandidate(moved, { ownIbans: own })).toBeNull();
    // The same row is real spending for someone who does not own that account.
    expect(toCandidate(moved)).not.toBeNull();
  });

  it("falls back to the remittance line when nobody is named", () => {
    expect(
      toCandidate(
        bank({ creditorName: null, remittanceInformation: "PRLV SEPA EDF" }),
      )?.note,
    ).toBe("PRLV SEPA EDF");
  });
});

describe("decide", () => {
  const groceries = [
    tx(
      "Carrefour Market",
      "cat-groceries",
      "Groceries",
      "expense",
      "2026-07-02",
    ),
    tx(
      "Carrefour Market",
      "cat-groceries",
      "Groceries",
      "expense",
      "2026-08-02",
    ),
  ];

  it("writes through a merchant the user has already answered for", () => {
    const decision = decide(toCandidate(bank())!, {
      merchants: buildMerchantIndex(groceries),
      categoryIdsByName: CATEGORIES,
    });
    expect(decision).toMatchObject({
      kind: "auto",
      suggestion: { categoryId: "cat-groceries", reason: "merchant" },
    });
  });

  it("still asks after a single sighting", () => {
    expect(AUTO_MERCHANT_THRESHOLD).toBe(2);
    const decision = decide(toCandidate(bank())!, {
      merchants: buildMerchantIndex(groceries.slice(0, 1)),
      // No MCC, so the merchant rule is the only signal available.
      categoryIdsByName: new Map(),
    });
    expect(decision.kind).toBe("review");
    expect(decision.kind === "review" && decision.suggestion).toMatchObject({
      categoryId: "cat-groceries",
    });
  });

  it("falls back to the card network's own code for an unseen merchant", () => {
    const decision = decide(
      toCandidate(bank({ creditorName: "SPAR RENNES" }))!,
      {
        merchants: NO_MERCHANTS,
        categoryIdsByName: CATEGORIES,
      },
    );
    expect(decision).toMatchObject({
      kind: "auto",
      suggestion: { categoryId: "cat-groceries", reason: "mcc" },
    });
  });

  it("asks rather than guess when the code names a category that does not exist", () => {
    // 5812 is a restaurant; this user has no Restaurants category.
    const decision = decide(
      toCandidate(
        bank({ creditorName: "LE BISTROT", merchantCategoryCode: "5812" }),
      )!,
      { merchants: NO_MERCHANTS, categoryIdsByName: CATEGORIES },
    );
    expect(decision).toMatchObject({ kind: "review", why: "no-such-category" });
    expect(decision.kind === "review" && decision.suggestion).toBeNull();
  });

  it("never writes a cash withdrawal through, however familiar", () => {
    const atm = [
      tx("RETRAIT DAB", "cat-groceries", "Groceries", "expense", "2026-07-03"),
      tx("RETRAIT DAB", "cat-groceries", "Groceries", "expense", "2026-08-03"),
    ];
    const decision = decide(
      toCandidate(
        bank({ creditorName: "RETRAIT DAB", merchantCategoryCode: "6011" }),
      )!,
      { merchants: buildMerchantIndex(atm), categoryIdsByName: CATEGORIES },
    );
    expect(decision).toMatchObject({ kind: "review", why: "needs-a-look" });
  });

  it("always asks about money arriving", () => {
    const decision = decide(
      toCandidate(
        bank({
          creditDebitIndicator: "CRDT",
          creditorName: null,
          debtorName: "EMPLOYER SA",
        }),
      )!,
      { merchants: NO_MERCHANTS, categoryIdsByName: CATEGORIES },
    );
    expect(decision).toMatchObject({ kind: "review", why: "money-in" });
  });

  it("flags money back from a place the user usually spends as a refund", () => {
    const decision = decide(
      toCandidate(
        bank({
          creditDebitIndicator: "CRDT",
          creditorName: null,
          debtorName: "Carrefour Market",
        }),
      )!,
      {
        merchants: buildMerchantIndex(groceries),
        categoryIdsByName: CATEGORIES,
      },
    );
    expect(decision).toMatchObject({ kind: "review", why: "possible-refund" });
  });

  it("does not write an income category through on money going out", () => {
    const salary = [
      tx("Acme Payroll", "cat-income", "Salary", "income", "2026-07-01"),
      tx("Acme Payroll", "cat-income", "Salary", "income", "2026-08-01"),
    ];
    const decision = decide(
      toCandidate(
        bank({ creditorName: "Acme Payroll", merchantCategoryCode: null }),
      )!,
      { merchants: buildMerchantIndex(salary), categoryIdsByName: CATEGORIES },
    );
    expect(decision.kind).toBe("review");
  });
});

describe("planFeed", () => {
  it("sorts a sync into what can be written and what must be looked at", () => {
    const merchants = buildMerchantIndex([
      tx(
        "Carrefour Market",
        "cat-groceries",
        "Groceries",
        "expense",
        "2026-07-02",
      ),
      tx(
        "Carrefour Market",
        "cat-groceries",
        "Groceries",
        "expense",
        "2026-08-02",
      ),
    ]);

    const plan = planFeed(
      [
        bank({ id: "a" }),
        bank({
          id: "b",
          creditorName: "LE BISTROT",
          merchantCategoryCode: "5812",
        }),
        bank({
          id: "c",
          creditDebitIndicator: "CRDT",
          creditorName: null,
          debtorName: "EMPLOYER SA",
        }),
        bank({ id: "d", amount: "0.00" }),
      ],
      { merchants, categoryIdsByName: CATEGORIES },
    );

    expect(plan.automatic.map((r) => r.candidate.providerId)).toEqual(["a"]);
    expect(plan.review.map((r) => r.candidate.providerId)).toEqual(["b", "c"]);
    expect(plan.discarded).toBe(1);
    expect(plan.duplicates).toBe(0);
  });

  it("never imports the same bank transaction twice", () => {
    const plan = planFeed([bank({ id: "a" }), bank({ id: "b" })], {
      merchants: NO_MERCHANTS,
      categoryIdsByName: CATEGORIES,
      seenProviderIds: new Set(["a"]),
    });

    expect(plan.duplicates).toBe(1);
    expect(
      [...plan.automatic, ...plan.review].map((r) => r.candidate.providerId),
    ).toEqual(["b"]);
  });

  it("keeps two identical purchases on the same day apart", () => {
    // Same merchant, same amount, same day — two coffees, not one counted twice.
    const plan = planFeed([bank({ id: "a" }), bank({ id: "b" })], {
      merchants: NO_MERCHANTS,
      categoryIdsByName: CATEGORIES,
    });
    expect(plan.automatic).toHaveLength(2);
  });
});

describe("not recording the same movement twice", () => {
  const ledger = (
    overrides: Partial<import("./bank-feed").ExistingLedgerRow> = {},
  ) => ({
    transactionId: "tx-existing",
    occurredOn: "2026-09-12",
    amount: 42.1,
    isIncome: false,
    fromRecurringTemplate: true,
    alreadyClaimed: false,
    ...overrides,
  });

  const opts = { merchants: NO_MERCHANTS, categoryIdsByName: CATEGORIES };

  it("files a bank row against the transaction a recurring template already wrote", () => {
    // The card fee was applied from a template on the 1st; the bank now
    // reports the same debit. One movement, one row.
    const decision = decide(toCandidate(bank())!, {
      ...opts,
      existing: [ledger()],
    });

    expect(decision).toEqual({ kind: "match", transactionId: "tx-existing" });
  });

  it("tolerates the bank debiting a few days off the nominal day", () => {
    const decision = decide(toCandidate(bank())!, {
      ...opts,
      existing: [ledger({ occurredOn: "2026-09-09" })],
    });

    expect(decision.kind).toBe("match");
  });

  it("does not reach past the window", () => {
    const decision = decide(toCandidate(bank())!, {
      ...opts,
      existing: [ledger({ occurredOn: "2026-09-01" })],
    });

    expect(decision.kind).not.toBe("match");
  });

  it("will not merge on an amount that is merely close", () => {
    const decision = decide(toCandidate(bank())!, {
      ...opts,
      existing: [ledger({ amount: 42.2 })],
    });

    expect(decision.kind).not.toBe("match");
  });

  it("asks before merging with something entered by hand", () => {
    // A one-off that happens to share an amount and a date may be a
    // coincidence, and merging would quietly delete a real expense.
    const decision = decide(toCandidate(bank())!, {
      ...opts,
      existing: [ledger({ fromRecurringTemplate: false })],
    });

    expect(decision).toMatchObject({
      kind: "review",
      why: "possible-duplicate",
      matchTransactionId: "tx-existing",
    });
  });

  it("never merges money in with money out", () => {
    const decision = decide(
      toCandidate(
        bank({
          creditDebitIndicator: "CRDT",
          creditorName: null,
          debtorName: "X",
        }),
      )!,
      { ...opts, existing: [ledger()] },
    );

    expect(decision.kind).not.toBe("match");
  });

  it("lets one ledger row answer for only one bank row", () => {
    // Two identical debits, one existing transaction: the first is matched,
    // the second is a genuinely new expense and must not vanish into it.
    const plan = planFeed([bank({ id: "a" }), bank({ id: "b" })], {
      ...opts,
      existing: [ledger()],
    });

    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0]!.candidate.providerId).toBe("a");
    expect([...plan.automatic, ...plan.review]).toHaveLength(1);
  });
});
