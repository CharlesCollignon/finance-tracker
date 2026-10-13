import { describe, expect, it } from "vitest";

import { entraideRulesCopy } from "./entraide-rules-copy";
import { entraideRulesCopyFr } from "./entraide-rules-copy.fr";
import { ENTRAIDE_RULES_DRAFT } from "./legal-status";

function blanks(value: unknown): string[] {
  return JSON.stringify(value).match(/\[\[[^\]]*\]\]/g) ?? [];
}

describe("« Les règles d'Entraide »", () => {
  it("has the same sections, in the same order, in both languages", () => {
    expect(
      entraideRulesCopyFr.document.sections.map((section) => section.id),
    ).toEqual(entraideRulesCopy.document.sections.map((section) => section.id));
  });

  it("has as many points in each section in both languages", () => {
    const shape = (copy: typeof entraideRulesCopy) =>
      copy.document.sections.map((section) => [
        section.body.length,
        section.points?.length ?? 0,
        section.after?.length ?? 0,
      ]);
    expect(shape(entraideRulesCopyFr)).toEqual(shape(entraideRulesCopy));
  });

  it("leaves the same number of blanks in both languages", () => {
    expect(blanks(entraideRulesCopyFr).length).toBe(
      blanks(entraideRulesCopy).length,
    );
  });

  it("never puts a breaking space before French punctuation", () => {
    expect(JSON.stringify(entraideRulesCopyFr)).not.toMatch(/[^\s ] [:;?!»]/u);
  });

  it("keeps no blank once the rules are final", () => {
    if (ENTRAIDE_RULES_DRAFT) {
      return;
    }
    expect(blanks(entraideRulesCopy)).toEqual([]);
    expect(blanks(entraideRulesCopyFr)).toEqual([]);
  });
});
