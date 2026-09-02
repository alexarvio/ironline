import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Coaches attach demo videos by uploading a clip from their phone or
      // laptop, and the default cap is 1MB — which silently rejected every
      // real video (and, before this, every progress photo bigger than a
      // thumbnail). uploadDemoVideoAction enforces the same 64MB itself so
      // an over-large file gets a sentence rather than a failed request.
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;
