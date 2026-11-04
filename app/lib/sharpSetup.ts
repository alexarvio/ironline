// sharp, set up once for the whole server (4 Nov, Alex: Railway bills the memory the app holds). By default sharp keeps
// up to 50 MB of decoded pictures and files in its own cache and splits each picture over as many threads as the box
// has cores, each thread holding its own working memory; we never shrink the same original twice in a row (the copies
// are kept), so its cache only holds memory, and one thread a picture is plenty for a coach's clients (a picture takes
// a little longer to make; how many are made at once is still libuv's pool). Every server path that draws with sharp
// (storage.ts, brandMark.ts) loads it through here.
import type sharpType from "sharp";

type Sharp = typeof sharpType;
const configured = ((globalThis as unknown as { _sharpSetUp?: WeakSet<object> })._sharpSetUp ??= new WeakSet<object>());

/** sharp, its cache off and one thread a picture. */
export async function loadSharp(): Promise<Sharp> {
  const sharp = (await import("sharp")).default;
  if (!configured.has(sharp)) {
    sharp.cache(false);
    sharp.concurrency(1);
    configured.add(sharp);
  }
  return sharp;
}
