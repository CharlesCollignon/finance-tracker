import { afterEach, describe, expect, it, vi } from "vitest";
import { keepIfMeasured, redactUrl, setMeasured } from "./measurement";

describe("redactUrl", () => {
  it("never lets an invitation's token out", () => {
    expect(redactUrl("https://pluclair.com/join/s3cr3t-T0ken")).toBe(
      "https://pluclair.com/join/[token]",
    );
  });

  it("replaces an id with its placeholder", () => {
    expect(
      redactUrl(
        "https://pluclair.com/property/2b1f6c1e-9d3a-4c55-8e0f-3a7b9c2d1e40",
      ),
    ).toBe("https://pluclair.com/property/[id]");
  });

  it("keeps where a visitor came from and drops every other parameter", () => {
    expect(
      redactUrl(
        "https://pluclair.com/auth/callback?code=abc&utm_source=x&ref=hn#top",
      ),
    ).toBe("https://pluclair.com/auth/callback?utm_source=x&ref=hn");
  });

  it("leaves public slugs as they are", () => {
    expect(redactUrl("https://pluclair.com/blog/un-mois-clos")).toBe(
      "https://pluclair.com/blog/un-mois-clos",
    );
  });

  it("gives a bare path back as a path", () => {
    expect(redactUrl("/join/abc?token_hash=1")).toBe("/join/[token]");
  });
});

describe("keepIfMeasured", () => {
  afterEach(() => setMeasured(true));

  it("sends a cleaned event while the switch is on", () => {
    expect(
      keepIfMeasured({ type: "pageview", url: "https://pluclair.com/join/x" }),
    ).toEqual({ type: "pageview", url: "https://pluclair.com/join/[token]" });
  });

  it("sends nothing when the browser objects (Global Privacy Control)", () => {
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    try {
      expect(
        keepIfMeasured({ type: "pageview", url: "https://pluclair.com/" }),
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sends nothing once the switch is off", () => {
    setMeasured(false);
    expect(
      keepIfMeasured({ type: "vital", url: "https://pluclair.com/bearing" }),
    ).toBeNull();
  });
});
