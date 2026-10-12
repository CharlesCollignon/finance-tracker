import { storeLinks } from "@/lib/store-links";

/**
 * The Android app, at an address that does not move: every button and QR
 * code on the site points here, and this sends the visitor on to wherever the
 * APK lives now (`ANDROID_APK_URL`, see `docs/store/README.md`). A new build
 * or a new host is one variable on Vercel, and no link already shared breaks.
 *
 * A 404 while nothing is set, so the address never sends anyone to a page
 * that is not the file.
 */

export const dynamic = "force-dynamic";

export function GET() {
  const apk = storeLinks().androidApk;
  if (!apk) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: apk, "Cache-Control": "no-store" },
  });
}
