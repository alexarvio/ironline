import { execFile } from "child_process";
import fs from "fs";

// A WebM from the coach's browser recorder as an MP4 the client's phone
// plays (9 Oct): ffmpeg from the ffmpeg-static package (the binary for the
// platform it was installed on), H.264 and AAC, the index at the front so
// it starts before it has all come down. False, and the caller keeps the
// original, when ffmpeg is missing or the conversion fails.
export function toMp4(input: string, output: string, timeoutMs = 10 * 60 * 1000): Promise<boolean> {
  return new Promise((resolve) => {
    let bin: string | null = null;
    try {
      bin = (require("ffmpeg-static") as string | null) ?? null;
    } catch {
      bin = null;
    }
    if (!bin || !fs.existsSync(bin)) return resolve(false);
    const args = ["-y", "-i", input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", output];
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err) => {
      if (err) {
        console.warn("[transcode] ffmpeg failed:", err.message);
        fs.rmSync(output, { force: true });
        return resolve(false);
      }
      resolve(fs.existsSync(output) && fs.statSync(output).size > 0);
    });
  });
}
