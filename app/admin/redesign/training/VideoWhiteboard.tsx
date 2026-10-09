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
type Shape = { kind: "pen"; points: Pt[]; color: string } | { kind: "arrow"; from: Pt; to: Pt; color: string };
type Rec = "idle" | "recording" | "done";

const COLORS = ["#ff3b30", "#ffd60a", "#34c759", "#0a84ff", "#ffffff"];
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
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 960, h: 540 });
  const [tool, setTool] = useState<"pen" | "arrow">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);
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
    [preview]
  );

  // ---- The drawing layer, over the picture.
  const drawShapes = (ctx: CanvasRenderingContext2D, list: Shape[]) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of list) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = Math.max(3, size.w / 220);
      if (s.kind === "pen") {
        if (s.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        const { from, to } = s;
        const a = Math.atan2(to.y - from.y, to.x - from.x);
        const head = Math.max(14, size.w / 60);
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
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e);
    live.current = tool === "pen" ? { kind: "pen", points: [p], color } : { kind: "arrow", from: p, to: p, color };
    paint();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
  const start = async () => {
    setProblem(null);
    const c = out.current;
    if (!c || !canRecord) return;
    let audio: MediaStream | null = null;
    try {
      audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      setNoMic(false);
    } catch {
      setNoMic(true);
    }
    mic.current = audio;
    compose();
    const stream = c.captureStream(30);
    audio?.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const r = new MediaRecorder(stream, { mimeType: mimeFor(), videoBitsPerSecond: 4_000_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    r.onstop = () => {
      const b = new Blob(chunks.current, { type: r.mimeType.split(";")[0] || "video/webm" });
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
      {rec === "done" && preview ? (
        <>
          <video className="wb-preview" src={preview} controls playsInline />
          <p className="rd-dlg-hint">
            {fmt(secs)} recorded{isMp4 ? "" : ` · converted for ${firstName}'s phone after it goes up`}. Not right? Record it again.
          </p>
        </>
      ) : (
        <>
          <div className="wb-stage" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
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
            <canvas ref={overlay} className="wb-overlay" width={size.w} height={size.h} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Draw on the video" />
            {rec === "recording" && (
              <span className="wb-live" aria-live="polite">
                <i /> REC {fmt(secs)}
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
          <div className="wb-row">
            <span className="rm-cadence wb-tools" role="group" aria-label="Drawing tool">
              <button type="button" className={tool === "pen" ? "on" : ""} aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>
                Pen
              </button>
              <button type="button" className={tool === "arrow" ? "on" : ""} aria-pressed={tool === "arrow"} onClick={() => setTool("arrow")}>
                Arrow
              </button>
            </span>
            <span className="wb-colors" role="group" aria-label="Colour">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`wb-color${color === c ? " on" : ""}`} style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} />
              ))}
            </span>
            <button type="button" className="rd-btn ghost sm" onClick={() => setShapes((l) => l.slice(0, -1))} disabled={!shapes.length}>
              Undo
            </button>
            <button type="button" className="rd-btn ghost sm" onClick={() => setShapes([])} disabled={!shapes.length}>
              Clear
            </button>
            <span className="rd-dlg-hint grow" />
            {canRecord ? (
              rec === "recording" ? (
                <button type="button" className="rd-btn primary wb-stop" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button type="button" className="rd-btn primary wb-rec" onClick={() => void start()}>
                  Record
                </button>
              )
            ) : (
              <span className="rd-dlg-hint">This browser cannot record. Write a note below.</span>
            )}
          </div>
          {noMic && rec === "recording" && <p className="rd-dlg-hint">No microphone: recording the picture only.</p>}
          {rec === "idle" && <p className="rd-dlg-hint">Press Record, then play, pause and draw as you talk. {firstName} gets the drawn-over video with your voice.</p>}
        </>
      )}

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
      <canvas ref={out} width={size.w} height={size.h} style={{ display: "none" }} aria-hidden="true" />
    </div>
  );
}
