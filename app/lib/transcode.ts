import { execFile } from "child_process";
import fs from "fs";

// A WebM from the coach's browser recorder as an MP4 the client's phone
// plays (9 Oct): ffmpeg from the ffmpeg-static package (the binary for the
// platform it was installed on), H.264 and AAC, the index at the front so
// it starts before it has all come down. False, and the caller keeps the
// original, when ffmpeg is missing or the conversion fails.
function ffmpegBin(): string | null {
  let bin: string | null = null;
  try {
    bin = (require("ffmpeg-static") as string | null) ?? null;
  } catch {
    bin = null;
  }
  // The ignore comments keep the bundler from tracing the whole project for these calls (a build warning on 9 Oct).
  return bin && fs.existsSync(/*turbopackIgnore: true*/ bin) ? bin : null;
}

/**
 * A video's first frame (or the one `at` seconds in) as a JPEG (21 Oct, the
 * chat's poster): from a file on the disk or a link into the bucket (ffmpeg
 * reads only the parts it needs). Null when ffmpeg is missing or the video
 * can't be read.
 */
export function firstFrame(input: string, at = 0, timeoutMs = 60 * 1000): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const bin = ffmpegBin();
    if (!bin) return resolve(null);
    const args = ["-hide_banner", "-loglevel", "error", ...(at > 0 ? ["-ss", String(at)] : []), "-i", input, "-frames:v", "1", "-f", "image2pipe", "-c:v", "mjpeg", "-q:v", "3", "pipe:1"];
    execFile(/*turbopackIgnore: true*/ bin, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: "buffer" }, (err, stdout) => {
      if (err || !stdout?.length) {
        if (err) console.warn("[transcode] no first frame:", err.message);
        return resolve(null);
      }
      resolve(stdout);
    });
  });
}

export function toMp4(input: string, output: string, timeoutMs = 10 * 60 * 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const bin = ffmpegBin();
    if (!bin) return resolve(false);
    const args = ["-y", "-i", input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", output];
    execFile(/*turbopackIgnore: true*/ bin, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err) => {
      if (err) {
        console.warn("[transcode] ffmpeg failed:", err.message);
        fs.rmSync(output, { force: true });
        return resolve(false);
      }
      resolve(fs.existsSync(output) && fs.statSync(output).size > 0);
    });
  });
}
