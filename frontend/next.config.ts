import type { NextConfig } from "next";

// `/api/*` is proxied to the FastAPI backend at runtime by the Route Handler in
// `src/app/api/[...path]/route.ts` (it reads BACKEND_URL per request). A
// build-time `rewrites()` entry is deliberately NOT used: its destination is
// frozen at build and, when BACKEND_URL is unset, silently points at
// 127.0.0.1:8000 — which the host drops, making `/api/*` return an opaque 404.
const nextConfig: NextConfig = {
  // Self-contained server output for Docker/Render images.
  output: "standalone",
};

export default nextConfig;
