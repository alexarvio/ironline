"use client";

import { useState } from "react";
import { ChatIcon, MoreIcon, TrashIcon } from "../components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { usePendingDay } from "../components/DayPending";
import { MessageAboutDialog, useMessageWho, type AboutTarget } from "./MessageAbout";
import { VideoIcon, VideoRequestDialog, type VideoRequestView } from "./VideoRequestButton";

// What an exercise's row can do, behind ⋯ at its end: ask for a video of it
// (or watch the one sent), message the client about it, remove it. They were
// three icons side by side, which took room from "What the client did" on
// every row. A new video puts a dot on the ⋯ so it is not missed.
//
// The menu is shadcn's Dropdown Menu (components/ui), like the session's.
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
  const [dialog, setDialog] = useState<"video" | "message" | null>(null);

  const req = video?.request ?? null;
  const videoState = !req ? "none" : req.src ? "sent" : "asked";
  const newVideo = videoState === "sent" && !req!.seen;

  return (
    <>
      {/* The row this sits on toggles and drags on its own clicks; the guard
          is a wrapper so Radix still gets the trigger's own pointer events. */}
      <span className="contents" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          className={`row-icon-btn pb-row-more${newVideo ? " new" : ""}${videoState === "asked" ? " waiting" : ""}`}
          aria-label={`More for ${exerciseName}${newVideo ? ": a new video" : ""}`}
          title={newVideo ? "Their video is in" : videoState === "asked" ? "Video asked for · waiting" : undefined}
        >
          <MoreIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="pb-menu" aria-label={exerciseName} onClick={(e) => e.stopPropagation()}>
          {video && (
            <DropdownMenuItem onSelect={() => setDialog("video")}>
              <VideoIcon />
              {videoState === "none" ? "Ask for a video" : videoState === "asked" ? "Video asked for · waiting" : req!.repliedAt ? "Their video · replied" : "Watch their video · reply"}
              {newVideo && <span className="pb-menu-new">New</span>}
            </DropdownMenuItem>
          )}
          {message && who && (
            <DropdownMenuItem onSelect={() => setDialog("message")}>
              <ChatIcon />
              Message {who.firstName} about it
            </DropdownMenuItem>
          )}
          {pending && (
            <>
              {(video || (message && who)) && <DropdownMenuSeparator />}
              {/* Queued on the bar with the other changes, as the bin was. */}
              <DropdownMenuItem variant="destructive" onSelect={() => pending.remove(assignmentId)}>
                <TrashIcon />
                Remove from session
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </span>

      {dialog === "video" && video && (
        <VideoRequestDialog assignmentId={assignmentId} exerciseName={exerciseName} where={video.where} request={video.request} onClose={() => setDialog(null)} />
      )}
      {dialog === "message" && message && <MessageAboutDialog target={message} onClose={() => setDialog(null)} />}
    </>
  );
}
