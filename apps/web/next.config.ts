import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /**
   * Who may ask the dev server for its own dev assets.
   *
   * Development only — it has no effect on a build, and nothing here is
   * reachable in production. Next blocks cross-origin requests to `/_next`
   * dev resources unless the origin matches the host it was started on, which
   * on this machine means the client bundle never arrives: the app runs
   * inside WSL2 in `nat` mode and the browser runs on Windows, so the only
   * URL that reaches it is the WSL interface's own address, never
   * `localhost`. The page then renders from the server and simply never
   * hydrates — every menu, toggle and language control is inert, with nothing
   * in the browser console to say why.
   *
   * The private ranges rather than one address because the WSL IP is
   * reassigned on reboot; `hostname -I` is how you find today's.
   */
  allowedDevOrigins: ["127.0.0.1", "172.*.*.*", "192.168.*.*", "10.*.*.*"],
  transpilePackages: ["@finance/core"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async redirects() {
    return [
      // Month is retired. Its content moved into the Bearing's own panels
      // rather than to a page, so there is nothing at `/dashboard` to render
      // — but bookmarks and already-delivered push notifications still name
      // it, and a bare 404 for either is worse than one redirect entry.
      // Handled here rather than with a page-level `redirect()` because
      // `next.config.js` redirects run before the filesystem router and
      // before `proxy`, so `/dashboard` never has to be threaded through
      // `MONTH_SCOPED` or the auth check in `lib/supabase/middleware.ts`.
      {
        source: "/dashboard",
        destination: "/bearing",
        permanent: true,
      },
      // The feature pages were named after the app's routes rather than
      // after its surfaces, so `/features/home` described the Bearing and
      // `/features/planning` described Plan. These are public URLs people
      // read and share, which is the difference from the app's own paths —
      // those kept their old names on purpose, because nobody reads
      // `/budgets` in an installed app. `/features/calendar` has no
      // successor of its own: the calendar is a view of the Ledger now, and
      // the Ledger's page is where it is described.
      ...[
        ["home", "bearing"],
        ["transactions", "ledger"],
        ["recurring", "charges"],
        ["planning", "plan"],
        ["calendar", "ledger"],
      ].map(([from, to]) => ({
        source: `/features/${from}`,
        destination: `/features/${to}`,
        permanent: true,
      })),
    ];
  },
  async headers() {
    const wellKnownJson = [
      { key: "Content-Type", value: "application/json" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: wellKnownJson,
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: wellKnownJson,
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
