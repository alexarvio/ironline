"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { markVideoReplySeenAction } from "../lib/actions";

// The coach's reply to a video the client sent: their comment and their
// video (often a screen recording of the client's, drawn over), with the
// client's own clip under it. Opened from the notification ("Your coach
// replied to your video of Leg Press") and from the exercise's camera, so
// the client never has to find the exercise to see it.
export type VideoReplyView = {
  id: number;
  exerciseName: string;
  /** "Push Day" / "Session 2" */
  where: string;
  /** What the coach asked them to film. */
  asked: string | null;
  /** The client's own video. */
  theirs: string | null;
  replyNote: string | null;
  replySrc: string | null;
  repliedAt: string;
  seen: boolean;
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** The reply itself, for the sheet here and the exercise's own sheet. */
export function VideoReplyBody({ reply }: { reply: VideoReplyView }) {
  // Opening it is seeing it: the notification's and the camera's dots go.
  useEffect(() => {
    if (!reply.seen) void markVideoReplySeenAction(reply.id);
  }, [reply.id, reply.seen]);
  return (
    <div className="vr-reply">
      <span className="vr-reply-label">Your coach replied · {day(reply.repliedAt)}</span>
      {reply.replySrc && <video className="vr-sheet-video" src={reply.replySrc} controls playsInline preload="metadata" />}
      {reply.replyNote && <p className="vr-reply-note">{reply.replyNote}</p>}
    </div>
  );
}

export default function VideoReplySheet({ reply, onClose }: { reply: VideoReplyView; onClose: () => void }) {
  return createPortal(
    <div className="vr-sheet-scrim" role="presentation" onClick={onClose}>
      <div className="pp-app-sheet vr-sheet" role="dialog" aria-modal="true" aria-label={`Your coach's reply: ${reply.exerciseName}`} onClick={(e) => e.stopPropagation()}>
        <div className="pp-app-sheet-head">
          <span className="pp-app-sheet-title">{reply.exerciseName}</span>
          {reply.where && <span className="pp-app-sheet-sub">{reply.where}</span>}
        </div>
        {/* Only the coach's side: the client's own clip stays on the exercise it was filmed on. */}
        <VideoReplyBody reply={reply} />
        <button type="button" className="pp-app-sheet-cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
