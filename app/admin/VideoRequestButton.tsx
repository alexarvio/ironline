"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { markVideoSeenAction, removeVideoReplyAction, removeVideoRequestAction, requestExerciseVideoAction, sendVideoReplyAction } from "../lib/actions";
import { TRACK_PALETTE } from "./phaseChrome";

// Asking the client for a video of one exercise in one session, watching
// what they send, and replying to it: a comment, a video (often a screen
// recording of theirs, drawn over and talked through), or both. Opened from
// the exercise row's ⋯ (ExerciseRowMenu). One dialog, in the phase dialog's
// look, for all of it.
export type VideoRequestView = {
  id: number;
  note: string | null;
  /** The video, once the client has sent it. */
  src: string | null;
  sentAt: string | null;
  /** The coach has watched it. */
  seen: boolean;
  /** The coach's reply, once sent. */
  replyNote?: string | null;
  replySrc?: string | null;
  repliedAt?: string | null;
  /** The client has opened the reply. */
  replySeen?: boolean;
};

const MAX_REPLY_BYTES = 500 * 1024 * 1024;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;

// A reply video goes as the raw file to its own route (/api/video-reply),
// which writes it to the disk as it arrives: it can be hundreds of MB, more
// than a server action takes. XHR rather than fetch, for the progress bar.
function uploadReplyVideo(id: number, file: File, onProgress: (share: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/video-reply/${id}`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
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
    xhr.send(file);
  });
}

export function VideoRequestDialog({
  assignmentId,
  exerciseName,
  where,
  request,
  onClose,
}: {
  assignmentId: number;
  exerciseName: string;
  where: string;
  request: VideoRequestView | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState(request?.note ?? "");
  const [busy, run] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const sent = !!request?.src;
  const replied = !!request?.repliedAt;
  // The reply being written (or rewritten).
  const [writing, setWriting] = useState(!replied);
  const [replyNote, setReplyNote] = useState(request?.replyNote ?? "");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploading = progress != null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !uploading && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, uploading]);
  // Opening a new video is watching it: the row's dot goes.
  useEffect(() => {
    if (request?.src && !request.seen) void markVideoSeenAction(request.id);
  }, [request]);

  const palette = TRACK_PALETTE.training;
  const chip = !request
    ? null
    : replied
      ? { text: "Replied", bg: "#e6ecf3", ink: "#1e3a6e" }
      : sent
        ? { text: `Sent ${when(request.sentAt!)}`, bg: "#e3f1e8", ink: "#1f6b43" }
        : { text: "Waiting", bg: "#fdf3e1", ink: "#8a5a12" };
  const ask = () =>
    run(async () => {
      await requestExerciseVideoAction(assignmentId, note);
      onClose();
    });
  const remove = () =>
    run(async () => {
      await removeVideoRequestAction(request!.id);
      onClose();
    });
  const canReply = !!replyNote.trim() || !!replyFile || !!request?.replySrc;
  const sendReply = () =>
    run(async () => {
      setError(null);
      if (replyFile) {
        if (replyFile.size > MAX_REPLY_BYTES) {
          setError(`That video is ${mb(replyFile.size)}; the limit is 500 MB. Export it at 1080p, or trim it.`);
          return;
        }
        setProgress(0);
        const failed = await uploadReplyVideo(request!.id, replyFile, setProgress);
        setProgress(null);
        if (failed) {
          setError(failed);
          return;
        }
      }
      const ok = await sendVideoReplyAction(request!.id, replyNote);
      if (!ok) {
        setError("Write a comment or add a video first.");
        return;
      }
      onClose();
    });
  const takeBackReply = () =>
    run(async () => {
      await removeVideoReplyAction(request!.id);
      onClose();
    });

  return createPortal(
    <div
      className="pl-dlg-scrim"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !uploading && onClose()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pl-dlg vr-dlg" role="dialog" aria-modal="true" aria-label={`Video of ${exerciseName}`}>
        <header className="pl-dlg-head">
          <h2>{sent ? "Their video" : request ? "Video asked for" : "Ask for a video"}</h2>
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            Training
          </span>
          {chip && (
            <span className="pl-dlg-state" style={{ background: chip.bg, color: chip.ink }}>
              {chip.text}
            </span>
          )}
        </header>

        <div className="pl-dlg-body">
          <div className="pl-dlg-field">
            <span className="pl-dlg-label">Of</span>
            <b className="vr-of">
              {exerciseName}
              <small>{where}</small>
            </b>
          </div>

          {sent ? (
            <>
              <video className="vr-player" src={request!.src!} controls playsInline preload="metadata" />
              {request!.note && (
                <div className="pl-dlg-field">
                  <span className="pl-dlg-label">You asked</span>
                  <p className="vr-asked">{request!.note}</p>
                </div>
              )}

              {/* The reply: a comment, a video (a screen recording drawn over
                  theirs works), or both. The client is notified, and the
                  notification opens it. */}
              <div className="vr-reply-box">
                <div className="vr-reply-head">
                  <span className="pl-dlg-label">Your reply</span>
                  {replied && !writing && (
                    <small className="dv-hint">
                      Sent {when(request!.repliedAt!)} · {request!.replySeen ? "watched" : "not opened yet"}
                    </small>
                  )}
                </div>
                {replied && !writing ? (
                  <>
                    {request!.replySrc && <video className="vr-player" src={request!.replySrc} controls playsInline preload="metadata" />}
                    {request!.replyNote && <p className="vr-asked">{request!.replyNote}</p>}
                  </>
                ) : (
                  <>
                    <textarea
                      className="pl-dlg-input vr-note"
                      rows={3}
                      maxLength={2000}
                      value={replyNote}
                      onChange={(e) => setReplyNote(e.target.value)}
                      placeholder="What you see, and what to change."
                      disabled={busy}
                    />
                    <label className={`dv-file${replyFile ? " chosen" : ""}`}>
                      <input
                        type="file"
                        accept="video/*"
                        disabled={busy}
                        onChange={(e) => {
                          setReplyFile(e.target.files?.[0] ?? null);
                          setError(null);
                        }}
                      />
                      <span>
                        {replyFile
                          ? `${replyFile.name} · ${mb(replyFile.size)}`
                          : request!.replySrc
                            ? "Replace your video (optional)"
                            : "Add a video, e.g. a screen recording (optional)"}
                      </span>
                    </label>
                    {uploading && (
                      <div className="vr-progress" role="progressbar" aria-valuenow={Math.round(progress! * 100)} aria-valuemin={0} aria-valuemax={100}>
                        <i style={{ width: `${Math.round(progress! * 100)}%` }} />
                        <span>Uploading {Math.round(progress! * 100)}%… keep this open</span>
                      </div>
                    )}
                    <small className="dv-hint">Up to 500 MB. The client gets a notification that opens it.</small>
                  </>
                )}
                {error && <p className="pl-move-note warn">{error}</p>}
              </div>
            </>
          ) : (
            <label className="pl-dlg-field">
              <span className="pl-dlg-label">What should they film? (optional)</span>
              <textarea
                className="pl-dlg-input vr-note"
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. From the side, your top set"
                autoFocus
              />
              <small className="dv-hint">
                {request
                  ? "They see this on the exercise in their app, with a camera to film or upload it."
                  : "It shows on this exercise in this session of their app, with a camera to film or upload it. Up to two minutes."}
              </small>
            </label>
          )}
        </div>

        <footer className="pl-dlg-foot">
          {confirmRemove ? (
            <div className="pl-dlg-ask" role="alert">
              <span>
                <strong>{sent ? "Remove their video?" : "Take the request back?"}</strong>
                {sent ? " The video is deleted, with your reply, and the request goes with it." : " It disappears from their app."}
              </span>
              <div className="pl-dlg-actions">
                <button type="button" className="pl-dlg-cancel" onClick={() => setConfirmRemove(false)} disabled={busy}>
                  Back
                </button>
                <button type="button" className="pl-dlg-danger" onClick={remove} disabled={busy}>
                  {sent ? "Yes, remove" : "Yes, take it back"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {request && (
                <button type="button" className="pl-text-btn danger" onClick={() => setConfirmRemove(true)} disabled={busy}>
                  {sent ? "Remove video" : "Take back"}
                </button>
              )}
              {sent && replied && !writing && (
                <button type="button" className="pl-text-btn" onClick={takeBackReply} disabled={busy}>
                  Take back reply
                </button>
              )}
              <div className="pl-dlg-actions">
                <button type="button" className="pl-dlg-cancel" onClick={onClose} disabled={uploading}>
                  {sent ? "Close" : "Cancel"}
                </button>
                {!sent ? (
                  <button type="button" className="pl-dlg-save" onClick={ask} disabled={busy}>
                    {busy ? "Saving…" : request ? "Save" : "Ask for it"}
                  </button>
                ) : replied && !writing ? (
                  <button type="button" className="pl-dlg-save" onClick={() => setWriting(true)} disabled={busy}>
                    Edit reply
                  </button>
                ) : (
                  <button type="button" className="pl-dlg-save" onClick={sendReply} disabled={busy || !canReply}>
                    {uploading ? "Uploading…" : busy ? "Sending…" : replied ? "Send again" : "Send reply"}
                  </button>
                )}
              </div>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
    </svg>
  );
}
