"use client";

import { useEffect, useRef, useState } from "react";
import RingEdge from "./RingEdge";

// A voice message: tap to start, tap to stop, and the recording is handed
// over as a file for the chat to send. Records with what the browser has
// (audio/webm on Chrome and Android, audio/mp4 on iPhone). Shows the
// seconds while it runs; a second tap ends it, Escape throws it away.
// Since 27 Oct (Alex, from the research: "playback and erase voice messages before sending") a second tap stops it
// and it waits: ✕ throws it away, ▶ plays it back with its length, the ink arrow sends it.
// `ring`: the round button's size, when its outline is a vector ring (`RingEdge`); while recording it is a pill.
export default function VoiceRecordButton({ onRecorded, className = "", disabled = false, ring }: { onRecorded: (file: File) => void; className?: string; disabled?: boolean; ring?: number }) {
  const [state, setState] = useState<"idle" | "recording" | "denied" | "review">("idle");
  // The take waiting to be sent, played back from here.
  const [take, setTake] = useState<{ file: File; url: string; secs: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const counted = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const discard = useRef(false);
  const timer = useRef<number | null>(null);

  const stopTracks = () => rec.current?.stream.getTracks().forEach((t) => t.stop());
  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setState("denied");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      discard.current = false;
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = () => {
        stopTracks();
        if (timer.current) window.clearInterval(timer.current);
        setSeconds(0);
        if (discard.current || chunks.current.length === 0) return setState("idle");
        const type = r.mimeType || mime || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "weba";
        const file = new File([new Blob(chunks.current, { type })], `voice-${Date.now()}.${ext}`, { type });
        setTake({ file, url: URL.createObjectURL(file), secs: counted.current });
        setState("review");
      };
      rec.current = r;
      r.start();
      setState("recording");
      setSeconds(0);
      counted.current = 0;
      timer.current = window.setInterval(() => {
        counted.current += 1;
        setSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setState("denied");
    }
  };
  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  const drop = () => {
    player.current?.pause();
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setPlaying(false);
    setState("idle");
  };
  const send = () => {
    player.current?.pause();
    const t = take;
    setTake(null);
    setPlaying(false);
    setState("idle");
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
    if (state !== "recording") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        discard.current = true;
        stop();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);
  // Leaving the screen mid-recording throws it away.
  useEffect(() => () => {
    discard.current = true;
    stop();
  }, []);

  if (state === "review" && take) {
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
        <button type="button" className="vr-send" onClick={send} aria-label="Send the voice message" title="Send">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </span>
    );
  }
  if (state === "recording") {
    return (
      <button type="button" className={`${className} recording`} onClick={stop} aria-label="Stop the voice message" title="Stop (Esc to throw it away)">
        <span className="vr-dot" aria-hidden="true" />
        <span className="vr-time">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={start} disabled={disabled} aria-label="Record a voice message" title={state === "denied" ? "The microphone is not available" : "Voice message"}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </svg>
      {ring != null && <RingEdge size={ring} />}
    </button>
  );
}
