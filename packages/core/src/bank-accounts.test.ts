import { describe, expect, it } from "vitest";
import {
  accountMarks,
  ledgerAccounts,
  awaitingRole,
  followsMovements,
  groupByBank,
  guessAccountRole,
  guessSavingsKind,
  ownTransferIbans,
  proposeForAccount,
} from "./bank-accounts";

describe("guessSavingsKind", () => {
  it.each([
    ["Livret A", "livret_a"],
    ["LIVRET A PARTICULIERS", "livret_a"],
    ["Livret Bleu", "livret_a"],
    ["LDDS", "ldds"],
    ["Livret Développement Durable et Solidaire", "ldds"],
    ["LEP", "lep"],
    ["Livret d'Épargne Populaire", "lep"],
    ["PEL", "pel"],
    ["Plan d'épargne logement", "pel"],
    ["CEL", "cel"],
    ["Compte Épargne Logement", "cel"],
    ["Livret Bourso+", "livret"],
    ["Livret Jeune", "livret"],
    ["Compte sur livret", "livret"],
    ["Compte épargne", "livret"],
  ] as const)("reads %s as %s", (name, kind) => {
    expect(guessSavingsKind([name])).toBe(kind);
  });

  it("finds the kind in any of the names", () => {
    expect(guessSavingsKind([null, "Mon épargne", "LDDS"])).toBe("ldds");
  });

  it("says nothing of a current account", () => {
    expect(guessSavingsKind(["Compte de dépôt"])).toBeNull();
    expect(guessSavingsKind([null, undefined])).toBeNull();
  });

  it("never takes an investment account for a Livret", () => {
    expect(guessSavingsKind(["Plan d'épargne en actions"])).toBeNull();
    expect(guessSavingsKind(["PER Individuel"])).toBeNull();
    expect(guessSavingsKind(["Épargne retraite"])).toBeNull();
  });
});

describe("guessAccountRole", () => {
  it("trusts the type the bank gives", () => {
    expect(guessAccountRole({ accountType: "CACC", names: ["Compte"] })).toBe(
      "spending",
    );
    expect(guessAccountRole({ accountType: "SVGS", names: ["Compte"] })).toBe(
      "savings",
    );
    expect(guessAccountRole({ accountType: "CARD", names: ["Compte"] })).toBe(
      "ignored",
    );
    expect(guessAccountRole({ accountType: "loan", names: [] })).toBe(
      "ignored",
    );
  });

  it("lets a name saying Livret win over a bank that calls it current", () => {
    expect(guessAccountRole({ accountType: "CACC", names: ["Livret A"] })).toBe(
      "savings",
    );
  });

  it("keeps an investment account out, whatever its type", () => {
    expect(
      guessAccountRole({ accountType: "SVGS", names: ["PEA espèces"] }),
    ).toBe("ignored");
    expect(
      guessAccountRole({ accountType: null, names: ["Assurance vie"] }),
    ).toBe("ignored");
  });

  it("reads a card or a loan from its name when there is no type", () => {
    expect(
      guessAccountRole({ accountType: null, names: ["Carte Visa Premier"] }),
    ).toBe("ignored");
    expect(
      guessAccountRole({ accountType: null, names: ["Prêt immobilier"] }),
    ).toBe("ignored");
  });

  it("does not take a bank called Crédit for a loan", () => {
    expect(
      guessAccountRole({
        accountType: null,
        names: ["Crédit Agricole — Compte de dépôt"],
      }),
    ).toBe("spending");
  });

  it("calls anything else a current account", () => {
    expect(guessAccountRole({ accountType: null, names: [] })).toBe("spending");
    expect(
      guessAccountRole({ accountType: "CACC", names: ["Compte joint"] }),
    ).toBe("spending");
  });
});

describe("followsMovements", () => {
  it("brings in a current account's movements, and nothing else's", () => {
    expect(followsMovements("spending")).toBe(true);
    expect(followsMovements("savings")).toBe(false);
    expect(followsMovements("ignored")).toBe(false);
    expect(followsMovements(null)).toBe(false);
  });
});

describe("ownTransferIbans", () => {
  it("holds the current accounts' IBANs only", () => {
    const ibans = ownTransferIbans([
      { iban: "FR76 1111 2222", role: "spending" },
      { iban: "fr7633334444", role: "spending" },
      { iban: "FR76 5555 6666", role: "savings" },
      { iban: "FR76 7777 8888", role: "ignored" },
      { iban: "FR76 9999 0000", role: null },
      { iban: null, role: "spending" },
      { iban: " ", role: "spending" },
    ]);
    expect([...ibans].sort()).toEqual(["FR7611112222", "FR7633334444"]);
  });
});

describe("proposeForAccount", () => {
  it("reads the product before the label, which may be the holder's name", () => {
    expect(
      proposeForAccount({
        account_type: null,
        product: "LIVRET A",
        label: "M CHARLES DUPONT",
      }),
    ).toEqual({ role: "savings", savingsKind: "livret_a" });
  });

  it("offers « Autre livret » when nothing names the Livret", () => {
    expect(
      proposeForAccount({
        account_type: "CACC",
        product: null,
        label: "Compte",
      }),
    ).toEqual({ role: "spending", savingsKind: "livret" });
  });
});

describe("awaitingRole", () => {
  it("asks about readable accounts with no role, and nothing else", () => {
    const accounts = [
      { id: "new", role: null, needs_reconnect: false },
      { id: "lapsed", role: null, needs_reconnect: true },
      { id: "known", role: "spending" as const, needs_reconnect: false },
    ];
    expect(awaitingRole(accounts).map((account) => account.id)).toEqual([
      "new",
    ]);
  });
});

describe("groupByBank", () => {
  const account = (
    label: string,
    bank: string | null,
    role: "spending" | "savings" | "ignored" | null,
    consent: string | null = null,
  ) => ({ label, bank_name: bank, role, consent_valid_until: consent });

  it("groups by bank, current accounts first, an unnamed bank last", () => {
    const groups = groupByBank([
      account("Livret A", "Crédit Agricole", "savings", "2027-02-01"),
      account("Compte", null, "spending"),
      account("Compte de dépôt", "Crédit Agricole", "spending", "2026-12-01"),
      account("Carte", "BoursoBank", "ignored"),
      account("Compte joint", "BoursoBank", null),
      account("Compte", "BoursoBank", "spending"),
    ]);
    expect(
      groups.map((group) => [
        group.bank,
        group.consentValidUntil,
        group.accounts.map((each) => each.label),
      ]),
    ).toEqual([
      ["BoursoBank", null, ["Compte", "Carte", "Compte joint"]],
      ["Crédit Agricole", "2026-12-01", ["Compte de dépôt", "Livret A"]],
      [null, null, ["Compte"]],
    ]);
  });
});

describe("accountMarks", () => {
  const account = (
    id: string,
    bank: string | null,
    role: "spending" | "savings" | "ignored" | null,
    label = id,
  ) => ({ provider_account_id: id, bank_name: bank, role, label });

  it("says nothing while there is one current account", () => {
    expect(
      accountMarks([
        account("cc", "BoursoBank", "spending"),
        account("livret", "BoursoBank", "savings"),
      ]),
    ).toBeNull();
  });

  it("names each account by its bank, or by itself where one bank holds two", () => {
    const marks = accountMarks([
      account("bourso", "BoursoBank", "spending"),
      account("ca-perso", "Crédit Agricole", "spending", "Compte perso"),
      account("ca-joint", "Crédit Agricole", "spending", "Compte joint"),
      account("old", "LCL", "ignored", "Ancien compte"),
    ]);
    expect(Object.fromEntries(marks!)).toEqual({
      bourso: "BoursoBank",
      "ca-perso": "Compte perso",
      "ca-joint": "Compte joint",
      old: "LCL",
    });
  });
});

describe("ledgerAccounts", () => {
  const account = (
    id: string,
    bank: string,
    role: "spending" | "savings" | "ignored" | null,
  ) => ({
    provider_account_id: id,
    bank_name: bank,
    role,
    label: id,
    consent_valid_until: null,
  });

  it("offers the current accounts, and any other whose rows are there", () => {
    const result = ledgerAccounts(
      [
        account("ca", "Crédit Agricole", "spending"),
        account("bourso", "BoursoBank", "spending"),
        account("livret", "BoursoBank", "savings"),
        account("old", "LCL", "ignored"),
      ],
      new Map([
        ["tx1", "ca"],
        ["tx2", "old"],
      ]),
    );
    expect(result?.options).toEqual([
      { id: "bourso", label: "BoursoBank" },
      { id: "ca", label: "Crédit Agricole" },
      { id: "old", label: "LCL" },
    ]);
    expect(result?.of).toEqual({ tx1: "ca", tx2: "old" });
  });

  it("is nothing with one current account", () => {
    expect(
      ledgerAccounts([account("ca", "Crédit Agricole", "spending")], new Map()),
    ).toBeNull();
  });
});
