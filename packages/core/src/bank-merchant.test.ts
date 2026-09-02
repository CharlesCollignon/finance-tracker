import { describe, expect, it } from "vitest";

import {
  bankMerchantKey,
  buildBankMerchantIndex,
  lookupBankMerchant,
} from "./bank-merchant";

/** Real descriptions from a Crédit Agricole statement, lightly anonymised. */
const REAL = {
  bitstackA: "PAIEMENT PAR CARTE X7322 BITSTACK SAS MEYREUI 30/08",
  bitstackB: "PAIEMENT PAR CARTE X7322 Bitstack 100 Impasse 12/07",
  swile: "PAIEMENT PAR CARTE X7322 Swile 561 rue George 31/08",
  deliveroo: "PAIEMENT PAR CARTE X7322 DELIVEROO 75009 PARI 22/08",
  monoprix: "PAIEMENT PAR CARTE X7322 MONOPRIX 0085 LAGAR2 29/07",
  bistrot: "PAIEMENT PAR CARTE X7322 LE BISTROT DU COIN 14/08",
  epicerie: "PAIEMENT PAR CARTE X7322 L'EPICERIE FINE 03/08",
};

describe("bankMerchantKey", () => {
  it("groups the same shop the terminal spelled two ways", () => {
    // 42 transactions and 7 in the real statement, split by trailing address.
    expect(bankMerchantKey(REAL.bitstackA)).toBe(
      bankMerchantKey(REAL.bitstackB),
    );
    expect(bankMerchantKey(REAL.bitstackA)).toBe("bitstack");
  });

  it("drops the card token, which is identical on every row", () => {
    expect(bankMerchantKey(REAL.swile)).toBe("swile");
    expect(bankMerchantKey(REAL.deliveroo)).toBe("deliveroo");
  });

  it("drops a branch code stapled to the name", () => {
    expect(bankMerchantKey(REAL.monoprix)).toBe("monoprix");
  });

  it("never lets a French article become the key", () => {
    // Without this, LE BISTROT and L'EPICERIE answer for each other.
    expect(bankMerchantKey(REAL.bistrot)).not.toBe(
      bankMerchantKey(REAL.epicerie),
    );
    expect(bankMerchantKey(REAL.bistrot)).toBe("bistrot");
    expect(bankMerchantKey(REAL.epicerie)).toBe("epicerie");
  });

  it("keeps a second word when the first is too short to stand alone", () => {
    expect(bankMerchantKey("PAIEMENT PAR CARTE X7322 BIO C BON PARIS")).toBe(
      "bio bon",
    );
  });

  it("has nothing to say about a description with no merchant in it", () => {
    expect(bankMerchantKey("PAIEMENT PAR CARTE X7322")).toBe("");
    expect(bankMerchantKey(null)).toBe("");
    expect(bankMerchantKey("LE")).toBe("");
  });

  it("drops the hash a transfer carries but keeps who sent it", () => {
    // Two people paying by Wero are two counterparties, not one merchant.
    expect(
      bankMerchantKey(
        "VIREMENT WERO de SYLVA · 01a05d6c07b37dd78678fc5283018306",
      ),
    ).toBe("wero sylva");
    expect(
      bankMerchantKey(
        "VIREMENT WERO de CLARA · 01a05e27763879a2a3d1948583617559",
      ),
    ).toBe("wero clara");
  });
});

describe("buildBankMerchantIndex", () => {
  const past = (
    note: string,
    categoryId: string,
    name: string,
    on: string,
  ) => ({
    note,
    category_id: categoryId,
    occurred_on: on,
    categories: { name, type: "expense" },
  });

  it("counts the two spellings of one shop as one merchant", () => {
    const index = buildBankMerchantIndex([
      past(REAL.bitstackA, "cat-invest", "Bitstack weekly DCA", "2026-07-01"),
      past(REAL.bitstackB, "cat-invest", "Bitstack weekly DCA", "2026-08-01"),
    ]);

    const rule = lookupBankMerchant(index, REAL.bitstackA);
    expect(rule).toMatchObject({ key: "bitstack", count: 2, unanimous: true });
  });

  it("marks a key the user has filed two different ways as not unanimous", () => {
    // A coarse key can gather two shops; this is what that looks like.
    const index = buildBankMerchantIndex([
      past("CARTE X7322 AMAZON EU 12/07", "cat-other", "Other", "2026-07-01"),
      past(
        "CARTE X7322 AMAZON PRIME 14/08",
        "cat-subs",
        "Subscriptions",
        "2026-08-01",
      ),
    ]);

    expect(
      lookupBankMerchant(index, "CARTE X7322 AMAZON EU 01/09"),
    ).toMatchObject({
      count: 2,
      unanimous: false,
    });
  });

  it("takes the category from the most recent sighting", () => {
    const index = buildBankMerchantIndex([
      past(REAL.swile, "cat-old", "Other", "2026-06-01"),
      past(REAL.swile, "cat-new", "Groceries", "2026-08-01"),
    ]);

    expect(lookupBankMerchant(index, REAL.swile)).toMatchObject({
      categoryId: "cat-new",
      unanimous: false,
    });
  });

  it("never learns a merchant from income", () => {
    const index = buildBankMerchantIndex([
      {
        note: "VIREMENT SALAIRE ACME",
        category_id: "cat-salary",
        occurred_on: "2026-08-01",
        categories: { name: "Salary", type: "income" },
      },
    ]);

    expect(lookupBankMerchant(index, "VIREMENT SALAIRE ACME")).toBeNull();
  });
});
