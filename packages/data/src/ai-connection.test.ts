import { describe, expect, it, vi } from "vitest";

import type { Db } from "./client";
import { chooseAiModel } from "./ai-connection";

/** A client that records the one update a model choice makes. */
function fakeDb() {
  const eq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { db: { from } as unknown as Db, update, eq };
}

describe("chooseAiModel", () => {
  it("writes a model on the short list, for this user only", async () => {
    const { db, update, eq } = fakeDb();
    await expect(
      chooseAiModel(db, "u1", "anthropic/claude-sonnet-5.5"),
    ).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ model: "anthropic/claude-sonnet-5.5" }),
    );
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("refuses one off the list without writing", async () => {
    const { db, update } = fakeDb();
    await expect(
      chooseAiModel(db, "u1", "openai/some-other-model"),
    ).resolves.toEqual({ error: "errors.invalidInput" });
    expect(update).not.toHaveBeenCalled();
  });
});
