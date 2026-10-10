"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";

// The whiteboard reply (9 Oct): the client's clip plays under a drawing
// layer; the coach presses Record, talks, pauses where it matters, draws a
// line or an arrow (the knee, the bar path), plays on. What the browser
// records is the drawn-over picture with the coach's voice, one new video,
// which goes up through /api/video-reply as a reply file does; the note and
// the notification follow (sendVideoReplyAction, by the dialog). Chrome
// records WebM, which a phone cannot play: the server converts it to MP4
// after the upload, so the client always gets a file that plays.

type Pt = { x: number; y: number };
type Shape = ({ kind: "pen"; points: Pt[] } | { kind: "arrow"; from: Pt; to: Pt }) & { color: string; width: number };
type Rec = "idle" | "recording" | "done";

// Eight colours (9 Oct): orange, purple and black joined the five.
const COLORS = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#0a84ff", "#af52de", "#ffffff", "#000000"];
/** Line thickness, as a share of a 960-wide picture: thin, medium, thick. */
const WIDTHS = [2.6, 4.6, 8.5];
const WIDTH_NAMES = ["Thin", "Medium", "Thick"];
const TOOLS: { id: "pen" | "arrow" | "erase"; label: string; icon: string }[] = [
  {
    id: "pen",
    label: "Pen",
    icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  },
  { id: "arrow", label: "Arrow", icon: "M5 19 19 5M9 5h10v10" },
  {
    id: "erase",
    label: "Eraser",
    icon: "M20 20H7.5M3.6 13.4 12.6 4.4a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8l-8.9 8.9a1 1 0 0 1-1.4 0l-5.7-5.7a1 1 0 0 1 0-1.4ZM8.5 8.5l7 7",
  },
];
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const MAX_W = 1280;

/** Uploads the recording as the reply file, with progress; null when it went up. */
function upload(id: number, blob: Blob, onProgress: (share: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/video-reply/${id}`);
    xhr.setRequestHeader("Content-Type", blob.type.split(";")[0] || "video/webm");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(null);
      let message = "The upload failed. Try again.";
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {}
      resolve(message);
    };
    xhr.onerror = () => resolve("The upload broke off. Check the connection and try again.");
    xhr.send(blob);
  });
}

const mimeFor = () => ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function VideoWhiteboard({ src, requestId, firstName, onSent }: { src: string; requestId: number; firstName: string; /** The file is up: send the note and tell the client. */ onSent: (note: string) => void }) {
  const videoEl = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({
    w: 960,
    h: 540,
  });
  const [tool, setTool] = useState<"pen" | "arrow" | "erase">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(1);
  const [shapes, setShapesRaw] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);
  // Undo and redo (9 Oct): every change keeps the list it replaced; undo brings it back and parks the one it undid for redo.
  const undoStack = useRef<Shape[][]>([]);
  const redoStack = useRef<Shape[][]>([]);
  const [histN, setHistN] = useState({ undo: 0, redo: 0 });
  const setShapes = (fn: (list: Shape[]) => Shape[]) => {
    const next = fn(shapesRef.current);
    if (next === shapesRef.current) return;
    undoStack.current.push(shapesRef.current);
    redoStack.current = [];
    shapesRef.current = next;
    setShapesRaw(next);
    setHistN({ undo: undoStack.current.length, redo: 0 });
  };
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(shapesRef.current);
    shapesRef.current = prev;
    setShapesRaw(prev);
    setHistN({
      undo: undoStack.current.length,
      redo: redoStack.current.length,
    });
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(shapesRef.current);
    shapesRef.current = next;
    setShapesRaw(next);
    setHistN({
      undo: undoStack.current.length,
      redo: redoStack.current.length,
    });
  };
  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y), as anywhere else; not while typing the note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const live = useRef<Shape | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rec, setRec] = useState<Rec>("idle");
  const [secs, setSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mic = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [noMic, setNoMic] = useState(false);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!mimeFor();

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      mic.current?.getTracks().forEach((x) => x.stop());
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // ---- The drawing layer, over the picture.
  const drawShapes = (ctx: CanvasRenderingContext2D, list: Shape[]) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of list) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = Math.max(1.5, (s.width * size.w) / 960);
      if (s.kind === "pen") {
        if (s.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        const { from, to } = s;
        const a = Math.atan2(to.y - from.y, to.x - from.x);
        const head = Math.max(10, (s.width * 3.2 * size.w) / 960);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - head * Math.cos(a - Math.PI / 6), to.y - head * Math.sin(a - Math.PI / 6));
        ctx.lineTo(to.x - head * Math.cos(a + Math.PI / 6), to.y - head * Math.sin(a + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    }
  };
  const paint = () => {
    const c = overlay.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawShapes(ctx, live.current ? [...shapesRef.current, live.current] : shapesRef.current);
  };
  // Shapes changed: the layer again (after paint is defined, for the linter).
  useEffect(() => {
    shapesRef.current = shapes;
    paint();
  }, [shapes]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * size.w,
      y: ((e.clientY - r.top) / r.height) * size.h,
    };
  };
  // The eraser (9 Oct): a tap or a drag over a stroke takes that stroke away.
  const near = (s: Shape, p: Pt) => {
    const tol = Math.max(14, size.w / 60);
    const segs: [Pt, Pt][] = s.kind === "arrow" ? [[s.from, s.to]] : s.points.slice(1).map((q, i) => [s.points[i], q] as [Pt, Pt]);
    return segs.some(([a, b]) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy)) <= tol;
    });
  };
  const eraseAt = (p: Pt) => {
    const hit = shapesRef.current.filter((s) => near(s, p));
    if (hit.length) setShapes((list) => list.filter((s) => !hit.includes(s)));
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e);
    if (tool === "erase") {
      eraseAt(p);
      return;
    }
    live.current = tool === "pen" ? { kind: "pen", points: [p], color, width: WIDTHS[width] } : { kind: "arrow", from: p, to: p, color, width: WIDTHS[width] };
    paint();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "erase") {
      if (e.buttons) eraseAt(at(e));
      return;
    }
    const s = live.current;
    if (!s) return;
    const p = at(e);
    if (s.kind === "pen") s.points.push(p);
    else s.to = p;
    paint();
  };
  const up = () => {
    const s = live.current;
    live.current = null;
    if (!s) return;
    if (s.kind === "pen" ? s.points.length > 1 : Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > 4) setShapes((list) => [...list, s]);
    else paint();
  };

  // ---- The picture: play, pause, scrub.
  const toggle = () => {
    const v = videoEl.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const seek = (x: number) => {
    const v = videoEl.current;
    if (!v) return;
    v.currentTime = x;
    setT(x);
  };

  // ---- Recording: the picture and the drawing, composed each frame, with the mic.
  const compose = () => {
    const v = videoEl.current;
    const c = out.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    drawShapes(ctx, live.current ? [...shapesRef.current, live.current] : shapesRef.current);
    raf.current = requestAnimationFrame(compose);
  };
  const [starting, setStarting] = useState(false);
  const [micWait, setMicWait] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const start = async () => {
    setProblem(null);
    const c = out.current;
    const v = videoEl.current;
    if (!c || !v || !canRecord || starting) return;
    setStarting(true);
    try {
      // A video that has never played has no decoded frame to draw, and the
      // recording came out black (10 Oct): play until one frame is painted, then
      // pause, so there is a picture before the recorder starts.
      // Pausing straight after play() is too soon (the frame is not painted yet): wait for one, a second and a half at most.
      if (v.readyState < 2 || !v.played.length) {
        try {
          await v.play();
          const el = v as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => number;
          };
          await Promise.race([new Promise<void>((r) => (el.requestVideoFrameCallback ? el.requestVideoFrameCallback(() => r()) : setTimeout(r, 300))), new Promise<void>((r) => setTimeout(r, 1500))]);
          v.pause();
        } catch {}
      }
      // The mic, but never a wait on it (10 Oct): Chrome's permission prompt
      // can sit unanswered in the address bar, and the recorder waited on it
      // forever, which looked like Record doing nothing. Five seconds, then
      // the picture records without sound and the hint says why.
      let audio: MediaStream | null = null;
      let blocked = false;
      try {
        const state = await navigator.permissions?.query({ name: "microphone" as PermissionName }).then(
          (p) => p.state,
          () => "prompt",
        );
        if (state === "denied") blocked = true;
        else {
          setMicWait(true);
          let timer: ReturnType<typeof setTimeout> | undefined;
          const ask = navigator.mediaDevices.getUserMedia({ audio: true });
          const late = new Promise<null>((r) => (timer = setTimeout(() => r(null), 5000)));
          audio = await Promise.race([ask, late]);
          clearTimeout(timer);
          // Answered after we gave up: let that stream go, it is not in the recording.
          if (!audio) ask.then((st) => st.getTracks().forEach((t) => t.stop())).catch(() => {});
        }
      } catch {
        audio = null;
      } finally {
        setMicWait(false);
      }
      setNoMic(!audio);
      setMicBlocked(blocked);
      mic.current = audio;
      compose();
      const stream = c.captureStream(30);
      audio?.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      const r = new MediaRecorder(stream, {
        mimeType: mimeFor(),
        videoBitsPerSecond: 4_000_000,
      });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = () => {
        const b = new Blob(chunks.current, {
          type: r.mimeType.split(";")[0] || "video/webm",
        });
        setBlob(b);
        setPreview(URL.createObjectURL(b));
        setRec("done");
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = null;
        mic.current?.getTracks().forEach((x) => x.stop());
        mic.current = null;
      };
      recorder.current = r;
      r.start(1000);
      setSecs(0);
      setRec("recording");
    } catch (e) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      mic.current?.getTracks().forEach((x) => x.stop());
      mic.current = null;
      setProblem(`Recording could not start (${e instanceof Error ? e.message : String(e)}). Try again, or write a note.`);
    } finally {
      setStarting(false);
    }
  };
  useEffect(() => {
    if (rec !== "recording") return;
    const i = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [rec]);
  const stop = () => {
    recorder.current?.stop();
    videoEl.current?.pause();
  };
  const retake = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setBlob(null);
    setRec("idle");
    setProgress(null);
    setProblem(null);
    recorder.current = null;
    chunks.current = [];
  };

  // ---- Sending: the file up, then the note and the notification.
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (sending) return;
    if (!blob && !note.trim()) return;
    setSending(true);
    setProblem(null);
    if (blob) {
      setProgress(0);
      const err = await upload(requestId, blob, setProgress);
      if (err) {
        setProblem(err);
        setSending(false);
        setProgress(null);
        return;
      }
    }
    onSent(note.trim());
  };

  const isMp4 = blob?.type.includes("mp4");

  return (
    <div className="wb">
      <div className="wb-left">
        {rec === "done" && preview ? (
          <>
            <video className="wb-preview" src={preview} controls playsInline />
            <p className="rd-dlg-hint">
              {fmt(secs)} recorded
              {isMp4 ? "" : ` · converted for ${firstName}'s phone after it goes up`}. Not right? Record it again.
            </p>
          </>
        ) : (
          <>
            {/* The stage fits the screen (9 Oct): a portrait phone video is as tall as the window allows, never taller, so the
              controls below it stay in view. A red ring and a Stop on the picture itself while it records. */}
            <div
              className={`wb-stage${rec === "recording" ? " rec" : ""}`}
              style={{
                aspectRatio: `${size.w} / ${size.h}`,
                width: `min(100%, calc(max(320px, 100vh - 330px) * ${(size.w / size.h).toFixed(4)}))`,
              }}
            >
              <video
                ref={videoEl}
                src={src}
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const w = Math.min(MAX_W, v.videoWidth || 960);
                  const h = Math.round(((v.videoHeight || 540) * w) / (v.videoWidth || 960));
                  setSize({ w, h });
                  setDur(v.duration || 0);
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              />
              <canvas ref={overlay} className={`wb-overlay${tool === "erase" ? " erase" : ""}`} width={size.w} height={size.h} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Draw on the video" />
              {rec === "recording" && (
                <span className="wb-live" aria-live="polite">
                  <i /> REC {fmt(secs)}
                  <button type="button" className="wb-live-stop" onClick={stop}>
                    Stop
                  </button>
                </span>
              )}
            </div>
            <div className="wb-row">
              <button type="button" className="rd-btn sm" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                {playing ? "Pause" : "Play"}
              </button>
              <input className="wb-scrub" type="range" min={0} max={Math.max(0.01, dur)} step={0.05} value={Math.min(t, dur || 0)} onChange={(e) => seek(Number(e.target.value))} aria-label="Where in the video" />
              <span className="wb-time">
                {fmt(t)} / {fmt(dur)}
              </span>
            </div>
            {/* The toolbar (9 Oct): the tool as an icon toggle, the thickness, the colour; then undo, redo, clear and Record. */}
            <div className="wb-bar">
              <span className="wb-seg" role="group" aria-label="Drawing tool">
                {TOOLS.map((x) => (
                  <button key={x.id} type="button" className={`wb-tool${tool === x.id ? " on" : ""}`} aria-pressed={tool === x.id} onClick={() => setTool(x.id)} title={x.label}>
                    <Ico d={x.icon} />
                    <span>{x.label}</span>
                  </button>
                ))}
              </span>
              <span className="wb-seg" role="group" aria-label="Thickness">
                {WIDTHS.map((w, i) => (
                  <button key={w} type="button" className={`wb-width${width === i ? " on" : ""}`} aria-pressed={width === i} aria-label={WIDTH_NAMES[i]} title={WIDTH_NAMES[i]} onClick={() => setWidth(i)} disabled={tool === "erase"}>
                    <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
                  </button>
                ))}
              </span>
              <span className="wb-colors" role="group" aria-label="Colour">
                {COLORS.map((c) => (
                  <button key={c} type="button" className={`wb-color${color === c ? " on" : ""}`} style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} disabled={tool === "erase"} />
                ))}
              </span>
              <span className="rd-dlg-hint grow" />
              <span className="wb-seg" role="group" aria-label="History">
                <button type="button" className="wb-tool" onClick={undo} disabled={!histN.undo} aria-label="Undo" title="Undo (Ctrl+Z)">
                  <Ico d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13" />
                </button>
                <button type="button" className="wb-tool" onClick={redo} disabled={!histN.redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                  <Ico d="M21 7v6h-6M3 17a9 9 0 0 1 15-6.7l3 2.7" />
                </button>
              </span>
              <button type="button" className="rd-btn sm" onClick={() => setShapes(() => [])} disabled={!shapes.length}>
                Clear
              </button>
              {canRecord ? (
                rec === "recording" ? (
                  <button type="button" className="rd-btn primary wb-stop" onClick={stop}>
                    Stop
                  </button>
                ) : (
                  <button type="button" className="rd-btn primary wb-rec" onClick={() => void start()} disabled={starting}>
                    {micWait ? "Waiting for the mic…" : starting ? "Starting…" : "Record"}
                  </button>
                )
              ) : (
                <span className="rd-dlg-hint">This browser cannot record. Write a note below.</span>
              )}
            </div>
            {noMic && rec === "recording" && (
              <p className="rd-dlg-hint wb-problem">
                {micBlocked
                  ? "The microphone is blocked for this site, so this records the picture only. Click the icon left of the address bar to allow it, then record again."
                  : "No microphone answered, so this records the picture only. If Chrome is asking for the mic by the address bar, allow it and record again."}
              </p>
            )}
            {rec === "idle" && <p className="rd-dlg-hint">Press Record, then play, pause and draw as you talk. {firstName} gets the drawn-over video with your voice.</p>}
          </>
        )}
      </div>
      <div className="wb-right">
        <label className="rd-field">
          <span>Your note</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={blob ? "A line to go with the video (optional)" : "Depth is good. Keep the knees tracking over the toes on the way up."} />
        </label>
        {problem && <p className="rd-dlg-hint wb-problem">{problem}</p>}
        {progress != null && (
          <div className="wb-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <div className="wb-send">
          {rec === "done" && (
            <button type="button" className="rd-btn ghost sm" onClick={retake} disabled={sending}>
              Record again
            </button>
          )}
          <button type="button" className="rd-btn primary" onClick={() => void send()} disabled={sending || (!blob && !note.trim())}>
            {sending ? (progress != null && progress < 1 ? `Sending ${Math.round(progress * 100)}%` : "Sending…") : blob ? "Send video and note" : "Send note"}
          </button>
        </div>
      </div>
      <canvas ref={out} width={size.w} height={size.h} style={{ display: "none" }} aria-hidden="true" />
    </div>
  );
}
