import { describe, expect, it } from "vitest";

import { resetRequestErrorKey } from "./auth-errors";

describe("resetRequestErrorKey", () => {
  it("names an email rate limit", () => {
    expect(resetRequestErrorKey("over_email_send_rate_limit")).toBe(
      "errors.resetTooMany",
    );
  });

  it("names a request rate limit", () => {
    expect(resetRequestErrorKey("over_request_rate_limit")).toBe(
      "errors.resetTooMany",
    );
  });

  it("falls back to a generic sentence for anything else", () => {
    expect(resetRequestErrorKey("some_other_code")).toBe("errors.resetNotSent");
    expect(resetRequestErrorKey(undefined)).toBe("errors.resetNotSent");
  });
});
