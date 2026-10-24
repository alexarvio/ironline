"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "../../components/icons";
import ChatLastLine from "../../components/ChatLastLine";
import { dayMonth } from "../../lib/dayMonth";
import { pic } from "../../lib/pic";
import type { DockChat } from "./loaders";

// Every chat this coach has, newest word first: the dock's list on the
// screens without a client (12 Oct), and since 21 Oct (Alex) the chat
// panel's All chats on a client's screens too, so someone else writing is
// a tap away without leaving the page. One row a client: the face, the
// name, the last line in grey, when, and a dot while what they wrote is
// unread. The client the page is on wears a ring, as the rail marks them.

export type { DockChat };

/** The time today, else the day as day/month numerals. */
export function chatWhen(at: number, now: Date): string {
  const d = new Date(at);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return dayMonth(d);
}

export default function ChatList({ chats, title, here = null, isUnread, onPick, autoFocus = false }: { chats: DockChat[] | null; title: string; /** The client the page is on. */ here?: number | null; isUnread: (c: DockChat) => boolean; onPick: (c: DockChat) => void; onClose: () => void; /** Mounted in place of a thread (‹ All chats): the keyboard lands in the search, not on the page behind. */ autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) search.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  const needle = q.trim().toLowerCase();
  const shown = (chats ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle));
  const now = new Date();
  return (
    <div className="rd-dock-list">
      <header className="rd-head rd-dock-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Chat</span>
          <h1 className="rd-title">{title}</h1>
        </div>
      </header>
      <input ref={search} className="rd-dock-search" type="search" value={q} placeholder="Search clients" aria-label="Search clients" onChange={(e) => setQ(e.target.value)} />
      <div className="rd-dock-rows">
        {chats == null ? null : shown.length === 0 ? (
          <p className="rd-dock-empty">{needle ? "No match" : "No clients yet"}</p>
        ) : (
          shown.map((c) => {
            const unread = isUnread(c);
            const isHere = c.id === here;
            return (
              <button key={c.id} type="button" className={`rd-dock-row${unread ? " unread" : ""}${isHere ? " here" : ""}`} onClick={() => onPick(c)} aria-current={isHere ? "page" : undefined} title={isHere ? "On this page" : undefined}>
                <span className="rd-dock-avatar" aria-hidden="true">
                  {c.avatarPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                    <img src={pic(c.avatarPath, 96)} alt="" loading="lazy" decoding="async" />
                  ) : (
                    c.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="rd-dock-main">
                  <span className="rd-dock-top">
                    <b>{c.name}</b>
                    <span className="rd-dock-when">{c.last ? chatWhen(c.last.at, now) : ""}</span>
                  </span>
                  <span className="rd-dock-bottom">
                    <small>
                      <ChatLastLine last={c.last} />
                    </small>
                    {unread && <i className="rd-dock-dot" role="img" aria-label="Unread" />}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Back to the list, over a thread; the count is the other chats with something unread. */
export function ChatsBack({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button type="button" className="rd-dock-back" onClick={onClick} aria-label={unread ? `All chats, ${unread} unread` : "All chats"}>
      <ChevronLeftIcon />
      All chats
      {unread > 0 && <span className="rd-dock-back-n">{unread}</span>}
    </button>
  );
}
