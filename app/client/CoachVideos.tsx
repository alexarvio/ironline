"use client";

import { useState } from "react";
import { ChevronDownIcon } from "../components/icons";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";

// Every video reply the coach has sent in the programme the client is on, in
// one place on Training: a reply is otherwise reached from its notification
// or from the exercise it was filmed on. The same blue fold as Saved days in
// the food diary; open, it is one line a reply, so five of them stay five
// lines, and a tap opens that one in the usual sheet: two taps from the
// session to the video. There is nothing to answer here: a reply is the
// coach's last word on that video.

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Nothing until the coach has replied to a video in this programme. */
export default function CoachVideos({ coachName, videos }: { coachName: string; videos: VideoReplyView[] }) {
  const [open, setOpen] = useState(false);
  const [shownId, setShownId] = useState<number | null>(null);
  if (videos.length === 0) return null;
  const shown = videos.find((v) => v.id === shownId) ?? null;
  const unseen = videos.filter((v) => !v.seen).length;
  return (
    <section className="fdi-copy cv">
      <button
        type="button"
        className="fdi-copy-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <PlayGlyph />
        <span className="fdi-copy-title">Videos from {coachName}</span>
        <span className="cv-count">{unseen ? `${unseen} new` : videos.length}</span>
        <span className={`fdi-copy-chev${open ? " up" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div className={`fdi-fold${open ? "" : " folding"}`}>
        <div className="fdi-fold-inner">
          {videos.map((v) => (
            <button key={v.id} type="button" className={`cv-item${v.seen ? "" : " new"}`} onClick={() => setShownId(v.id)} tabIndex={open ? 0 : -1}>
              <span className="cv-item-dot" aria-hidden="true" />
              <span className="cv-item-main">
                <b>{v.exerciseName}</b>
                {v.where && <small>{v.where}</small>}
              </span>
              <span className="cv-item-when">{day(v.repliedAt)}</span>
            </button>
          ))}
        </div>
      </div>
      {shown && <VideoReplySheet reply={shown} onClose={() => setShownId(null)} />}
    </section>
  );
}

function PlayGlyph() {
  return (
    <svg className="cv-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.5-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}
