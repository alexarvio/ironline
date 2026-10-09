"use client";

import { useState } from "react";
import VideoWhiteboard from "../training/VideoWhiteboard";

// The recorder in a dialog-sized card, over the sample clip. "Sent" only
// says so here.
export default function WhiteboardBoard() {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div className="rd-dlg wide wb-board">
      <h2 className="wb-board-title">Elena&rsquo;s video</h2>
      <p className="rd-dlg-hint">Hack Squat · Push, Week 1 · sent unasked</p>
      {sent != null ? (
        <p className="rd-dlg-para">
          <b>Sent.</b> {sent || "No note."} On a real request the file would be up and Elena notified.
        </p>
      ) : (
        <VideoWhiteboard src="/img/sample-lift.mp4" requestId={0} firstName="Elena" onSent={(note) => setSent(note)} />
      )}
    </div>
  );
}
