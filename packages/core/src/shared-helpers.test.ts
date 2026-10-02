import { describe, expect, it } from "vitest";

import { wrapperFeesFromPlans } from "./fund-costs";
import { formatWeightShare } from "./look-through";
import { exactModelLabel } from "./model-name";

describe("formatWeightShare", () => {
  it("says a sliver is there rather than rounding it to nothing", () => {
    expect(formatWeightShare(0.0004, "fr")).toBe("<0,1 %");
    expect(formatWeightShare(0.0234, "fr")).toBe("2,3 %");
    expect(formatWeightShare(0.456, "en")).toBe("46%");
  });
});

describe("wrapperFeesFromPlans", () => {
  it("keeps each wallet's fee where one was given", () => {
    expect(
      wrapperFeesFromPlans([
        { wallet: "av", wrapper_fee: "0.006" },
        { wallet: "pea", wrapper_fee: null },
      ]),
    ).toEqual({ av: 0.006 });
  });
});

describe("exactModelLabel", () => {
  it("names a known model and keeps an unknown id as it stands", () => {
    expect(exactModelLabel("some-unknown-model")).toBe("some-unknown-model");
    expect(exactModelLabel("mistral-large-latest")).toContain(
      "(mistral-large-latest)",
    );
  });
});
