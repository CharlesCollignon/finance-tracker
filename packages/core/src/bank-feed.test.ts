import { describe, expect, it } from "vitest";

import {
  AUTO_MERCHANT_THRESHOLD,
  decide,
  findLedgerMatch,
  indexCategoriesByName,
  planFeed,
  reviewEverything,
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
    cash_on: null,
    deleted_at: null,
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
  it("keeps the booking day and reads the day a card payment was made", () => {
    expect(
      toCandidate(
        bank({
          bookingDate: "2026-11-03",
          valueDate: "2026-11-03",
          remittanceInformation: "PAIEMENT PAR CARTE X7322 SYMPA LILLE 31/10",
        }),
        { locale: "en" },
      ),
    ).toMatchObject({ occurredOn: "2026-11-03", purchasedOn: "2026-10-31" });
  });

  it("reads a card payment as money going out", () => {
    expect(toCandidate(bank(), { locale: "en" })).toMatchObject({
      providerId: "prov-1",
      occurredOn: "2026-09-12",
      amount: "42.10",
      direction: "out",
      counterparty: "CARREFOUR MARKET",
      note: "CARREFOUR MARKET",
    });
  });

  it("keeps the amount as the bank stated it, never as a float", () => {
    const candidate = toCandidate(bank({ amount: "1234567.89" }), {
      locale: "en",
    });
    expect(candidate?.amount).toBe("1234567.89");
    expect(typeof candidate?.amount).toBe("string");
  });

  it("strips the sign but keeps the direction from it when the bank sets no indicator", () => {
    const candidate = toCandidate(
      bank({ creditDebitIndicator: "", amount: "-19.99" }),
      { locale: "en" },
    );
    expect(candidate).toMatchObject({ amount: "19.99", direction: "out" });
  });

  it("refuses a row whose direction cannot be established", () => {
    // Booking a salary as an expense is worse than dropping the row.
    expect(
      toCandidate(bank({ creditDebitIndicator: "", amount: "19.99" }), {
        locale: "en",
      }),
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
        { locale: "en" },
      ),
    ).toMatchObject({ direction: "in", counterparty: "EMPLOYER SA" });
  });

  it("falls back through the dates the bank may or may not set", () => {
    expect(
      toCandidate(bank({ bookingDate: null, valueDate: "2026-09-10" }), {
        locale: "en",
      })?.occurredOn,
    ).toBe("2026-09-10");
    expect(
      toCandidate(
        bank({
          bookingDate: null,
          valueDate: null,
          transactionDate: "2026-09-09",
        }),
        { locale: "en" },
      )?.occurredOn,
    ).toBe("2026-09-09");
  });

  it("drops a row with no usable date, amount or sane decimal", () => {
    expect(
      toCandidate(bank({ bookingDate: null }), { locale: "en" }),
    ).toBeNull();
    expect(toCandidate(bank({ amount: "0.00" }), { locale: "en" })).toBeNull();
    expect(
      toCandidate(bank({ amount: "not a number" }), { locale: "en" }),
    ).toBeNull();
    expect(toCandidate(bank({ amount: "1.234" }), { locale: "en" })).toBeNull();
  });

  it("drops a movement between the user's own accounts", () => {
    const own = new Set(["FR7630006000011234567890189"]);
    const moved = bank({ creditorIban: "FR76 3000 6000 0112 3456 7890 189" });
    expect(toCandidate(moved, { locale: "en", ownIbans: own })).toBeNull();
    // The same row is real spending for someone who does not own that account.
    expect(toCandidate(moved, { locale: "en" })).not.toBeNull();
  });

  it("falls back to the remittance line when nobody is named", () => {
    expect(
      toCandidate(
        bank({ creditorName: null, remittanceInformation: "PRLV SEPA EDF" }),
        { locale: "en" },
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
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
      merchants: buildMerchantIndex(groceries),
      categoryIdsByName: CATEGORIES,
    });
    expect(decision).toMatchObject({
      kind: "auto",
      suggestion: { categoryId: "cat-groceries", reason: "merchant" },
    });
  });

  it("files money sent to the joint account as such, without asking", () => {
    const toJoint = toCandidate(
      bank({ creditorName: "M. ET MME DUPONT", creditorIban: "FR76 1111" }),
      { locale: "fr" },
    )!;
    expect(toJoint.counterpartyIban).toBe("FR761111");
    const jointTransfer = {
      isJoint: (iban: string) => iban === "FR761111",
      category: { id: "cat-joint", name: "Versement au compte commun" },
    };
    expect(
      decide(toJoint, {
        merchants: NO_MERCHANTS,
        categoryIdsByName: CATEGORIES,
        jointTransfer,
      }),
    ).toEqual({
      kind: "auto",
      suggestion: {
        categoryId: "cat-joint",
        categoryName: "Versement au compte commun",
        reason: "joint-transfer",
      },
    });
    // Money coming back from it is still looked at.
    const fromJoint = toCandidate(
      bank({
        creditDebitIndicator: "CRDT",
        debtorName: "M. ET MME DUPONT",
        debtorIban: "FR761111",
      }),
      { locale: "fr" },
    )!;
    expect(
      decide(fromJoint, {
        merchants: NO_MERCHANTS,
        categoryIdsByName: CATEGORIES,
        jointTransfer,
      }).kind,
    ).toBe("review");
  });

  it("still asks after a single sighting", () => {
    expect(AUTO_MERCHANT_THRESHOLD).toBe(2);
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
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
      toCandidate(bank({ creditorName: "SPAR RENNES" }), { locale: "en" })!,
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
        { locale: "en" },
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
        { locale: "en" },
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
        { locale: "en" },
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
        { locale: "en" },
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
        { locale: "en" },
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
      { locale: "en", merchants, categoryIdsByName: CATEGORIES },
    );

    expect(plan.automatic.map((r) => r.candidate.providerId)).toEqual(["a"]);
    expect(plan.review.map((r) => r.candidate.providerId)).toEqual(["b", "c"]);
    expect(plan.discarded).toBe(1);
    expect(plan.duplicates).toBe(0);
  });

  it("never imports the same bank transaction twice", () => {
    const plan = planFeed([bank({ id: "a" }), bank({ id: "b" })], {
      locale: "en",
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
      locale: "en",
      merchants: NO_MERCHANTS,
      categoryIdsByName: CATEGORIES,
    });
    expect(plan.automatic).toHaveLength(2);
  });

  it("can hold every line for a look, filed or paired as it would have been", () => {
    const merchants = buildMerchantIndex([
      tx("Carrefour Market", "cat-groceries", "Groceries", "expense", "2026-07-02"),
      tx("Carrefour Market", "cat-groceries", "Groceries", "expense", "2026-08-02"),
    ]);
    const plan = planFeed(
      [
        bank({ id: "a" }),
        bank({ id: "b", creditorName: "LE BISTROT", merchantCategoryCode: "5812" }),
      ],
      { locale: "en", merchants, categoryIdsByName: CATEGORIES },
    );
    const held = reviewEverything({
      ...plan,
      matched: [
        {
          candidate: plan.review[0]!.candidate,
          decision: { kind: "match", transactionId: "tx-1" },
        },
      ],
    });
    expect(held.automatic).toEqual([]);
    expect(held.matched).toEqual([]);
    expect(held.review.map((row) => row.decision)).toEqual([
      {
        kind: "review",
        suggestion: (plan.automatic[0]!.decision as { suggestion: unknown }).suggestion,
        why: "needs-a-look",
      },
      {
        kind: "review",
        suggestion: null,
        why: "possible-duplicate",
        matchTransactionId: "tx-1",
      },
      plan.review[0]!.decision,
    ]);
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
    categoryId: "cat-groceries",
    insideWallet: false,
    ...overrides,
  });

  const opts = { merchants: NO_MERCHANTS, categoryIdsByName: CATEGORIES };

  it("raises a possible duplicate rather than merging it away", () => {
    // It used to merge on its own when the existing row came from a
    // template. On a real statement that swallowed a ten-euro purchase into
    // an unrelated ten-euro DCA, so the guess is now always the user's.
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
      ...opts,
      existing: [ledger()],
    });

    expect(decision).toMatchObject({
      kind: "review",
      why: "possible-duplicate",
      matchTransactionId: "tx-existing",
    });
  });

  it("tolerates the bank debiting a few days off the nominal day", () => {
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
      ...opts,
      existing: [ledger({ occurredOn: "2026-09-09" })],
    });

    expect(decision).toMatchObject({ why: "possible-duplicate" });
  });

  it("does not reach past the window", () => {
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
      ...opts,
      existing: [ledger({ occurredOn: "2026-09-01" })],
    });

    expect(decision).not.toMatchObject({ why: "possible-duplicate" });
  });

  it("will not pair on an amount that is merely close", () => {
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
      ...opts,
      existing: [ledger({ amount: 42.2 })],
    });

    expect(decision).not.toMatchObject({ why: "possible-duplicate" });
  });

  it("never takes a bank row for a purchase made at the broker", () => {
    // A DCA PEA is bought with money already at the broker: the bank never
    // sees it, so a debit of the same amount is something else.
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
      ...opts,
      existing: [ledger({ insideWallet: true })],
    });

    expect(decision).not.toMatchObject({ why: "possible-duplicate" });
  });

  it("pairs a card payment with the row typed on the day it was made", () => {
    // Bought on the 10th, booked on the 16th: six days, past the window from
    // the booking, two from the purchase it names.
    const candidate = toCandidate(
      bank({
        bookingDate: "2026-09-16",
        valueDate: "2026-09-16",
        remittanceInformation: "PAIEMENT PAR CARTE X7322 CARREFOUR 10/09",
      }),
      { locale: "en" },
    )!;
    expect(candidate.purchasedOn).toBe("2026-09-10");
    expect(
      findLedgerMatch(candidate, [
        ledger({ occurredOn: "2026-09-11", fromRecurringTemplate: false }),
      ]),
    ).not.toBeNull();
  });

  it("files under a category only against a row in that category", () => {
    const candidate = toCandidate(bank(), { locale: "en" })!;
    const row = ledger({ fromRecurringTemplate: false });
    expect(
      findLedgerMatch(candidate, [row], { categoryId: "cat-restaurants" }),
    ).toBeNull();
    expect(
      findLedgerMatch(candidate, [row], { categoryId: "cat-groceries" }),
    ).toBe(row);
  });

  it("asks about something entered by hand too", () => {
    const decision = decide(toCandidate(bank(), { locale: "en" })!, {
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
        { locale: "en" },
      )!,
      { ...opts, existing: [ledger()] },
    );

    expect(decision.kind).not.toBe("match");
  });

  it("never files anything as matched, whatever it suspects", () => {
    // Nothing may leave the ledger on a guess. Two identical debits against
    // one existing transaction are two rows the user is asked about, not one
    // row and one disappearance.
    const plan = planFeed([bank({ id: "a" }), bank({ id: "b" })], {
      locale: "en",
      ...opts,
      existing: [ledger()],
    });

    expect(plan.matched).toHaveLength(0);
    expect(plan.review).toHaveLength(2);
  });
});

describe("decide with filing rules", () => {
  const categoryIdsByName = indexCategoriesByName([
    { id: "c-groceries", name: "Groceries" },
  ]);
  const transports = {
    id: "r-navigo",
    words: "navigo",
    categoryId: "c-transport",
    categoryName: "Transports",
    direction: "out" as const,
    appliedCount: 0,
    createdFrom: null,
  };

  it("files by the rule the person wrote before anything learned", () => {
    const candidate = toCandidate(
      bank({
        creditorName: "PRLV NAVIGO ANNUEL",
        merchantCategoryCode: "5411",
      }),
      { locale: "fr" },
    )!;
    const decision = decide(candidate, {
      merchants: buildMerchantIndex([]),
      categoryIdsByName,
      rules: [transports],
    });
    expect(decision).toEqual({
      kind: "auto",
      suggestion: {
        categoryId: "c-transport",
        categoryName: "Transports",
        reason: "rule",
        ruleId: "r-navigo",
      },
    });
  });

  it("files money coming in by a rule written for it, and asks otherwise", () => {
    const candidate = toCandidate(
      bank({
        creditDebitIndicator: "CRDT",
        debtorName: "VIR SALAIRE ACME",
        creditorName: null,
      }),
      { locale: "fr" },
    )!;
    const salary = {
      ...transports,
      id: "r-salary",
      words: "salaire",
      categoryId: "c-salary",
      categoryName: "Salaire",
      direction: "in" as const,
    };
    expect(
      decide(candidate, {
        merchants: buildMerchantIndex([]),
        categoryIdsByName,
        rules: [salary],
      }).kind,
    ).toBe("auto");
    expect(
      decide(candidate, {
        merchants: buildMerchantIndex([]),
        categoryIdsByName,
        rules: [transports],
      }).kind,
    ).toBe("review");
  });

  it("still raises a possible duplicate ahead of a rule", () => {
    const candidate = toCandidate(bank({ creditorName: "NAVIGO" }), {
      locale: "fr",
    })!;
    const decision = decide(candidate, {
      merchants: buildMerchantIndex([]),
      categoryIdsByName,
      rules: [transports],
      existing: [
        {
          transactionId: "tx-1",
          occurredOn: "2026-09-12",
          amount: 42.1,
          isIncome: false,
          fromRecurringTemplate: true,
          alreadyClaimed: false,
          categoryId: "c-transport",
          insideWallet: false,
        },
      ],
    });
    expect(decision.kind).toBe("review");
  });
});

describe("deferred-debit cards", () => {
  const deferred = [{ key: "1234", debit: "deferred" as const, debitDay: 31 }];

  it("dates a card account's payment on its day and debits it at month end", () => {
    const candidate = toCandidate(
      bank({
        bookingDate: "2026-10-13",
        valueDate: "2026-10-13",
        remittanceInformation: "CARREFOUR MARKET 12/10",
        creditorName: null,
      }),
      { locale: "en", cardAccountKey: "acct:card-1", cards: deferred },
    )!;
    expect(candidate).toMatchObject({
      cardKey: "acct:card-1",
      debitedOn: "2026-10-31",
    });
  });

  it("debits an alert's payment on a deferred card's day", () => {
    const candidate = toCandidate(
      bank({
        bookingDate: "2026-10-12",
        valueDate: "2026-10-12",
        remittanceInformation: "PAIEMENT CARTE X1234 FNAC",
        creditorName: null,
      }),
      { locale: "en", cards: deferred, provisional: true },
    )!;
    expect(candidate).toMatchObject({
      cardKey: "1234",
      debitedOn: "2026-10-31",
    });
  });

  it("leaves an immediate card's payment on its booking", () => {
    const candidate = toCandidate(
      bank({
        bookingDate: "2026-10-12",
        remittanceInformation: "PAIEMENT PAR CARTE X7322 FNAC 11/10",
        creditorName: null,
      }),
      {
        locale: "en",
        cards: [{ key: "7322", debit: "immediate", debitDay: null }],
        provisional: true,
      },
    )!;
    expect(candidate.cardKey).toBe("7322");
    expect(candidate.debitedOn).toBeUndefined();
  });

  it("takes a card line's late value date as its debit", () => {
    const candidate = toCandidate(
      bank({
        bookingDate: "2026-10-12",
        valueDate: "2026-10-31",
        remittanceInformation: "CB FNAC 11/10 CARTE 4974XXXXXXXX5555",
        creditorName: null,
      }),
      { locale: "en" },
    )!;
    expect(candidate).toMatchObject({
      cardKey: "5555",
      debitedOn: "2026-10-31",
    });
  });

  it("counts a month's combined debit once against the payments it pays", () => {
    const plan = planFeed(
      [
        bank({
          id: "settle",
          bookingDate: "2026-10-31",
          amount: "-612.40",
          creditorName: null,
          remittanceInformation: "FACTURE CARTE DU 311026 CARTE X1234",
        }),
      ],
      {
        locale: "en",
        merchants: NO_MERCHANTS,
        categoryIdsByName: CATEGORIES,
        cards: deferred,
        cardCycles: [{ key: "1234", debitOn: "2026-10-31", total: 612.4 }],
      },
    );
    expect(plan.settled).toHaveLength(1);
    expect(plan.settled![0]!.decision).toEqual({
      kind: "settled",
      cardKey: "1234",
      debitOn: "2026-10-31",
    });
    expect([...plan.automatic, ...plan.review, ...plan.matched]).toHaveLength(
      0,
    );
  });

  it("keeps a combined debit an expense when its payments are not known", () => {
    const plan = planFeed(
      [
        bank({
          id: "settle",
          bookingDate: "2026-10-31",
          amount: "-612.40",
          creditorName: null,
          remittanceInformation: "FACTURE CARTE DU 311026 CARTE X1234",
        }),
      ],
      {
        locale: "en",
        merchants: NO_MERCHANTS,
        categoryIdsByName: CATEGORIES,
        cards: deferred,
      },
    );
    expect(plan.settled).toHaveLength(0);
    expect(plan.review.length + plan.automatic.length).toBe(1);
  });

  it("settles against a card statement brought in the same file", () => {
    const plan = planFeed(
      [
        bank({
          id: "p1",
          bookingDate: "2026-10-05",
          amount: "-400.00",
          creditorName: null,
          remittanceInformation: "PAIEMENT CARTE X1234 IKEA",
        }),
        bank({
          id: "p2",
          bookingDate: "2026-10-20",
          amount: "-212.40",
          creditorName: null,
          remittanceInformation: "PAIEMENT CARTE X1234 FNAC",
        }),
        bank({
          id: "settle",
          bookingDate: "2026-10-31",
          amount: "-612.40",
          creditorName: null,
          remittanceInformation: "RELEVE DIFFERE CARTE X1234",
        }),
      ],
      {
        locale: "en",
        merchants: NO_MERCHANTS,
        categoryIdsByName: CATEGORIES,
        cards: deferred,
        provisional: true,
      },
    );
    expect(plan.settled?.map((row) => row.candidate.providerId)).toEqual([
      "settle",
    ]);
  });
});
