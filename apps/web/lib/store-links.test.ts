import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  androidApkVersion,
  iosApp,
  isIphone,
  latestApkRelease,
  latestApkVersion,
  storeLinks,
  versionFromTag,
} = await import("./store-links");

beforeEach(() => {
  vi.stubEnv("APP_STORE_URL", "");
  vi.stubEnv("PLAY_STORE_URL", "");
  vi.stubEnv("ANDROID_APK_URL", "");
  vi.stubEnv("ANDROID_APK_VERSION", "");
  vi.stubEnv("IOS_TESTFLIGHT_URL", "");
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
      iosBeta: null,
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

describe("iosApp", () => {
  it("is the TestFlight beta, from its public link", () => {
    vi.stubEnv(
      "IOS_TESTFLIGHT_URL",
      " https://testflight.apple.com/join/AbC123xY ",
    );
    expect(iosApp()).toEqual({
      kind: "testFlight",
      url: "https://testflight.apple.com/join/AbC123xY",
    });
  });

  it("refuses a link that is not a TestFlight invitation", () => {
    vi.stubEnv("IOS_TESTFLIGHT_URL", "https://testflight.apple.com/");
    expect(iosApp()).toBeNull();
    vi.stubEnv("IOS_TESTFLIGHT_URL", "http://testflight.apple.com/join/AbC123");
    expect(iosApp()).toBeNull();
    vi.stubEnv("IOS_TESTFLIGHT_URL", "https://example.com/join/AbC123");
    expect(iosApp()).toBeNull();
  });

  it("is the App Store once the app is there, beta or not", () => {
    vi.stubEnv(
      "IOS_TESTFLIGHT_URL",
      "https://testflight.apple.com/join/AbC123",
    );
    vi.stubEnv("APP_STORE_URL", "https://apps.apple.com/fr/app/pluclair/id1");
    expect(iosApp()).toEqual({
      kind: "appStore",
      url: "https://apps.apple.com/fr/app/pluclair/id1",
    });
  });
});

describe("isIphone", () => {
  it("knows an iPhone, and not an iPad, a Mac or Android", () => {
    expect(
      isIphone(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
    expect(
      isIphone(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
      ),
    ).toBe(false);
    expect(
      isIphone(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
    expect(isIphone(null)).toBe(false);
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

describe("versionFromTag", () => {
  it("reads the release's own naming", () => {
    expect(versionFromTag("android-1.1.0")).toBe("1.1.0");
    expect(versionFromTag("android-1.0.0-beta.1")).toBe("1.0.0");
    expect(versionFromTag("v1.1.0")).toBeNull();
  });
});

describe("latestApkVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes the variable over the release", async () => {
    vi.stubEnv("ANDROID_APK_VERSION", "1.2.0");
    vi.stubGlobal("fetch", vi.fn());
    expect(await latestApkVersion()).toBe("1.2.0");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads the latest release's tag, and nothing when GitHub does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ tag_name: "android-1.3.0" })),
    );
    expect(await latestApkVersion()).toBe("1.3.0");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await latestApkVersion()).toBeNull();
  });
});

describe("latestApkRelease", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const release = {
    tag_name: "android-1.3.0",
    published_at: "2026-10-25T11:23:38Z",
    assets: [
      {
        name: "pluclair.apk",
        size: 114406716,
        digest: `sha256:${"af".repeat(32)}`,
      },
    ],
  };

  it("reads the version, size, day and fingerprint of the release's APK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(release)),
    );
    expect(await latestApkRelease()).toEqual({
      version: "1.3.0",
      sizeBytes: 114406716,
      publishedOn: "2026-10-25",
      sha256: "af".repeat(32),
    });
  });

  it("says only the version when another one is pinned", async () => {
    vi.stubEnv("ANDROID_APK_VERSION", "1.2.0");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(release)),
    );
    expect(await latestApkRelease()).toEqual({
      version: "1.2.0",
      sizeBytes: null,
      publishedOn: null,
      sha256: null,
    });
  });

  it("is null when GitHub does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await latestApkRelease()).toBeNull();
  });
});
