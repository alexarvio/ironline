"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { markVideoSeenAction, replyToMediaAction, sendChatMessageAction, sendFormReviewAction } from "../lib/actions";
import { COLORS, sameOrigin, upload } from "../admin/redesign/media-review/MediaReviewModal";
import { pathOf, simplify, STROKE, UNDERLAY, UNDERLAY_COLOR, unitFor, worthKeeping, type Pt, type Shape, type Tool } from "../admin/redesign/media-review/shapes";
import { recordingSupported, useReviewRecorder } from "../admin/redesign/media-review/useReviewRecorder";
import type { PhoneReview as Review } from "../lib/coachPhone";
import { dayMonth } from "../lib/dayMonth";
import { useKeyboardInset } from "../client/useKeyboardInset";
import { coachReviewAction } from "./actions";
import { Facts, Icon, Sheet, type IconName } from "./parts";

// A client's exercise video (or photo) on the coach's phone (21 Oct): the
// laptop's review, laid out for a phone. It opens on the recorder, as the
// laptop's does: draw over the clip with a finger (pen, arrow, circle, a
// colour, undo) and talk; Record review, Stop, watch it back, Send. The
// recording is made by the same recorder (useReviewRecorder), goes up the
// same way (/api/video-reply) and lands where the laptop's does: on the
// exercise, carried to the next session, and in the client's chat. Or a few
// words instead, on the line under it.

const TOOLS: { id: Tool; icon: IconName; name: string }[] = [
  { id: "pen", icon: "pen", name: "Pen" },
  { id: "arrow", icon: "arrow", name: "Arrow" },
  { id: "circle", icon: "circle", name: "Circle" },
];
// The phone's palette: the laptop's colours a thumb needs.
const PALETTE = ["#FFD60A", "#FF9F0A", "#FF453A", "#30D158", "#0A84FF", "#BF5AF2", "#FFFFFF", "#000000"].map((id) => COLORS.find((c) => c.id === id) ?? { id, name: id });
const RATES = [1, 0.5, 0.25];
const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** A review of a chat video or photo: the raw file to /api/chat-review, which posts it in the chat as a reply. */
function uploadChatReview(clientId: number, replyTo: number, note: string, blob: Blob, onProgress: (share: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/chat-review/${clientId}?replyTo=${replyTo}&note=${encodeURIComponent(note)}`);
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

/** Where a review from the chat goes back to: the client's message it answers (25 Oct, Alex). */
type ChatTarget = { clientId: number; replyTo: number };

/**
 * A video or photo a client sent in the chat, reviewed on the same screen as an exercise's (25 Oct, Alex: "if I review,
 * then it goes to that screen where I have the toolbar and I can record… as a whiteboard"): draw, talk, Send. The
 * recording, or a few words, lands in the chat as a reply to it.
 */
export function ChatReview({ clientId, messageId, first, name, media, words, when, onBack, onSent }: { clientId: number; messageId: number; first: string; name: string; media: { kind: "video" | "photo"; url: string }; words: string; when: string; onBack: () => void; onSent: () => void }) {
  const review: Review = {
    requestId: 0,
    unseen: false,
    client: { firstName: first, name, avatarPath: null },
    exercise: { name: media.kind === "video" ? "Video" : "Photo", session: when, week: 0, day: 0 },
    requested: false,
    media: [media],
    sentAt: null,
    sets: [],
    clientMessage: words ? { text: words, at: null } : null,
    thread: [],
    askNote: null,
    repliedAt: null,
    clientId,
  };
  return <Reviewer review={review} chat={{ clientId, replyTo: messageId }} onBack={onBack} onSent={onSent} />;
}

export default function PhoneReview({ requestId, onBack, onSent }: { requestId: number; onBack: () => void; onSent: () => void }) {
  // undefined while it loads, null when it is gone.
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    coachReviewAction(requestId)
      .then((r) => live && setReview(r))
      .catch(() => live && setReview(null));
    return () => {
      live = false;
    };
  }, [requestId]);
  // Seen, once opened: it stops being new on the laptop too.
  const unseen = review?.unseen ?? false;
  useEffect(() => {
    if (unseen) void markVideoSeenAction(requestId).catch(() => {});
  }, [unseen, requestId]);

  if (review === undefined || review === null) {
    return (
      <section className="cph-review" aria-label="Video">
        <div className="cph-stage">
          <button type="button" className="cph-stage-btn back" onClick={onBack} aria-label="Back to the videos">
            <Icon name="back" size={22} />
          </button>
          {review === null && <p className="cph-stage-empty">Gone</p>}
        </div>
      </section>
    );
  }
  return <Reviewer review={review} onBack={onBack} onSent={onSent} />;
}

function Reviewer({ review, chat = null, onBack, onSent }: { review: Review; chat?: ChatTarget | null; onBack: () => void; onSent: () => void }) {
  const first = review.client.firstName;
  const item = review.media[0];
  const canRecord = useMemo(() => recordingSupported(), []);
  const past = review.thread.find((x) => x.kind === "review") ?? null;
  const pastText = review.thread.find((x) => x.kind === "text") ?? null;
  // A sent review playing on the stage in place of the client's clip.
  const [stageReview, setStageReview] = useState<string | null>(null);

  // ---- The stage: the frame fits the room under the status bar and over the playback bar at the media's own shape (CSS, container units).
  const [natural, setNatural] = useState({ w: 1080, h: 1920 });
  const isVideo = item.kind === "video";
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
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };
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
  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    const v = videoOf();
    if (v) v.playbackRate = next;
  };

  // ---- Drawing, with a finger: a touch on the picture pauses it.
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(PALETTE[0].id);
  const [palette, setPalette] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);
  const liveRef = useRef<Shape | null>(null);
  const [liveShape, setLiveShape] = useState<Shape | null>(null);
  const redraw = () => setLiveShape(liveRef.current ? { ...liveRef.current, pts: [...liveRef.current.pts] } : null);
  const [drawn, setDrawn] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const toMedia = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * natural.w, ((e.clientY - r.top) / r.height) * natural.h];
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    setPalette(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = videoOf();
    if (v && !v.paused) v.pause();
    const p = toMedia(e);
    liveRef.current = { tool, color, size: 1, pts: [p, p] };
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

  // ---- The recorder: the clip, the drawing and the coach's voice, one video. No camera bubble on the phone.
  const [micOn, setMicOnState] = useState(true);
  const recorder = useReviewRecorder({
    media: () => mediaEl.current,
    size: () => natural,
    shapes: () => (liveRef.current ? [...shapesRef.current, liveRef.current] : shapesRef.current),
    unit: () => unit,
    camera: () => null,
    bubble: () => ({ corner: "br", share: 0, inset: 0 }),
  });
  const setMicOn = (on: boolean) => {
    setMicOnState(on);
    recorder.setMicOn(on);
  };
  const startRecording = () => {
    setStageReview(null);
    setDrawn(shapes.length);
    void recorder.start({ mic: micOn });
  };
  const rec = recorder.state;
  const recording = rec === "recording" || rec === "paused";

  // ---- Sending: the recording with an optional note, or words alone.
  const [note, setNote] = useState("");
  const [words, setWords] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendReview = async () => {
    const blob = recorder.blob;
    if (!blob || progress != null) return;
    setError(null);
    setProgress(0);
    if (chat) {
      // From the chat: the recording and the note go back into it, as one message answering theirs.
      const err = await uploadChatReview(chat.clientId, chat.replyTo, note.trim(), blob, setProgress);
      setProgress(null);
      if (err) return setError(err);
      recorder.retake();
      onSent();
      onBack();
      return;
    }
    const err = await upload(review.requestId, blob, setProgress);
    if (err) {
      setProgress(null);
      return setError(err);
    }
    const ok = await sendFormReviewAction(review.requestId, note.trim(), { durationMs: recorder.secs * 1000, annotations: drawn }).catch(() => false);
    setProgress(null);
    if (!ok) return setError("The review is up, but the reply did not save. Try Send again.");
    recorder.retake();
    onSent();
    onBack();
  };
  const sendWords = async () => {
    const clean = words.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    const ok = chat
      ? await (async () => {
          const fd = new FormData();
          fd.set("clientId", String(chat.clientId));
          fd.set("text", clean);
          fd.set("replyTo", String(chat.replyTo));
          fd.set("quiet", "1");
          return sendChatMessageAction(fd).then(() => true, () => false);
        })()
      : await replyToMediaAction(review.requestId, clean).catch(() => false);
    setBusy(false);
    if (!ok) return setError("Not sent. Check the connection and try again.");
    onSent();
    onBack();
  };

  // ---- Leaving: a recording in hand is never thrown away without asking.
  const [confirm, setConfirm] = useState(false);
  const leave = () => (rec !== "ready" ? setConfirm(true) : onBack());

  // The page held still while reviewing (25 Oct, Alex: drawing with a finger moved the whole screen): nothing behind
  // scrolls or bounces, and a finger on the picture only draws (iOS scrolls on a touch unless the touch is stopped).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("cph-locked");
    return () => root.classList.remove("cph-locked");
  }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      if (el.classList.contains("on")) e.preventDefault();
    };
    el.addEventListener("touchstart", hold, { passive: false });
    el.addEventListener("touchmove", hold, { passive: false });
    return () => {
      el.removeEventListener("touchstart", hold);
      el.removeEventListener("touchmove", hold);
    };
  });

  const kb = useKeyboardInset();
  const all = liveShape ? [...shapes, liveShape] : shapes;
  const showing = rec === "done" && recorder.preview ? { kind: "video" as const, url: recorder.preview, own: true } : stageReview ? { kind: "video" as const, url: stageReview, own: true } : { ...item, own: false };
  const canDraw = rec !== "done" && !stageReview;

  return (
    <section className="cph-review" style={{ bottom: kb }} aria-label={`${first}, ${review.exercise.name}`}>
      <div className="cph-stage">
        <div className={`cph-stage-room${isVideo && !showing.own ? " with-bar" : ""}`}>
        {showing.own ? (
          // The recording just made (or a review already sent), to watch back.
          <video key={showing.url} className="cph-stage-own" src={showing.url} controls playsInline autoPlay={rec === "done"} />
        ) : (
          <div className="cph-frame" style={{ "--r": natural.w / natural.h } as React.CSSProperties}>
            {isVideo ? (
              <video
                ref={(el) => {
                  mediaEl.current = el;
                }}
                src={sameOrigin(item.url)}
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) setNatural({ w: v.videoWidth, h: v.videoHeight });
                  setDur(v.duration || 0);
                  v.playbackRate = rate;
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
              <img
                ref={(el) => {
                  mediaEl.current = el;
                }}
                src={sameOrigin(item.url)}
                alt={`${first}'s photo`}
                onLoad={(e) => {
                  const im = e.currentTarget;
                  if (im.naturalWidth && im.naturalHeight) setNatural({ w: im.naturalWidth, h: im.naturalHeight });
                }}
              />
            )}
            <svg ref={svgRef} className={`cph-draw${canDraw ? " on" : ""}`} viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="none" aria-hidden="true" onPointerDown={canDraw ? down : undefined} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
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
          </div>
        )}
        </div>

        <button type="button" className="cph-stage-btn back" onClick={stageReview ? () => setStageReview(null) : leave} aria-label={stageReview ? "Back to the clip" : "Back to the videos"}>
          <Icon name="back" size={22} />
        </button>
        {recording && (
          <span className={`cph-rec${rec === "paused" ? " paused" : ""}`} aria-live="polite">
            <i aria-hidden="true" />
            {rec === "paused" ? "Paused" : "Rec"} {clock(recorder.secs)}
          </span>
        )}

        {canDraw && (
          <div className="cph-tools" role="toolbar" aria-label="Drawing">
            {TOOLS.map((x) => (
              <button key={x.id} type="button" className={`cph-tool${tool === x.id ? " on" : ""}`} aria-pressed={tool === x.id} aria-label={x.name} onClick={() => setTool(x.id)}>
                <Icon name={x.icon} size={18} />
              </button>
            ))}
            <button type="button" className="cph-tool" aria-expanded={palette} aria-label="Colour" onClick={() => setPalette((o) => !o)}>
              <span className="cph-swatch" style={{ background: color }} />
            </button>
            <button type="button" className="cph-tool" disabled={!shapes.length} aria-label="Undo" onClick={() => setShapes((list) => list.slice(0, -1))}>
              <Icon name="undo" size={18} />
            </button>
            {palette && (
              <span className="cph-palette" role="listbox" aria-label="Colours">
                {PALETTE.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={color === c.id}
                    aria-label={c.name}
                    className={color === c.id ? "on" : ""}
                    style={{ background: c.id }}
                    onClick={() => {
                      setColor(c.id);
                      setPalette(false);
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        )}

        {isVideo && !showing.own && (
          <div className="cph-play">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <div
              ref={scrubRef}
              className="cph-scrub"
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
            >
              <span>
                <i style={{ width: `${dur ? (t / dur) * 100 : 0}%` }} />
              </span>
            </div>
            <span className="cph-play-time">
              {clock(t)} / {clock(dur)}
            </span>
            <button type="button" className="cph-rate" onClick={cycleRate} aria-label={`Speed ${rate}×`}>
              {rate === 1 ? "1×" : rate === 0.5 ? "½×" : "¼×"}
            </button>
          </div>
        )}
      </div>

      <div className="cph-review-body">
        <h1>{review.exercise.name}</h1>
        <p className="cph-review-facts">
          <Facts parts={[first, review.exercise.session, review.exercise.week ? `Week ${review.exercise.week}` : null]} />
        </p>
        {review.sets.length > 0 && (
          <p className="cph-review-sets">
            <Facts parts={review.sets.map((s) => s.label)} />
          </p>
        )}
        {review.askNote && <p className="cph-review-ask">{review.askNote}</p>}
        {review.clientMessage && <p className="cph-review-said">&ldquo;{review.clientMessage.text}&rdquo;</p>}
        {review.repliedAt != null && rec === "ready" && (
          <p className="cph-review-replied">
            {past ? (
              <button type="button" className="cph-text-btn" onClick={() => setStageReview(past.kind === "review" ? past.url : null)}>
                <Icon name="play" small />
                <Facts parts={["Your form review", past.kind === "review" && past.durationMs ? clock(past.durationMs / 1000) : null, dayMonth(new Date(review.repliedAt))]} />
              </button>
            ) : (
              <>
                <Facts parts={["You replied", dayMonth(new Date(review.repliedAt))]} />
                {pastText?.kind === "text" && <span className="cph-review-said">&ldquo;{pastText.text}&rdquo;</span>}
              </>
            )}
          </p>
        )}
      </div>

      <footer className="cph-review-foot">
        {error && (
          <p className="cph-error" role="alert">
            {error}
          </p>
        )}
        {recorder.problem && <p className="cph-error">{recorder.problem}</p>}
        {rec === "ready" && (
          <>
            {canRecord && !words.trim() && (
              <button type="button" className="cph-pill ink" onClick={startRecording}>
                <i className="cph-recdot" aria-hidden="true" />
                Record review
              </button>
            )}
            <div className="cph-note-row">
              <textarea className="cph-note" rows={1} value={words} placeholder={canRecord ? `Or write to ${first}…` : `Write to ${first}…`} aria-label={`Reply to ${first}`} onChange={(e) => setWords(e.target.value)} />
              {words.trim() && (
                <>
                  <button type="button" className="cph-text-btn" onClick={() => setWords("")}>
                    Cancel
                  </button>
                  <button type="button" className="cph-pill ink small" disabled={busy} onClick={() => void sendWords()}>
                    {busy ? "Sending…" : "Send"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {recording && (
          <div className="cph-rec-row">
            <button type="button" className={`cph-round${micOn ? " ink" : ""}`} onClick={() => setMicOn(!micOn)} aria-pressed={micOn} aria-label={micOn ? "Mute the mic" : "Turn the mic on"}>
              <Icon name={micOn ? "mic" : "micoff"} />
            </button>
            <button type="button" className="cph-stop" onClick={recorder.stop} aria-label="Stop recording">
              <i />
            </button>
            <button type="button" className="cph-round" onClick={rec === "paused" ? recorder.resume : recorder.pause} aria-label={rec === "paused" ? "Go on recording" : "Pause recording"}>
              <Icon name={rec === "paused" ? "play" : "pause"} />
            </button>
          </div>
        )}
        {rec === "done" && (
          <>
            {recorder.micDenied && <p className="cph-note-line">No mic: the review has no voice.</p>}
            <textarea className="cph-note" rows={1} value={note} placeholder="Add a note" aria-label="A note with the review" onChange={(e) => setNote(e.target.value)} />
            <div className="cph-done-row">
              <button
                type="button"
                className="cph-text-btn"
                disabled={progress != null}
                onClick={() => {
                  recorder.retake();
                  setNote("");
                }}
              >
                Record again
              </button>
              <button type="button" className="cph-pill ink small" disabled={progress != null} onClick={() => void sendReview()}>
                {progress != null ? `Sending ${Math.round(progress * 100)}%` : "Send"}
              </button>
            </div>
          </>
        )}
      </footer>

      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label="Discard the review">
          <div className="cph-confirm">
            <h2>Discard this review?</h2>
            <div className="cph-confirm-row">
              <button type="button" className="cph-text-btn" onClick={() => setConfirm(false)}>
                Keep
              </button>
              <button
                type="button"
                className="cph-text-btn danger"
                onClick={() => {
                  recorder.retake();
                  setConfirm(false);
                  onBack();
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}
