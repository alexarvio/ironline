"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { sendExerciseMediaAction } from "../lib/actions";
import { uploadFileFirst } from "../lib/uploadFirst";
import { fitJpeg } from "../lib/coverJpeg";
import { Bars } from "./Bars";
import DoneCheck from "../components/DoneCheck";
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

/** The photo or video sheet (13 Nov, Alex): a centred pop-up in the gym picker's voice, the title and the round ✕ on its
 *  right. One tap opens the phone's own picker (a hidden file field's click, no capture, so the camera is one of the
 *  phone's choices; never a menu of ours or a see-through field). The coach's reply first, with what it answers under it:
 *  the client's own clip as a small frame, `Your video | Sat 10 Oct | Upper`, a tap playing it. What is picked starts going
 *  up at once (a photo made smaller first), so Send only files it. */
export function VideoAskSheet({ ask, assignmentId, about = null, exerciseName, coachName = "Coach", onClose }: { ask: VideoAsk | null; assignmentId: number; /** Sending a picture of the swap (9 Oct). */ about?: "swap" | null; exerciseName: string; coachName?: string; onClose: () => void }) {
  const isPhoto = (f: Blob | null) => !!f && f.type.startsWith("image/");
  const sentPhoto = ask?.media === "photo";
  // The coach asked for it, with or without a note (the note is optional since 15 Oct).
  const asked = !!ask && !ask.fromClient && !ask.carried;
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [theirsOpen, setTheirsOpen] = useState(false);
  const [sending, run] = useTransition();
  const url = useRef<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  // The picked file going up ahead (13 Nov, Alex: "faster upload"): its handle once the server has it.
  const upload = useRef<{ file: File; abort: AbortController; done: Promise<{ handle: string } | { refused: string }> } | null>(null);
  // The send whose answer was lost on the way, its one-time key kept for sending that clip again (6 Nov).
  const lostSend = useRef<{ key: string; sent: string } | null>(null);

  const dropUpload = () => {
    upload.current?.abort.abort();
    upload.current = null;
  };
  // The preview's object URL and an upload not sent are let go as the sheet closes.
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
      upload.current?.abort.abort();
    },
    []
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sending, onClose]);

  const startUpload = (f: File) => {
    dropUpload();
    const abort = new AbortController();
    const done = (async () => {
      // A photo goes up made smaller (the server keeps 2048 at most anyway); a video as it is.
      const body: Blob = isPhoto(f) ? ((await fitJpeg(f, 2048)) ?? f) : f;
      return uploadFileFirst(body, "media", null, abort.signal);
    })();
    done.catch(() => undefined);
    upload.current = { file: f, abort, done };
  };

  const pick = async (f: File) => {
    if (url.current) URL.revokeObjectURL(url.current);
    const u = URL.createObjectURL(f);
    url.current = u;
    setFile(f);
    setPreview(u);
    setProblem(null);
    dropUpload();
    if (f.type.startsWith("image/")) {
      if (f.size > 20 * 1024 * 1024) return setProblem("This photo is over 20 MB. Pick a smaller one.");
      return startUpload(f);
    }
    if (f.size > MAX_BYTES) return setProblem(`This clip is ${Math.round(f.size / 1024 / 1024)} MB and the limit is 128 MB. Film it in 1080p rather than 4K, and keep it under two minutes.`);
    const secs = await durationOf(u);
    if (secs != null && secs > MAX_SECONDS + 1) return setProblem(`This clip is ${Math.round(secs)} seconds. Keep it under two minutes.`);
    startUpload(f);
  };

  const send = () => {
    if (!file || problem) return;
    const fd = new FormData();
    fd.set("assignmentId", String(assignmentId));
    fd.set("about", about ?? ask?.about ?? "");
    fd.set("note", note);
    // Its one-time key, made as Send is tapped (6 Nov): sent again once the signal is back, or the same clip sent again
    // after `That didn't send`, it goes once. An answer from the server (sent, or a reason) ends it.
    const sent = JSON.stringify([assignmentId, file.name, file.size, file.lastModified]);
    const onceKey = lostSend.current?.sent === sent ? lostSend.current.key : newOnceKey();
    lostSend.current = { key: onceKey, sent };
    fd.set("onceKey", onceKey);
    run(async () => {
      let error: string | null;
      try {
        // The upload begun at the pick; one that failed on the way goes again now.
        if (upload.current?.file !== file) startUpload(file);
        let answer = await upload.current!.done.catch(() => null);
        if (!answer) {
          startUpload(file);
          answer = await upload.current!.done;
        }
        if ("refused" in answer) error = answer.refused;
        else {
          fd.set("upload", answer.handle);
          error = await sendExerciseMediaAction(fd);
          upload.current = null;
          lostSend.current = null;
        }
      } catch (e) {
        const mb = Math.round(file.size / 1024 / 1024);
        error = `Not sent${mb ? ` (${mb} MB)` : ""}. Check your connection and try again.`;
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

  // A video shows its first frame before it plays (19 Oct): iOS paints nothing until asked for a time.
  const firstFrame = (src: string) => (src.includes("#") ? src : `${src}#t=0.001`);
  const reply = ask?.reply ?? null;
  // What the reply answers: the clip it was sent on (the ask's own, or an earlier session's for a carried one).
  const theirs = reply ? reply.theirs ?? (ask?.carried ? null : ask?.src ?? null) : null;
  const theirsPhoto = reply ? (reply.theirsPhoto ?? (!ask?.carried && sentPhoto)) : false;
  const theirsAt = reply ? (reply.theirsAt ?? (!ask?.carried ? ask?.sentAt : null) ?? null) : null;
  // The sent clip shows once: as what the reply answers when it is this ask's own.
  const showSent = !!ask?.src && !(reply && !ask.carried);
  const title = done
    ? `Sent to ${coachName}`
    : file
      ? isPhoto(file) ? "Your photo" : "Your video"
      : reply
        ? `${coachName} replied`
        : ask?.src
          ? sentPhoto ? "Your photo" : "Your video"
          : asked
            ? `Video for ${coachName}`
            : about === "swap" || ask?.about === "swap"
              ? "A picture of what you used"
              : "Photo or video";
  const addWords = ask?.src || reply ? (asked ? "Send a new video" : "Send another") : asked ? "Record a video" : "Add a photo or video";

  return createPortal(
    <div className="vr-sheet-scrim vas-scrim" role="presentation" onClick={() => !sending && onClose()}>
      <div className="vr-sheet vas" role="dialog" aria-modal="true" aria-labelledby="vas-title" onClick={(e) => e.stopPropagation()}>
        <div className="vas-head">
          <div className="vas-head-text">
            <h2 id="vas-title" className="vas-title">{title}</h2>
            <span className="vas-sub">{exerciseName}</span>
          </div>
          <button type="button" className="vas-x" onClick={onClose} disabled={sending} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {done ? (
          <span className="vas-done" aria-hidden="true">
            <DoneCheck size={36} />
          </span>
        ) : file && preview ? (
          <>
            {isPhoto(file) ? <img className="vas-media" src={preview} alt="" /> : <video className="vas-media" src={firstFrame(preview)} controls playsInline muted preload="metadata" />}
            {!asked && (
              <input
                className="vas-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={`Note for ${coachName}`}
                aria-label={`Note for ${coachName}`}
                maxLength={300}
                enterKeyHint="done"
              />
            )}
            {problem && <p className="vas-problem">{problem}</p>}
            <div className="vas-foot">
              <button type="button" className="vas-text" onClick={() => field.current?.click()} disabled={sending}>
                Choose another
              </button>
              <button type="button" className="vas-pill" onClick={send} disabled={!!problem || sending}>
                {sending ? "Sending" : `Send to ${coachName}`}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* The coach's reply first: it is what is new. */}
            {reply && <VideoReplyBody reply={reply} coachName={coachName} />}
            {reply && theirs && (
              <div className="vas-theirs">
                <span className="vas-label">What it replies to</span>
                <button type="button" className={`vas-theirs-row${theirsOpen ? " open" : ""}`} onClick={() => setTheirsOpen((o) => !o)} aria-expanded={theirsOpen}>
                  <span className="vas-thumb" aria-hidden="true">
                    {theirsPhoto ? <img src={theirs} alt="" /> : <video src={firstFrame(theirs)} muted playsInline preload="metadata" />}
                  </span>
                  <span className="vas-theirs-words">
                    <Bars parts={[theirsPhoto ? "Your photo" : "Your video", theirsAt ? dayWords(new Date(theirsAt), { weekday: "short" }) : null, reply.where || null]} />
                  </span>
                  <span className="vas-chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </button>
                {theirsOpen && (theirsPhoto ? <img className="vas-media" src={theirs} alt="" /> : <video className="vas-media" src={firstFrame(theirs)} controls autoPlay playsInline preload="metadata" />)}
              </div>
            )}

            {ask?.note && !ask.fromClient && (
              <div className="vas-asked">
                <span className="vas-label">{coachName} asked</span>
                <p>“{ask.note}”</p>
              </div>
            )}

            {showSent && ask?.src && (
              <>
                {sentPhoto ? <img className="vas-media" src={ask.src} alt="" /> : <video className="vas-media" src={firstFrame(ask.src)} controls playsInline preload="metadata" />}
                {ask.clientNote && <p className="vas-fact">“{ask.clientNote}”</p>}
                {ask.sentAt && <p className="vas-fact">Sent {dayWords(new Date(ask.sentAt), { weekday: "short" })}</p>}
              </>
            )}
            {/* The limit alone, and nothing with no ask (3 Nov, Alex: the words audit). */}
            {!ask?.src && asked && <p className="vas-fact">Up to 2 min</p>}
            {problem && <p className="vas-problem">{problem}</p>}
            {/* The one ink pill while nothing is picked; once something is sent or answered it is the white one. */}
            <button type="button" className={ask?.src || reply ? "vas-pill white" : "vas-pill"} onClick={() => field.current?.click()}>
              {addWords}
            </button>
          </>
        )}
        <input
          ref={field}
          type="file"
          hidden
          accept={asked ? "video/*" : "image/*,video/*"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>,
    document.body
  );
}

/** Whether an exercise shows its photo or video row (the workout's rule): a coach's ask with or without a note, on a
 *  swap only when it is about the swap, and one the client started only once something is in it. A finished session
 *  shows only what was sent in it and the reply to that, never a reply carried from an earlier session (`finished`).
 *  A reply carried from an earlier session shows on a later workout only while it is still unseen (12 Nov, Alex: a
 *  month-old reply lit the video mark with nothing new in it). */
export function askShown(ask: VideoAsk | null | undefined, swapped: boolean, finished = false): ask is VideoAsk {
  return !!ask && !(ask.carried && (finished || !!ask.reply?.seen)) && (!swapped || ask.about === "swap") && (!ask.fromClient || !!ask.note || !!ask.src || !!ask.reply);
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
        <b>{ask.reply ? (ask.carried ? `${coachName} replied to your ${ask.reply.theirsPhoto ? "photo" : "video"}${ask.reply.theirsAt ? ` of ${dayWords(new Date(ask.reply.theirsAt))}` : ""}` :`${coachName} replied to your ${ask.media === "photo" ? "photo" : "video"}`) : ask.src ? (ask.media === "photo" ? "Photo sent" : "Video sent") : `${coachName} asked for a video`}</b>
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
