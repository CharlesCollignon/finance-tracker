import { describe, expect, it } from "vitest";
import { findRenameConflict, tagUsageFromRows, type TagUsage } from "./tags";

describe("tagUsageFromRows", () => {
  it("reads PostgREST's embedded count as the tag's uses", () => {
    expect(
      tagUsageFromRows([
        { id: "a", name: "Holiday", transaction_tags: [{ count: 3 }] },
      ]),
    ).toEqual([{ id: "a", name: "Holiday", uses: 3 }]);
  });

  it("reads a missing count as none", () => {
    expect(
      tagUsageFromRows([{ id: "a", name: "Holiday", transaction_tags: [] }]),
    ).toEqual([{ id: "a", name: "Holiday", uses: 0 }]);
  });
});

describe("findRenameConflict", () => {
  const tags: TagUsage[] = [
    { id: "a", name: "Holiday", uses: 3 },
    { id: "b", name: "Trip", uses: 1 },
  ];

  it("finds the other tag already holding the name", () => {
    expect(findRenameConflict(tags, "a", "Trip")?.id).toBe("b");
  });

  it("compares the name as it will be saved, trimmed", () => {
    expect(findRenameConflict(tags, "a", "  Trip ")?.id).toBe("b");
  });

  it("never clashes a tag with itself, so a change of case goes through", () => {
    expect(findRenameConflict(tags, "a", "Holiday")).toBeNull();
    expect(findRenameConflict(tags, "a", "holiday")).toBeNull();
  });

  it("is exact about case, as the database's unique constraint is", () => {
    expect(findRenameConflict(tags, "a", "trip")).toBeNull();
  });
});
