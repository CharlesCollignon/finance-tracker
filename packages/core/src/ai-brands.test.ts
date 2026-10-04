import { describe, expect, it } from "vitest";

import { AI_MODELS } from "./ai-models";
import { aiBrandOf } from "./ai-brands";
import { DEFAULT_WRITER_MODEL } from "./model-name";

describe("aiBrandOf", () => {
  it("marks every model the Profile offers, and Pluclair's own", () => {
    expect(AI_MODELS.map((model) => aiBrandOf(model.id))).toEqual([
      "mistral",
      "openai",
      "claude",
    ]);
    expect(aiBrandOf(DEFAULT_WRITER_MODEL)).toBe("mistral");
  });

  it("reads the names a screen already holds", () => {
    expect(aiBrandOf("GPT-6 Sol")).toBe("openai");
    expect(aiBrandOf("Claude Sonnet 5.5")).toBe("claude");
    expect(aiBrandOf("Mistral")).toBe("mistral");
  });

  it("leaves a model none of the three made unmarked", () => {
    expect(aiBrandOf("meta-llama/llama-5")).toBeNull();
    expect(aiBrandOf(null)).toBeNull();
  });
});
