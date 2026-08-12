import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@finance/core"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
