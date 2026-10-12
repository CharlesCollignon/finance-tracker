import { describe, expect, it } from "vitest";
import {
  changelogTarget,
  NO_TALLY,
  roadmapTarget,
  toggledTally,
} from "./reactions";

describe("targets", () => {
  it("name what is reacted to as migration 070 checks it", () => {
    expect(changelogTarget("2026-10-12-nouveautes")).toBe(
      "changelog:2026-10-12-nouveautes",
    );
    expect(roadmapTarget("entraide")).toBe("roadmap:entraide");
  });
});

describe("toggledTally", () => {
  it("adds and takes back the reader's own", () => {
    const said = toggledTally(NO_TALLY, "love", true);
    expect(said).toEqual({ counts: { love: 1 }, mine: ["love"] });
    expect(toggledTally(said, "love", false)).toEqual({
      counts: { love: 0 },
      mine: [],
    });
  });

  it("changes nothing for what was already so", () => {
    const said = toggledTally(NO_TALLY, "useful", true);
    expect(toggledTally(said, "useful", true)).toBe(said);
    expect(toggledTally(NO_TALLY, "want", false)).toBe(NO_TALLY);
  });
});
