import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the brand logo PNG is traced into the PDF route's serverless function
  // (it's read via node:fs at render time, not statically imported). See
  // src/lib/proposals/brand-assets.ts.
  outputFileTracingIncludes: {
    "/api/proposals/**": ["./public/brand/01_primary_logo_2.png"],
  },
};

export default nextConfig;
