"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { coachThreadAction } from "./actions";
import type { DraftMedia, DraftMessage, DraftMessages } from "../admin/redesign/messages/MessagesDraft";
import { deleteChatMessageAction, editChatMessageAction, markSeenAction, pinMessageAction, reactToMessageAction, sendChatMessageAction } from "../lib/actions";
import VoiceRecordButton from "../components/VoiceRecordButton";
import ChatMediaGallery from "../components/ChatMediaGallery";
import { ChatVideo, sized } from "../components/ChatMedia";
import { dayMonth } from "../lib/dayMonth";
import { useKeyboardInset } from "../client/useKeyboardInset";
import { Avatar, Facts, Icon, Sheet } from "./parts";
import { ChatReview } from "./PhoneReview";

// One client's chat on the coach's phone (21 Oct): the laptop's thread (its
// loader, through coachThreadAction, which also keeps this chat's pushes
// quiet while it shows, and the same actions for every send, reaction, edit,
// pin and delete), laid out for a thumb. Their messages on the left in white
// with a hairline, the coach's on the right in a neutral tint; hold one to
// react, reply, copy, edit, pin or delete it. + sends a photo, video or file,
// the mic a voice message, the ink arrow the words.

const REACTIONS = ["👍", "❤️", "💪", "🔥", "👏", "😂"] as const;
const POLL_MS = 15000;
const HOLD_MS = 450;

const dayOf = (when: string) => when.split(", ")[0] ?? when;
const timeOf = (when: string) => when.split(", ")[1] ?? "";
const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");
const quoteOf = (m: DraftMessage) => m.text.trim() || (m.media?.type === "image" ? "Photo" : m.media?.type === "video" ? "Video" : m.media?.type === "audio" ? "Voice message" : m.media ? m.media.name ?? "File" : "");
const NOT_SENT = "Not sent. Check the connection and try again.";

type Outgoing = { key: number; text: string; failed: boolean; replyTo: DraftMessage | null };

export default function ChatThread({ clientId, name, avatarPath, onBack, onRead }: { clientId: number; name: string; avatarPath: string | null; onBack: () => void; onRead: () => void }) {
  const [plan, setPlan] = useState<DraftMessages | null>(null);
  const first = name.split(/\s+/)[0] || "them";
  const readRef = useRef(onRead);
  useEffect(() => {
    readRef.current = onRead;
  });

  // The thread, now and every 15 s while it shows; anything new from the client is read as it comes in.
  const take = useCallback(
    (next: DraftMessages | null) => {
      if (!next) return;
      setPlan(next);
      if (next.unread) {
        void markSeenAction(clientId, { tab: "messages" }).catch(() => {});
        readRef.current();
      }
    },
    [clientId]
  );
  const refresh = useCallback(async () => take(await coachThreadAction(clientId).catch(() => null)), [clientId, take]);
  // The first unread before it is marked read (25 Oct): the thread is read first, then the chat marked seen.
  const firstUnread = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    coachThreadAction(clientId)
      .then((t) => {
        if (firstUnread.current === undefined) firstUnread.current = t?.firstUnread ?? null;
        take(t);
      }, () => {})
      .finally(() => {
        void markSeenAction(clientId, { tab: "messages" })
          .then(() => readRef.current())
          .catch(() => {});
      });
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [clientId, refresh, take]);

  const messages = plan?.messages ?? [];
  const avatar = plan?.avatarPath ?? avatarPath;

  // ---- The scroll (25 Oct, Alex: "always defaulted to the last message, or if there are unread new ones, to those"):
  // on opening, the first new message from the client, else the newest; held there while pictures and videos settle,
  // until the coach's own finger or wheel moves it; after that it follows the foot only while the coach is at it.
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const placing = useRef(true);
  const loaded = plan != null;
  useLayoutEffect(() => {
    const el = scroller.current;
    const box = inner.current;
    if (!el || !box) return;
    const place = () => {
      const first = firstUnread.current;
      if (placing.current && first != null) {
        const row = el.querySelector<HTMLElement>(`[data-mid="${first}"]`);
        if (row) {
          el.scrollTop = el.scrollTop + row.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
          return;
        }
      }
      if (placing.current || atEnd.current) el.scrollTop = el.scrollHeight;
    };
    const touched = () => {
      placing.current = false;
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(box);
    watch.observe(el);
    el.addEventListener("touchstart", touched, { passive: true });
    el.addEventListener("wheel", touched, { passive: true });
    el.addEventListener("pointerdown", touched, { passive: true });
    el.addEventListener("load", place, true);
    el.addEventListener("loadedmetadata", place, true);
    const timers = [80, 300, 800, 1600].map((ms) => window.setTimeout(place, ms));
    return () => {
      watch.disconnect();
      el.removeEventListener("touchstart", touched);
      el.removeEventListener("wheel", touched);
      el.removeEventListener("pointerdown", touched);
      el.removeEventListener("load", place, true);
      el.removeEventListener("loadedmetadata", place, true);
      timers.forEach(clearTimeout);
    };
  }, [loaded]);
  const [flash, setFlash] = useState<number | null>(null);
  const goTo = (id: number) => {
    const el = scroller.current;
    const row = el?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el || !row) return;
    atEnd.current = false;
    el.scrollTo({ top: el.scrollTop + row.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 3, behavior: "smooth" });
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
  };

  // ---- Writing.
  const [text, setText] = useState("");
  const [replying, setReplying] = useState<DraftMessage | null>(null);
  const [editing, setEditing] = useState<DraftMessage | null>(null);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [sendingFile, setSendingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const grow = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    el.style.overflowY = el.scrollHeight > 132 ? "auto" : "hidden";
  };
  const resetBox = () => {
    setText("");
    requestAnimationFrame(grow);
  };

  const deliver = async (o: Outgoing) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", o.text);
    fd.set("quiet", "1");
    if (o.replyTo) fd.set("replyTo", String(o.replyTo.id));
    try {
      await sendChatMessageAction(fd);
    } catch {
      setOutbox((list) => list.map((x) => (x.key === o.key ? { ...x, failed: true } : x)));
      return;
    }
    await refresh();
    setOutbox((list) => list.filter((x) => x.key !== o.key));
  };
  const send = async () => {
    const words = text.trim();
    if (!words) return;
    setError(null);
    if (editing) {
      const m = editing;
      setEditing(null);
      resetBox();
      if (words === m.text) return;
      try {
        await editChatMessageAction(clientId, m.id, words, true);
        await refresh();
      } catch {
        setError("Not saved. Check the connection and try again.");
      }
      return;
    }
    // On screen at once, faint until the server has it (21 Oct: answer fast).
    const o: Outgoing = { key: Date.now(), text: words, failed: false, replyTo: replying };
    setOutbox((list) => [...list, o]);
    setReplying(null);
    resetBox();
    atEnd.current = true;
    box.current?.focus();
    await deliver(o);
  };
  const sendFile = async (file: File) => {
    setError(null);
    setSendingFile(true);
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    fd.set("quiet", "1");
    if (replying) fd.set("replyTo", String(replying.id));
    try {
      await sendChatMessageAction(fd);
      setReplying(null);
      atEnd.current = true;
      await refresh();
    } catch {
      setError(NOT_SENT);
    }
    setSendingFile(false);
  };
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch {
      setError("Not saved. Check the connection and try again.");
    }
  };

  // ---- Holding a message opens its sheet; a right click too, on a computer.
  const [menuFor, setMenuFor] = useState<DraftMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const held = useRef(false);
  const openMenu = (m: DraftMessage) => {
    held.current = true;
    setConfirmDelete(false);
    setMenuFor(m);
    try {
      navigator.vibrate?.(8);
    } catch {}
  };
  const pressHandlers = (m: DraftMessage) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      held.current = false;
      const timer = window.setTimeout(() => {
        hold.current = null;
        openMenu(m);
      }, HOLD_MS);
      hold.current = { timer, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const h = hold.current;
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) cancelHold();
    },
    onPointerUp: () => cancelHold(),
    onPointerCancel: () => cancelHold(),
    onPointerLeave: () => cancelHold(),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancelHold();
      openMenu(m);
    },
  });
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };
  const closeMenu = () => {
    setMenuFor(null);
    setConfirmDelete(false);
  };

  const [viewer, setViewer] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  // A video or photo they sent, reviewed on the recorder (25 Oct, Alex).
  const [reviewing, setReviewing] = useState<DraftMessage | null>(null);
  const reviewable = (m: DraftMessage) => !m.mine && (m.media?.type === "video" || m.media?.type === "image");

  // ---- Oldest first, a label over each day; Today and Yesterday in words.
  const now = new Date();
  const today = dayMonth(now);
  now.setDate(now.getDate() - 1);
  const yesterday = dayMonth(now);
  const days: { day: string; items: DraftMessage[] }[] = [];
  for (const m of [...messages].reverse()) {
    const last = days[days.length - 1];
    const day = dayOf(m.when);
    if (last && last.day === day) last.items.push(m);
    else days.push({ day, items: [m] });
  }
  const dayLabel = (d: string) => (d === today ? "Today" : d === yesterday ? "Yesterday" : d);
  const pinned = messages.filter((m) => m.pinned);
  const [pinAt, setPinAt] = useState(0);
  const pinShown = pinned.length ? pinned[pinAt % pinned.length] : null;

  const kb = useKeyboardInset();

  const bubble = (m: DraftMessage) => (
    <div key={m.id} data-mid={m.id} className={`cph-msg ${m.mine ? "mine" : "theirs"}${flash === m.id ? " flash" : ""}`}>
      <div
        className={`cph-bubble${m.media && !m.text ? " bare" : ""}${m.media?.type === "image" || m.media?.type === "video" ? " visual" : ""}`}
        {...pressHandlers(m)}
      >
        {m.replyTo && (
          <button type="button" className={`cph-quote${m.replyTo.mine ? " mine" : ""}`} onClick={() => goTo(m.replyTo!.id)}>
            <b>{m.replyTo.mine ? "You" : first}</b>
            <span>{m.replyTo.text}</span>
          </button>
        )}
        {/* A link opens what it points at, as on the laptop (24 Oct, Alex: on the phone it went nowhere); one that's gone stays words. */}
        {m.link &&
          (m.link.href && !m.link.gone ? (
            <a className="cph-link" href={m.link.href} onClick={(e) => e.stopPropagation()}>
              <Icon name="link" small />
              <span>
                <Facts parts={m.link.label.split(" · ")} />
              </span>
            </a>
          ) : (
            <span className={`cph-link${m.link.gone ? " gone" : ""}`}>
              <Icon name="link" small />
              <span>
                <Facts parts={m.link.label.split(" · ")} />
              </span>
            </span>
          ))}
        {m.media && <Media media={m.media} onOpen={(src) => !held.current && setViewer(src)} />}
        {m.text && <span className="cph-text">{m.text}</span>}
        <span className="cph-meta">
          {m.pinned && <Icon name="pin" small size={11} />}
          {m.edited && "Edited "}
          {timeOf(m.when)}
          {/* Its sheet in a tap, as the client's chat has it (25 Oct, Alex): react, reply, and the rest. Holding still works. */}
          <button
            type="button"
            className="cph-chev"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openMenu(m);
            }}
            aria-label="More for this message"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </span>
      </div>
      {(m.reactions?.client || m.reactions?.coach) && (
        <span className="cph-reacts">
          {m.reactions?.client && <span title={`${first}'s reaction`}>{m.reactions.client}</span>}
          {m.reactions?.coach && (
            <button type="button" onClick={() => void act(() => reactToMessageAction(clientId, m.id, null, true))} aria-label={`Take your ${m.reactions.coach} off`}>
              {m.reactions.coach}
            </button>
          )}
        </span>
      )}
    </div>
  );

  return (
    <section className="cph-thread" style={{ bottom: kb }} aria-label={`Chat with ${name || "client"}`}>
      <header className="cph-thread-head">
        <button type="button" className="cph-icon-btn" onClick={onBack} aria-label="Back to the chats">
          <Icon name="back" size={22} />
        </button>
        <Avatar name={name || "?"} src={avatar} size={34} />
        <h1>{name}</h1>
        <button type="button" className="cph-icon-btn quiet" onClick={() => setGallery(true)} aria-label="Photos, videos and files in this chat">
          <Icon name="photo" />
        </button>
      </header>
      {pinShown && (
        <button
          type="button"
          className="cph-pinbar"
          onClick={() => {
            goTo(pinShown.id);
            setPinAt((i) => (i + 1) % Math.max(1, pinned.length));
          }}
        >
          <Icon name="pin" small />
          <span>{quoteOf(pinShown) || pinShown.link?.label}</span>
          {pinned.length > 1 && (
            <em>
              {(pinAt % pinned.length) + 1}/{pinned.length}
            </em>
          )}
        </button>
      )}

      <div
        ref={scroller}
        className="cph-thread-scroll"
        onScroll={(e) => {
          // Only the coach's own scrolling decides it; a placed one never does.
          if (placing.current) return;
          const el = e.currentTarget;
          atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div ref={inner} className="cph-thread-inner">
          {plan == null ? null : days.length === 0 && outbox.length === 0 ? (
            <p className="cph-empty">No messages yet</p>
          ) : (
            days.map((d) => (
              <div key={d.day} className="cph-day">
                <span className="cph-day-label">{dayLabel(d.day)}</span>
                {d.items.map(bubble)}
              </div>
            ))
          )}
          {outbox.map((o) => (
            <div key={o.key} className="cph-msg mine">
              <button type="button" className={`cph-bubble out${o.failed ? " failed" : ""}`} disabled={!o.failed} onClick={() => {
                setOutbox((list) => list.map((x) => (x.key === o.key ? { ...x, failed: false } : x)));
                void deliver({ ...o, failed: false });
              }}>
                {o.replyTo && (
                  <span className={`cph-quote${o.replyTo.mine ? " mine" : ""}`}>
                    <b>{o.replyTo.mine ? "You" : first}</b>
                    <span>{quoteOf(o.replyTo)}</span>
                  </span>
                )}
                <span className="cph-text">{o.text}</span>
                <span className="cph-meta">{o.failed ? "Not sent · Tap to retry" : "Sending…"}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <footer className="cph-compose">
        {error && (
          <p className="cph-error" role="alert">
            {error}
          </p>
        )}
        {sendingFile && <p className="cph-sending">Sending…</p>}
        {(replying || editing) && (
          <div className="cph-replying">
            <span className={`cph-quote static${(editing ?? replying)!.mine ? " mine" : ""}`}>
              <b>{editing ? "Editing" : `Replying to ${replying!.mine ? "yourself" : first}`}</b>
              <span>{quoteOf((editing ?? replying)!)}</span>
            </span>
            <button
              type="button"
              className="cph-icon-btn quiet"
              onClick={() => {
                if (editing) resetBox();
                setEditing(null);
                setReplying(null);
              }}
              aria-label={editing ? "Stop editing" : "Don't reply to it"}
            >
              <Icon name="x" small />
            </button>
          </div>
        )}
        <div className="cph-compose-row">
          <button type="button" className="cph-round" onClick={() => fileInput.current?.click()} disabled={sendingFile || !!editing} aria-label="Send a photo, video or file">
            <Icon name="plus" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void sendFile(f);
            }}
          />
          <textarea
            ref={box}
            className="cph-box"
            rows={1}
            value={text}
            placeholder={`Message ${first}…`}
            aria-label={`Message ${first}`}
            onChange={(e) => {
              setText(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              // Enter sends on a computer; on a phone it is a new line, and the arrow sends.
              if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
                e.preventDefault();
                void send();
              }
              if (e.key === "Escape" && (replying || editing)) {
                setReplying(null);
                setEditing(null);
              }
            }}
          />
          {text.trim() ? (
            <button type="button" className="cph-round ink" onClick={() => void send()} aria-label={editing ? "Save" : "Send"}>
              <Icon name={editing ? "check" : "send"} />
            </button>
          ) : (
            <VoiceRecordButton className="cph-round cph-mic" onRecorded={(f) => void sendFile(f)} disabled={sendingFile || !!editing} />
          )}
        </div>
      </footer>

      {menuFor && (
        <Sheet onClose={closeMenu} label="Message">
          {confirmDelete ? (
            <div className="cph-confirm">
              <h2>Delete this message?</h2>
              <p>It leaves {first}&rsquo;s app too.</p>
              <div className="cph-confirm-row">
                <button type="button" className="cph-text-btn" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cph-text-btn danger"
                  onClick={() => {
                    const id = menuFor.id;
                    closeMenu();
                    void act(() => deleteChatMessageAction(clientId, id, true));
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cph-react-pick" role="group" aria-label="React">
                {REACTIONS.map((e) => {
                  const on = menuFor.reactions?.coach === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      className={on ? "on" : ""}
                      aria-pressed={on}
                      aria-label={`React ${e}`}
                      onClick={() => {
                        const m = menuFor;
                        closeMenu();
                        void act(() => reactToMessageAction(clientId, m.id, on ? null : e, true));
                      }}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
              {reviewable(menuFor) && (
                <button
                  type="button"
                  className="cph-sheet-row"
                  onClick={() => {
                    setReviewing(menuFor);
                    closeMenu();
                  }}
                >
                  <Icon name="pen" />
                  Review
                </button>
              )}
              <button
                type="button"
                className="cph-sheet-row"
                onClick={() => {
                  setEditing(null);
                  setReplying(menuFor);
                  closeMenu();
                  setTimeout(() => box.current?.focus(), 0);
                }}
              >
                <Icon name="reply" />
                Reply
              </button>
              {menuFor.text && (
                <button
                  type="button"
                  className="cph-sheet-row"
                  onClick={() => {
                    void navigator.clipboard?.writeText(menuFor.text).catch(() => {});
                    closeMenu();
                  }}
                >
                  <Icon name="copy" />
                  Copy
                </button>
              )}
              {menuFor.mine && menuFor.text && (
                <button
                  type="button"
                  className="cph-sheet-row"
                  onClick={() => {
                    const m = menuFor;
                    setReplying(null);
                    setEditing(m);
                    setText(m.text);
                    closeMenu();
                    setTimeout(() => {
                      grow();
                      box.current?.focus();
                    }, 0);
                  }}
                >
                  <Icon name="edit" />
                  Edit
                </button>
              )}
              <button
                type="button"
                className="cph-sheet-row"
                onClick={() => {
                  const m = menuFor;
                  closeMenu();
                  void act(() => pinMessageAction(clientId, m.id, !m.pinned, true));
                }}
              >
                <Icon name="pin" />
                {menuFor.pinned ? "Unpin" : "Pin"}
              </button>
              {menuFor.mine && (
                <button type="button" className="cph-sheet-row danger" onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" />
                  Delete
                </button>
              )}
            </>
          )}
        </Sheet>
      )}

      {reviewing && reviewing.media && (
        <ChatReview
          clientId={clientId}
          messageId={reviewing.id}
          first={first}
          name={name}
          media={{ kind: reviewing.media.type === "video" ? "video" : "photo", url: reviewing.media.path }}
          words={reviewing.text}
          when={dayLabel(dayOf(reviewing.when))}
          onBack={() => setReviewing(null)}
          onSent={() => {
            atEnd.current = true;
            void refresh();
          }}
        />
      )}
      {gallery && <ChatMediaGallery items={messages.filter((m) => m.media).map((m) => ({ id: m.id, who: m.mine ? "You" : first, when: m.when, media: m.media! }))} onShow={goTo} onClose={() => setGallery(false)} />}
      {viewer && (
        <button type="button" className="cph-viewer" onClick={() => setViewer(null)} aria-label="Close the photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- the chat's own upload, served by the app */}
          <img src={viewer} alt="" />
        </button>
      )}
    </section>
  );
}

// A picture shows (tap: big), a video plays behind its poster, a voice message plays in the bubble, a file opens.
function Media({ media, onOpen }: { media: DraftMedia; onOpen: (src: string) => void }) {
  if (media.type === "video") return <ChatVideo className="cph-video-media" src={media.path} />;
  if (media.type === "audio") return <Voice src={media.path} />;
  if (media.type === "file")
    return (
      <a className="cph-file" href={media.path} target="_blank" rel="noreferrer" download={media.name ?? undefined}>
        <Icon name="file" />
        <span>{media.name ?? "File"}</span>
      </a>
    );
  return (
    <button type="button" className="cph-img" onClick={() => onOpen(sized(media.path, 1080))} aria-label="Open the photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- the chat's own upload, served by the app */}
      <img src={sized(media.path, 1080)} alt="" decoding="async" />
    </button>
  );
}

/** A voice message: play, the length, how far it has played. */
function Voice({ src }: { src: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const toggle = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  };
  const share = d && Number.isFinite(d) ? Math.min(1, t / d) : 0;
  return (
    <span className="cph-voice">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause the voice message" : "Play the voice message"}>
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <span className="cph-voice-track" aria-hidden="true">
        <i style={{ width: `${share * 100}%` }} />
      </span>
      <span className="cph-voice-time">{playing || t > 0 ? clock(t) : clock(d)}</span>
      <audio
        ref={el}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setD(e.currentTarget.duration)}
        onDurationChange={(e) => setD(e.currentTarget.duration)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setT(0);
        }}
      />
    </span>
  );
}
