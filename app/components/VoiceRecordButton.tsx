"use client";

import { useEffect, useRef, useState } from "react";

// A voice message: tap to start, tap to stop, and the recording is handed
// over as a file for the chat to send. Records with what the browser has
// (audio/webm on Chrome and Android, audio/mp4 on iPhone). Shows the
// seconds while it runs; a second tap ends it, Escape throws it away.
export default function VoiceRecordButton({ onRecorded, className = "", disabled = false }: { onRecorded: (file: File) => void; className?: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "denied">("idle");
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
        setState("idle");
        setSeconds(0);
        if (discard.current || chunks.current.length === 0) return;
        const type = r.mimeType || mime || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "weba";
        onRecorded(new File([new Blob(chunks.current, { type })], `voice-${Date.now()}.${ext}`, { type }));
      };
      rec.current = r;
      r.start();
      setState("recording");
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setState("denied");
    }
  };
  const stop = () => rec.current?.state === "recording" && rec.current.stop();

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

  if (state === "recording") {
    return (
      <button type="button" className={`${className} recording`} onClick={stop} aria-label="Stop and send the voice message" title="Stop and send (Esc to throw it away)">
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
    </button>
  );
}
