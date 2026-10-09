import "server-only";

/**
 * The phone app's pages in the App Store and Google Play, set in the
 * environment once it is published there (`docs/store/README.md`): null
 * until then, and the landing keeps the app under « Bientôt ».
 *
 * Only a store's own address is taken, so a mistyped value never sends a
 * visitor somewhere else.
 */
export interface StoreLinks {
  appStore: string | null;
  googlePlay: string | null;
}

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

export function storeLinks(): StoreLinks {
  return {
    appStore: storeUrl(process.env.APP_STORE_URL, "apps.apple.com"),
    googlePlay: storeUrl(process.env.PLAY_STORE_URL, "play.google.com"),
  };
}
