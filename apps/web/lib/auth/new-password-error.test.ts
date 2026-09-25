import { describe, expect, it } from "vitest";
import { newPasswordErrorKey } from "./new-password-error";

describe("newPasswordErrorKey", () => {
  it("names a repeated password", () => {
    expect(newPasswordErrorKey("same_password")).toBe("errors.samePassword");
  });

  it("names a weak password", () => {
    expect(newPasswordErrorKey("weak_password")).toBe("errors.passwordTooWeak");
  });

  it("falls back to a generic sentence for anything else", () => {
    expect(newPasswordErrorKey("some_other_code")).toBe(
      "errors.passwordNotSaved",
    );
    expect(newPasswordErrorKey(undefined)).toBe("errors.passwordNotSaved");
  });
});
