"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { paintShapes, type Shape } from "./shapes";

// Recording a form review (12 Oct): every frame, the client's video (or
// photo), the coach's drawing and the camera bubble are painted onto one
// offscreen canvas; the canvas and the coach's mic go into a MediaRecorder.
// What comes out is one video, sent through /api/video-reply as a reply
// file is (the server turns a WebM into an MP4 the phone plays).
//
// The lessons from the first whiteboard (9 Oct) stand: a video that has
// never played has no frame to draw, so it is nudged to one first; and the
// mic prompt is never waited on for more than five seconds.

export type RecState = "ready" | "recording" | "paused" | "done";
export type Corner = "tl" | "tr" | "bl" | "br";
export const MAX_SECONDS = 300;
const LONG_EDGE = 1080;
const FPS = 30;

export const recordingSupported = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype && !!mimeFor();

const mimeFor = () =>
  ["video/mp4;codecs=avc1,mp4a", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(
    (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
  ) ?? "";

type Source = {
  /** The element on the stage: the client's video, or their photo. */
  media: () => HTMLVideoElement | HTMLImageElement | null;
  /** The media's own size, the drawing's coordinates. */
  size: () => { w: number; h: number };
  /** Everything drawn, and the shape being drawn. */
  shapes: () => Shape[];
  unit: () => number;
  /** The camera preview element, when the camera is on. */
  camera: () => HTMLVideoElement | null;
  /** Where the bubble sits, and how big it is as a share of the media's width. */
  bubble: () => { corner: Corner; share: number; inset: number };
};

export function useReviewRecorder(src: Source) {
  const [state, setState] = useState<RecState>("ready");
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mic = useRef<MediaStream | null>(null);
  // The getters as of the last render, for the frame loop to read.
  const srcRef = useRef(src);
  useEffect(() => {
    srcRef.current = src;
  });

  const stopLoop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  const dropMic = () => {
    mic.current?.getTracks().forEach((t) => t.stop());
    mic.current = null;
  };

  // One frame of the recording.
  const paint = useCallback(() => {
    const c = canvas.current;
    const s = srcRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { w } = s.size();
    const scale = c.width / w;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    const m = s.media();
    try {
      if (m) ctx.drawImage(m, 0, 0, c.width, c.height);
    } catch {}
    paintShapes(ctx, s.shapes(), s.unit(), scale);
    // The camera bubble: a circle of the coach's face, white ring, in its corner.
    const cam = s.camera();
    if (cam && cam.readyState >= 2) {
      const b = s.bubble();
      const d = c.width * b.share;
      const inset = c.width * b.inset;
      const x = b.corner.endsWith("l") ? inset : c.width - inset - d;
      const y = b.corner.startsWith("t") ? inset : c.height - inset - d;
      const vw = cam.videoWidth || 1;
      const vh = cam.videoHeight || 1;
      const side = Math.min(vw, vh);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
      ctx.clip();
      // Mirrored, as it shows on screen.
      ctx.translate(x + d, y);
      ctx.scale(-1, 1);
      ctx.drawImage(cam, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, d, d);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, (3 * c.width) / 280 / 2);
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  }, []);


  /** Asks for the mic, five seconds at most; null when it is off, refused or slow. */
  const getMic = async (): Promise<MediaStream | null> => {
    try {
      const state = await navigator.permissions?.query({ name: "microphone" as PermissionName }).then(
        (p) => p.state,
        () => "prompt"
      );
      if (state === "denied") return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ask = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const late = new Promise<null>((r) => (timer = setTimeout(() => r(null), 5000)));
      const got = await Promise.race([ask, late]);
      clearTimeout(timer);
      if (!got) ask.then((st) => st.getTracks().forEach((t) => t.stop())).catch(() => {});
      return got;
    } catch {
      return null;
    }
  };

  const start = useCallback(
    async (opts: { mic: boolean }) => {
      setProblem(null);
      const s = srcRef.current;
      const m = s.media();
      if (!m) return;
      // A video with no painted frame records black: nudge it to one first.
      if (m instanceof HTMLVideoElement && (m.readyState < 2 || !m.played.length)) {
        try {
          m.muted = true;
          await m.play();
          const el = m as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
          await Promise.race([new Promise<void>((r) => (el.requestVideoFrameCallback ? el.requestVideoFrameCallback(() => r()) : setTimeout(r, 300))), new Promise<void>((r) => setTimeout(r, 1500))]);
          m.pause();
        } catch {}
      }
      // The client's own sound stays out of the review: only the coach's voice is in it.
      if (m instanceof HTMLVideoElement) m.muted = true;
      const { w, h } = s.size();
      const k = Math.min(1, LONG_EDGE / Math.max(w, h));
      // A fresh canvas each take, at the media's own shape.
      const c = document.createElement("canvas");
      c.width = Math.round((w * k) / 2) * 2;
      c.height = Math.round((h * k) / 2) * 2;
      canvas.current = c;
      let audio: MediaStream | null = null;
      if (opts.mic) {
        audio = await getMic();
        setMicDenied(!audio);
      }
      mic.current = audio;
      try {
        const run = () => {
          paint();
          raf.current = requestAnimationFrame(run);
        };
        run();
        const stream = c.captureStream(FPS);
        audio?.getAudioTracks().forEach((t) => stream.addTrack(t));
        const r = new MediaRecorder(stream, { mimeType: mimeFor(), videoBitsPerSecond: 4_000_000 });
        chunks.current = [];
        r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
        r.onstop = () => {
          const b = new Blob(chunks.current, { type: r.mimeType.split(";")[0] || "video/webm" });
          setBlob(b);
          setPreview(URL.createObjectURL(b));
          setState("done");
          stopLoop();
          dropMic();
        };
        rec.current = r;
        r.start(1000);
        setSecs(0);
        setState("recording");
      } catch (e) {
        stopLoop();
        dropMic();
        setProblem(`Recording could not start (${e instanceof Error ? e.message : String(e)}).`);
      }
    },
    [paint]
  );

  const pause = useCallback(() => {
    if (rec.current?.state === "recording") {
      rec.current.pause();
      setState("paused");
    }
  }, []);
  const resume = useCallback(() => {
    if (rec.current?.state === "paused") {
      rec.current.resume();
      setState("recording");
    }
  }, []);
  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);
  /** Mutes or unmutes the voice while recording. */
  const setMicOn = useCallback((on: boolean) => {
    mic.current?.getAudioTracks().forEach((t) => (t.enabled = on));
  }, []);
  const retake = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") {
      rec.current.onstop = null;
      rec.current.stop();
    }
    rec.current = null;
    stopLoop();
    dropMic();
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    setBlob(null);
    setSecs(0);
    setState("ready");
    setProblem(null);
  }, []);

  // The clock, while it records; the cap stops it at five minutes.
  useEffect(() => {
    if (state !== "recording") return;
    const i = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [state]);
  useEffect(() => {
    if (state === "recording" && secs >= MAX_SECONDS) stop();
  }, [state, secs, stop]);

  // Gone with the modal: nothing keeps running or listening.
  useEffect(
    () => () => {
      stopLoop();
      dropMic();
      if (rec.current && rec.current.state !== "inactive") {
        rec.current.onstop = null;
        rec.current.stop();
      }
    },
    []
  );

  return { state, secs, blob, preview, micDenied, problem, start, pause, resume, stop, retake, setMicOn };
}
