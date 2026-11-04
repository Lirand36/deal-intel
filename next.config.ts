import type { NextConfig } from "next";

const config: NextConfig = {
  // Type checking runs via `npm run typecheck`, which uses the same strict settings.
  typescript: { ignoreBuildErrors: true },
};

export default config;
