import { describe, expect, it } from "vitest";

import { AI_MODELS, DEFAULT_AI_MODEL, aiModel } from "./ai-models";

describe("aiModel", () => {
  it("finds a listed model, and falls back to Mistral for any other", () => {
    expect(aiModel("openai/gpt-6-sol").reasoning).toBe(true);
    expect(aiModel("someone/retired-model")).toBe(DEFAULT_AI_MODEL);
    expect(aiModel(null).id).toBe("mistralai/mistral-medium-3-5");
    expect(new Set(AI_MODELS.map((model) => model.id)).size).toBe(
      AI_MODELS.length,
    );
  });
});
