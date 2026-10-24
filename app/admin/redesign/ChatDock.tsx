"use client";

import { useEffect, useState } from "react";
import { ChatIcon } from "../../components/icons";
import MessagesDraft, { type DraftMessages } from "./messages/MessagesDraft";
import { chatDraftThreadAction } from "./messages/actions";
import ChatList, { ChatsBack, type DockChat } from "./ChatList";
import { useCloseOnEmptyClick } from "./useCloseOnEmptyClick";

// The chat on the screens that are not one client's (12 Oct): Feed, Calendar,
// Phases, Library, Business. The same tab on the window's right edge as on
// a client's screens (RedesignShell), but it opens on the list of chats
// (ChatList, shared with a client's panel since 21 Oct). Picking one shows
// that thread (MessagesDraft, which fetches and refreshes itself), with a
// way back to the list. The tab stays out while open and closes it; Esc too.

export type { DockChat };

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
  // A click on empty space closes it, one on anything with a function doesn't (24 Oct, Alex).
  useCloseOnEmptyClick(open, close);
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
  const inThread = pick && thread && thread.id === pick.id;
  const isUnread = (c: DockChat) => c.unread && !read.has(c.id);

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
              <ChatsBack
                unread={chats.filter((c) => c.id !== pick.id && isUnread(c)).length}
                onClick={() => {
                  remember(true, null);
                  setPick(null);
                }}
              />
              <MessagesDraft clientId={pick.id} firstName={pick.name.split(" ")[0]} plan={thread.plan} active={open} panel={{ about: null, opened, onClose: close, focus: null }} />
            </>
          ) : (
            // Back from a thread the keyboard lands in the search (not while the panel is still sliding in, or put back on a new screen).
            <ChatList chats={chats} title={pick ? `Opening ${pick.name.split(" ")[0]}…` : "Chats"} isUnread={isUnread} onPick={(c) => void choose(c)} onClose={close} autoFocus={open && !still} />
          )}
        </aside>
      )}
    </>
  );
}
