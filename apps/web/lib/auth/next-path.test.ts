import { describe, expect, it } from "vitest";
import { confirmRedirect, sanitizeNextPath } from "./next-path";

describe("sanitizeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(sanitizeNextPath("/reset/new", "/bearing")).toBe("/reset/new");
  });

  it.each([
    ["missing", null],
    ["protocol-relative", "//evil.example"],
    ["absolute", "https://evil.example/reset"],
    ["backslash", "/\\evil.example"],
    ["relative", "reset/new"],
  ])("falls back for a %s path", (_label, raw) => {
    expect(sanitizeNextPath(raw, "/bearing")).toBe("/bearing");
  });
});

describe("confirmRedirect", () => {
  it("sends a verified recovery to the new-password page by default", () => {
    expect(confirmRedirect({ verified: true, next: null })).toBe("/reset/new");
  });

  it("honours a safe next path", () => {
    expect(confirmRedirect({ verified: true, next: "/reset/new" })).toBe(
      "/reset/new",
    );
  });

  it("sends an expired or reused link back to the reset form, saying so", () => {
    expect(confirmRedirect({ verified: false, next: "/reset/new" })).toBe(
      "/reset?error=link_expired",
    );
  });
});
