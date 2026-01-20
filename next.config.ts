import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the default caching behavior. The experimental `cacheComponents`
  // mode is disabled to avoid conflicts with dynamic server-side auth
  // (e.g. Supabase `createClient()` in route segments like `/protected`).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "acontext.io",
      },
    ],
    localPatterns: [
      // Allow local slide assets to include cache-busting query strings like `?v=2026-01-20`.
      {
        pathname: "/fonts/slides/**",
        search: "?v=*",
      },
    ],
  },
};

export default nextConfig;
