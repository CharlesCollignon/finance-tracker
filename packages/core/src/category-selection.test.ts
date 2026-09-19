import { describe, expect, it } from "vitest";

import {
  applySelection,
  findingsDigest,
  verifyCategorySelection,
} from "./category-selection";
import type { CategoryFinding } from "./category-findings";

const findings: CategoryFinding[] = [
  {
    id: "drift:a",
    kind: "drift",
    categoryId: "a",
    categoryName: "Rent",
    type: "expense",
    severity: 300,
    direction: "up",
    months: ["2026-09"],
    messageKey: "categoryFindings.driftUp",
    params: { months: 3 },
  },
  {
    id: "drift:b",
    kind: "drift",
    categoryId: "b",
    categoryName: "Restaurants",
    type: "expense",
    severity: 30,
    direction: "up",
    months: ["2026-09"],
    messageKey: "categoryFindings.driftUp",
    params: { months: 3 },
  },
];

describe("verifyCategorySelection", () => {
  it("keeps the order the model asked for", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:b" }, { id: "drift:a" }] },
      findings,
    );

    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.selection.picks.map((p) => p.id)).toEqual([
      "drift:b",
      "drift:a",
    ]);
  });

  it("drops an id it was never given, and keeps the rest", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:invented" }, { id: "drift:a" }] },
      findings,
    );

    expect(verdict.ok && verdict.selection.picks.map((p) => p.id)).toEqual([
      "drift:a",
    ]);
  });

  it("drops a remark with a figure in it and keeps the pick", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:a", remark: "up by 300 a month" }] },
      findings,
    );

    const pick = verdict.ok ? verdict.selection.picks[0] : null;
    expect(pick?.id).toBe("drift:a");
    expect(pick?.remark).toBeUndefined();
    expect(verdict.ok && verdict.trimmed).toBe(1);
  });

  it("refuses an answer with no usable pick at all", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "nope" }] },
      findings,
    );

    expect(verdict.ok).toBe(false);
  });

  it("catches a spelled-out quantity in a remark, not only a digit", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:a", remark: "nearly a third of what goes out" }] },
      findings,
    );

    const pick = verdict.ok ? verdict.selection.picks[0] : null;
    expect(pick?.id).toBe("drift:a");
    expect(pick?.remark).toBeUndefined();
  });

  it("keeps a remark that is a judgement and no arithmetic", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:b", remark: "the one you can act on" }] },
      findings,
    );

    expect(verdict.ok && verdict.selection.picks[0]?.remark).toBe(
      "the one you can act on",
    );
    expect(verdict.ok && verdict.trimmed).toBe(0);
  });

  it("names each finding once, however often the model does", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:a" }, { id: "drift:a" }, { id: "drift:b" }] },
      findings,
    );

    expect(verdict.ok && verdict.selection.picks.map((p) => p.id)).toEqual([
      "drift:a",
      "drift:b",
    ]);
  });

  it("refuses an answer that is not the shape asked for", () => {
    expect(verifyCategorySelection({ order: ["drift:a"] }, findings).ok).toBe(
      false,
    );
    expect(verifyCategorySelection(null, findings).ok).toBe(false);
  });
});

describe("applySelection", () => {
  it("puts the chosen findings first and leaves the rest behind them", () => {
    const ordered = applySelection(findings, {
      picks: [{ id: "drift:b" }],
    });

    expect(ordered.map((f) => f.id)).toEqual(["drift:b", "drift:a"]);
  });

  it("loses nothing, and ignores a pick that no longer names a finding", () => {
    const ordered = applySelection(findings, {
      picks: [{ id: "drift:gone" }, { id: "drift:b" }],
    });

    expect(ordered.map((f) => f.id)).toEqual(["drift:b", "drift:a"]);
  });
});

describe("findingsDigest", () => {
  it("is the same for the same findings, whatever order they arrive in", () => {
    expect(findingsDigest(findings)).toBe(findingsDigest([...findings].reverse()));
  });

  it("moves when a weight moves", () => {
    const moved = findings.map((finding) =>
      finding.id === "drift:b" ? { ...finding, severity: 31 } : finding,
    );

    expect(findingsDigest(moved)).not.toBe(findingsDigest(findings));
  });

  it("moves when a finding arrives or leaves", () => {
    expect(findingsDigest(findings.slice(0, 1))).not.toBe(
      findingsDigest(findings),
    );
  });
});
