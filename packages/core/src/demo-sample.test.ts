import { describe, expect, it } from "vitest";
import { buildDemoSample, DEMO_MONTHS } from "./demo-sample";

describe("buildDemoSample", () => {
  const today = "2026-10-26";
  const sample = buildDemoSample(today);

  it("is the same sample for the same day", () => {
    expect(buildDemoSample(today)).toEqual(sample);
  });

  it("names every category a row points at", () => {
    const keys = new Set(sample.categories.map((category) => category.key));
    for (const row of [
      ...sample.templates,
      ...sample.transactions,
      ...sample.savingsAccounts,
      ...sample.filingRules,
    ]) {
      expect(keys.has(row.categoryKey)).toBe(true);
    }
    expect(
      new Set(sample.categories.map((category) => category.name)).size,
    ).toBe(sample.categories.length);
  });

  it("writes nothing after today, and the months before in full", () => {
    expect(sample.transactions.every((row) => row.occurredOn <= today)).toBe(
      true,
    );
    const months = new Set(
      sample.transactions.map((row) => row.occurredOn.slice(0, 7)),
    );
    expect(months.size).toBe(DEMO_MONTHS + 1);
    expect(months.has("2026-01")).toBe(true);
    expect(months.has("2026-10")).toBe(true);
    expect(sample.events.every((event) => event.occurredOn <= today)).toBe(
      true,
    );
  });

  it("pays the salary on the 3rd and the PEA every Friday, from their templates", () => {
    const salaries = sample.transactions.filter(
      (row) => row.templateKey === "salary",
    );
    expect(salaries).toHaveLength(DEMO_MONTHS + 1);
    expect(
      salaries.every(
        (row) => row.occurredOn.endsWith("-03") && row.amount === 3200,
      ),
    ).toBe(true);
    const fridays = sample.transactions.filter(
      (row) => row.templateKey === "pea-dca",
    );
    expect(fridays.length).toBeGreaterThan(DEMO_MONTHS * 4);
    expect(
      fridays.every((row) => {
        const [y, m, d] = row.occurredOn.split("-").map(Number);
        return new Date(y!, m! - 1, d).getDay() === 5;
      }),
    ).toBe(true);
  });

  it("closes every past month on the 1st of the next, with the account going down", () => {
    expect(sample.monthCloses).toHaveLength(DEMO_MONTHS);
    expect(sample.monthCloses[0]).toMatchObject({
      month: "2026-01-01",
      observedOn: "2026-02-01",
    });
    expect(sample.monthCloses.at(-1)).toMatchObject({
      month: "2026-09-01",
      observedOn: "2026-10-01",
    });
    expect(sample.monthCloses.every((close) => close.closingBalance > 0)).toBe(
      true,
    );
  });

  it("holds the landing's three wallets", () => {
    const byWallet = new Map<string, number>();
    for (const position of sample.positions) {
      byWallet.set(
        position.wallet,
        (byWallet.get(position.wallet) ?? 0) + position.currentValue,
      );
    }
    expect(byWallet.get("pea")).toBe(6800);
    expect(byWallet.get("cto")).toBe(4200);
    expect(byWallet.get("crypto")).toBe(1480);
    expect(sample.walletPlans.map((plan) => plan.wallet)).toEqual([
      "pea",
      "cto",
      "crypto",
    ]);
  });

  it("moves with the day", () => {
    const later = buildDemoSample("2027-03-14");
    expect(
      later.transactions.every((row) => row.occurredOn <= "2027-03-14"),
    ).toBe(true);
    expect(later.monthCloses.at(-1)?.month).toBe("2027-02-01");
    expect(
      later.transactions.some((row) => row.occurredOn.startsWith("2026-06")),
    ).toBe(true);
    expect(
      later.transactions.some((row) => row.occurredOn.startsWith("2026-05")),
    ).toBe(false);
  });
});
