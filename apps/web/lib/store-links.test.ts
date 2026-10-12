import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { androidApkVersion, storeLinks } = await import("./store-links");

beforeEach(() => {
  vi.stubEnv("APP_STORE_URL", "");
  vi.stubEnv("PLAY_STORE_URL", "");
  vi.stubEnv("ANDROID_APK_URL", "");
  vi.stubEnv("ANDROID_APK_VERSION", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storeLinks", () => {
  it("is empty until the app is published", () => {
    expect(storeLinks()).toEqual({
      appStore: null,
      googlePlay: null,
      androidApk: null,
    });
  });

  it("takes each store's own address", () => {
    vi.stubEnv("APP_STORE_URL", "https://apps.apple.com/fr/app/pluclair/id1");
    vi.stubEnv(
      "PLAY_STORE_URL",
      " https://play.google.com/store/apps/details?id=com.salut_charles.pluclair ",
    );
    expect(storeLinks()).toMatchObject({
      appStore: "https://apps.apple.com/fr/app/pluclair/id1",
      googlePlay:
        "https://play.google.com/store/apps/details?id=com.salut_charles.pluclair",
    });
  });

  it("refuses anything else", () => {
    vi.stubEnv("APP_STORE_URL", "https://example.com/pluclair");
    vi.stubEnv("PLAY_STORE_URL", "http://play.google.com/store/apps");
    expect(storeLinks()).toMatchObject({ appStore: null, googlePlay: null });
  });

  it("takes an APK served over HTTPS, wherever it is hosted", () => {
    vi.stubEnv(
      "ANDROID_APK_URL",
      " https://github.com/CharlesCollignon/finance-tracker/releases/latest/download/pluclair.apk ",
    );
    expect(storeLinks().androidApk).toBe(
      "https://github.com/CharlesCollignon/finance-tracker/releases/latest/download/pluclair.apk",
    );
  });

  it("refuses an APK over plain HTTP, or a page that is not one", () => {
    vi.stubEnv("ANDROID_APK_URL", "http://example.com/pluclair.apk");
    expect(storeLinks().androidApk).toBeNull();
    vi.stubEnv("ANDROID_APK_URL", "https://expo.dev/accounts/me/builds/1");
    expect(storeLinks().androidApk).toBeNull();
    vi.stubEnv("ANDROID_APK_URL", "not a url");
    expect(storeLinks().androidApk).toBeNull();
  });
});

describe("androidApkVersion", () => {
  it("takes a version, and nothing else", () => {
    expect(androidApkVersion()).toBeNull();
    vi.stubEnv("ANDROID_APK_VERSION", " 1.2.0 ");
    expect(androidApkVersion()).toBe("1.2.0");
    vi.stubEnv("ANDROID_APK_VERSION", "latest");
    expect(androidApkVersion()).toBeNull();
  });
});
