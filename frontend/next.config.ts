import type { NextConfig } from "next";

// Fully self-contained app: document extraction and the governance-compliance
// analysis run inside this Next.js app's own /api routes (Node runtime). No
// external backend is required. `mammoth` / `unpdf` are kept as external server
// packages so their internals aren't bundled by the compiler.
const nextConfig: NextConfig = {
  // `output: "standalone"` is only for self-hosted Docker images. On Vercel it
  // suppresses the serverless functions for /api/* routes (the static pages
  // still deploy, so the homepage works but /api/upload 404s). Vercel sets
  // VERCEL=1 at build time — use standalone everywhere EXCEPT Vercel.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
