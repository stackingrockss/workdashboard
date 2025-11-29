import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  generateBuildId: async () => {
    // Force new build ID to invalidate CDN cache
    const buildId = `build-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log('🔨 Generated Build ID:', buildId);
    return buildId;
  },
  // Disable build caching
  experimental: {

  },
};

export default nextConfig;
