import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { storeLinks } = await import("./store-links");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storeLinks", () => {
  it("is empty until the app is published", () => {
    vi.stubEnv("APP_STORE_URL", "");
    vi.stubEnv("PLAY_STORE_URL", "");
    expect(storeLinks()).toEqual({ appStore: null, googlePlay: null });
  });

  it("takes each store's own address", () => {
    vi.stubEnv("APP_STORE_URL", "https://apps.apple.com/fr/app/pluclair/id1");
    vi.stubEnv(
      "PLAY_STORE_URL",
      " https://play.google.com/store/apps/details?id=com.salut_charles.pluclair ",
    );
    expect(storeLinks()).toEqual({
      appStore: "https://apps.apple.com/fr/app/pluclair/id1",
      googlePlay:
        "https://play.google.com/store/apps/details?id=com.salut_charles.pluclair",
    });
  });

  it("refuses anything else", () => {
    vi.stubEnv("APP_STORE_URL", "https://example.com/pluclair");
    vi.stubEnv("PLAY_STORE_URL", "http://play.google.com/store/apps");
    expect(storeLinks()).toEqual({ appStore: null, googlePlay: null });
  });
});
