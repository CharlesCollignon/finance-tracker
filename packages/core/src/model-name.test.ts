import { describe, expect, it } from "vitest";

import { DEFAULT_WRITER_MODEL, describeModel } from "./model-name";

describe("describeModel", () => {
  it("names the maker and the model the app is configured with", () => {
    expect(describeModel("mistral-large-latest")).toEqual({
      brand: "Mistral",
      full: "Mistral Large",
      id: "mistral-large-latest",
    });
  });

  it("follows the configuration to another size without a new entry", () => {
    expect(describeModel("mistral-medium-latest").full).toBe("Mistral Medium");
    expect(describeModel("mistral-small-latest").full).toBe("Mistral Small");
  });

  it("keeps a dated build in the full name, because it is a different model", () => {
    expect(describeModel("mistral-medium-2505").full).toBe(
      "Mistral Medium 2505",
    );
  });

  it("still says Mistral when the size is one nobody has heard of", () => {
    expect(describeModel("mistral-enormous-latest")).toEqual({
      brand: "Mistral",
      full: "Mistral Enormous",
      id: "mistral-enormous-latest",
    });
  });

  it("claims no maker for an id that names none", () => {
    // Better an unfamiliar string on screen than the app telling someone
    // Mistral wrote what something else in fact wrote.
    expect(describeModel("some-other-model")).toEqual({
      brand: "some-other-model",
      full: "some-other-model",
      id: "some-other-model",
    });
  });

  it("treats an empty configuration as naming nothing", () => {
    expect(describeModel("  ")).toEqual({ brand: "", full: "", id: "" });
  });
});

describe("DEFAULT_WRITER_MODEL", () => {
  it("names a model this app can attribute to its maker", () => {
    // The phone names the writer on a button without being able to read the
    // web server's environment. That only works while every model this app
    // can be configured with has the same maker, which this asserts.
    expect(describeModel(DEFAULT_WRITER_MODEL).brand).toBe("Mistral");
  });
});
