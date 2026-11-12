"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { sendExerciseMediaAction } from "../lib/actions";
import { uploadFirst } from "../lib/uploadFirst";
import { newOnceKey } from "../lib/onceKey";
import { VideoReplyBody, type VideoReplyView } from "./VideoReplySheet";
import { dayWords } from "../lib/clientDates";
import RingEdge from "../components/RingEdge";

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
  /** The client sent it unasked (9 Oct); a photo or a video; about the swap. */
  fromClient?: boolean;
  media?: "video" | "photo" | null;
  about?: "swap" | null;
  clientNote?: string | null;
  /** The coach's reply on this exercise from an earlier session (9 Oct), shown again here. */
  carried?: boolean;
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

// The coach by their name, never "your coach" (3 Nov, Alex: the words audit); "Coach" with no name.
export default function VideoAskButton({ ask, assignmentId, exerciseName, coachName = "Coach" }: { ask: VideoAsk; assignmentId: number; exerciseName: string; coachName?: string }) {
  const [open, setOpen] = useState(false);
  const sent = !!ask.src;
  const label = ask.reply ? `${coachName} replied` : sent ? "Video sent" : `${coachName} asked for a video`;
  return (
    <>
      <button
        type="button"
        className={`ts-ask${sent ? " sent" : ""}${ask.reply && !ask.reply.seen ? " replied" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
      >
        <VideoGlyph />
      </button>
      {open && <VideoAskSheet ask={ask} assignmentId={assignmentId} exerciseName={exerciseName} coachName={coachName} onClose={() => setOpen(false)} />}
    </>
  );
}

export function VideoAskSheet({ ask, assignmentId, about = null, exerciseName, coachName = "Coach", onClose }: { ask: VideoAsk | null; assignmentId: number; /** Sending a picture of the swap (9 Oct). */ about?: "swap" | null; exerciseName: string; coachName?: string; onClose: () => void }) {
  const isPhoto = (f: File | null) => !!f && f.type.startsWith("image/");
  const sentPhoto = ask?.media === "photo";
  // The coach asked for it, with or without a note (the note is optional since 15 Oct).
  const asked = !!ask && !ask.fromClient && !ask.carried;
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, run] = useTransition();
  const url = useRef<string | null>(null);
  // The send whose answer was lost on the way, its one-time key kept for sending that clip again (6 Nov).
  const lostSend = useRef<{ key: string; sent: string } | null>(null);

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
    if (f.type.startsWith("image/")) {
      if (f.size > 20 * 1024 * 1024) setProblem("This photo is over 20 MB. Pick a smaller one.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setProblem(`This clip is ${Math.round(f.size / 1024 / 1024)} MB and the limit is 128 MB. Film it in 1080p rather than 4K (Settings › Camera › Record Video), and keep it under two minutes.`);
      return;
    }
    const secs = await durationOf(u);
    if (secs != null && secs > MAX_SECONDS + 1) setProblem(`This clip is ${Math.round(secs)} seconds. Keep it under two minutes: just the set ${coachName} asked for.`);
  };

  const send = () => {
    if (!file || problem) return;
    const fd = new FormData();
    fd.set("assignmentId", String(assignmentId));
    fd.set("file", file);
    fd.set("about", about ?? ask?.about ?? "");
    fd.set("note", note);
    // Its one-time key, made as Send is tapped (6 Nov): sent again once the signal is back, or the same clip sent again
    // after `That didn't send`, it goes once. An answer from the server (sent, or a reason) ends it.
    const sent = JSON.stringify([assignmentId, file.name, file.size, file.lastModified]);
    const onceKey = lostSend.current?.sent === sent ? lostSend.current.key : newOnceKey();
    lostSend.current = { key: onceKey, sent };
    fd.set("onceKey", onceKey);
    run(async () => {
      // A failed request (the connection dropped, the body refused) used to throw
      // out of here and crash the screen (15 Oct): now it reads as a line in the sheet.
      let error: string | null;
      try {
        // The clip goes ahead to the server's disk; the send carries its handle (4 Nov, Alex: memory).
        error = await uploadFirst(fd, "media");
        if (!error) {
          error = await sendExerciseMediaAction(fd);
          lostSend.current = null;
        }
      } catch (e) {
        const mb = Math.round(file.size / 1024 / 1024);
        error = `That didn't send${mb ? ` (${mb} MB)` : ""}. Check your connection and try again; a shorter clip helps.`;
        console.error("[media] send failed", e);
      }
      if (error) {
        setProblem(error);
        return;
      }
      setDone(true);
      setTimeout(onClose, 1200);
    });
  };

  const picker = (label: string, capture: boolean, className = "pp-app-sheet-option") => (
    <label key={label} className={className}>
      {label}
      <input
        type="file"
        accept={asked ? "video/*" : "image/*,video/*"}
        capture={capture ? "environment" : undefined}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
  const options = (
    <>
      {picker(ask?.src ? (asked ? "Record a new one" : "Take a new one") : asked ? "Record a video" : "Take a photo or film a video", true)}
      {picker("Choose from your phone", false)}
    </>
  );
  // A video shows its first frame before it plays (19 Oct): iOS paints nothing until asked for a time.
  const firstFrame = (src: string) => (src.includes("#") ? src : `${src}#t=0.001`);

  return createPortal(
    <div className="vr-sheet-scrim" role="presentation" onClick={() => !sending && onClose()}>
      <div className="pp-app-sheet vr-sheet" role="dialog" aria-modal="true" aria-label={`Video of ${exerciseName}`} onClick={(e) => e.stopPropagation()}>
        <div className="pp-app-sheet-head">
          <span className="pp-app-sheet-title">{done ? `Sent to ${coachName}` : ask?.src && !file ? (sentPhoto ? "Your photo" : "Your video") : asked ? `Video for ${coachName}` : about === "swap" || ask?.about === "swap" ? "A picture of what you used" : "Photo or video"}</span>
          <span className="pp-app-sheet-sub">{exerciseName}</span>
        </div>

        {/* The coach's reply first, when there is one: it is what is new. */}
        {ask?.reply && !done && !file && <VideoReplyBody reply={ask.reply} coachName={coachName} />}

        {ask?.note && !done && (
          <div className="vr-sheet-note">
            <span>{coachName} asked</span>
            <p>{ask.note}</p>
          </div>
        )}

        {/* Sent, the title says it alone (3 Nov, Alex: the words audit). */}
        {done ? null : file && preview ? (
          <>
            {isPhoto(file) ? <img className="vr-sheet-video" src={preview} alt="" /> : <video className="vr-sheet-video" src={firstFrame(preview)} controls playsInline muted preload="metadata" />}
            {/* Send and Cancel are the choice here (19 Oct, Alex: four buttons was crowded); another one is a quiet line. */}
            {picker(`Choose another ${asked ? "video" : "one"}`, false, "vr-sheet-again")}
            {!asked && <input className="vr-sheet-note-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to say with it? (optional)" maxLength={300} />}
            {problem && <p className="vr-sheet-problem">{problem}</p>}
            <button type="button" className="vr-sheet-send" onClick={send} disabled={!!problem || sending}>
              {sending ? "Sending… keep the app open" : ask?.src ? "Send instead" : `Send to ${coachName}`}
            </button>
          </>
        ) : (
          <>
            {ask?.src && (
              <>
                {sentPhoto ? <img className="vr-sheet-video" src={ask.src} alt="" /> : <video className="vr-sheet-video" src={firstFrame(ask.src)} controls playsInline preload="metadata" />}
                {ask.clientNote && <p className="vr-sheet-sent">{ask.clientNote}</p>}
                {ask.sentAt && <p className="vr-sheet-sent">Sent {dayWords(new Date(ask.sentAt), { weekday: "short" })}.</p>}
              </>
            )}
            {/* The limit alone, and nothing with no ask (3 Nov, Alex: the words audit). */}
            {!ask?.src && asked && <p className="vr-sheet-hint">Up to 2 min</p>}
            {options}
          </>
        )}

        {!done && (
          <button type="button" className="pp-app-sheet-cancel" onClick={onClose} disabled={sending}>
            {ask?.src && !file ? "Close" : "Cancel"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Whether an exercise shows its photo or video row (the workout's rule): a coach's ask with or without a note, on a
 *  swap only when it is about the swap, and one the client started only once something is in it. A finished session
 *  shows only what was sent in it and the reply to that, never a reply carried from an earlier session (`finished`). */
export function askShown(ask: VideoAsk | null | undefined, swapped: boolean, finished = false): ask is VideoAsk {
  return !!ask && !(finished && ask.carried) && (!swapped || ask.about === "swap") && (!ask.fromClient || !!ask.note || !!ask.src || !!ask.reply);
}

/** The workout's row for an exercise's photo or video and the coach's reply, word for word wherever it shows: the
 *  exercise page, and a finished session's exercise on Training and in its overview (12 Nov, Alex: B of
 *  docs/boards/workout-hidden-mockup.html). Styled under `.lw`; a page outside the workout wraps it in one. */
export function VideoAskRow({ ask, coachName, onOpen, tabIndex }: { ask: VideoAsk; coachName: string; onOpen: () => void; tabIndex?: number }) {
  return (
    <button type="button" className={`wo-video${ask.reply ? " replied" : ask.src ? " sent" : " asked"}${ask.reply && !ask.reply.seen ? " unseen" : ""}`} onClick={onOpen} tabIndex={tabIndex}>
      <span className="wo-video-tile">
        <VideoGlyph photo={ask.media === "photo"} />
      </span>
      <span className="wo-video-main">
        <b>{ask.reply ? (ask.carried ? `${coachName}'s reply on this exercise` : `${coachName} replied to your ${ask.media === "photo" ? "photo" : "video"}`) : ask.src ? (ask.media === "photo" ? "Photo sent" : "Video sent") : `${coachName} asked for a video`}</b>
        {/* A reply needs no second line (17 Oct, Alex): the title says it and Open opens it. */}
        {!ask.reply && <small>{/* Sent and its day alone (25 Oct, Alex: "waiting for Finlay is not necessary"). */}
        {ask.src ? (ask.sentAt ? `Sent ${dayWords(new Date(ask.sentAt))}` : "Sent") : ask.note || "Of this exercise, this session"}</small>}
      </span>
      <span className="wo-video-action">{ask.reply ? "Open" : ask.src ? "View" : "Record"}</span>
    </button>
  );
}

/** Where an ask stands on the workout (12 Nov, Alex: docs/boards/workout-a2-mockup.html): asked and nothing sent amber,
 *  sent with no reply grey, replied green. */
export const askState = (ask: VideoAsk): "asked" | "sent" | "replied" => (ask.reply ? "replied" : ask.src ? "sent" : "asked");

/** The ask's round button on the exercise page's eyebrow line (12 Nov, Alex: A2 of docs/boards/workout-a2-mockup.html):
 *  the video, or the camera for a photo, 14 in a 32px ring in its state's colour; a tap opens the sheet. Both even. */
export function VideoAskTool({ ask, coachName, onOpen }: { ask: VideoAsk; coachName: string; onOpen: () => void }) {
  const state = askState(ask);
  const photo = ask.media === "photo";
  const words = state === "replied" ? `${coachName} replied` : state === "sent" ? (photo ? "Photo sent" : "Video sent") : `${coachName} asked for a ${photo ? "photo" : "video"}`;
  return (
    <button type="button" className={`wo-ask-tool ${state}`} onClick={onOpen} aria-label={words} title={words}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <MediaPaths photo={photo} fixed />
      </svg>
      <RingEdge size={32} stroke={1.5} />
    </button>
  );
}

/** The ask's line under the exercise's name (12 Nov, Alex: A2 and "the pill" of docs/boards/workout-a2-mockup.html), only
 *  while there is something to do or see: a dot and the words in the state's colour, the action on the right as a pill
 *  (Record the ink one, View the white one), the coach's ask note grey under it in quotes. A reply once seen says nothing
 *  here; its green ring on the eyebrow line stays. The one pill in a row, by choice (docs/DESIGN-RULES.md §6). */
export function VideoAskLine({ ask, coachName, onOpen }: { ask: VideoAsk; coachName: string; onOpen: () => void }) {
  const state = askState(ask);
  if (state === "replied" && ask.reply?.seen) return null;
  const photo = ask.media === "photo";
  const words = state === "replied" ? `${coachName} replied` : state === "sent" ? (photo ? "Photo sent" : "Video sent") : `${coachName} asked for a ${photo ? "photo" : "video"}`;
  const note = state === "asked" && !ask.fromClient ? ask.note?.trim() : null;
  return (
    <div className={`wo-askline ${state}`}>
      <button type="button" className="wo-askline-row" onClick={onOpen}>
        <span className="wo-askline-words">
          <i aria-hidden="true" />
          {words}
        </span>
        <span className={`wo-askline-pill${state === "asked" ? " ink" : ""}`}>{state === "asked" ? "Record" : "View"}</span>
      </button>
      {note && <p className="wo-askline-note">“{note}”</p>}
    </div>
  );
}

/** The mark on a finished session's exercise row that says it holds a photo or video (12 Nov, Alex: B of
 *  docs/boards/workout-hidden-mockup.html; as the coach's rows carry it): the video, or the camera for a photo, 12px in
 *  a 22px ring, green once sent or replied to, grey while only asked. */
export function VideoAskMark({ ask }: { ask: VideoAsk }) {
  const green = !!ask.reply || !!ask.src;
  const photo = ask.media === "photo";
  const words = ask.reply ? "Reply" : ask.src ? (photo ? "Photo sent" : "Video sent") : "Video asked";
  return (
    <span className={`wo-askmark${green ? " green" : ""}`} role="img" aria-label={words} title={words}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <MediaPaths photo={photo} fixed />
      </svg>
      <RingEdge size={22} stroke={1.5} />
    </span>
  );
}

/** The video camera, or the photo camera for a photo: one drawing for the mark and the row's tile, so one thing never
 *  wears two icons. `fixed` keeps the stroke at its width however small it is drawn. */
function MediaPaths({ photo, fixed = false }: { photo: boolean; fixed?: boolean }) {
  const ve = fixed ? "non-scaling-stroke" : undefined;
  return photo ? (
    <>
      <path vectorEffect={ve} d="M3 8A1.5 1.5 0 0 1 4.5 6.5H8L9.5 4h5L16 6.5h3.5A1.5 1.5 0 0 1 21 8v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle vectorEffect={ve} cx="12" cy="12.6" r="3.4" />
    </>
  ) : (
    <>
      <rect vectorEffect={ve} x="2.75" y="6" width="13" height="12" rx="2.5" />
      <path vectorEffect={ve} d="M15.75 10.5 21.25 7.5v9l-5.5-3" />
    </>
  );
}

export function VideoGlyph({ photo = false }: { photo?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <MediaPaths photo={photo} />
    </svg>
  );
}
