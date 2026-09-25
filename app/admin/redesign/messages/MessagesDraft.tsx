"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ChevronDownIcon, PinIcon } from "../../../components/icons";
import Picker from "../Picker";
import VoiceRecordButton from "../../../components/VoiceRecordButton";
import { deleteChatMessageAction, editChatMessageAction, markSeenAction, pinMessageAction, reactToMessageAction, sendChatMessageAction, setMessageLinkAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import type { LinkTargets } from "../../../lib/queries";
import { ConfirmDialog } from "../training/TrainingDraft";

// The Messages tab in the redesign's sheet: one chat box, and unlike the
// other drafts it is real. Everything here sends and saves through the same
// actions as the old tab: the words, a picture, a video, a file or a voice
// message; an emoji on any message; and on the coach's own, after sending,
// reword, point it at something, pin, or take back. The client answers from
// their app; the thread refreshes itself while it is open.

/** href: where it opens on the coach's side (sent links that still open). */
export type DraftLink = { area: string; label: string; gone: boolean; link?: MessageLink; href?: string };
export type DraftMedia = { path: string; type: "image" | "video" | "audio" | "file"; name?: string | null };
export type DraftMessage = { id: number; mine: boolean; text: string; when: string; media?: DraftMedia | null; link: DraftLink | null; reactions?: { coach?: string | null; client?: string | null }; pinned?: boolean; edited?: boolean };
/** Newest first, as the loader hands them over. */
export type DraftMessages = { messages: DraftMessage[]; targets: LinkTargets; avatarPath?: string | null };
const REACTIONS = ["👍", "❤️", "💪", "🔥", "👏", "😂"] as const;
const POLL_MS = 15000;

/** "23 Sept, 14:02" → the day, and the time. */
const dayOf = (when: string) => when.split(", ")[0] ?? when;
const timeOf = (when: string) => when.split(", ")[1] ?? "";

export default function MessagesDraft({ clientId, firstName, plan, active }: { clientId: number; firstName: string; plan: DraftMessages; /** The tab is the one showing. */ active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const messages = plan.messages;
  const [text, setText] = useState("");
  const [link, setLink] = useState<DraftLink | null>(null);
  const [linking, setLinking] = useState(false);
  // After sending: one message being reworded, one getting a link, one about to go.
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [relink, setRelink] = useState<number | null>(null);
  const [remove, setRemove] = useState<DraftMessage | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const chat = useRef<HTMLElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const threadInner = useRef<HTMLDivElement>(null);
  // Whether the thread is at its latest message: it opens there, and stays
  // there as messages arrive or pictures load, unless the coach has
  // scrolled up to read back.
  const atEnd = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = text.trim().length > 0 && !pending;
  const t = plan.targets;
  const nothingToLink = t.training.length === 0 && !t.nutrition && t.foodDays.length === 0 && t.checkins.length === 0 && !t.photos;

  // Opening reads what the client wrote (the rail's dot clears); then the
  // thread asks for anything new every so often. Every action refreshes.
  // Only while the tab is showing: it stays mounted behind the others, and
  // polling from there re-read the whole page every 15 s, which reset the
  // other tabs under the coach's typing (and cleared the dot unread).
  useEffect(() => {
    if (!active) return;
    markSeenAction(clientId, { tab: "messages" });
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [clientId, router, active]);
  // The box takes all the room there is, from where it starts to the foot of
  // the window, and never so much that the page itself scrolls. Measured
  // when the tab is shown (it mounts hidden behind the other tabs) and when
  // the window changes size.
  useLayoutEffect(() => {
    const el = chat.current;
    if (!el) return;
    const fit = () => {
      if (!el.offsetParent) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(360, window.innerHeight - top)}px`;
      // Whatever still spills over (the page's own padding below) comes off.
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) el.style.height = `${Math.max(360, el.offsetHeight - over)}px`;
    };
    fit();
    const shown = new IntersectionObserver(() => fit());
    shown.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      shown.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);
  // To the latest message on opening, and whenever the thread grows (a new
  // message, a picture that finished loading) while the coach is there.
  useLayoutEffect(() => {
    const el = thread.current;
    const inner = threadInner.current;
    if (!el || !inner) return;
    const toEnd = () => {
      if (atEnd.current) el.scrollTop = el.scrollHeight;
    };
    toEnd();
    const watch = new ResizeObserver(toEnd);
    watch.observe(inner);
    return () => watch.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = thread.current;
    if (el && atEnd.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  const act = (fn: () => Promise<void>, done?: () => void) =>
    start(async () => {
      await fn();
      router.refresh();
      done?.();
    });

  const send = () => {
    if (!ready) return;
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", text.trim());
    if (link?.link) fd.set("link", JSON.stringify(link.link));
    act(
      () => sendChatMessageAction(fd),
      () => {
        setText("");
        setLink(null);
        if (box.current) box.current.style.height = "auto";
        box.current?.focus();
      }
    );
  };
  const sendFile = (file: File) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    act(() => sendChatMessageAction(fd));
  };
  const react = (m: DraftMessage, emoji: string | null) => act(() => reactToMessageAction(clientId, m.id, emoji));
  function saveEdit() {
    if (!editing || !editing.text.trim()) return;
    const { id, text: words } = editing;
    setEditing(null);
    act(() => editChatMessageAction(clientId, id, words));
  }

  // Oldest first on screen, a heading over each day; the coach's pins on top.
  const days: { day: string; items: DraftMessage[] }[] = [];
  for (const m of [...messages].reverse()) {
    const last = days[days.length - 1];
    const day = dayOf(m.when);
    if (last && last.day === day) last.items.push(m);
    else days.push({ day, items: [m] });
  }
  const pinned = messages.filter((m) => m.pinned);
  // The pinned bar shows one pin at a time, as WhatsApp does: a tap goes to
  // that message in the thread, and the bar moves on to the next pin.
  const [pinAt, setPinAt] = useState(0);
  const pinShown = pinned.length ? pinned[pinAt % pinned.length] : null;
  const [flash, setFlash] = useState<number | null>(null);
  const goToPin = () => {
    if (!pinShown) return;
    const row = thread.current?.querySelector<HTMLElement>(`[data-mid="${pinShown.id}"]`);
    const el = thread.current;
    if (row && el) {
      el.scrollTo({ top: el.scrollTop + row.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 3, behavior: "smooth" });
      setFlash(pinShown.id);
      setTimeout(() => setFlash((f) => (f === pinShown.id ? null : f)), 1600);
    }
    setPinAt((i) => (i + 1) % Math.max(1, pinned.length));
  };

  const bubble = (m: DraftMessage, inPins = false) => (
    <div key={`${inPins ? "pin-" : ""}${m.id}`} data-mid={inPins ? undefined : m.id} className={`rm-bubble-row${m.mine ? " mine" : " theirs"}${flash === m.id ? " flash" : ""}`}>
      <div className="rm-bubble-wrap">
        <div className={`rm-bubble${m.media ? " media" : ""}${m.link ? " linked" : ""}`}>
          {m.media && <Media media={m.media} />}
          {editing?.id === m.id && !inPins ? (
            <span className="rm-edit">
              <textarea
                className="rm-edit-box"
                rows={2}
                value={editing.text}
                autoFocus
                onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(null);
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                  }
                }}
                aria-label="Reword the message"
              />
              <span className="rm-edit-actions">
                <button type="button" className="rm-mini" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="button" className="rm-mini primary" disabled={!editing.text.trim() || editing.text.trim() === m.text} onClick={saveEdit}>
                  Save
                </button>
              </span>
            </span>
          ) : (
            m.text && (
              <span className="rm-bubble-body">
                <span className="rm-bubble-text">{m.text}</span>
                {/* The time sits in the bubble's corner, on the last line when it fits (as WhatsApp does). */}
                {meta(m, inPins)}
              </span>
            )
          )}
          {/* What the message is about: a round link on the bubble's top
              corner (the side away from the edge), as in the client's app;
              hovering it says what it opens before a click. */}
          {m.link &&
            (m.link.href ? (
              <a className="rm-linkdot" href={m.link.href} aria-label={`Open ${m.link.label}`}>
                <LinkGlyph />
                <span className="rm-linkdot-tip" aria-hidden="true">
                  {m.link.label}
                </span>
              </a>
            ) : (
              <span className={`rm-linkdot${m.link.gone ? " gone" : ""}`} tabIndex={0} aria-label={m.link.gone ? `${m.link.label}: the client can't open this any more` : m.link.label}>
                <LinkGlyph />
                <span className="rm-linkdot-tip" aria-hidden="true">
                  {m.link.label}
                  {m.link.gone && <em> · no longer opens</em>}
                </span>
              </span>
            ))}
          {!m.text && <span className="rm-bubble-line end">{meta(m, inPins)}</span>}
          {/* The chevron in the corner: react, and on the coach's own, reword, link, pin or delete. */}
          {!inPins && editing?.id !== m.id && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="rm-chev" aria-label="Message options">
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align={m.mine ? "end" : "start"} className="pb-menu rm-menu">
                <div className="rm-menu-reacts" role="group" aria-label="React">
                  {REACTIONS.map((e) => (
                    <DropdownMenuItem key={e} className={`rm-react-pick${m.reactions?.coach === e ? " on" : ""}`} onSelect={() => react(m, m.reactions?.coach === e ? null : e)} aria-label={`React ${e}`}>
                      {e}
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                {m.mine && <DropdownMenuItem onSelect={() => setEditing({ id: m.id, text: m.text })}>Edit</DropdownMenuItem>}
                {m.mine && <DropdownMenuItem onSelect={() => setRelink(m.id)}>{m.link ? "Change the link" : "Link to…"}</DropdownMenuItem>}
                {m.mine && m.link && <DropdownMenuItem onSelect={() => act(() => setMessageLinkAction(clientId, m.id, null))}>Remove the link</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => act(() => pinMessageAction(clientId, m.id, !m.pinned))}>{m.pinned ? "Unpin" : "Pin to the top"}</DropdownMenuItem>
                {m.mine && <DropdownMenuSeparator />}
                {m.mine && (
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemove(m)}>
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {/* Reactions hang off the bubble's foot: theirs, and yours (a tap takes it off). */}
        {!inPins && (m.reactions?.client || m.reactions?.coach) && (
          <span className="rm-reacts">
            {m.reactions?.client && (
              <span className="rm-react theirs" title={`${firstName}'s reaction`}>
                {m.reactions.client}
              </span>
            )}
            {m.reactions?.coach && (
              <button type="button" className="rm-react mine" onClick={() => react(m, null)} title="Take yours off">
                {m.reactions.coach}
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
  // Pinned, edited, and the time: no name, as the side it is on says who.
  function meta(m: DraftMessage, inPins: boolean) {
    return (
      <span className="rm-meta">
        {m.pinned && !inPins && (
          <span className="rm-meta-pin" title="Pinned">
            <PinIcon filled />
          </span>
        )}
        {m.edited && "Edited "}
        {inPins ? m.when : timeOf(m.when)}
      </span>
    );
  }

  return (
    <div className="rd rm">
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Messages</span>
          <h1 className="rd-title">
            <span className="rm-avatar" aria-hidden="true">
              {plan.avatarPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                <img src={plan.avatarPath} alt="" />
              ) : (
                firstName.charAt(0).toUpperCase()
              )}
            </span>
            {firstName}
          </h1>
        </div>
      </header>

      <section ref={chat} className="rd-session open rm-chat" aria-label={`Conversation with ${firstName}`}>
        {pinShown && (
          <div className="rm-pinbar-wrap">
          <button type="button" className="rm-pinbar" onClick={goToPin} title={pinned.length > 1 ? "Go to this pinned message; the next pin shows" : "Go to the pinned message"}>
            {/* One mark a pin when there are several, the one showing filled. */}
            {pinned.length > 1 && (
              <span className="rm-pinbar-marks" aria-hidden="true">
                {pinned.map((p, i) => (
                  <i key={p.id} className={i === pinAt % pinned.length ? "on" : ""} />
                ))}
              </span>
            )}
            <span className="rm-pinbar-pin" aria-hidden="true">
              <PinIcon />
            </span>
            {pinShown.media && <span className="rm-pinbar-kind">{pinShown.media.type === "image" ? "📷" : pinShown.media.type === "video" ? "🎥" : pinShown.media.type === "audio" ? "🎤" : "📄"}</span>}
            <span className="rm-pinbar-text">
              {pinShown.text || (pinShown.media ? (pinShown.media.type === "image" ? "Photo" : pinShown.media.type === "video" ? "Video" : pinShown.media.type === "audio" ? "Voice message" : pinShown.media.name ?? "File") : pinShown.link?.label ?? "")}
            </span>
            {pinned.length > 1 && <span className="rm-pinbar-count">{(pinAt % pinned.length) + 1}/{pinned.length}</span>}
          </button>
          {/* Off the top straight from the bar. */}
          <button type="button" className="rm-pinbar-x" onClick={() => act(() => pinMessageAction(clientId, pinShown.id, false))} aria-label="Unpin this message" title="Unpin">
            ×
          </button>
          </div>
        )}
        <div
          ref={thread}
          className="rm-thread"
          onScroll={(e) => {
            const el = e.currentTarget;
            atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          <div ref={threadInner} className="rm-thread-inner">
          {days.length === 0 ? (
            <p className="rm-empty">Nothing yet. What you write lands on {firstName}&rsquo;s Home, and they answer from their app.</p>
          ) : (
            days.map((d) => (
              <div key={d.day} className="rm-day">
                <span className="rm-day-label">{d.day}</span>
                {d.items.map((m) => bubble(m))}
              </div>
            ))
          )}
          </div>
        </div>

        {/* The bar at the foot: the link, if one, then the box and Send. */}
        <div className="rm-bar">
          {link && (
            <span className="rm-link">
              <LinkGlyph />
              <span>{link.label}</span>
              <button type="button" className="rm-link-x" onClick={() => setLink(null)} aria-label="Remove the link">
                ×
              </button>
            </span>
          )}
          <div className="rm-bar-row">
            <button type="button" className="rd-btn ghost rm-linkbtn" disabled={nothingToLink || pending} aria-label="Link to something in the app" title={nothingToLink ? `Nothing in ${firstName}'s app to point at yet` : "Link to…"} onClick={() => setLinking(true)}>
              <LinkGlyph />
            </button>
            <button type="button" className="rd-btn ghost rm-linkbtn" disabled={pending} onClick={() => fileInput.current?.click()} aria-label="Send a photo, video or file" title="Photo, video or file">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M17.5 8.5l-8 8a3.5 3.5 0 0 1-5-5l8.3-8.3a2.4 2.4 0 0 1 3.4 3.4l-8.1 8.1a1.3 1.3 0 0 1-1.9-1.9l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) sendFile(f);
              }}
            />
            <VoiceRecordButton className="rd-btn ghost rm-linkbtn rm-mic" onRecorded={sendFile} disabled={pending} />
            <textarea
              ref={box}
              className="rm-box"
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${firstName}… (Shift+Enter for a new line)`}
              aria-label={`Message ${firstName}`}
              disabled={pending}
            />
            <button type="button" className="rd-btn primary rm-send" disabled={!ready} onClick={send} title="Send (Enter)">
              {pending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </section>

      <Dialog
        open={linking || relink != null}
        onOpenChange={(o) => {
          if (o) return;
          setLinking(false);
          setRelink(null);
        }}
      >
        {(linking || relink != null) && (
          <LinkDialog
            firstName={firstName}
            targets={t}
            onPick={(l) => {
              if (relink != null) {
                const id = relink;
                setRelink(null);
                act(() => setMessageLinkAction(clientId, id, JSON.stringify(l.link)));
              } else {
                setLink(l);
                setLinking(false);
                box.current?.focus();
              }
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!remove} onOpenChange={(o) => !o && setRemove(null)}>
        {remove && (
          <ConfirmDialog
            title="Delete this message?"
            description={`It leaves ${firstName}'s Home too. They may already have read it.`}
            confirm="Delete"
            danger
            onConfirm={() => {
              const id = remove.id;
              setRemove(null);
              act(() => deleteChatMessageAction(clientId, id), () => toast("Message deleted"));
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// ---- Link to…: one thing in the client's app, picked from what they can open.
// Three areas across the top, the same the coach comments on. Training is
// one week at a time: each session a heading that is itself a row, its
// exercises under it. Type to narrow any of it.
type Area = "training" | "nutrition" | "measurements";
function LinkDialog({ firstName, targets: t, onPick }: { firstName: string; targets: LinkTargets; onPick: (l: DraftLink & { link: MessageLink }) => void }) {
  const areas: { id: Area; label: string; empty: boolean }[] = [
    { id: "training", label: "Training", empty: t.training.length === 0 },
    { id: "nutrition", label: "Nutrition", empty: !t.nutrition && t.foodDays.length === 0 },
    { id: "measurements", label: "Measurements", empty: t.checkins.length === 0 && !t.photos },
  ];
  const [area, setArea] = useState<Area>(areas.find((a) => !a.empty)?.id ?? "training");
  const [weekAt, setWeekAt] = useState(0);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hit = (name: string) => !needle || name.toLowerCase().includes(needle);
  const week = t.training[weekAt] ?? null;
  const pick = (label: string, link: MessageLink) => onPick({ area, label, gone: false, link });
  const groups = week ? week.sessions.map((s) => ({ s, rows: s.exercises.filter((x) => hit(x.name)), whole: hit(s.title) })).filter((g) => g.whole || g.rows.length > 0) : [];

  return (
    <DialogContent className="rd-dlg rm-linkdlg">
      <DialogHeader>
        <DialogTitle>Link to…</DialogTitle>
        <DialogDescription>One thing in {firstName}&rsquo;s app. They tap the message and land on it.</DialogDescription>
      </DialogHeader>
      <div className="rd-btn-group rq-groups" role="group" aria-label="Which area">
        {areas.map((a) => (
          <button key={a.id} type="button" className={area === a.id ? "on" : ""} aria-pressed={area === a.id} disabled={a.empty} onClick={() => setArea(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="rm-linkdlg-tools">
        {area === "training" && t.training.length > 1 && (
          <Picker value={String(weekAt)} onChange={(v) => setWeekAt(Number(v))} label="Week" className="rm-week" options={t.training.map((w, i) => ({ value: String(i), label: w.label, hint: `${w.sessions.length} session${w.sessions.length === 1 ? "" : "s"}` }))} />
        )}
        <input className="rd-addrow-search rm-linkdlg-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={area === "training" ? "Find a session or exercise" : "Find…"} aria-label="Find" autoFocus />
      </div>
      <div className="rd-addrow-list rq-things rm-linkdlg-list" role="listbox">
        {area === "training" && week && (
          <>
            {groups.map(({ s, rows }) => (
              <div key={s.dayId} className="rm-linkdlg-group">
                <button type="button" role="option" aria-selected={false} className="rd-addrow-item rm-linkdlg-head" onClick={() => pick(`${s.title} · ${week.label}`, { kind: "session", dayId: s.dayId })}>
                  {s.title}
                  <small>the whole session</small>
                </button>
                {rows.map((x) => (
                  <button key={x.assignmentId} type="button" role="option" aria-selected={false} className="rd-addrow-item rm-linkdlg-ex" onClick={() => pick(`${x.name} · ${s.title}, ${week.label}`, { kind: "exercise", dayId: s.dayId, assignmentId: x.assignmentId })}>
                    {x.name}
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="rd-addrow-hint">Nothing in {week.label} matches that.</p>}
          </>
        )}
        {area === "nutrition" && (
          <>
            {t.nutrition && hit("targets") && (
              <button type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => pick("Nutrition targets", { kind: "nutrition" })}>
                Their targets
                <small>calories and macros</small>
              </button>
            )}
            {t.foodDays.length > 0 && <span className="rd-menu-head">Food diary · last two weeks</span>}
            {t.foodDays
              .filter((d) => hit(d.label))
              .map((d) => (
                <button key={d.date} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => pick(`Food diary · ${d.label}`, { kind: "food", date: d.date })}>
                  {d.label}
                </button>
              ))}
          </>
        )}
        {area === "measurements" && (
          <>
            {t.checkins
              .filter((c) => hit(c === "daily" ? "Daily check-in" : "Weekly check-in"))
              .map((c) => (
                <button key={c} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => pick(c === "daily" ? "Daily check-in" : "Weekly check-in", { kind: "checkin", section: c })}>
                  {c === "daily" ? "Daily check-in" : "Weekly check-in"}
                </button>
              ))}
            {t.photos && hit("Progress pictures") && (
              <button type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => pick("Progress pictures", { kind: "photos" })}>
                Progress pictures
              </button>
            )}
          </>
        )}
      </div>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

// A picture shows, a video and a voice message play, any other file downloads.
function Media({ media }: { media: DraftMedia }) {
  if (media.type === "video") return <video className="rm-media-video" src={media.path} controls playsInline />;
  if (media.type === "audio") return <audio className="rm-media-audio" src={media.path} controls preload="metadata" />;
  if (media.type === "file")
    return (
      <a className="rm-media-file" href={media.path} download={media.name ?? undefined} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
        <span>{media.name ?? "File"}</span>
      </a>
    );
  // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
  return <img className="rm-media-img" src={media.path} alt="" />;
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
