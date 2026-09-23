"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "../components/icons";
import ChatComposeForm from "../components/ChatComposeForm";
import MessageReactions from "../components/MessageReactions";
import CoachMark from "./CoachMark";
import MessageLinkChip from "./MessageLinkChip";
import type { LinkView } from "../lib/messageLinks";

// The conversation with the coach: their messages on the left, the client's
// own on the right, oldest first, grouped by day, and a box to answer from
// at the foot. What the coach pinned stays at the top. Either side can put
// one emoji on a message. The coach writes from the Messages tab and reads
// the answers there; the client never has to leave the app for it.
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
};

// How often the thread asks for anything new while it is open.
const POLL_MS = 15000;

export default function CoachMessagesScreen({ coachName, messages, clientId, onBack }: CoachMessagesProps & { clientId: number; onBack: () => void }) {
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);
  const days: { label: string; items: CoachMessageView[] }[] = [];
  for (const m of messages) {
    const last = days[days.length - 1];
    if (last && last.label === m.dayLabel) last.items.push(m);
    else days.push({ label: m.dayLabel, items: [m] });
  }
  const pinned = messages.filter((m) => m.pinned);

  // Keep it fresh while it is open, and stay at the newest message.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const bubble = (m: CoachMessageView, inPins = false) => (
    <article key={`${inPins ? "pin-" : ""}${m.id}`} className={`cm-item${m.mine ? " mine" : ""}`}>
      <div className="cm-msg-row">
        {!m.mine && <CoachMark size="lg" />}
        <div className="cm-msg-wrap">
          <div className={`cm-msg${m.mine ? " mine" : ""}${m.media ? " media" : ""}`}>
            {m.media && <Media media={m.media} />}
            {m.text && <p className="cm-msg-text">{m.text}</p>}
            {m.link && <MessageLinkChip view={m.link} />}
            <span className="cm-msg-time">
              {m.timeLabel}
              {m.edited && " · edited"}
              {m.pinned && !inPins && " · pinned"}
            </span>
          </div>
          {!inPins && <MessageReactions clientId={clientId} messageId={m.id} mine={m.reactions?.client ?? null} theirs={m.reactions?.coach ?? null} align={m.mine ? "right" : "left"} />}
        </div>
      </div>
    </article>
  );

  return (
    <>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">{coachName}</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      {pinned.length > 0 && (
        <section className="cm-pins" aria-label="Pinned by your coach">
          <span className="cm-pins-label">Pinned by {coachName}</span>
          {pinned.map((m) => bubble(m, true))}
        </section>
      )}
      <main className="cm-body">
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
        <div ref={end} />
      </main>
      <footer className="cm-compose">
        <ChatComposeForm clientId={clientId} sender="client" />
      </footer>
    </>
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
