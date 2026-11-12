"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RingEdge from "./RingEdge";

// A voice message, as WhatsApp records one (13 Nov, Alex: "hold to record, slide up to lock, slide left to cancel, live
// wave"), in every chat. On a phone: hold the mic and speak, the bar over the box showing the time and the live wave;
// let go and it sends; slide left past the line and it is thrown away; slide up onto the lock and it keeps recording
// hands-free, the bar then holding ✕, ■ (stop and play it back first, as since 27 Oct) and the ink arrow to send. A tap
// too short to be a hold says `Hold to record`. With a mouse, a click starts it locked. Records with what the browser
// has (audio/webm on Chrome and Android, audio/mp4 on iPhone); Escape throws it away.
// `ring`: the round button's size, when its outline is a vector ring (`RingEdge`).

const CANCEL_PX = 110;
const LOCK_PX = 80;
const WAVE = 44;

type Phase = "idle" | "holding" | "locked" | "review" | "denied";

export default function VoiceRecordButton({ onRecorded, className = "", disabled = false, ring }: { onRecorded: (file: File) => void; className?: string; disabled?: boolean; ring?: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [take, setTake] = useState<{ file: File; url: string; secs: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const [hint, setHint] = useState(false);
  const [bar, setBar] = useState<{ left: number; top: number; width: number; height: number; micLeft: number; micW: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  // What the stop does with the take: send it, keep it for playing back, or throw it away.
  const ending = useRef<"send" | "review" | "discard">("discard");
  const held = useRef(false);
  const locked = useRef(false);
  const origin = useRef({ x: 0, y: 0, at: 0 });
  const startedAt = useRef(0);
  const audio = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const hintTimer = useRef<number | null>(null);

  const measure = () => {
    // The bar lies over the composer's row: the first box up from the mic wide enough to be it.
    let row: HTMLElement | null = btn.current?.parentElement ?? null;
    while (row && row.getBoundingClientRect().width < 260 && row.parentElement) row = row.parentElement;
    const r = row?.getBoundingClientRect();
    const m = btn.current?.getBoundingClientRect();
    if (r && m) setBar({ left: r.left, top: r.top, width: r.width, height: Math.max(44, r.height), micLeft: m.left - r.left, micW: m.width });
  };

  const stopAudio = () => {
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.raf);
    void audio.current.ctx.close().catch(() => {});
    audio.current = null;
  };
  const stopTracks = () => rec.current?.stream.getTracks().forEach((t) => t.stop());

  const start = async (lockIt: boolean) => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setPhase("denied");
    locked.current = lockIt;
    // The bar in the tap's own frame (13 Nov, Alex: "it takes two seconds to react"): the phone's microphone can take a
    // moment to open, so nothing waits on it; the time starts once it records.
    measure();
    setSecs(0);
    setLevels([]);
    setPhase(lockIt ? "locked" : "holding");
    // The wave's audio started inside the tap: an iPhone keeps one made after it silent (the wave stayed flat).
    let ctx: AudioContext | null = null;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        ctx = new Ctx();
        void ctx.resume().catch(() => {});
      }
    } catch {
      ctx = null;
    }
    let stream: MediaStream;
    try {
      // A voice, clean (13 Nov, Alex: "the quality is so bad"): one channel, echo and noise taken out, the level kept even.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      void ctx?.close().catch(() => {});
      return setPhase("denied");
    }
    // Let go (or slid away) while the microphone was opening: nothing is recorded.
    if (!held.current && !locked.current) {
      stream.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
      return setPhase("idle");
    }
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    let r: MediaRecorder;
    try {
      // 96 kbps, well over the phone's own default: a voice as it sounds.
      r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 96000 });
    } catch {
      r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    }
    chunks.current = [];
    ending.current = "discard";
    r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    r.onstop = () => {
      stopTracks();
      stopAudio();
      const took = (Date.now() - startedAt.current) / 1000;
      setLevels([]);
      setDrag({ dx: 0, dy: 0 });
      if (ending.current === "discard" || chunks.current.length === 0 || took < 0.6) return setPhase("idle");
      const type = r.mimeType || mime || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "weba";
      const file = new File([new Blob(chunks.current, { type })], `voice-${Date.now()}.${ext}`, { type });
      if (ending.current === "send") {
        setPhase("idle");
        onRecorded(file);
        return;
      }
      setTake({ file, url: URL.createObjectURL(file), secs: Math.round(took) });
      setPhase("review");
    };
    rec.current = r;
    r.start();
    startedAt.current = Date.now();
    // The live wave: the microphone's loudness a few times a second, the newest on the right.
    try {
      if (ctx) {
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        let last = 0;
        const tick = (now: number) => {
          if (!audio.current) return;
          audio.current.raf = requestAnimationFrame(tick);
          if (now - last < 70) return;
          last = now;
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += ((buf[i] - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          setLevels((l) => [...l.slice(-(WAVE - 1)), level]);
          setSecs(Math.floor((Date.now() - startedAt.current) / 1000));
        };
        audio.current = { ctx, raf: requestAnimationFrame(tick) };
      }
    } catch {
      /* no wave, the recording goes on */
    }
    if (!audio.current) {
      // No wave to drive the time: a plain tick until it stops.
      const t = window.setInterval(() => (rec.current?.state === "recording" ? setSecs(Math.floor((Date.now() - startedAt.current) / 1000)) : window.clearInterval(t)), 500);
    }
  };

  const end = (how: "send" | "review" | "discard") => {
    held.current = false;
    ending.current = how;
    if (rec.current?.state === "recording") rec.current.stop();
    else setPhase("idle");
  };

  const drop = () => {
    player.current?.pause();
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setPlaying(false);
    setPhase("idle");
  };
  const sendTake = () => {
    player.current?.pause();
    const t = take;
    setTake(null);
    setPlaying(false);
    setPhase("idle");
    if (t) {
      onRecorded(t.file);
      setTimeout(() => URL.revokeObjectURL(t.url), 60_000);
    }
  };
  const playBack = () => {
    const a = player.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  };
  const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

  useEffect(() => {
    if (phase !== "holding" && phase !== "locked") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end("discard");
    const onMove = () => measure();
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
    };
  }, [phase]);
  // While holding or recording nothing on the page is selected or called out (13 Nov, Alex: "it selects elements").
  useEffect(() => {
    const on = phase === "holding" || phase === "locked";
    document.documentElement.classList.toggle("vrec-on", on);
    return () => document.documentElement.classList.remove("vrec-on");
  }, [phase]);
  // Leaving the screen mid-recording throws it away.
  useEffect(
    () => () => {
      ending.current = "discard";
      if (rec.current?.state === "recording") rec.current.stop();
      stopAudio();
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    },
    []
  );

  if (phase === "review" && take) {
    return (
      <span className="vr-review" role="group" aria-label="Voice message">
        <audio ref={player} src={take.url} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        <button type="button" className="vr-drop" onClick={drop} aria-label="Throw it away" title="Throw it away">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button type="button" className="vr-play" onClick={playBack} aria-label={playing ? "Pause" : "Play it back"}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M8 5v14M16 5v14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          )}
          <span className="vr-time">{clock(take.secs)}</span>
        </button>
        <button type="button" className="vr-send" onClick={sendTake} aria-label="Send the voice message" title="Send">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </span>
    );
  }

  const recording = phase === "holding" || phase === "locked";
  const wave = (
    <span className="vrec-wave" aria-hidden="true">
      {Array.from({ length: WAVE }, (_, i) => {
        const v = levels[levels.length - WAVE + i];
        return <i key={i} style={{ height: `${Math.round(Math.max(0.1, v ?? 0) * 100)}%`, opacity: v == null ? 0.35 : 1 }} />;
      })}
    </span>
  );
  const overlay =
    recording && bar
      ? createPortal(
          <div
            className={`vrec ${phase}`}
            style={{ left: bar.left, top: bar.top, width: phase === "locked" ? bar.width : Math.max(120, bar.micLeft - 6), height: bar.height }}
            role="status"
            aria-label={`Recording ${clock(secs)}`}
          >
            {phase === "locked" && (
              <button type="button" className="vrec-x" onClick={() => end("discard")} aria-label="Throw it away">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
            )}
            <span className="vrec-dot" aria-hidden="true" />
            <span className="vrec-time">{clock(secs)}</span>
            {phase === "holding" ? (
              <span className="vrec-cancel" style={{ translate: `${Math.max(-CANCEL_PX, drag.dx) * 0.6}px 0`, opacity: 1 - Math.min(1, -drag.dx / CANCEL_PX) * 0.7 }}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m15 6-6 6 6 6" />
                </svg>
                Slide to cancel
              </span>
            ) : (
              wave
            )}
            {phase === "holding" && wave}
            {phase === "locked" && (
              <>
                <button type="button" className="vrec-stop" onClick={() => end("review")} aria-label="Stop and play it back">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                  </svg>
                </button>
                <button type="button" className="vrec-send" onClick={() => end("send")} aria-label="Send the voice message">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}
          </div>,
          document.body
        )
      : null;
  // The lock over the mic while holding: it rises with the finger, closing once past the line.
  const lockMark =
    phase === "holding" && bar
      ? createPortal(
          <span
            className={`vrec-lock${-drag.dy > LOCK_PX * 0.6 ? " near" : ""}`}
            style={{ left: bar.left + bar.micLeft + bar.micW / 2, top: bar.top - 74 + Math.max(-LOCK_PX, drag.dy) * 0.5 }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <rect x="6" y="11" width="12" height="9" rx="2" />
              <path d="M9 11V8a3 3 0 0 1 6 0v3" />
            </svg>
            <svg viewBox="0 0 24 24" className="vrec-up">
              <path d="m7 14 5-5 5 5" />
            </svg>
          </span>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`${className}${phase === "holding" ? " vrec-held" : ""}`}
        style={phase === "holding" ? { translate: `${Math.max(-CANCEL_PX, drag.dx) * 0.4}px ${Math.max(-LOCK_PX, drag.dy) * 0.4}px` } : undefined}
        disabled={disabled}
        aria-label={phase === "denied" ? "The microphone is not available" : "Hold to record a voice message"}
        title={phase === "denied" ? "The microphone is not available" : "Voice message"}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (disabled || recording) return;
          if (e.pointerType === "mouse") {
            // A click with a mouse records hands-free: there is no finger to hold.
            void start(true);
            return;
          }
          e.preventDefault();
          held.current = true;
          origin.current = { x: e.clientX, y: e.clientY, at: Date.now() };
          setDrag({ dx: 0, dy: 0 });
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* the moves still come while the finger stays on it */
          }
          void start(false);
        }}
        onPointerMove={(e) => {
          if (!held.current || locked.current) return;
          const dx = Math.min(0, e.clientX - origin.current.x);
          const dy = Math.min(0, e.clientY - origin.current.y);
          setDrag({ dx, dy });
          if (phase !== "holding") return;
          if (-dx > CANCEL_PX) end("discard");
          else if (-dy > LOCK_PX) {
            locked.current = true;
            held.current = false;
            setDrag({ dx: 0, dy: 0 });
            setPhase("locked");
            if (navigator.vibrate) navigator.vibrate(10);
          }
        }}
        onPointerUp={() => {
          if (!held.current) return;
          held.current = false;
          // Too short to be a hold: a word on how, nothing recorded.
          if (Date.now() - origin.current.at < 350) {
            end("discard");
            setHint(true);
            if (hintTimer.current) window.clearTimeout(hintTimer.current);
            hintTimer.current = window.setTimeout(() => setHint(false), 1600);
            return;
          }
          if (!locked.current) end("send");
        }}
        onPointerCancel={() => {
          if (held.current && !locked.current) end("discard");
        }}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
        {ring != null && <RingEdge size={ring} />}
        {hint && (
          <span className="vrec-hint" role="status">
            Hold to record
          </span>
        )}
      </button>
      {overlay}
      {lockMark}
    </>
  );
}
