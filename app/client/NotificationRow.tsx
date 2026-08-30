"use client";

import { ReactNode, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import { useNavigateTab } from "./CheckInContext";

// Deliberately does NOT import from ../lib/queries — see HomeHub.tsx.
// Tapping a notification does two things: marks it read, and follows its
// action link if it has one. "chat" isn't a bottom-nav tab (it's the view
// this row already sits in), so those rows just mark read.
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
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="cn-notif-row"
      onClick={() => {
        startTransition(() => {
          markNotificationReadAction(id);
        });
        if (actionTab && actionTab !== "chat") navigate?.(actionTab, actionRef ?? undefined);
      }}
    >
      {children}
    </button>
  );
}
