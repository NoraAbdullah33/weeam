import type { NextConfig } from "next";

// Fully self-contained app: document extraction and the governance-compliance
// analysis run inside this Next.js app's own /api routes (Node runtime). No
// external backend is required. `mammoth` / `unpdf` are kept as external server
// packages so their internals aren't bundled by the compiler.
const nextConfig: NextConfig = {
  // Self-contained server output for Docker images (ignored by Vercel).
  output: "standalone",
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
