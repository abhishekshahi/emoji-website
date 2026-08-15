import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Windows build: limit parallel workers to avoid ~2GB native OOM during webpack compile.
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
