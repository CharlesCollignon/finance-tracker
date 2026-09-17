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
