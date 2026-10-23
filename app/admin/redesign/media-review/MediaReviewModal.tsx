"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { markVideoSeenAction, replyToMediaAction, sendFormReviewAction } from "../../../lib/actions";
import { pic } from "../../../lib/pic";
import { pathOf, simplify, SIZES, STROKE, UNDERLAY, UNDERLAY_COLOR, unitFor, worthKeeping, type Pt, type Shape, type Tool } from "./shapes";
import { MAX_SECONDS, recordingSupported, useReviewRecorder, type Corner } from "./useReviewRecorder";
import { Sep, SepJoin } from "../Sep";

// The coach's media review (12 Oct, design 18a): one modal for every photo or
// video a client sends from an exercise, in place of the plain pop-up. A dark
// stage on the left with the media; on the right the context (session, week,
// asked for or not, the sets logged) and the conversation about it, with a
// reply box. "Record review" turns the stage into a whiteboard: the coach
// draws over the video while talking, and the whole thing is recorded as one
// video and sent as the reply. A reply lands on the exercise (and carries to
// the next session) and in the chat, linked to the exercise.

/** An upload drawn into the recorder's canvas must come from this origin (15 Oct): the plain path redirects to the bucket, which taints the canvas ("Canvas is not origin-clean"); ?stream=1 sends the bytes through the app. */
export const sameOrigin = (url: string) => (url.startsWith("/uploads/") ? `${url}${url.includes("?") ? "&" : "?"}stream=1` : url);

export type ThreadItem =
  | { id: string; kind: "text"; mine: boolean; text: string; at: number }
  | { id: string; kind: "review"; url: string; durationMs: number | null; annotations: number | null; message: string | null; at: number };
export type MediaReview = {
  requestId: number;
  /** New to the coach: opening it marks it seen. */
  unseen: boolean;
  client: { firstName: string; name: string; avatarPath: string | null };
  exercise: { name: string; session: string; week: number; day: number };
  requested: boolean;
  media: { kind: "video" | "photo"; url: string }[];
  sentAt: string | null;
  sets: { n: number; label: string }[];
  clientMessage: { text: string; at: string | null } | null;
  thread: ThreadItem[];
};

// The palette (12 Oct): one swatch on the toolbox, the rest a click away.
export const COLORS = [
  { id: "#FFD60A", name: "Yellow" },
  { id: "#FF9F0A", name: "Orange" },
  { id: "#FF453A", name: "Red" },
  { id: "#FF375F", name: "Pink" },
  { id: "#BF5AF2", name: "Purple" },
  { id: "#5E5CE6", name: "Indigo" },
  { id: "#0A84FF", name: "Blue" },
  { id: "#64D2FF", name: "Cyan" },
  { id: "#30D158", name: "Green" },
  { id: "#B4F000", name: "Lime" },
  { id: "#FFFFFF", name: "White" },
  { id: "#8E8E93", name: "Grey" },
  { id: "#000000", name: "Black" },
  { id: "#AC8E68", name: "Brown" },
  { id: "#FF6B6B", name: "Coral" },
  { id: "#00C7BE", name: "Teal" },
];
const TOOLS: { id: Tool; name: string; key: string; icon: string }[] = [
  { id: "pen", name: "Pen", key: "P", icon: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" },
  { id: "arrow", name: "Arrow", key: "A", icon: "M5 19L19 5M10 5h9v9" },
  { id: "line", name: "Line", key: "L", icon: "M5 19L19 5" },
  { id: "circle", name: "Circle", key: "O", icon: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z" },
];
const RATES = [1, 0.5, 0.25];
const FRAME = 1 / 30;
const CAM_KEY = "mrv-camera";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const hhmm = (iso: string | number | null) => (iso == null ? "" : new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
const Ico = ({ d, size = 18, w = 2.2 }: { d: string; size?: number; w?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Up with progress; null once it is up, else what went wrong. The coach's phone sends its reviews through it too. */
export function upload(id: number, blob: Blob, onProgress: (share: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/video-reply/${id}`);
    xhr.setRequestHeader("Content-Type", blob.type.split(";")[0] || "video/webm");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(null);
      let message = `The upload failed (${xhr.status || "no answer"}). Try again.`;
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {}
      resolve(message);
    };
    xhr.onerror = () => resolve("The upload broke off. Check the connection and try again.");
    xhr.send(blob);
  });
}

export default function MediaReviewModal({ review, onClose }: { review: MediaReview; onClose: () => void }) {
  const router = useRouter();
  const first = review.client.firstName;
  // Opens on the recorder (15 Oct, Alex): the panel is the client, the video, where it comes from, and the recording. The thread and the text box went; a review reaches the chat on its own.
  const [mode, setMode] = useState<"talk" | "record">("record");
  const [idx, setIdx] = useState(0);
  const item = review.media[Math.min(idx, review.media.length - 1)];
  // A sent review playing on the stage in place of the client's media.
  const [stageReview, setStageReview] = useState<string | null>(null);
  const showing = stageReview ? { kind: "video" as const, url: stageReview } : item;
  const canRecord = useMemo(() => recordingSupported(), []);

  // Seen, once opened.
  useEffect(() => {
    if (review.unseen) void markVideoSeenAction(review.requestId);
  }, [review.unseen, review.requestId]);

  // ---- The stage and the frame the media sits in, fitted to it.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 600, h: 650 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (r) setStage({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [natural, setNatural] = useState({ w: 1080, h: 1920 });
  // The frame is sized by CSS (12 Oct): as big as fits between the toolbox
  // on either side, the top and the playback bar, at the media's own shape
  // (.mrv-fit, container units). Measured here only for the camera bubble.
  const frameRef = useRef<HTMLDivElement>(null);
  const unit = unitFor(natural.w, natural.h);

  // ---- Playback.
  const mediaEl = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  const videoOf = () => (mediaEl.current instanceof HTMLVideoElement ? mediaEl.current : null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const toggle = () => {
    const v = videoOf();
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const step = (d: number) => {
    const v = videoOf();
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
    setT(v.currentTime);
  };
  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    const v = videoOf();
    if (v) v.playbackRate = next;
  };
  // The time, smoothly, while it plays.
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      const v = videoOf();
      if (v) setT(v.currentTime);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  const scrubRef = useRef<HTMLDivElement>(null);
  const seekAt = (clientX: number) => {
    const el = scrubRef.current;
    const v = videoOf();
    if (!el || !v || !dur) return;
    const r = el.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur;
    setT(v.currentTime);
  };

  // ---- Drawing (record mode only).
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0].id);
  const [palette, setPalette] = useState(false);
  // How big the next shape is drawn (12 Oct): small, medium, large.
  const [size, setSize] = useState<number>(1);
  const stepSize = (d: number) => {
    const i = SIZES.findIndex((x) => x.id === size);
    setSize(SIZES[Math.max(0, Math.min(SIZES.length - 1, i + d))].id);
  };
  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);
  // The shape being drawn: in state for the screen, in a ref for the recorder's frames.
  const liveRef = useRef<Shape | null>(null);
  const [liveShape, setLiveShape] = useState<Shape | null>(null);
  const redraw = () => setLiveShape(liveRef.current ? { ...liveRef.current, pts: [...liveRef.current.pts] } : null);
  // Drawings made for this recording (those on screen when it started count too).
  const [drawn, setDrawn] = useState(0);
  const [flash, setFlash] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const toMedia = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * natural.w, ((e.clientY - r.top) / r.height) * natural.h];
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== "record") return;
    setPalette(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = videoOf();
    if (v && !v.paused) {
      v.pause();
      setFlash(true);
      setTimeout(() => setFlash(false), 1600);
    }
    const p = toMedia(e);
    liveRef.current = { tool, color, size, pts: [p, p] };
    redraw();
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const s = liveRef.current;
    if (!s) return;
    const p = toMedia(e);
    if (s.tool === "pen") s.pts.push(p);
    else s.pts[s.pts.length - 1] = p;
    redraw();
  };
  const up = () => {
    const s = liveRef.current;
    liveRef.current = null;
    if (s && worthKeeping(s, unit)) {
      const kept = s.tool === "pen" ? { ...s, pts: simplify(s.pts, 0.8 * unit) } : s;
      setShapes((list) => [...list, kept]);
      setDrawn((n) => n + 1);
    }
    setLiveShape(null);
  };
  const undo = () => setShapes((list) => list.slice(0, -1));
  const clearAll = () => setShapes([]);

  // ---- Camera and mic.
  const [micOn, setMicOnState] = useState(true);
  const [camOn, setCamOn] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(CAM_KEY) === "1") Promise.resolve().then(() => setCamOn(true));
    } catch {}
  }, []);
  const camVideo = useRef<HTMLVideoElement | null>(null);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [camDenied, setCamDenied] = useState(false);
  useEffect(() => {
    if (mode !== "record" || !camOn) return;
    let live = true;
    let got: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((st) => {
        if (!live) return st.getTracks().forEach((x) => x.stop());
        got = st;
        setCamStream(st);
        setCamDenied(false);
      })
      .catch(() => live && setCamDenied(true));
    return () => {
      live = false;
      got?.getTracks().forEach((x) => x.stop());
      setCamStream(null);
    };
  }, [mode, camOn]);
  useEffect(() => {
    if (camVideo.current && camStream) {
      camVideo.current.srcObject = camStream;
      void camVideo.current.play().catch(() => {});
    }
  }, [camStream]);
  const [corner, setCorner] = useState<Corner>("br");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const bubbleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = stageRef.current!.getBoundingClientRect();
    setDrag({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const bubbleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const r = stageRef.current!.getBoundingClientRect();
    setDrag({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const bubbleUp = () => {
    if (!drag) return;
    setCorner(`${drag.y < stage.h / 2 ? "t" : "b"}${drag.x < stage.w / 2 ? "l" : "r"}` as Corner);
    setDrag(null);
  };
  const toggleCam = () => {
    setCamOn((on) => {
      try {
        localStorage.setItem(CAM_KEY, on ? "0" : "1");
      } catch {}
      return !on;
    });
  };

  // ---- The recorder.
  const recorder = useReviewRecorder({
    media: () => mediaEl.current,
    size: () => natural,
    shapes: () => (liveRef.current ? [...shapesRef.current, liveRef.current] : shapesRef.current),
    unit: () => unit,
    camera: () => (camOn && camStream ? camVideo.current : null),
    bubble: () => {
      const fw = Math.max(1, frameRef.current?.clientWidth ?? 1);
      return { corner, share: 92 / fw, inset: 20 / fw };
    },
  });
  const setMicOn = (on: boolean) => {
    setMicOnState(on);
    recorder.setMicOn(on);
  };
  const [count, setCount] = useState<number | null>(null);
  const startRecording = () => {
    if (count != null) return;
    setDrawn(shapes.length);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beat = reduce ? 400 : 600;
    setCount(3);
    setTimeout(() => setCount(2), beat);
    setTimeout(() => setCount(1), beat * 2);
    setTimeout(() => {
      setCount(null);
      void recorder.start({ mic: micOn });
    }, beat * 3);
  };
  const recDirty = recorder.state !== "ready";

  // ---- Leaving: a recording in hand is never thrown away without asking.
  const [confirm, setConfirm] = useState<null | "close" | "back">(null);
  const backToTalk = () => {
    recorder.retake();
    setShapes([]);
    setMode("talk");
    setConfirm(null);
  };
  const askClose = () => (mode === "record" && recDirty ? setConfirm("close") : onClose());
  const enterRecord = () => {
    setStageReview(null);
    setMode("record");
  };

  // ---- Switching media: drawings do not carry over.
  const go = (d: number) => {
    if (review.media.length < 2) return;
    setIdx((i) => (i + d + review.media.length) % review.media.length);
    setShapes([]);
    setPlaying(false);
    setT(0);
  };

  // ---- The conversation, with what was just sent ahead of the server.
  const [sent, setSent] = useState<ThreadItem[]>([]);
  const thread = useMemo(() => [...review.thread, ...sent.filter((s) => !review.thread.some((r) => r.kind === s.kind && Math.abs(r.at - s.at) < 120000))].sort((a, b) => a.at - b.at), [review.thread, sent]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendText = async () => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    const ok = await replyToMediaAction(review.requestId, clean);
    setBusy(false);
    if (!ok) return setError("That did not send. Try again.");
    setSent((s) => [...s, { id: `t${Date.now()}`, kind: "text", mine: true, text: clean, at: Date.now() }]);
    setText("");
    router.refresh();
  };
  const [reviewNote, setReviewNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const sendReview = async () => {
    const blob = recorder.blob;
    if (!blob || progress != null) return;
    setError(null);
    setProgress(0);
    const err = await upload(review.requestId, blob, setProgress);
    if (err) {
      setProgress(null);
      return setError(err);
    }
    const meta = { durationMs: recorder.secs * 1000, annotations: drawn };
    const ok = await sendFormReviewAction(review.requestId, reviewNote.trim(), meta);
    setProgress(null);
    if (!ok) return setError("The review is up, but the reply did not save. Try Send again.");
    setSent((s) => [...s, { id: `r${Date.now()}`, kind: "review", url: URL.createObjectURL(blob), durationMs: meta.durationMs, annotations: meta.annotations, message: reviewNote.trim() || null, at: Date.now() }]);
    setReviewNote("");
    backToTalk();
    router.refresh();
  };

  // ---- Keys. Never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || confirm) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        toggle();
        return;
      }
      if (mode === "talk") {
        if (k === "arrowleft") go(-1);
        if (k === "arrowright") go(1);
        return;
      }
      const t2 = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (t2 && !e.metaKey && !e.ctrlKey) return setTool(t2.id);
      if (k === "z") {
        e.preventDefault();
        return undo();
      }
      if (k === "[") return stepSize(-1);
      if (k === "]") return stepSize(1);
      const v = videoOf();
      if (v?.paused && k === "arrowleft") step(-FRAME);
      if (v?.paused && k === "arrowright") step(FRAME);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- What the stage shows.
  const all = liveShape ? [...shapes, liveShape] : shapes;
  const isVideo = showing.kind === "video";
  const recording = recorder.state === "recording";
  const status =
    recorder.state === "ready" ? { label: "READY", cls: "ready" } : recorder.state === "recording" ? { label: `REC ${clock(recorder.secs)}`, cls: "rec" } : recorder.state === "paused" ? { label: `PAUSED ${clock(recorder.secs)}`, cls: "paused" } : { label: `RECORDED ${clock(recorder.secs)}`, cls: "done" };
  const bubblePos: React.CSSProperties = drag
    ? { left: drag.x - 46, top: drag.y - 46 }
    : { [corner.startsWith("t") ? "top" : "bottom"]: corner.startsWith("t") ? 20 : 84, [corner.endsWith("l") ? "left" : "right"]: 20 };
  const nearEnd = recorder.secs >= MAX_SECONDS - 30;
  const label = `${review.client.name}, ${review.exercise.name}`;

  return (
    <DialogContent
      className="mrv-modal"
      onEscapeKeyDown={(e) => {
        e.preventDefault();
        if (confirm) return setConfirm(null);
        if (palette) return setPalette(false);
        askClose();
      }}
      onInteractOutside={(e) => {
        if (mode === "record" && recDirty) {
          e.preventDefault();
          setConfirm("close");
        }
      }}
    >
      <DialogTitle className="sr-only">{label}</DialogTitle>
      <DialogDescription className="sr-only">
        {first}&rsquo;s {item.kind} of {review.exercise.name}, and your conversation about it.
      </DialogDescription>

      {/* ---- The stage */}
      <div ref={stageRef} className={`mrv-stage${mode === "record" ? " rec-mode" : ""}`}>
        <div className="mrv-fit">
        <div ref={frameRef} className="mrv-frame" style={{ "--r": natural.w / natural.h } as React.CSSProperties}>
          {isVideo ? (
            <video
              key={showing.url}
              ref={(el) => {
                mediaEl.current = el;
              }}
              src={sameOrigin(showing.url)}
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) setNatural({ w: v.videoWidth, h: v.videoHeight });
                setDur(v.duration || 0);
                v.playbackRate = rate;
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onClick={toggle}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
            <img
              key={showing.url}
              ref={(el) => {
                mediaEl.current = el;
              }}
              src={sameOrigin(showing.url)}
              alt={`${first}'s photo`}
              onLoad={(e) => {
                const im = e.currentTarget;
                if (im.naturalWidth && im.naturalHeight) setNatural({ w: im.naturalWidth, h: im.naturalHeight });
              }}
            />
          )}
          <svg ref={svgRef} className={`mrv-draw${mode === "record" ? " on" : ""}`} viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="none" aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {all.map((s, i) => {
              const d = pathOf(s, unit);
              return (
                <g key={i}>
                  <path d={d} stroke={UNDERLAY_COLOR} strokeWidth={UNDERLAY * unit * (s.size ?? 1)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={d} stroke={s.color} strokeWidth={STROKE * unit * (s.size ?? 1)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
          </svg>
          {flash && <span className="mrv-flash">Paused to draw</span>}
        </div>
        </div>

        {/* Playback, videos only. */}
        {isVideo && (
          <div className="mrv-bar">
            <button type="button" className="mrv-bar-btn" onClick={() => step(-FRAME)} aria-label="Back one frame" title="Back one frame">
              <Ico d="M6 5v14M18 6l-8 6 8 6z" size={16} />
            </button>
            <button type="button" className="mrv-bar-btn play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Ico d="M8 5v14M16 5v14" size={16} w={2.6} /> : <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
            </button>
            <button type="button" className="mrv-bar-btn" onClick={() => step(FRAME)} aria-label="Forward one frame" title="Forward one frame">
              <Ico d="M18 5v14M6 6l8 6-8 6z" size={16} />
            </button>
            <div
              ref={scrubRef}
              className="mrv-scrub"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekAt(e.clientX);
              }}
              onPointerMove={(e) => e.buttons && seekAt(e.clientX)}
              role="slider"
              aria-label="Position"
              aria-valuemin={0}
              aria-valuemax={Math.round(dur)}
              aria-valuenow={Math.round(t)}
              tabIndex={0}
            >
              <span className="mrv-scrub-track">
                <span className="mrv-scrub-fill" style={{ width: `${dur ? (t / dur) * 100 : 0}%` }} />
                <span className="mrv-scrub-knob" style={{ left: `${dur ? (t / dur) * 100 : 0}%` }} />
              </span>
            </div>
            <span className="mrv-time">
              {clock(t)} / {clock(dur)}
            </span>
            <button type="button" className="mrv-rate" onClick={cycleRate} aria-label={`Speed ${rate}×`} title="Speed">
              {rate}×
            </button>
          </div>
        )}

        {/* Conversation mode: Record review, and which of several. */}
        {mode === "talk" && !stageReview && canRecord && (
          <button type="button" className="mrv-recpill" onClick={enterRecord}>
            <i aria-hidden="true" /> Record review
          </button>
        )}
        {stageReview && (
          <button type="button" className="mrv-recpill back" onClick={() => setStageReview(null)}>
            ‹ Back to {first}&rsquo;s {item.kind}
          </button>
        )}
        {!recording && review.media.length > 1 && (
          <>
            <span className="mrv-count">
              {item.kind.toUpperCase()} {idx + 1} OF {review.media.length}
            </span>
            <button type="button" className="mrv-edge left" onClick={() => go(-1)} aria-label="Previous">
              ‹
            </button>
            <button type="button" className="mrv-edge right" onClick={() => go(1)} aria-label="Next">
              ›
            </button>
          </>
        )}

        {/* Record mode: the frame, the status, the tools, the camera. */}
        {mode === "record" && (
          <>
            <span className={`mrv-recframe${recording ? " on" : ""}`} aria-hidden="true" />
            <span className={`mrv-status ${status.cls}`} aria-live="polite">
              <i aria-hidden="true" />
              {status.label}
            </span>
            <div className="mrv-tools" role="toolbar" aria-label="Drawing">
              {TOOLS.map((x) => (
                <button key={x.id} type="button" className={`mrv-tool${tool === x.id ? " on" : ""}`} aria-pressed={tool === x.id} aria-label={`${x.name} (${x.key})`} title={`${x.name} (${x.key})`} onClick={() => setTool(x.id)}>
                  <Ico d={x.icon} />
                </button>
              ))}
              <span className="mrv-tools-div" />
              {/* The colour on, and the rest of the palette beside the toolbox when opened. */}
              <span className="mrv-palette-wrap">
                <button type="button" className="mrv-swatch on" aria-expanded={palette} aria-label={`Colour: ${COLORS.find((c) => c.id === color)?.name ?? "custom"}. Choose another`} title="Colour" onClick={() => setPalette((o) => !o)}>
                  <i style={{ background: color }} />
                </button>
                {palette && (
                  <span className="mrv-palette" role="listbox" aria-label="Colours">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={color === c.id}
                        className={`mrv-pal${color === c.id ? " on" : ""}`}
                        aria-label={c.name}
                        title={c.name}
                        onClick={() => {
                          setColor(c.id);
                          setPalette(false);
                        }}
                      >
                        <i style={{ background: c.id }} />
                      </button>
                    ))}
                  </span>
                )}
              </span>
              <span className="mrv-tools-div" />
              {SIZES.map((z) => (
                <button key={z.id} type="button" className={`mrv-size${size === z.id ? " on" : ""}`} aria-pressed={size === z.id} aria-label={`${z.name} ([ or ])`} title={`${z.name} ([ or ])`} onClick={() => setSize(z.id)}>
                  <i style={{ width: z.dot, height: z.dot, background: color }} />
                </button>
              ))}
              <span className="mrv-tools-div" />
              <button type="button" className="mrv-tool" disabled={!shapes.length} onClick={undo} aria-label="Undo (Z)" title="Undo (Z)">
                <Ico d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
              </button>
              <button type="button" className="mrv-tool" disabled={!shapes.length} onClick={clearAll} aria-label="Clear the drawing" title="Clear">
                <Ico d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </button>
            </div>
            {camOn && camStream && (
              <div className={`mrv-cam${drag ? " dragging" : ""}`} style={bubblePos} onPointerDown={bubbleDown} onPointerMove={bubbleMove} onPointerUp={bubbleUp} onPointerCancel={bubbleUp} aria-label="Your camera" role="img">
                <video ref={camVideo} muted playsInline />
              </div>
            )}
            {count != null && (
              <span key={count} className="mrv-countdown" aria-live="assertive">
                {count}
              </span>
            )}
          </>
        )}
      </div>

      {/* ---- The panel */}
      <div className="mrv-panel">
        <header className="mrv-head">
          <span className="mrv-avatar" aria-hidden="true">
            {review.client.avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
              <img src={pic(review.client.avatarPath, 96)} alt="" />
            ) : (
              review.client.name.charAt(0).toUpperCase()
            )}
          </span>
          <span className="mrv-head-main">
            <b>{review.client.name}</b>
            <small>
              {review.exercise.name}
              <Sep />
              {review.media.length} {item.kind === "photo" ? (review.media.length === 1 ? "photo" : "photos") : review.media.length === 1 ? "video" : "videos"}
              {review.sentAt ? (
                <>
                  <Sep />
                  {hhmm(review.sentAt)}
                </>
              ) : null}
            </small>
          </span>
          <button type="button" className="mrv-close" onClick={askClose} aria-label="Close">
            <Ico d="M6 6l12 12M18 6L6 18" size={12} w={2.6} />
          </button>
        </header>

        {mode === "talk" ? (
          <div className="mrv-body talk" key="talk">
            <div className="mrv-scroll">
              <section className="mrv-ctx">
                <div className="mrv-ctx-row">
                  <span className="mrv-eyebrow">
                    {review.exercise.session.toUpperCase()}
                    <Sep />
                    WK {review.exercise.week}
                    <Sep />
                    DAY {review.exercise.day}
                  </span>
                  <span className={`mrv-req${review.requested ? " asked" : ""}`}>{review.requested ? "You asked for this" : "Sent unasked"}</span>
                </div>
                {review.sets.length > 0 ? (
                  <div className="mrv-sets">
                    {review.sets.map((s) => (
                      <span key={s.n} className="mrv-set">
                        <b>{s.n}</b>
                        {s.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mrv-nosets">No sets logged on it yet.</p>
                )}
              </section>

              {review.clientMessage && (
                <div className="mrv-msg theirs">
                  <span className="mrv-msg-avatar" aria-hidden="true">
                    {review.client.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                      <img src={pic(review.client.avatarPath, 96)} alt="" />
                    ) : (
                      first.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="mrv-msg-col">
                    <small>
                      {first}
                      {review.clientMessage.at ? (
                        <>
                          <Sep />
                          {hhmm(review.clientMessage.at)}
                        </>
                      ) : null}
                    </small>
                    <span className="mrv-bubble theirs">{review.clientMessage.text}</span>
                  </span>
                </div>
              )}

              {thread.map((m) =>
                m.kind === "text" ? (
                  <div key={m.id} className={`mrv-msg ${m.mine ? "mine" : "theirs"}`}>
                    <span className="mrv-msg-col">
                      <small>
                        {m.mine ? "You" : first}
                        <Sep />
                        {hhmm(m.at)}
                      </small>
                      <span className={`mrv-bubble ${m.mine ? "mine" : "theirs"}`}>{m.text}</span>
                    </span>
                  </div>
                ) : (
                  <div key={m.id} className="mrv-msg mine">
                    <span className="mrv-msg-col">
                      <small>
                        You<Sep />
                        {hhmm(m.at)}
                      </small>
                      <button type="button" className="mrv-review" onClick={() => setStageReview(m.url)} aria-label="Play your form review on the stage">
                        <span className="mrv-review-row">
                          <span className="mrv-review-thumb">
                            <video src={m.url} muted playsInline preload="metadata" aria-hidden="true" />
                            <i aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                            </i>
                          </span>
                          <span className="mrv-review-text">
                            <span className="mrv-review-eyebrow">FORM REVIEW</span>
                            <b>{m.durationMs != null ? clock(m.durationMs / 1000) : "Video"}</b>
                            <small>
                              <SepJoin parts={[m.annotations != null && `${m.annotations} drawing${m.annotations === 1 ? "" : "s"}`, "voice"]} />
                            </small>
                          </span>
                        </span>
                        {m.message && <span className="mrv-review-msg">{m.message}</span>}
                      </button>
                    </span>
                  </div>
                )
              )}
            </div>

            <footer className="mrv-compose">
              {error && <p className="mrv-error">{error}</p>}
              <label className={`mrv-field${text.trim() ? " has" : ""}`}>
                <textarea
                  value={text}
                  placeholder={`Reply to ${first}…`}
                  aria-label={`Reply to ${first}`}
                  onChange={(e) => {
                    setText(e.target.value);
                    const el = e.currentTarget;
                    el.style.height = "44px";
                    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                />
              </label>
              <div className="mrv-compose-row">
                {canRecord && item && (
                  <button type="button" className="mrv-recbtn" onClick={enterRecord}>
                    <i aria-hidden="true" /> Record review
                  </button>
                )}
                <button type="button" className="mrv-send" disabled={!text.trim() || busy} onClick={() => void sendText()}>
                  {busy ? "Sending…" : "Send"} <Ico d="M5 12h14M13 6l6 6-6 6" size={15} w={2.4} />
                </button>
              </div>
            </footer>
          </div>
        ) : (
          <div className="mrv-body record" key="record">
            <div className="mrv-scroll">
              <section className="mrv-ctx">
                <div className="mrv-ctx-row">
                  <span className="mrv-eyebrow">
                    {review.exercise.session.toUpperCase()}
                    <Sep />
                    WK {review.exercise.week}
                    <Sep />
                    DAY {review.exercise.day}
                  </span>
                  <span className={`mrv-req${review.requested ? " asked" : ""}`}>{review.requested ? "You asked for this" : "Sent unasked"}</span>
                </div>
                {review.sets.length > 0 ? (
                  <div className="mrv-sets">
                    {review.sets.map((s) => (
                      <span key={s.n} className="mrv-set">
                        <b>{s.n}</b>
                        {s.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mrv-nosets">No sets logged on it yet.</p>
                )}
              </section>

              {review.clientMessage && (
                <div className="mrv-msg theirs">
                  <span className="mrv-msg-avatar" aria-hidden="true">
                    {review.client.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                      <img src={pic(review.client.avatarPath, 96)} alt="" />
                    ) : (
                      first.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="mrv-msg-col">
                    <small>
                      {first}
                      {review.clientMessage.at ? (
                        <>
                          <Sep />
                          {hhmm(review.clientMessage.at)}
                        </>
                      ) : null}
                    </small>
                    <span className="mrv-bubble theirs">{review.clientMessage.text}</span>
                  </span>
                </div>
              )}

              {recorder.micDenied && micOn && (
                <p className="mrv-banner">
                  Allow microphone access to record a review.{" "}
                  <button type="button" onClick={() => recorder.retake()}>
                    Try again
                  </button>
                </p>
              )}
              {camDenied && camOn && <p className="mrv-banner">The camera is blocked in this browser, so the review records without it.</p>}
              {(recorder.problem || error) && <p className="mrv-error">{recorder.problem ?? error}</p>}

              {recorder.state === "ready" && (
                <section className="mrv-card ready">
                  <button type="button" className="mrv-bigrec" onClick={startRecording} disabled={count != null} aria-label="Start recording">
                    <i aria-hidden="true" />
                  </button>
                  <b>Start recording</b>
                  <small>You can draw before you start. Anything already on screen is included.</small>
                </section>
              )}
              {(recorder.state === "recording" || recorder.state === "paused") && (
                <section className="mrv-card live">
                  <span className={`mrv-live-status ${recorder.state}`}>
                    <i aria-hidden="true" />
                    {recorder.state === "recording" ? (
                      <span>
                        RECORDING<Sep />
                        {micOn && !recorder.micDenied ? "MIC ON" : "MIC OFF"}
                      </span>
                    ) : (
                      "PAUSED"
                    )}
                  </span>
                  <span className={`mrv-timer${nearEnd ? " warn" : ""}`}>{clock(recorder.secs)}</span>
                  <span className="mrv-live-btns">
                    {recorder.state === "recording" ? (
                      <button type="button" className="mrv-live-btn" onClick={recorder.pause}>
                        Pause
                      </button>
                    ) : (
                      <button type="button" className="mrv-live-btn" onClick={recorder.resume}>
                        Resume
                      </button>
                    )}
                    <button type="button" className="mrv-live-btn stop" onClick={recorder.stop}>
                      <i aria-hidden="true" /> Stop
                    </button>
                  </span>
                </section>
              )}
              {recorder.state === "done" && recorder.preview && (
                <section className="mrv-card done">
                  <div className="mrv-done-row">
                    <video className="mrv-done-thumb" src={recorder.preview} playsInline preload="metadata" onClick={(e) => (e.currentTarget.paused ? void e.currentTarget.play() : e.currentTarget.pause())} aria-label="Play the recording" />
                    <span className="mrv-review-text dark">
                      <span className="mrv-review-eyebrow navy">
                        FORM REVIEW<Sep />
                        READY
                      </span>
                      <b className="big">{clock(recorder.secs)}</b>
                      <small>
                        <SepJoin parts={[`${drawn} drawing${drawn === 1 ? "" : "s"}`, micOn && !recorder.micDenied ? "voice" : "no voice", camOn && camStream && "camera"]} />
                      </small>
                    </span>
                  </div>
                  <textarea className="mrv-done-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Add a message (optional)" aria-label="Add a message (optional)" />
                  <span className="mrv-done-btns">
                    <button type="button" className="mrv-retake" onClick={recorder.retake} disabled={progress != null}>
                      Retake
                    </button>
                    <button type="button" className="mrv-sendrev" onClick={() => void sendReview()} disabled={progress != null}>
                      {progress != null ? (
                        <>
                          <span className="mrv-ring" style={{ "--p": `${Math.round(progress * 100)}%` } as React.CSSProperties} aria-hidden="true" />
                          {progress >= 1 ? "Saving…" : `Sending ${Math.round(progress * 100)}%`}
                        </>
                      ) : (
                        <>
                          Send to {first} <Ico d="M5 12h14M13 6l6 6-6 6" size={15} w={2.4} />
                        </>
                      )}
                    </button>
                  </span>
                </section>
              )}

              <div className="mrv-toggles">
                <button type="button" className={`mrv-toggle${micOn ? " on" : ""}`} aria-pressed={micOn} onClick={() => setMicOn(!micOn)}>
                  <Ico d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" size={16} />
                  Mic {micOn ? "on" : "off"}
                </button>
                <button type="button" className={`mrv-toggle${camOn ? " on" : ""}`} aria-pressed={camOn} onClick={toggleCam}>
                  <Ico d="M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5" size={16} />
                  Camera {camOn ? "on" : "off"}
                </button>
              </div>
              <p className="mrv-keys">
                <SepJoin parts={["P pen", "A arrow", "L line", "O circle", "[ ] size", "Z undo", "Space play/pause"]} />
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Asked before a recording is thrown away. */}
      {confirm && (
        <div className="mrv-confirm" role="alertdialog" aria-label="Discard recording?">
          <div className="mrv-confirm-card">
            <b>Discard recording?</b>
            <small>What you recorded goes. Your drawings go too.</small>
            <span>
              <button type="button" className="mrv-retake" onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button
                type="button"
                className="mrv-discard"
                onClick={() => {
                  const was = confirm;
                  backToTalk();
                  if (was === "close") onClose();
                }}
              >
                Discard
              </button>
            </span>
          </div>
        </div>
      )}
    </DialogContent>
  );
}

/** Whether a Training-tab video is one this modal shows: in, or answered, with a file. */
export const reviewable = (v: { state: string; src: string | null } | null | undefined) => !!v && (v.state === "in" || v.state === "replied") && !!v.src;

