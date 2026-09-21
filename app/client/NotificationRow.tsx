"use client";

import { ReactNode, useState, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import { useNavigateTab, useOpenMessages } from "./CheckInContext";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";

// Deliberately does NOT import from ../lib/queries — see HomeHub.tsx.
// Tapping a notification does two things: marks it read, and follows its
// action link if it has one. "chat" is the coach's message feed, not a
// bottom-nav tab, so those rows open the feed instead.
export default function NotificationRow({
  id,
  actionTab,
  actionRef,
  videoReply = null,
  children,
}: {
  id: number;
  actionTab: string | null;
  actionRef: number | null;
  /** "Your coach replied to your video": the reply, opened right here. */
  videoReply?: VideoReplyView | null;
  children: ReactNode;
}) {
  const navigate = useNavigateTab();
  const openMessages = useOpenMessages();
  const [, startTransition] = useTransition();
  const [watching, setWatching] = useState(false);

  return (
    <>
      <button
        type="button"
        className="cn-notif-row"
        onClick={() => {
          startTransition(() => {
            markNotificationReadAction(id);
          });
          if (actionTab === "chat") openMessages?.();
          else if (actionTab === "video") setWatching(!!videoReply);
          else if (actionTab) navigate?.(actionTab, actionRef ?? undefined);
        }}
      >
        {children}
      </button>
      {watching && videoReply && <VideoReplySheet reply={videoReply} onClose={() => setWatching(false)} />}
    </>
  );
}
