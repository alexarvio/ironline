import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (a Postgres that runs in-process, used for local testing of the
  // Postgres store) ships a WebAssembly build that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "ffmpeg-static"],
  experimental: {
    serverActions: {
      // Coaches attach demo videos by uploading a clip from their phone or
      // laptop, and the default cap is 1MB — which silently rejected every
      // real video (and, before this, every progress photo bigger than a
      // thumbnail). uploadDemoVideoAction enforces its own 128MB so
      // an over-large file gets a sentence rather than a failed request.
      // 130mb since the client's exercise video went to 128 MB (two minutes);
      // each action still enforces its own ceiling (128 MB for a demo).
      // 25mb since 4 Nov (Alex: memory was 92% of the bill; an action holds its
      // whole body three or four times over): every video, the chat's files
      // and the meal and shape-update photos go ahead to /api/upload, written
      // to the disk as they come (lib/streamUpload.ts), and the action gets a
      // handle. What still comes in an action body: Support's screenshot (20 MB
      // at most, the largest), the logo (10 MB), the covers, avatars, gym and
      // coach pictures (6 MB, most shrunk in the browser), a chat video's first
      // frame (5 MB).
      bodySizeLimit: "25mb",
    },
    // proxy.ts runs in front of nearly every request, and with a proxy Next
    // copies each request body into memory, cut off at 10MB by default. An
    // upload over 10MB then reached its server action truncated ("Unexpected
    // end of form"), so a 30MB demo video failed although the limit above
    // says 128MB. The same here. (Bigger files, like a coach's screen
    // recording, go to a route the proxy skips.) 25mb with it (4 Nov): the big
    // files skip the proxy now (api/upload in its matcher).
    proxyClientMaxBodySize: "25mb",
    // A save sent while the phone has no signal waits for it and goes again,
    // instead of rejecting (6 Nov: a client on 5G in the gym lost the whole
    // app to "Something went wrong" each time a set's save failed to load).
    // Navigations and refreshes wait the same way.
    useOffline: true,
  },
};

export default nextConfig;
