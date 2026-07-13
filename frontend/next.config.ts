import type { NextConfig } from "next";

// Proxy /api/* to the FastAPI backend so the whole app is served from a single
// origin. This means one public tunnel URL (the frontend) covers the API too.
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Self-contained server output for Docker/Render images.
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
