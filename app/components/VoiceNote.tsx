"use client";

import { useEffect, useRef, useState } from "react";

// A voice message in every chat, as WhatsApp draws one (13 Nov, Alex): the sender's face with a small mic on it, the
// round play, the waveform (the played part ink, the rest grey, a dot where it is), dragged or tapped to move through it,
// and the length under it (the time played while it plays). The waveform is read from the file itself once the
// message comes on screen, kept for the visit; a recording whose browser wrote no length (Chrome's webm) takes the
// decoded one.

const BARS = 34;
const peaksCache = new Map<string, { peaks: number[]; secs: number }>();

async function readPeaks(src: string): Promise<{ peaks: number[]; secs: number } | null> {
  const kept = peaksCache.get(src);
  if (kept) return kept;
  try {
    const buf = await (await fetch(src, { credentials: "same-origin" })).arrayBuffer();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const audio = await new Promise<AudioBuffer>((ok, fail) => ctx.decodeAudioData(buf, ok, fail));
    void ctx.close().catch(() => {});
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / BARS));
    const raw: number[] = [];
    for (let i = 0; i < BARS; i++) {
      let sum = 0;
      const from = i * step;
      const to = Math.min(data.length, from + step);
      for (let j = from; j < to; j += 8) sum += data[j] * data[j];
      raw.push(Math.sqrt(sum / Math.max(1, (to - from) / 8)));
    }
    const top = Math.max(...raw, 0.0001);
    const out = { peaks: raw.map((v) => Math.max(0.12, Math.min(1, v / top))), secs: audio.duration };
    peaksCache.set(src, out);
    return out;
  } catch {
    return null;
  }
}

const clock = (n: number) => (Number.isFinite(n) && n >= 0 ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}` : "0:00");

export default function VoiceNote({ src, face, name, mine = false, className = "" }: { src: string; /** The sender's photo; their initial without one. */ face: string | null; name: string; mine?: boolean; className?: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const wave = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const seeking = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(() => peaksCache.get(src)?.peaks ?? null);

  // The waveform once it is on screen (a thread of many voice messages fetches none it doesn't show).
  useEffect(() => {
    if (peaks) return;
    const node = root.current;
    if (!node) return;
    let gone = false;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void readPeaks(src).then((r) => {
        if (gone || !r) return;
        setPeaks(r.peaks);
        setD((now) => (now && Number.isFinite(now) ? now : r.secs));
      });
    });
    io.observe(node);
    return () => {
      gone = true;
      io.disconnect();
    };
  }, [src, peaks]);

  const toggle = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  };
  const length = d && Number.isFinite(d) ? d : peaksCache.get(src)?.secs ?? 0;
  const share = length ? Math.min(1, t / length) : 0;
  // A tap or a drag on the waveform moves through it (13 Nov, Alex: "waveform").
  const seekAt = (clientX: number) => {
    const a = el.current;
    const box = wave.current?.getBoundingClientRect();
    if (!a || !box || !length) return;
    const at = Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * length;
    a.currentTime = at;
    setT(at);
  };
  // A file the phone can't decode (an iPhone's own recording, often) still draws as a wave, not a row of dots (13 Nov,
  // Alex): a shape of its own from the file's name, the same each time.
  const bars = peaks ?? fallbackBars(src);

  return (
    <span ref={root} className={`vn${mine ? " mine" : ""}${playing ? " playing" : ""}${className ? ` ${className}` : ""}`}>
      <span className="vn-face" aria-hidden="true">
        {face ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small round face
          <img src={face} alt="" draggable={false} />
        ) : (
          <span className="vn-initial">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <span className={`vn-mic${played ? " played" : ""}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
      </span>
      <button type="button" className="vn-play" onClick={toggle} aria-label={playing ? "Pause the voice message" : "Play the voice message"}>
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14M16 5v14" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="fill">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        )}
      </button>
      <span className="vn-body">
        <span
          ref={wave}
          className="vn-wave"
          role="slider"
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={Math.round(length)}
          aria-valuenow={Math.round(t)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX);
          }}
          onPointerMove={(e) => e.buttons && seekAt(e.clientX)}
          onKeyDown={(e) => {
            const a = el.current;
            if (!a || !length) return;
            if (e.key === "ArrowRight") a.currentTime = Math.min(length, a.currentTime + 2);
            if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 2);
          }}
        >
          {bars.map((p, i) => (
            <i key={i} className={(i + 0.5) / bars.length <= share ? "on" : undefined} style={{ height: `${Math.round(p * 100)}%` }} />
          ))}
          <b className="vn-knob" style={{ left: `${share * 100}%` }} aria-hidden="true" />
        </span>
        <span className="vn-time">{playing || t > 0 ? clock(t) : clock(length)}</span>
      </span>
      <audio
        ref={el}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          if (Number.isFinite(a.duration) && a.duration > 0) return setD(a.duration);
          // A recording that doesn't say its length (13 Nov, Alex: voice messages reading 0:00): asked for its end, the
          // phone reads it through and learns it; then back to the start.
          seeking.current = true;
          a.currentTime = 1e7;
        }}
        onDurationChange={(e) => {
          const a = e.currentTarget;
          if (!Number.isFinite(a.duration) || a.duration <= 0) return;
          setD(a.duration);
          if (seeking.current) {
            seeking.current = false;
            a.currentTime = 0;
            setT(0);
          }
        }}
        onTimeUpdate={(e) => !seeking.current && setT(e.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true);
          setPlayed(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setT(0);
        }}
      />
    </span>
  );
}

function fallbackBars(src: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const noise = ((h >>> 0) % 1000) / 1000;
    // Louder in the middle, quieter at the ends, as speech reads.
    const swell = Math.sin((Math.PI * (i + 0.5)) / BARS);
    return Math.max(0.15, Math.min(1, 0.25 + 0.55 * swell * (0.5 + noise * 0.8)));
  });
}
