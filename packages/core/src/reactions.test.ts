import { describe, expect, it } from "vitest";
import {
  changelogTarget,
  NO_TALLY,
  postTarget,
  reactionAllowed,
  replyTarget,
  roadmapTarget,
  toggledTally,
} from "./reactions";

describe("targets", () => {
  it("name what is reacted to as migration 070 checks it", () => {
    expect(changelogTarget("2026-10-12-nouveautes")).toBe(
      "changelog:2026-10-12-nouveautes",
    );
    expect(roadmapTarget("entraide")).toBe("roadmap:entraide");
    expect(postTarget(42)).toBe("post:42");
    expect(replyTarget(7)).toBe("reply:7");
  });

  it("allow each thing only its own reactions", () => {
    expect(reactionAllowed(changelogTarget("x"), "love")).toBe(true);
    expect(reactionAllowed(changelogTarget("x"), "thanks")).toBe(false);
    expect(reactionAllowed(roadmapTarget("x"), "want")).toBe(true);
    expect(reactionAllowed(roadmapTarget("x"), "useful")).toBe(false);
    expect(reactionAllowed(postTarget(1), "useful")).toBe(true);
    expect(reactionAllowed(replyTarget(1), "thanks")).toBe(true);
    expect(reactionAllowed(replyTarget(1), "love")).toBe(false);
    expect(reactionAllowed("elsewhere:1", "useful")).toBe(false);
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
