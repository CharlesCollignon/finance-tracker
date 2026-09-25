import { describe, expect, it } from "vitest";
import { newPasswordSchema, resetRequestSchema } from "./finance";

describe("newPasswordSchema", () => {
  it("accepts two identical passwords of six or more characters", () => {
    expect(
      newPasswordSchema.safeParse({ password: "abcdef", confirm: "abcdef" })
        .success,
    ).toBe(true);
  });

  it("names the short password", () => {
    const result = newPasswordSchema.safeParse({
      password: "abc",
      confirm: "abc",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.passwordTooShort");
  });

  it("names a mismatch, on the second field", () => {
    const result = newPasswordSchema.safeParse({
      password: "abcdef",
      confirm: "abcdeg",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.passwordsDiffer");
    expect(result.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("resetRequestSchema", () => {
  it("trims and accepts an email", () => {
    expect(resetRequestSchema.parse({ email: " me@example.com " }).email).toBe(
      "me@example.com",
    );
  });

  it("names an address that is not one", () => {
    const result = resetRequestSchema.safeParse({ email: "nope" });
    expect(result.error?.issues[0]?.message).toBe("errors.invalidEmail");
  });
});
