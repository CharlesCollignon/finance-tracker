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
