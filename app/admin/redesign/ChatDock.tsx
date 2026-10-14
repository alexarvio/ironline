"use client";

import { useEffect, useState } from "react";
import { ChatIcon } from "../../components/icons";
import MessagesDraft, { type DraftMessages } from "./messages/MessagesDraft";
import { chatDraftThreadAction } from "./messages/actions";

// The chat on the screens that are not one client's (12 Oct): Feed, Calendar,
// Phases, Library, Business. The same tab on the window's right edge as on
// a client's screens (RedesignShell), but it opens on the list of chats, as
// WhatsApp lays it out: the face, the name, the last message, and on the
// right when it was and a dot for unread. Picking one shows that thread
// (MessagesDraft, which fetches and refreshes itself), with a way back to
// the list. The tab stays out while open and closes it; Esc too.

export type DockChat = { id: number; name: string; avatarPath: string | null; unread: boolean; last: { text: string; at: number; mine: boolean } | null };

const DAY_MS = 86400000;
/** WhatsApp's: the time today, "Yesterday", the weekday within the week, then the date. */
function whenLabel(at: number, now: Date): string {
  const d = new Date(at);
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(d)) / DAY_MS);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const DOCK_KEY = "norcoach:chat-dock";

export default function ChatDock({ chats }: { chats: DockChat[] }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  // Put back open on a new screen (14 Oct, Alex): in place, no slide and no page contracting.
  const [still, setStill] = useState(false);
  const [pick, setPick] = useState<DockChat | null>(null);
  const [thread, setThread] = useState<{ id: number; plan: DraftMessages } | null>(null);
  // Counts the openings of a thread: each one lands on its newest message.
  const [opened, setOpened] = useState(0);
  const [q, setQ] = useState("");
  // Dots cleared here as chats are opened; the page's own flags are from its render.
  const [read, setRead] = useState<Set<number>>(() => new Set());
  const unread = chats.filter((c) => c.unread && !read.has(c.id)).length;

  const show = () => {
    if (pick && thread) setOpened((n) => n + 1);
    remember(true);
    if (mounted) return setOpen(true);
    // In closed first, then open a frame later, so even the first one slides.
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  const close = () => {
    remember(false);
    setOpen(false);
  };
  // Open stays open across the admin's screens (14 Oct, Alex): each screen mounts its own
  // dock, so the state lives in sessionStorage, the chat on screen included.
  const remember = (isOpen: boolean, chatId: number | null = pick?.id ?? null) => {
    try {
      window.sessionStorage.setItem(DOCK_KEY, JSON.stringify({ open: isOpen, chat: isOpen ? chatId : null }));
    } catch {}
  };
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
    remember(true, c.id);
    setPick(c);
    setThread(null);
    setRead((r) => new Set(r).add(c.id));
    const plan = await chatDraftThreadAction(c.id).catch(() => null);
    if (plan) {
      setThread({ id: c.id, plan });
      setOpened((n) => n + 1);
    }
  };
  useEffect(() => {
    let saved: { open?: boolean; chat?: number | null } | null = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(DOCK_KEY) ?? "null");
    } catch {}
    if (!saved?.open) return;
    const frame = document.querySelector(".rd-frame");
    frame?.setAttribute("data-chat-still", "");
    const t = setTimeout(() => {
      setStill(true);
      setMounted(true);
      setOpen(true);
      const c = saved?.chat != null ? chats.find((x) => x.id === saved!.chat) : null;
      if (c) void choose(c);
    }, 0);
    const t2 = setTimeout(() => {
      setStill(false);
      frame?.removeAttribute("data-chat-still");
    }, 400);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  const needle = q.trim().toLowerCase();
  const shown = needle ? chats.filter((c) => c.name.toLowerCase().includes(needle)) : chats;
  const inThread = pick && thread && thread.id === pick.id;
  const now = new Date();

  return (
    <>
      <button type="button" className={`rd-chattab${open ? " open" : ""}${still ? " still" : ""}`} onClick={() => (open ? close() : show())} aria-label={open ? "Close the chats" : `Chats${unread ? `, ${unread} unread` : ""}`} title={open ? "Close the chats" : "Chats"} aria-expanded={open}>
        <ChatIcon />
        {unread > 0 && !open && <i className="rd-chattab-dot" aria-hidden="true" />}
      </button>
      {mounted && (
        <aside className={`rd-chatpanel rd-chatdock${open ? " open" : ""}${still ? " still" : ""}`} aria-label="Chats" aria-hidden={!open} inert={open ? undefined : true}>
          {inThread ? (
            <>
              <button
                type="button"
                className="rd-dock-back"
                onClick={() => {
                  remember(true, null);
                  setPick(null);
                }}
              >
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
                  shown.map((c) => {
                    const isUnread = c.unread && !read.has(c.id);
                    return (
                      <button key={c.id} type="button" className={`rd-dock-row${isUnread ? " unread" : ""}`} onClick={() => void choose(c)}>
                        <span className="rd-dock-avatar" aria-hidden="true">
                          {c.avatarPath ? (
                            // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                            <img src={c.avatarPath} alt="" />
                          ) : (
                            c.name.charAt(0).toUpperCase()
                          )}
                        </span>
                        <span className="rd-dock-main">
                          <span className="rd-dock-top">
                            <b>{c.name}</b>
                            <span className="rd-dock-when">{c.last ? whenLabel(c.last.at, now) : ""}</span>
                          </span>
                          <span className="rd-dock-bottom">
                            <small>{c.last ? `${c.last.mine ? "You: " : ""}${c.last.text}` : "No messages yet"}</small>
                            {isUnread && <i className="rd-dock-dot" aria-label="Unread" />}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
