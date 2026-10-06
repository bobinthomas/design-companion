import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // V2 lives inside the V1 repo without workspaces; pin the root so Turbopack
  // doesn't pick up the parent directory's lockfile and resolve V1's files.
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

// Exposes wrangler.jsonc bindings (AI, JEV_QUOTA) to `next dev` via
// getCloudflareContext(). KV is simulated locally; Workers AI calls are remote.
initOpenNextCloudflareForDev();
