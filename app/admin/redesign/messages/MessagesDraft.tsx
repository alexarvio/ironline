"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { MoreIcon } from "../../../components/icons";
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

export type DraftLink = { area: string; label: string; gone: boolean; link?: MessageLink };
export type DraftMedia = { path: string; type: "image" | "video" | "audio" | "file"; name?: string | null };
export type DraftMessage = { id: number; mine: boolean; text: string; when: string; media?: DraftMedia | null; link: DraftLink | null; reactions?: { coach?: string | null; client?: string | null }; pinned?: boolean; edited?: boolean };
/** Newest first, as the loader hands them over. */
export type DraftMessages = { messages: DraftMessage[]; targets: LinkTargets };
const REACTIONS = ["👍", "❤️", "💪", "🔥", "👏", "😂"] as const;
const POLL_MS = 15000;

/** "23 Sept, 14:02" → the day, and the time. */
const dayOf = (when: string) => when.split(", ")[0] ?? when;
const timeOf = (when: string) => when.split(", ")[1] ?? "";

export default function MessagesDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftMessages }) {
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
  const [reactOn, setReactOn] = useState<number | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = text.trim().length > 0 && !pending;
  const t = plan.targets;
  const nothingToLink = t.training.length === 0 && !t.nutrition && t.foodDays.length === 0 && t.checkins.length === 0 && !t.photos;

  // Opening reads what the client wrote (the rail's dot clears); then the
  // thread asks for anything new every so often. Every action refreshes.
  useEffect(() => {
    markSeenAction(clientId, { tab: "messages" });
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [clientId, router]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
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
  const react = (m: DraftMessage, emoji: string | null) => {
    setReactOn(null);
    act(() => reactToMessageAction(clientId, m.id, emoji));
  };
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

  const bubble = (m: DraftMessage, inPins = false) => (
    <div key={`${inPins ? "pin-" : ""}${m.id}`} className={`rm-bubble-row${m.mine ? " mine" : " theirs"}`}>
      <div className="rm-bubble-wrap">
        <div className={`rm-bubble${m.media ? " media" : ""}`}>
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
            m.text && <span className="rm-bubble-text">{m.text}</span>
          )}
          {m.link && (
            <span className={`rm-link sent${m.link.gone ? " gone" : ""}`} title={m.link.gone ? "The client can't open this any more" : undefined}>
              <LinkGlyph />
              <span>{m.link.label}</span>
              {m.link.gone && <em>no longer opens</em>}
            </span>
          )}
          <span className="rm-bubble-when">
            {m.mine ? "You" : firstName} · {timeOf(m.when)}
            {m.edited && " · edited"}
            {m.pinned && !inPins && " · pinned"}
          </span>
        </div>
        {!inPins && (
          <div className="rm-bubble-foot">
            {/* Reactions: theirs, yours (a tap takes it off), and the smiley to pick one. */}
            <span className="rm-reacts">
              {m.reactions?.client && <span className="rm-react theirs">{m.reactions.client}</span>}
              {m.reactions?.coach && (
                <button type="button" className="rm-react mine" onClick={() => react(m, null)} title="Take yours off">
                  {m.reactions.coach}
                </button>
              )}
              <span className="rm-react-add">
                <button type="button" className="rm-foot-btn" onClick={() => setReactOn(reactOn === m.id ? null : m.id)} aria-label="React" aria-expanded={reactOn === m.id}>
                  <SmileGlyph />
                </button>
                {reactOn === m.id && (
                  <span className="rm-react-row" role="listbox" aria-label="Pick a reaction">
                    {REACTIONS.map((e) => (
                      <button key={e} type="button" role="option" aria-selected={m.reactions?.coach === e} className={`rm-react-pick${m.reactions?.coach === e ? " on" : ""}`} onClick={() => react(m, m.reactions?.coach === e ? null : e)}>
                        {e}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="rm-foot-btn" aria-label="More for this message">
                <MoreIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align={m.mine ? "end" : "start"} className="pb-menu">
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
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="rd rm">
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Messages</span>
          <h1 className="rd-title">{firstName}</h1>
        </div>
      </header>

      <section className="rd-session open rm-chat" aria-label={`Conversation with ${firstName}`}>
        {pinned.length > 0 && (
          <div className="rm-pins">
            <span className="rm-pins-label">Pinned</span>
            {pinned.map((m) => bubble(m, true))}
          </div>
        )}
        <div className="rm-thread">
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
          <div ref={end} />
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

function SmileGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M5.5 9.5c.6.9 1.5 1.4 2.5 1.4s1.9-.5 2.5-1.4" />
      <circle cx="6" cy="6.5" r=".6" fill="currentColor" />
      <circle cx="10" cy="6.5" r=".6" fill="currentColor" />
      <path d="M12.5 2.5v3M11 4h3" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" />
    </svg>
  );
}
