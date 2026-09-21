import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (a Postgres that runs in-process, used for local testing of the
  // Postgres store) ships a WebAssembly build that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      // Coaches attach demo videos by uploading a clip from their phone or
      // laptop, and the default cap is 1MB — which silently rejected every
      // real video (and, before this, every progress photo bigger than a
      // thumbnail). uploadDemoVideoAction enforces the same 64MB itself so
      // an over-large file gets a sentence rather than a failed request.
      // 130mb since the client's exercise video went to 128 MB (two minutes);
      // each action still enforces its own ceiling (64 MB for a demo).
      bodySizeLimit: "130mb",
    },
    // proxy.ts runs in front of nearly every request, and with a proxy Next
    // copies each request body into memory, cut off at 10MB by default. An
    // upload over 10MB then reached its server action truncated ("Unexpected
    // end of form"), so a 30MB demo video failed although the limit above
    // says 64MB. The same 64MB here. (Bigger files, like a coach's screen
    // recording, go to a route the proxy skips.)
    proxyClientMaxBodySize: "130mb",
  },
};

export default nextConfig;
