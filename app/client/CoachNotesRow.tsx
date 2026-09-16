"use client";

import { ChevronDownIcon } from "../components/icons";
import { useOpenMessages } from "./CheckInContext";

// The coach's messages sit apart from the other notifications: one row at
// the top of the list that opens their own feed, with how many are new.
export default function CoachNotesRow({ coachName, initial, photoPath, unread, total }: { coachName: string; initial: string; photoPath: string | null; unread: number; total: number }) {
  const openMessages = useOpenMessages();
  if (total === 0) return null;
  return (
    <button type="button" className={`cn-coach-row${unread > 0 ? " unread" : ""}`} onClick={() => openMessages?.()}>
      <span className="cn-coach-avatar" aria-hidden="true">
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
          <img src={photoPath} alt="" />
        ) : (
          initial
        )}
      </span>
      <span className="cn-coach-body">
        <span className="cn-coach-title">From {coachName}</span>
        <span className="cn-coach-sub">
          {unread > 0 ? `${unread} new message${unread === 1 ? "" : "s"}` : `${total} message${total === 1 ? "" : "s"} · nothing new`}
        </span>
      </span>
      {unread > 0 && <span className="cn-notif-dot" aria-hidden="true" />}
      <span className="cn-coach-chev" aria-hidden="true">
        <ChevronDownIcon />
      </span>
    </button>
  );
}
