import "server-only";

/**
 * Where the phone app can be had: its pages in the App Store and Google
 * Play, once it is published there (`docs/store/README.md`), and the Android
 * APK the site hands out itself in the meantime. Each is set in the
 * environment and null until then; the landing keeps the app under
 * « Bientôt » while all three are.
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
}

/** Where the site sends a visitor for the APK, whatever hosts it now. */
export const ANDROID_DOWNLOAD_PATH = "/android";

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
  };
}
