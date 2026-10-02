import { afterEach, describe, expect, it, vi } from "vitest";
import { isRetryableError } from "@finance/core/outbox";

import { dbError } from "./errors";

describe("dbError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the refusals a person can cause", () => {
    expect(dbError({ code: "23505", message: "duplicate key value" })).toBe(
      "errors.alreadyThere",
    );
    expect(dbError({ code: "23503", message: "violates foreign key" })).toBe(
      "errors.stillInUse",
    );
    expect(dbError({ code: "42501", message: "row-level security" })).toBe(
      "errors.notAllowed",
    );
    expect(dbError({ code: "PGRST116", message: "0 rows" })).toBe(
      "errors.notFound",
    );
  });

  it("keeps a network failure retryable for the outbox", () => {
    const key = dbError({ message: "TypeError: fetch failed" });
    expect(key).toBe("errors.offline");
    expect(isRetryableError(key)).toBe(true);
  });

  it("never hands Postgres' own wording to a reader", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      dbError({ code: "P0001", message: "check constraint failed on amount" }),
    ).toBe("errors.couldNotSave");
  });
});
