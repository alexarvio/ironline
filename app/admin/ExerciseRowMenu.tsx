"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatIcon, MoreIcon, TrashIcon } from "../components/icons";
import { placePopover, type Placement } from "../components/popover";
import { usePendingDay } from "../components/DayPending";
import { MessageAboutDialog, useMessageWho, type AboutTarget } from "./MessageAbout";
import { VideoIcon, VideoRequestDialog, type VideoRequestView } from "./VideoRequestButton";

const WIDTH = 236;

// What an exercise's row can do, behind ⋯ at its end: ask for a video of it
// (or watch the one sent), message the client about it, remove it. They were
// three icons side by side, which took room from "What the client did" on
// every row. A new video puts a dot on the ⋯ so it is not missed.
//
// Fixed and portalled like the session's ⋯ (SessionMenu): the builder sits
// inside .ad-main, which scrolls and would clip it.
export default function ExerciseRowMenu({
  assignmentId,
  exerciseName,
  video,
  message,
}: {
  assignmentId: number;
  exerciseName: string;
  /** Asking for a video; null where the client can't be asked (a draft). */
  video: { where: string; request: VideoRequestView | null } | null;
  /** Messaging about it; null where the client can't open it yet. */
  message: AboutTarget | null;
}) {
  const pending = usePendingDay();
  const who = useMessageWho();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"video" | "message" | null>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A click elsewhere, Escape or a scroll closes it, as with the session's.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const req = video?.request ?? null;
  const videoState = !req ? "none" : req.src ? "sent" : "asked";
  const newVideo = videoState === "sent" && !req!.seen;
  const pick = (which: "video" | "message") => {
    setOpen(false);
    setDialog(which);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`row-icon-btn pb-row-more${open ? " on" : ""}${newVideo ? " new" : ""}${videoState === "asked" ? " waiting" : ""}`}
        aria-label={`More for ${exerciseName}${newVideo ? ": a new video" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={newVideo ? "Their video is in" : videoState === "asked" ? "Video asked for · waiting" : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) setPos(placePopover(btn.current, { width: WIDTH, align: "right", maxHeight: 180, minHeight: 80 }));
          setOpen((o) => !o);
        }}
      >
        <MoreIcon />
      </button>

      {open &&
        createPortal(
          <div ref={panel} className="pb-session-menu" role="menu" aria-label={exerciseName} style={{ ...(pos ?? {}), width: WIDTH }}>
            {video && (
              <button type="button" role="menuitem" onClick={() => pick("video")}>
                <VideoIcon />
                {videoState === "none" ? "Ask for a video" : videoState === "asked" ? "Video asked for · waiting" : req!.repliedAt ? "Their video · replied" : "Watch their video · reply"}
                {newVideo && <span className="pb-menu-new">New</span>}
              </button>
            )}
            {message && who && (
              <button type="button" role="menuitem" onClick={() => pick("message")}>
                <ChatIcon />
                Message {who.firstName} about it
              </button>
            )}
            {pending && (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setOpen(false);
                  // Queued on the bar with the other changes, as the bin was.
                  pending.remove(assignmentId);
                }}
              >
                <TrashIcon />
                Remove from session
              </button>
            )}
          </div>,
          document.body
        )}

      {dialog === "video" && video && (
        <VideoRequestDialog assignmentId={assignmentId} exerciseName={exerciseName} where={video.where} request={video.request} onClose={() => setDialog(null)} />
      )}
      {dialog === "message" && message && <MessageAboutDialog target={message} onClose={() => setDialog(null)} />}
    </>
  );
}
