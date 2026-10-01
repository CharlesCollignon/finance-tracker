import { describe, expect, it } from "vitest";

import {
  resetRequestErrorKey,
  signInErrorKey,
  signUpErrorKey,
} from "./auth-errors";

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

describe("signInErrorKey", () => {
  it("says wrong address or password without saying which", () => {
    expect(signInErrorKey("invalid_credentials")).toBe(
      "auth.invalidCredentials",
    );
  });

  it("names an unconfirmed address and a rate limit", () => {
    expect(signInErrorKey("email_not_confirmed")).toBe(
      "errors.emailNotConfirmed",
    );
    expect(signInErrorKey("over_request_rate_limit")).toBe(
      "errors.tooManyAttempts",
    );
  });

  it("falls back to a generic sentence", () => {
    expect(signInErrorKey(undefined)).toBe("errors.signInFailed");
  });
});

describe("signUpErrorKey", () => {
  it("names the refusals a person can act on", () => {
    expect(signUpErrorKey("user_already_exists")).toBe("errors.accountExists");
    expect(signUpErrorKey("weak_password")).toBe("errors.passwordTooWeak");
    expect(signUpErrorKey("email_address_invalid")).toBe("errors.invalidEmail");
    expect(signUpErrorKey("signup_disabled")).toBe("errors.signUpClosed");
  });

  it("falls back to a generic sentence", () => {
    expect(signUpErrorKey("unexpected_failure")).toBe("errors.signUpFailed");
  });
});
