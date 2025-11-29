import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  generateBuildId: async () => {
    // Force new build ID to invalidate CDN cache
    return `build-${Date.now()}`;
  },
};

export default nextConfig;
