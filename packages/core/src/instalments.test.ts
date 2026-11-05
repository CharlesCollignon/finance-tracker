import { describe, expect, it } from "vitest";

import {
  detectInstalmentPlans,
  instalmentCountOf,
  instalmentProviderOf,
  lastInstalmentOn,
} from "./instalments";
import { detectRecurring, proposalCadence } from "./recurring-detection";
import type { DetectionInput } from "./recurring-detection";

function line(
  note: string,
  occurredOn: string,
  amount: number,
): DetectionInput {
  return {
    occurredOn,
    amount,
    note,
    categoryId: "cat-shopping",
    categoryName: "Shopping",
    categoryType: "expense",
  };
}

describe("instalmentProviderOf", () => {
  it("knows the providers French banks print", () => {
    expect(instalmentProviderOf("PAIEMENT PAR CARTE X7322 ALMA 12/10")).toBe(
      "Alma",
    );
    expect(instalmentProviderOf("PRLV SEPA ONEY BANK 4X")).toBe("Oney");
    expect(instalmentProviderOf("PRLV SEPA Klarna Bank AB")).toBe("Klarna");
    expect(instalmentProviderOf("PAYPAL *PAIEMENT EN 4 FOIS")).toBe("PayPal");
    expect(instalmentProviderOf("CB FNAC 3X SANS FRAIS")).toBe(
      "plusieurs-fois",
    );
  });

  it("leaves an ordinary PayPal or card payment alone", () => {
    expect(instalmentProviderOf("PAYPAL *SPOTIFY")).toBeNull();
    expect(instalmentProviderOf("PAIEMENT PAR CARTE X7322 FNAC")).toBeNull();
  });

  it("reads the count when the line says it", () => {
    expect(instalmentCountOf("PRLV SEPA ONEY BANK 4X")).toBe(4);
    expect(instalmentCountOf("PAYPAL *PAIEMENT EN 3 FOIS")).toBe(3);
    expect(instalmentCountOf("ALMA BOULANGER")).toBeNull();
  });
});

describe("detectInstalmentPlans", () => {
  it("proposes a plan from its first instalment, asking the count", () => {
    const [plan] = detectInstalmentPlans(
      [line("PAIEMENT PAR CARTE X7322 ALMA 12/10", "2026-10-13", 112.5)],
      "2026-10-20",
    );
    expect(plan).toMatchObject({
      amount: 112.5,
      dayOfMonth: 13,
      instalments: {
        provider: "Alma",
        paid: 1,
        count: null,
        firstOn: "2026-10-13",
      },
    });
    expect(proposalCadence(plan!, "fr")).toBe("paiement en plusieurs fois");
  });

  it("counts the instalments already paid, the first with its fees", () => {
    const [plan] = detectInstalmentPlans(
      [
        line("PRLV SEPA ONEY BANK 4X", "2026-09-05", 61.2),
        line("PRLV SEPA ONEY BANK 4X", "2026-10-05", 60.9),
      ],
      "2026-10-20",
    );
    expect(plan!.instalments).toEqual({
      provider: "Oney",
      paid: 2,
      count: 4,
      firstOn: "2026-09-05",
    });
    expect(proposalCadence(plan!, "fr")).toBe("paiement en 4 fois");
  });

  it("proposes nothing once the last instalment is paid, or long after", () => {
    const done = ["2026-07-05", "2026-08-05", "2026-09-05"].map((on) =>
      line("PRLV SEPA ONEY BANK 3X", on, 40),
    );
    expect(detectInstalmentPlans(done, "2026-09-20")).toEqual([]);
    expect(
      detectInstalmentPlans(
        [line("ALMA DARTY", "2026-08-01", 90)],
        "2026-10-20",
      ),
    ).toEqual([]);
  });

  it("keeps two purchases with one provider apart", () => {
    const plans = detectInstalmentPlans(
      [
        line("ALMA DARTY", "2026-10-02", 90),
        line("ALMA DECATHLON", "2026-10-09", 35),
      ],
      "2026-10-20",
    );
    expect(plans.map((plan) => plan.amount).sort()).toEqual([35, 90]);
  });

  it("is never taken for a monthly charge", () => {
    expect(
      detectRecurring(
        ["2026-08-05", "2026-09-05", "2026-10-05"].map((on) =>
          line("PRLV SEPA KLARNA BANK", on, 33.3),
        ),
      ),
    ).toEqual([]);
  });
});

describe("lastInstalmentOn", () => {
  it("is the count's month from the first, its day kept", () => {
    expect(lastInstalmentOn("2026-10-13", 4)).toBe("2027-01-13");
    expect(lastInstalmentOn("2026-11-30", 4)).toBe("2027-02-28");
  });
});
