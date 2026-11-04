import { execFile } from "child_process";
import { once } from "events";
import fs from "fs";
import os from "os";
import path from "path";

// A WebM from the coach's browser recorder as an MP4 the client's phone
// plays (9 Oct): ffmpeg from the ffmpeg-static package (the binary for the
// platform it was installed on), H.264 and AAC, the index at the front so
// it starts before it has all come down. False, and the caller keeps the
// original, when ffmpeg is missing or the conversion fails.
function staticBin(): string | null {
  let bin: string | null = null;
  try {
    bin = (require("ffmpeg-static") as string | null) ?? null;
  } catch {
    bin = null;
  }
  // The ignore comments keep the bundler from tracing the whole project for these calls (a build warning on 9 Oct).
  return bin && fs.existsSync(/*turbopackIgnore: true*/ bin) ? bin : null;
}
/** The system's own ffmpeg on the PATH (25 Oct: the package's download can be missing on the live server; the build
    installs ffmpeg from the system's packages too, nixpacks.toml / railpack.json). */
function systemBin(): string | null {
  const names = process.platform === "win32" ? ["ffmpeg.exe"] : ["ffmpeg"];
  for (const dir of (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) {
    for (const n of names) {
      const p = `${dir}/${n}`;
      try {
        if (dir && fs.existsSync(/*turbopackIgnore: true*/ p)) return p;
      } catch {}
    }
  }
  return null;
}
// The system one first (26 Oct, Alex: every chat poster failed on the live server: the package's static build could not
// read the bucket's https links, while the system's reads them).
function ffmpegBin(): string | null {
  return systemBin() ?? staticBin();
}
/** Which ffmpeg the server has, for /api/timing (25 Oct). */
export const ffmpegInfo = () => ({ static: staticBin(), system: systemBin() });

/**
 * A video's first frame (or the one `at` seconds in) as a JPEG (21 Oct, the
 * chat's poster): from a file on the disk or a link into the bucket (ffmpeg
 * reads only the parts it needs). Null when ffmpeg is missing or the video
 * can't be read.
 */
/** The last first-frame failure, for /api/timing. */
export let lastFrameError: string | null = null;

export async function firstFrame(input: string, at = 0, timeoutMs = 60 * 1000): Promise<Buffer | null> {
  const frame = await frameOf(input, at, timeoutMs);
  if (frame || !/^https?:/i.test(input)) return frame;
  // A link ffmpeg could not read: the video downloaded to a file first, then read from there. Streamed to the disk a
  // piece at a time (4 Nov, Alex: memory is most of the bill; the whole video was held in memory, a phone's 128 MB
  // twice over), as a coach's review recording is received (chatReviewUpload.ts).
  const tmp = path.join(os.tmpdir(), `frame-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const res = await fetch(input);
    if (!res.ok || !res.body) {
      lastFrameError = `download ${res.status}`;
      return null;
    }
    const out = fs.createWriteStream(tmp);
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!out.write(value)) await once(out, "drain");
      }
      await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    } catch (error) {
      out.destroy();
      void reader.cancel().catch(() => {});
      throw error;
    }
    return await frameOf(tmp, at, timeoutMs);
  } catch (error) {
    lastFrameError = `download: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300);
    return null;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ffmpeg kept small (4 Nov, Alex: memory is most of the bill, and the server sat at gigabytes for hours): two threads to
// read the video as well as to write it ("-threads" before "-i" is the decoder's; by default each takes one per core
// and holds frames for every one of them), one video made at a time, one frame taken at a time.
const THREADS = ["-threads", "2"];
// The long edge 1280 at most, the other kept in proportion and even (H.264 in yuv420p takes no odd size).
const FIT = "scale='if(gt(iw,ih),min(1280,trunc(iw/2)*2),-2)':'if(gt(iw,ih),-2,min(1280,trunc(ih/2)*2))'";

// One at a time, on globalThis so the routes and the server actions (built into different bundles) share one line.
type Lines = { video: Promise<unknown>; review: Promise<unknown>; frame: Promise<unknown> };
const lines = ((globalThis as unknown as { _ffmpegLines?: Partial<Lines> })._ffmpegLines ??= {});
function inLine<T>(which: keyof Lines, run: () => Promise<T>): Promise<T> {
  const next = (lines[which] ?? Promise.resolve()).then(run, run);
  lines[which] = next.catch(() => {});
  return next;
}

// Frames have their own line, not the videos' (4 Nov): a frame is a second's work a chat waits on for its posters, and
// behind a phone video being made small it would wait minutes.
function frameOf(input: string, at: number, timeoutMs: number): Promise<Buffer | null> {
  return inLine("frame", () => frameNow(input, at, timeoutMs));
}

function frameNow(input: string, at: number, timeoutMs: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const bin = ffmpegBin();
    if (!bin) {
      lastFrameError = "no ffmpeg on this server";
      return resolve(null);
    }
    const args = ["-hide_banner", "-loglevel", "error", ...THREADS, ...(at > 0 ? ["-ss", String(at)] : []), "-i", input, "-frames:v", "1", "-f", "image2pipe", "-c:v", "mjpeg", "-q:v", "3", ...THREADS, "pipe:1"];
    execFile(/*turbopackIgnore: true*/ bin, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: "buffer" }, (err, stdout) => {
      if (err || !stdout?.length) {
        if (err) console.warn("[transcode] no first frame:", err.message);
        lastFrameError = (err?.message ?? "no output").slice(0, 300);
        return resolve(null);
      }
      resolve(stdout);
    });
  });
}

/** A coach's review recording (a browser's WebM) as an MP4, its long edge 1280 at most as a web copy's (4 Nov, Alex:
    the screen stays readable at 1280, and a laptop's full-size recording was the heaviest work the server did). A line
    of its own, one at a time, never behind a phone video's web copy (4 Nov, review): the coach's Send waits on this,
    and behind a 15-minute web copy it would wait minutes; so at most a review and a web copy run at once. */
export function toMp4(input: string, output: string, timeoutMs = 10 * 60 * 1000): Promise<boolean> {
  const run = () =>
    new Promise<boolean>((resolve) => {
      const bin = ffmpegBin();
      if (!bin) return resolve(false);
      const args = ["-y", ...THREADS, "-i", input, "-vf", FIT, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", ...THREADS, "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", output];
      execFile(/*turbopackIgnore: true*/ bin, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err) => {
        if (err) {
          console.warn("[transcode] ffmpeg failed:", err.message);
          fs.rmSync(output, { force: true });
          return resolve(false);
        }
        resolve(fs.existsSync(output) && fs.statSync(output).size > 0);
      });
    });
  return inLine("review", run);
}

// One at a time (25 Oct): a phone video made small is minutes of work for the server's few cores, and two at once
// would slow every page while they run.

/**
 * A phone video as one every browser starts at once (25 Oct, Alex: "it takes so long for the videos to load"): H.264
 * and AAC, its long edge 1280 at most, the index at the front. A phone's original is often HEVC in a .mov, tens of
 * MB, which a laptop's browser plays late or not at all. From a file or a link into the bucket; false, the caller
 * keeping the original, when ffmpeg is missing or it fails. Made beside the output and named it only once whole (4 Nov:
 * so a file at `output` is always a finished copy, which webChatVideo trusts to skip the work).
 */
export function toWebVideo(input: string, output: string, timeoutMs = 15 * 60 * 1000): Promise<boolean> {
  const run = () =>
    new Promise<boolean>((resolve) => {
      const bin = ffmpegBin();
      if (!bin) return resolve(false);
      const part = `${output.replace(/\.mp4$/i, "")}.part-${process.pid}-${Math.random().toString(36).slice(2)}.mp4`;
      const args = ["-y", "-hide_banner", "-loglevel", "error", ...THREADS, "-i", input, "-vf", FIT, "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", ...THREADS, "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", part];
      execFile(/*turbopackIgnore: true*/ bin, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err) => {
        if (err || !fs.existsSync(part) || fs.statSync(part).size === 0) {
          if (err) console.warn("[transcode] web video failed:", err.message);
          fs.rmSync(part, { force: true });
          return resolve(false);
        }
        try {
          fs.renameSync(part, output);
        } catch (error) {
          console.warn("[transcode] web video not kept:", error instanceof Error ? error.message : error);
          fs.rmSync(part, { force: true });
          return resolve(false);
        }
        resolve(true);
      });
    });
  return inLine("video", run);
}
