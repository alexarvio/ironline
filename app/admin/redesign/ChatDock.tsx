"use client";

import { useEffect, useState } from "react";
import { ChatIcon } from "../../components/icons";
import MessagesDraft, { type DraftMessages } from "./messages/MessagesDraft";
import { chatDraftThreadAction } from "./messages/actions";

// The chat on the screens that are not one client's (12 Oct): Feed, Calendar,
// Phases, Library, Business. The same tab on the window's right edge as on
// a client's screens (RedesignShell), but it opens on the list of chats,
// newest word first, a dot by those with something unread; picking one
// shows that thread (MessagesDraft, which fetches and refreshes itself),
// with a way back to the list. Closing slides it away; Esc too.

export type DockChat = { id: number; name: string; avatarPath: string | null; unread: boolean; last: { text: string; when: string; mine: boolean } | null };

export default function ChatDock({ chats }: { chats: DockChat[] }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<DockChat | null>(null);
  const [thread, setThread] = useState<{ id: number; plan: DraftMessages } | null>(null);
  const [opened, setOpened] = useState(0);
  const [q, setQ] = useState("");
  // Dots cleared here as chats are opened; the page's own flags are from its render.
  const [read, setRead] = useState<Set<number>>(() => new Set());
  const unread = chats.filter((c) => c.unread && !read.has(c.id)).length;

  const show = () => {
    if (mounted) return setOpen(true);
    // In closed first, then open a frame later, so even the first one slides.
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog]") && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // The page makes room on a wide window, as a client's screens do (messages.css).
  useEffect(() => {
    const frame = document.querySelector(".rd-frame");
    if (!frame) return;
    if (open) frame.setAttribute("data-chat", "open");
    else frame.removeAttribute("data-chat");
  }, [open]);

  const choose = async (c: DockChat) => {
    setPick(c);
    setThread(null);
    setRead((r) => new Set(r).add(c.id));
    const plan = await chatDraftThreadAction(c.id).catch(() => null);
    if (plan) {
      setThread({ id: c.id, plan });
      setOpened((n) => n + 1);
    }
  };
  const needle = q.trim().toLowerCase();
  const shown = needle ? chats.filter((c) => c.name.toLowerCase().includes(needle)) : chats;
  const inThread = pick && thread && thread.id === pick.id;

  return (
    <>
      <button type="button" className={`rd-chattab${open ? " hidden" : ""}`} onClick={show} aria-label={`Chats${unread ? `, ${unread} unread` : ""}`} title="Chats" tabIndex={open ? -1 : 0}>
        <ChatIcon />
        {unread > 0 && <i className="rd-chattab-dot" aria-hidden="true" />}
      </button>
      {mounted && (
        <aside className={`rd-chatpanel rd-chatdock${open ? " open" : ""}`} aria-label="Chats" aria-hidden={!open} inert={open ? undefined : true}>
          {inThread ? (
            <>
              <button type="button" className="rd-dock-back" onClick={() => setPick(null)}>
                ‹ All chats
              </button>
              <MessagesDraft clientId={pick.id} firstName={pick.name.split(" ")[0]} plan={thread.plan} active={open} panel={{ about: null, opened, onClose: close, focus: null }} />
            </>
          ) : (
            <div className="rd-dock-list">
              <header className="rd-dock-head">
                <button type="button" className="rm-panel-x" onClick={close} aria-label="Close the chats" title="Close (Esc)">
                  ×
                </button>
                <div className="rd-head-main">
                  <span className="rd-eyebrow">Chat</span>
                  <h1 className="rd-title">{pick ? `Opening ${pick.name.split(" ")[0]}…` : "Chats"}</h1>
                </div>
              </header>
              <input className="rd-dock-search" type="search" value={q} placeholder="Search clients" aria-label="Search clients" onChange={(e) => setQ(e.target.value)} />
              <div className="rd-dock-rows">
                {shown.length === 0 ? (
                  <p className="rd-dock-empty">No one by that name.</p>
                ) : (
                  shown.map((c) => (
                    <button key={c.id} type="button" className={`rd-dock-row${c.unread && !read.has(c.id) ? " unread" : ""}`} onClick={() => void choose(c)}>
                      <span className="rfd-avatar rd-dock-avatar" aria-hidden="true">
                        {c.avatarPath ? (
                          // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                          <img src={c.avatarPath} alt="" />
                        ) : (
                          c.name.charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="rd-dock-main">
                        <b>{c.name}</b>
                        <small>{c.last ? `${c.last.mine ? "You: " : ""}${c.last.text}` : "No messages yet"}</small>
                      </span>
                      <span className="rd-dock-when">{c.last?.when ?? ""}</span>
                      {c.unread && !read.has(c.id) && <i className="rd-dock-dot" aria-hidden="true" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
