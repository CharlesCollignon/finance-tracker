import { describe, expect, it } from "vitest";
import { readSubmittedTagIds, TAGS_FIELD_MARKER } from "./tag-field";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) {
    data.append(key, value);
  }
  return data;
}

describe("readSubmittedTagIds", () => {
  it("returns null when the form never showed the tags control", () => {
    // The Calendar's form, or any form for a user with no tags: no marker,
    // so the save must leave the transaction's tags alone.
    expect(readSubmittedTagIds(form([["amount", "12"]]))).toBeNull();
  });

  it("ignores stray tag ids when the marker is missing", () => {
    expect(readSubmittedTagIds(form([["tagIds", "t-1"]]))).toBeNull();
  });

  it("returns an empty list when the control was shown and nothing is ticked", () => {
    expect(readSubmittedTagIds(form([[TAGS_FIELD_MARKER, "1"]]))).toEqual([]);
  });

  it("returns every ticked tag when the control was shown", () => {
    expect(
      readSubmittedTagIds(
        form([
          [TAGS_FIELD_MARKER, "1"],
          ["tagIds", "t-1"],
          ["tagIds", "t-2"],
        ]),
      ),
    ).toEqual(["t-1", "t-2"]);
  });
});
