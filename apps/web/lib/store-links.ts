import "server-only";

/**
 * Where the phone app can be had: its pages in the App Store and Google
 * Play, once it is published there (`docs/store/README.md`), and in the
 * meantime the Android APK the site hands out itself and the iPhone beta on
 * TestFlight. Each is set in the environment and null until then; the
 * landing keeps the app under « Bientôt » while the stores and the APK are.
 *
 * Only a store's own address is taken, so a mistyped value never sends a
 * visitor somewhere else. The APK can live anywhere — a GitHub release, the
 * build's page on expo.dev — so it is held to HTTPS and to a file that is an
 * APK instead.
 */
export interface StoreLinks {
  appStore: string | null;
  googlePlay: string | null;
  /** The APK file itself; visitors reach it through `/android`. */
  androidApk: string | null;
  /** The iPhone beta's TestFlight public link; reached through `/ios`. */
  iosBeta: string | null;
}

/** Where the site sends a visitor for the APK, whatever hosts it now. */
export const ANDROID_DOWNLOAD_PATH = "/android";

/** Where the site sends a visitor for the iPhone app, wherever it is had. */
export const IOS_DOWNLOAD_PATH = "/ios";

function storeUrl(value: string | undefined, host: string): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === host
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** A TestFlight public link, `https://testflight.apple.com/join/<code>`. */
function testFlightUrl(value: string | undefined): string | null {
  const url = storeUrl(value, "testflight.apple.com");
  return url && /^\/join\/[A-Za-z0-9]+\/?$/.test(new URL(url).pathname)
    ? url
    : null;
}

function apkUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" &&
      url.pathname.toLowerCase().endsWith(".apk")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function storeLinks(): StoreLinks {
  return {
    appStore: storeUrl(process.env.APP_STORE_URL, "apps.apple.com"),
    googlePlay: storeUrl(process.env.PLAY_STORE_URL, "play.google.com"),
    androidApk: apkUrl(process.env.ANDROID_APK_URL),
    iosBeta: testFlightUrl(process.env.IOS_TESTFLIGHT_URL),
  };
}

/** The iPhone app, where `/ios` sends a visitor for it. */
export interface IosApp {
  kind: "appStore" | "testFlight";
  url: string;
}

/**
 * Where the iPhone app is had: the App Store once it is there, its beta on
 * TestFlight before — and null while neither, when an iPhone has the web app
 * on its home screen instead (`DownloadPage.tsx`).
 */
export function iosApp(links: StoreLinks = storeLinks()): IosApp | null {
  if (links.appStore) {
    return { kind: "appStore", url: links.appStore };
  }
  return links.iosBeta ? { kind: "testFlight", url: links.iosBeta } : null;
}

/**
 * Whether a request comes from an iPhone, from its User-Agent. Not an iPad:
 * the phone app is iPhone-only, and an iPad's Safari says it is a Mac.
 */
export function isIphone(userAgent: string | null): boolean {
  return userAgent ? /\b(iPhone|iPod)\b/.test(userAgent) : false;
}

/**
 * `ANDROID_APK_VERSION`, when it is set and is a version: an override for
 * `latestApkVersion`, which otherwise reads the release itself.
 */
export function androidApkVersion(): string | null {
  const value = process.env.ANDROID_APK_VERSION?.trim();
  return value && /^\d+(\.\d+){0,3}$/.test(value) ? value : null;
}

/** This repository, public: its releases carry the APK. */
const GITHUB_REPO = "CharlesCollignon/finance-tracker";

/** « 1.1.0 » from a release tag such as `android-1.1.0`, or null. */
export function versionFromTag(tag: string): string | null {
  return /^android-(\d+(?:\.\d+){0,3})(?:$|-)/.exec(tag)?.[1] ?? null;
}

/** The APK the site hands out, as its release on GitHub describes it. */
export interface ApkRelease {
  version: string;
  /** The file's size in bytes, or null when the release does not say. */
  sizeBytes: number | null;
  /** The day it was published, ISO, or null. */
  publishedOn: string | null;
  /** The file's SHA-256 as GitHub computed it, in hex, or null. */
  sha256: string | null;
}

/**
 * The repository's latest release, as GitHub tells it, asked at most every
 * ten minutes; null when GitHub does not answer in three seconds.
 */
async function latestRelease(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(3000),
      },
    );
    return response.ok
      ? ((await response.json()) as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * What the download page says of the APK: its version, size, day and
 * fingerprint, from the latest release — which `scripts/release-android.mjs`
 * publishes with the file, so a new APK updates the page by itself.
 *
 * With `ANDROID_APK_VERSION` pinned to another version, only that version is
 * said: the release's size and fingerprint would belong to a different file.
 */
export async function latestApkRelease(): Promise<ApkRelease | null> {
  const pinned = androidApkVersion();
  const release = await latestRelease();
  const tagged =
    typeof release?.tag_name === "string"
      ? versionFromTag(release.tag_name)
      : null;
  if (pinned && pinned !== tagged) {
    return {
      version: pinned,
      sizeBytes: null,
      publishedOn: null,
      sha256: null,
    };
  }
  if (!release || !tagged) {
    return null;
  }
  const assets = Array.isArray(release.assets)
    ? (release.assets as Record<string, unknown>[])
    : [];
  const apk = assets.find(
    (asset) =>
      typeof asset.name === "string" &&
      asset.name.toLowerCase().endsWith(".apk"),
  );
  const digest =
    typeof apk?.digest === "string"
      ? /^sha256:([0-9a-f]{64})$/.exec(apk.digest)?.[1]
      : undefined;
  return {
    version: tagged,
    sizeBytes: typeof apk?.size === "number" ? apk.size : null,
    publishedOn:
      typeof release.published_at === "string"
        ? release.published_at.slice(0, 10)
        : null,
    sha256: digest ?? null,
  };
}

/**
 * The version of the APK the site hands out, for the phone to compare its
 * own against (`/nouveautes/feed.json`): `ANDROID_APK_VERSION` where set,
 * else the tag of the repository's latest release, which
 * `scripts/release-android.mjs` names after `app.json`'s version — so
 * publishing an APK is all it takes. Asked of GitHub at most every ten
 * minutes; null when neither says, and the phone then offers nothing.
 */
export async function latestApkVersion(): Promise<string | null> {
  const pinned = androidApkVersion();
  if (pinned) {
    return pinned;
  }
  const release = await latestRelease();
  return typeof release?.tag_name === "string"
    ? versionFromTag(release.tag_name)
    : null;
}
