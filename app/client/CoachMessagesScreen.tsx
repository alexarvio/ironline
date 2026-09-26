"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronLeftIcon, PinIcon } from "../components/icons";
import ChatComposeForm from "../components/ChatComposeForm";
import { REACTIONS } from "../components/MessageReactions";
import { deleteMyChatMessageAction, editMyChatMessageAction, reactToMessageAction, unpinMessageAction } from "../lib/actions";
import CoachMark from "./CoachMark";
import { useOpenLink } from "./CheckInContext";
import type { LinkView, MessageAbout } from "../lib/messageLinks";

// The conversation with the coach, laid out as WhatsApp does: the coach's
// picture and name in the header, their messages on the left and the
// client's own on the right, oldest first under a day label, and a box to
// answer from at the foot. What is pinned shows in one bar over the thread,
// one pin at a time. Every message has a chevron: a reaction, Copy, and Edit
// and Delete on your own. A message about something in the app carries a
// small link bubble on its corner that goes there.
export type CoachMessageView = {
  id: number;
  /** The client's own message. */
  mine: boolean;
  text: string;
  /** "Wednesday, September 16" */
  dayLabel: string;
  /** "14:02" */
  timeLabel: string;
  /** A photo, video, voice message or file sent with it. */
  media?: { path: string; type: "image" | "video" | "audio" | "file"; name?: string | null } | null;
  /** What in the app the message is about, when the coach linked it. */
  link?: LinkView | null;
  reactions?: { coach: string | null; client: string | null };
  pinned?: boolean;
  edited?: boolean;
};

export type CoachMessagesProps = {
  coachName: string;
  messages: CoachMessageView[];
  /** The client themselves is signed in; false when a coach previews the app. */
  viewerIsClient: boolean;
};

// How often the thread asks for anything new while it is open.
const POLL_MS = 15000;

/** What a message is, in a word, when it has no words of its own. */
const mediaWord = (m: CoachMessageView) =>
  !m.media ? "" : m.media.type === "image" ? "Photo" : m.media.type === "video" ? "Video" : m.media.type === "audio" ? "Voice message" : (m.media.name ?? "File");

export default function CoachMessagesScreen({ coachName, messages, viewerIsClient, clientId, onBack, about = null, onClearAbout }: CoachMessagesProps & { clientId: number; onBack: () => void; about?: MessageAbout | null; onClearAbout?: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const days: { label: string; items: CoachMessageView[] }[] = [];
  for (const m of messages) {
    const last = days[days.length - 1];
    if (last && last.label === m.dayLabel) last.items.push(m);
    else days.push({ label: m.dayLabel, items: [m] });
  }
  const pinned = messages.filter((m) => m.pinned);
  // Your own messages are the ones you can change: the client's, or the
  // coach's when a coach is previewing the app (they send as the coach).
  const own = (m: CoachMessageView) => (viewerIsClient ? m.mine : !m.mine);
  // Which side's reaction is yours, and which is theirs.
  const mySide = viewerIsClient ? "client" : "coach";
  const theirSide = viewerIsClient ? "coach" : "client";

  // Keep it fresh while it is open, and stay at the newest message.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [router]);
  // Open at the newest message, and stay there while pictures and videos
  // load in above it (they grow the thread after the first jump, which used
  // to leave it somewhere in the middle). Once the client scrolls up to read
  // back, it stops following, until a new message comes in.
  const body = useRef<HTMLElement>(null);
  const atEnd = useRef(true);
  // A layout effect: at the bottom before the first paint, not a jump after it.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const toEnd = () => {
      if (atEnd.current) el.scrollTop = el.scrollHeight;
    };
    const onScroll = () => {
      atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    toEnd();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(toEnd);
    for (const child of Array.from(el.children)) ro.observe(child);
    // Pictures loading in grow the thread without a resize the observer sees on the scroller itself.
    el.addEventListener("load", toEnd, true);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("load", toEnd, true);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    atEnd.current = true;
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const act = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  const saveEdit = () => {
    if (!editing) return;
    const { id, text } = editing;
    setEditing(null);
    act(() => editMyChatMessageAction(clientId, id, text));
  };
  // Off the top: either side may take a pin away.
  const unpin = (m: CoachMessageView) => act(() => unpinMessageAction(clientId, m.id));
  const remove = (m: CoachMessageView) => act(() => deleteMyChatMessageAction(clientId, m.id));
  const react = (m: CoachMessageView, emoji: string | null) => act(() => reactToMessageAction(clientId, m.id, emoji));

  // The pinned bar shows one pin at a time: a tap goes to that message in
  // the thread and lights it for a moment, and the bar moves on to the next.
  const [pinAt, setPinAt] = useState(0);
  const pinShown = pinned.length ? pinned[pinAt % pinned.length] : null;
  const [flash, setFlash] = useState<number | null>(null);
  const goToPin = () => {
    if (!pinShown) return;
    const el = body.current;
    const row = el?.querySelector<HTMLElement>(`[data-mid="${pinShown.id}"]`);
    if (row && el) {
      atEnd.current = false;
      el.scrollTo({ top: el.scrollTop + row.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 3, behavior: "smooth" });
      const id = pinShown.id;
      setFlash(id);
      setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
    }
    setPinAt((i) => (i + 1) % Math.max(1, pinned.length));
  };

  const bubble = (m: CoachMessageView) => {
    const isEditing = editing?.id === m.id;
    const mine = m.reactions?.[mySide] ?? null;
    const theirs = m.reactions?.[theirSide] ?? null;
    return (
      <article key={m.id} data-mid={m.id} className={`cm-item${m.mine ? " mine" : ""}${flash === m.id ? " flash" : ""}`}>
        <div className="cm-msg-row">
          <div className="cm-msg-wrap">
            <div className={`cm-msg${m.mine ? " mine" : ""}${m.media ? " media" : ""}${m.link ? " linked" : ""}`}>
              {/* What it is about: a small bubble on the corner that goes there. */}
              {m.link && <LinkBubble view={m.link} />}
              {m.media && <Media media={m.media} />}
              {isEditing ? (
                <div className="cm-edit">
                  <textarea
                    value={editing.text}
                    onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                    rows={3}
                    autoFocus
                    aria-label="Edit your message"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <div className="cm-edit-actions">
                    <button type="button" className="cm-edit-cancel" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button type="button" className="cm-edit-save" onClick={saveEdit} disabled={!editing.text.trim() || editing.text.trim() === m.text}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                m.text && <p className="cm-msg-text">{m.text}</p>
              )}
              {/* Pinned, edited and the time, in the bubble's corner: no name, the side says who. */}
              <span className="cm-msg-foot">
                <span className="cm-msg-time">
                  {m.pinned && (
                    <span className="cm-msg-pin" title="Pinned">
                      <PinIcon filled />
                    </span>
                  )}
                  {m.edited && "Edited "}
                  {m.timeLabel}
                </span>
                {!isEditing && (
                  <MessageMenu
                    align={m.mine ? "right" : "left"}
                    reaction={mine}
                    onReact={(e) => react(m, e)}
                    canChange={own(m)}
                    canEdit={own(m) && !!m.text}
                    onCopy={m.text ? () => navigator.clipboard?.writeText(m.text).catch(() => {}) : null}
                    onEdit={() => setEditing({ id: m.id, text: m.text })}
                    onDelete={() => remove(m)}
                    onUnpin={m.pinned ? () => unpin(m) : null}
                  />
                )}
              </span>
            </div>
            {/* Reactions hang off the bubble's foot: theirs, and yours (a tap takes it off). */}
            {(mine || theirs) && (
              <span className="cm-reacts">
                {theirs && (
                  <span className="mr-chip theirs" title="Their reaction">
                    {theirs}
                  </span>
                )}
                {mine && (
                  <button type="button" className="mr-chip mine" onClick={() => react(m, null)} title="Take yours off" aria-label={`Your reaction ${mine}, tap to remove`}>
                    {mine}
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      <header className="cn-header cm-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <CoachMark size="lg" />
        <h1 className="cm-header-name">{coachName}</h1>
      </header>
      {pinShown && (
        <div className="cm-pinbar-wrap">
          <button type="button" className="cm-pinbar" onClick={goToPin} aria-label={pinned.length > 1 ? "Go to this pinned message; the next pin shows" : "Go to the pinned message"}>
            {/* One mark a pin when there are several, the one showing filled. */}
            {pinned.length > 1 && (
              <span className="cm-pinbar-marks" aria-hidden="true">
                {pinned.map((p, i) => (
                  <i key={p.id} className={i === pinAt % pinned.length ? "on" : ""} />
                ))}
              </span>
            )}
            <span className="cm-pinbar-pin" aria-hidden="true">
              <PinIcon />
            </span>
            <span className="cm-pinbar-text">{pinShown.text || mediaWord(pinShown) || pinShown.link?.label}</span>
            {pinned.length > 1 && (
              <span className="cm-pinbar-count">
                {(pinAt % pinned.length) + 1}/{pinned.length}
              </span>
            )}
          </button>
          <button type="button" className="cm-unpin" onClick={() => unpin(pinShown)} aria-label="Unpin this message">
            ×
          </button>
        </div>
      )}
      <main ref={body} className="cm-body">
        {days.length === 0 ? (
          <p className="cm-empty">Nothing yet. {coachName} writes here between calls: a nudge, a tweak to the plan, a well done. You can write back any time.</p>
        ) : (
          days.map((d) => (
            <section key={d.label} className="cm-day">
              <span className="cm-day-label">{d.label}</span>
              {d.items.map((m) => bubble(m))}
            </section>
          ))
        )}
      </main>
      <footer className="cm-compose">
        {/* A coach previewing the app writes as the coach, not as the client. */}
        {!viewerIsClient && <p className="cm-preview-note">You&rsquo;re previewing as {coachName}: what you send here comes from {coachName}.</p>}
        <ChatComposeForm clientId={clientId} sender={viewerIsClient ? "client" : "coach"} about={about} onClearAbout={onClearAbout} />
      </footer>
    </>
  );
}

// The chevron on a message: a row of reactions across the top, then Copy,
// and Edit, Unpin and Delete where they apply. Delete asks once, in the menu
// itself. Goes on a pick, a tap anywhere else, or Escape. Opens upward,
// or downward when the message is near the top of the screen.
function MessageMenu({
  align,
  reaction,
  onReact,
  canChange,
  canEdit,
  onCopy,
  onEdit,
  onDelete,
  onUnpin = null,
}: {
  align: "left" | "right";
  reaction: string | null;
  onReact: (emoji: string | null) => void;
  canChange: boolean;
  canEdit: boolean;
  onCopy: (() => void) | null;
  onEdit: () => void;
  onDelete: () => void;
  onUnpin?: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const [down, setDown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const toggle = () => {
    if (!open) {
      const scroller = box.current?.closest(".cm-body");
      const top = box.current?.getBoundingClientRect().top ?? 0;
      setDown(top - (scroller?.getBoundingClientRect().top ?? 0) < 280);
      setConfirming(false);
    }
    setOpen((o) => !o);
  };
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <span className="cm-menu" ref={box}>
      <button type="button" className={`cm-chev${open ? " open" : ""}`} onClick={toggle} aria-label="Message options" aria-expanded={open}>
        <ChevronDownIcon />
      </button>
      {open && (
        <span className={`cm-menu-list ${align}${down ? " down" : ""}`} role="menu">
          {confirming ? (
            <>
              <span className="cm-menu-ask">Delete for both of you?</span>
              <button type="button" role="menuitem" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" role="menuitem" className="danger" onClick={pick(onDelete)}>
                Delete
              </button>
            </>
          ) : (
            <>
              <span className="cm-menu-reacts" role="group" aria-label="React">
                {REACTIONS.map((e) => (
                  <button key={e} type="button" className={`mr-pick${reaction === e ? " on" : ""}`} onClick={pick(() => onReact(reaction === e ? null : e))} aria-label={`React ${e}`} aria-pressed={reaction === e}>
                    {e}
                  </button>
                ))}
              </span>
              {onCopy && (
                <button type="button" role="menuitem" onClick={pick(onCopy)}>
                  Copy
                </button>
              )}
              {canEdit && (
                <button type="button" role="menuitem" onClick={pick(onEdit)}>
                  Edit
                </button>
              )}
              {onUnpin && (
                <button type="button" role="menuitem" onClick={pick(onUnpin)}>
                  Unpin
                </button>
              )}
              {canChange && (
                <button type="button" role="menuitem" className="danger" onClick={() => setConfirming(true)}>
                  Delete
                </button>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
}

// A small round bubble on the message's top corner with the link glyph;
// tapped, it opens what the message is about. One that can no longer be
// opened sits faded and says so.
function LinkBubble({ view }: { view: LinkView }) {
  const openLink = useOpenLink();
  return (
    <button
      type="button"
      className={`cm-linkdot${view.gone ? " gone" : ""}`}
      onClick={() => !view.gone && openLink?.(view)}
      disabled={view.gone}
      aria-label={view.gone ? `${view.label}: no longer available` : `Open ${view.area}: ${view.label}`}
      title={view.gone ? `${view.label} · no longer available` : `${view.area} · ${view.label}`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
      </svg>
    </button>
  );
}

// A picture shows, a video and a voice message play, any other file downloads.
function Media({ media }: { media: NonNullable<CoachMessageView["media"]> }) {
  if (media.type === "video") return <video className="cm-msg-video" src={media.path} controls playsInline />;
  if (media.type === "audio") return <audio className="cm-msg-audio" src={media.path} controls preload="metadata" />;
  if (media.type === "file")
    return (
      <a className="cm-msg-file" href={media.path} download={media.name ?? undefined} target="_blank" rel="noreferrer">
        <FileGlyph />
        <span>{media.name ?? "File"}</span>
      </a>
    );
  // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
  return <img className="cm-msg-img" src={media.path} alt="" />;
}

function FileGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
