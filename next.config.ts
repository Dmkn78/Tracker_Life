import type { NextConfig } from "next";


const websiteVersion = process.env.NEXT_PUBLIC_WEBSITE_VERSION ?? "development";

const nextConfig: NextConfig = {
  generateBuildId: async () => websiteVersion,
  env: { NEXT_PUBLIC_WEBSITE_VERSION: websiteVersion },
  async headers() {
    return ["/mobile-app/index.html", "/mobile-app/release.json"].map(source => ({ source, headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }));
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb"
    }
  }
};

export default nextConfig;
