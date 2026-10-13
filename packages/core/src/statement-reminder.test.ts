import { describe, expect, it } from "vitest";

import { translator } from "./i18n/t";
import { statementReminder } from "./statement-reminder";

const t = translator("fr");

describe("statementReminder", () => {
  it("asks on the 5th for last month's statement", () => {
    const reminder = statementReminder({
      today: "2026-11-05",
      lastImport: { periodTo: "2026-09-30" },
      t,
      locale: "fr",
    });
    expect(reminder).toMatchObject({
      kind: "statement",
      key: "statement:2026-11",
      url: "/import",
    });
    expect(reminder?.title).toContain("octobre");
  });

  it("says nothing on another day, once it is brought, or to someone who never imports", () => {
    expect(
      statementReminder({
        today: "2026-11-04",
        lastImport: { periodTo: "2026-09-30" },
        t,
        locale: "fr",
      }),
    ).toBeNull();
    expect(
      statementReminder({
        today: "2026-11-05",
        lastImport: { periodTo: "2026-10-31" },
        t,
        locale: "fr",
      }),
    ).toBeNull();
    expect(
      statementReminder({
        today: "2026-11-05",
        lastImport: null,
        t,
        locale: "fr",
      }),
    ).toBeNull();
  });
});
