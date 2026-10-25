import { iosApp } from "@/lib/store-links";

/**
 * The iPhone app, at an address that does not move: the App Store once it is
 * there, its beta on TestFlight before (`IOS_TESTFLIGHT_URL`, see
 * `docs/store/README.md`). Moving from one to the other is a variable on
 * Vercel, and no link already shared breaks.
 *
 * A 404 while neither is set, as `/android` is without its file.
 */

export const dynamic = "force-dynamic";

export function GET() {
  const app = iosApp();
  if (!app) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: app.url, "Cache-Control": "no-store" },
  });
}
