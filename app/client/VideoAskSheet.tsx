"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { uploadRequestedVideoAction } from "../lib/actions";
import { VideoReplyBody, type VideoReplyView } from "./VideoReplySheet";

// The coach asked for a video of this exercise: a camera on the exercise
// card, with a dot until one is sent. It opens a sheet from the bottom with
// what the coach asked for and two ways in: record one now, or pick one
// already on the phone. The clip plays back before it goes; a clip over
// two minutes or over 128 MB is refused here, with how to make it fit, rather
// than after a long upload.
export type VideoAsk = {
  id: number;
  note: string | null;
  src: string | null;
  sentAt: string | null;
  /** The coach's reply to it, once there is one. */
  reply?: VideoReplyView | null;
};

const MAX_BYTES = 128 * 1024 * 1024;
const MAX_SECONDS = 120;

// How long a picked clip runs, read from the file itself.
function durationOf(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

export default function VideoAskButton({ ask, exerciseName }: { ask: VideoAsk; exerciseName: string }) {
  const [open, setOpen] = useState(false);
  const sent = !!ask.src;
  return (
    <>
      <button
        type="button"
        className={`ts-ask${sent ? " sent" : ""}${ask.reply && !ask.reply.seen ? " replied" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={ask.reply ? "Your coach replied to your video" : sent ? "The video you sent your coach" : "Your coach asked for a video"}
        title={ask.reply ? "Your coach replied" : sent ? "Video sent" : "Your coach asked for a video"}
      >
        <VideoGlyph />
      </button>
      {open && <VideoAskSheet ask={ask} exerciseName={exerciseName} onClose={() => setOpen(false)} />}
    </>
  );
}

export function VideoAskSheet({ ask, exerciseName, onClose }: { ask: VideoAsk; exerciseName: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, run] = useTransition();
  const url = useRef<string | null>(null);

  // The preview's object URL is let go when it changes and when the sheet closes.
  useEffect(() => () => {
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);

  const pick = async (f: File) => {
    if (url.current) URL.revokeObjectURL(url.current);
    const u = URL.createObjectURL(f);
    url.current = u;
    setFile(f);
    setPreview(u);
    setProblem(null);
    if (f.size > MAX_BYTES) {
      setProblem(`This clip is ${Math.round(f.size / 1024 / 1024)} MB and the limit is 128 MB. Film it in 1080p rather than 4K (Settings › Camera › Record Video), and keep it under two minutes.`);
      return;
    }
    const secs = await durationOf(u);
    if (secs != null && secs > MAX_SECONDS + 1) setProblem(`This clip is ${Math.round(secs)} seconds. Keep it under two minutes: just the set your coach asked for.`);
  };

  const send = () => {
    if (!file || problem) return;
    const fd = new FormData();
    fd.set("requestId", String(ask.id));
    fd.set("file", file);
    run(async () => {
      const error = await uploadRequestedVideoAction(fd);
      if (error) {
        setProblem(error);
        return;
      }
      setDone(true);
      setTimeout(onClose, 1200);
    });
  };

  const options = (
    <>
      {[
        { label: ask.src ? "Record a new one" : "Record a video", capture: true },
        { label: "Choose from your phone", capture: false },
      ].map((o) => (
        <label key={o.label} className="pp-app-sheet-option">
          {o.label}
          <input
            type="file"
            accept="video/*"
            capture={o.capture ? "environment" : undefined}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
              e.target.value = "";
            }}
          />
        </label>
      ))}
    </>
  );

  return createPortal(
    <div className="vr-sheet-scrim" role="presentation" onClick={() => !sending && onClose()}>
      <div className="pp-app-sheet vr-sheet" role="dialog" aria-modal="true" aria-label={`Video of ${exerciseName}`} onClick={(e) => e.stopPropagation()}>
        <div className="pp-app-sheet-head">
          <span className="pp-app-sheet-title">{done ? "Sent to your coach" : ask.src && !file ? "Your video" : "Video for your coach"}</span>
          <span className="pp-app-sheet-sub">{exerciseName}</span>
        </div>

        {/* The coach's reply first, when there is one: it is what is new. */}
        {ask.reply && !done && !file && <VideoReplyBody reply={ask.reply} />}

        {ask.note && !done && (
          <div className="vr-sheet-note">
            <span>Your coach asked</span>
            <p>{ask.note}</p>
          </div>
        )}

        {done ? (
          <p className="vr-sheet-done">✓ Your coach can watch it now.</p>
        ) : file && preview ? (
          <>
            <video className="vr-sheet-video" src={preview} controls playsInline muted />
            {problem && <p className="vr-sheet-problem">{problem}</p>}
            <button type="button" className="vr-sheet-send" onClick={send} disabled={!!problem || sending}>
              {sending ? "Sending… keep the app open" : ask.src ? "Send instead" : "Send to your coach"}
            </button>
            {options}
          </>
        ) : (
          <>
            {ask.src && (
              <>
                <video className="vr-sheet-video" src={ask.src} controls playsInline preload="metadata" />
                {ask.sentAt && <p className="vr-sheet-sent">Sent {new Date(ask.sentAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}. Only your coach sees it.</p>}
              </>
            )}
            {!ask.src && <p className="vr-sheet-hint">Up to two minutes. Film in 1080p so it sends quickly. Only your coach sees it.</p>}
            {options}
          </>
        )}

        {!done && (
          <button type="button" className="pp-app-sheet-cancel" onClick={onClose} disabled={sending}>
            {ask.src && !file ? "Close" : "Cancel"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

export function VideoGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
    </svg>
  );
}
