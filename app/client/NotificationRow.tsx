"use client";

import { ReactNode, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import { useNavigateTab, useOpenMessages } from "./CheckInContext";

// Deliberately does NOT import from ../lib/queries — see HomeHub.tsx.
// Tapping a notification does two things: marks it read, and follows its
// action link if it has one. "chat" is the coach's message feed, not a
// bottom-nav tab, so those rows open the feed instead.
export default function NotificationRow({
  id,
  actionTab,
  actionRef,
  children,
}: {
  id: number;
  actionTab: string | null;
  actionRef: number | null;
  children: ReactNode;
}) {
  const navigate = useNavigateTab();
  const openMessages = useOpenMessages();
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="cn-notif-row"
      onClick={() => {
        startTransition(() => {
          markNotificationReadAction(id);
        });
        if (actionTab === "chat") openMessages?.();
        else if (actionTab) navigate?.(actionTab, actionRef ?? undefined);
      }}
    >
      {children}
    </button>
  );
}
