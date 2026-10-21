"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { logoutAction } from "../lib/auth-actions";
import { chatWhen } from "../admin/redesign/ChatList";
import { dayMonth } from "../lib/dayMonth";
import { coachInboxAction, type CoachInbox } from "./actions";
import type { PhoneVideo } from "../lib/coachPhone";
import ChatThread from "./ChatThread";
import PhoneReview from "./PhoneReview";
import { Avatar, Facts, Icon, Sheet } from "./parts";

// The coach's phone (21 Oct, Alex): Chats and Videos on a floating tab bar,
// a chat or a video over them. Where it is lives in the address (?c=, ?v=,
// ?tab=videos), moved with the browser's own history so the phone's Back
// works and nothing is fetched to switch screens. The lists ask for
// themselves every 15 s while the app is showing, as the chat does.

const POLL_MS = 15000;

export default function CoachApp({ inbox: fromPage, coach }: { inbox: CoachInbox; coach: { name: string; photoPath: string | null } }) {
  const params = useSearchParams();
  const chatId = Number(params.get("c")) || null;
  const videoId = Number(params.get("v")) || null;
  const tab: "chats" | "videos" = params.get("tab") === "videos" ? "videos" : "chats";

  const [inbox, setInbox] = useState(fromPage);
  const pageKey = JSON.stringify(fromPage);
  const [seenPage, setSeenPage] = useState(pageKey);
  if (seenPage !== pageKey) {
    setSeenPage(pageKey);
    setInbox(fromPage);
  }
  const refresh = useCallback(async () => {
    const next = await coachInboxAction().catch(() => null);
    if (next) setInbox(next);
  }, []);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Opened from a list in this visit: Back is the browser's. Opened straight from a link: Back is the list.
  const fromList = useRef(false);
  const go = (query: string, how: "push" | "replace" = "push") => window.history[how === "push" ? "pushState" : "replaceState"](null, "", query ? `/coach?${query}` : "/coach");
  const open = (query: string) => {
    fromList.current = true;
    go(query);
  };
  const back = () => {
    if (fromList.current) {
      fromList.current = false;
      window.history.back();
    } else go(videoId || tab === "videos" ? "tab=videos" : "", "replace");
    void refresh();
  };
  if (chatId) {
    const chat = inbox.chats.find((c) => c.id === chatId) ?? null;
    return (
      <div className="cph">
        <ChatThread
          key={chatId}
          clientId={chatId}
          name={chat?.name ?? ""}
          avatarPath={chat?.avatarPath ?? null}
          onBack={back}
          onRead={() => setInbox((b) => ({ ...b, chats: b.chats.map((c) => (c.id === chatId ? { ...c, unread: false, unreadCount: 0 } : c)) }))}
        />
      </div>
    );
  }
  if (videoId) {
    return (
      <div className="cph">
        <PhoneReview key={videoId} requestId={videoId} onBack={back} onSent={() => void refresh()} />
      </div>
    );
  }

  const unreadChats = inbox.chats.filter((c) => c.unread).length;
  const waiting = inbox.videos.waiting.length;
  return (
    <div className="cph">
      <Lists
        tab={tab}
        inbox={inbox}
        coach={coach}
        onOpenChat={(id) => {
          listY[tab] = window.scrollY;
          open(`c=${id}`);
        }}
        onOpenVideo={(id) => {
          listY[tab] = window.scrollY;
          open(`v=${id}`);
        }}
      />
      <nav className="cph-nav" aria-label="Coach app">
        <button type="button" className={`cph-tab${tab === "chats" ? " on" : ""}`} aria-current={tab === "chats" ? "page" : undefined} onClick={() => tab !== "chats" && go("", "replace")}>
          <Icon name="chat" />
          Chats
          {unreadChats > 0 && <b aria-label={`${unreadChats} unread`}>{unreadChats}</b>}
        </button>
        <button type="button" className={`cph-tab${tab === "videos" ? " on" : ""}`} aria-current={tab === "videos" ? "page" : undefined} onClick={() => tab !== "videos" && go("tab=videos", "replace")}>
          <Icon name="video" />
          Videos
          {waiting > 0 && <b aria-label={`${waiting} waiting`}>{waiting}</b>}
        </button>
      </nav>
    </div>
  );
}

/** Where each list was left, for coming back from a chat or a video. */
const listY: Record<string, number> = {};

function Lists({ tab, inbox, coach, onOpenChat, onOpenVideo }: { tab: "chats" | "videos"; inbox: CoachInbox; coach: { name: string; photoPath: string | null }; onOpenChat: (id: number) => void; onOpenVideo: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [account, setAccount] = useState(false);
  // Back from a chat or a video: the list where it was left.
  useEffect(() => {
    window.scrollTo(0, listY[tab] ?? 0);
  }, [tab]);
  const needle = q.trim().toLowerCase();
  const chats = inbox.chats.filter((c) => !needle || c.name.toLowerCase().includes(needle));
  const now = new Date();

  return (
    <main className="cph-list">
      <header className="cph-head">
        <h1>{tab === "chats" ? "Chats" : "Videos"}</h1>
        <button type="button" className="cph-me" onClick={() => setAccount(true)} aria-label={`${coach.name}: sign out`}>
          <Avatar name={coach.name} src={coach.photoPath} size={30} />
        </button>
      </header>

      {tab === "chats" ? (
        <>
          <label className="cph-search">
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" aria-label="Search clients" enterKeyHint="search" />
          </label>
          {chats.length === 0 ? (
            <p className="cph-empty">{needle ? "No match" : "No clients yet"}</p>
          ) : (
            <ul className="cph-rows">
              {chats.map((c) => {
                const n = c.unreadCount ?? (c.unread ? 1 : 0);
                const media = c.last?.media ?? null;
                // A file with no words says what it is; with words, the words.
                const bare = !!media && /^an? (picture|video|voice message|file)$/.test(c.last?.text ?? "");
                const words = !c.last ? "No messages yet" : `${c.last.mine ? "You: " : ""}${bare && media ? MEDIA_WORDS[media] : c.last.text.split("\n")[0]}`;
                return (
                  <li key={c.id}>
                    <button type="button" className={`cph-chat${n > 0 ? " unread" : ""}`} onClick={() => onOpenChat(c.id)}>
                      <Avatar name={c.name} src={c.avatarPath} size={46} />
                      <span className="cph-chat-main">
                        <span className="cph-chat-top">
                          <b>{c.name}</b>
                          <time>{c.last ? chatWhen(c.last.at, now) : ""}</time>
                        </span>
                        <span className="cph-chat-bottom">
                          <span className="cph-chat-line">
                            {media && <Icon name={MEDIA_ICON[media]} small />}
                            {words}
                          </span>
                          {n > 0 && <i className="cph-count" aria-label={`${n} unread`}>{n}</i>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <h2 className="cph-label">Waiting</h2>
          {inbox.videos.waiting.length === 0 ? <p className="cph-empty left">None</p> : <VideoRows rows={inbox.videos.waiting} now={now.getTime()} onOpen={onOpenVideo} />}
          {inbox.videos.replied.length > 0 && (
            <>
              <h2 className="cph-label quiet">Replied</h2>
              <VideoRows rows={inbox.videos.replied} now={now.getTime()} onOpen={onOpenVideo} past />
            </>
          )}
        </>
      )}

      {account && (
        <Sheet onClose={() => setAccount(false)} label="Account">
          <div className="cph-sheet-who">
            <Avatar name={coach.name} src={coach.photoPath} size={40} />
            <b>{coach.name}</b>
          </div>
          <button type="button" className="cph-sheet-row" onClick={() => logoutAction()}>
            Sign out
          </button>
        </Sheet>
      )}
    </main>
  );
}

const MEDIA_WORDS = { image: "Photo", video: "Video", audio: "Voice message", file: "File" } as const;
const MEDIA_ICON = { image: "photo", video: "video", audio: "mic", file: "file" } as const;

/** How long it has waited: minutes, hours, then days (rust past a day, as the Feed's waits). */
function waitFor(since: number, now: number): { text: string; late: boolean } {
  const m = Math.max(0, Math.round((now - since) / 60000));
  if (m < 60) return { text: `${Math.max(1, m)} min`, late: false };
  const h = Math.round(m / 60);
  if (h < 24) return { text: `${h} h`, late: false };
  const d = Math.floor(h / 24);
  return { text: `${d} day${d === 1 ? "" : "s"}`, late: true };
}

function VideoRows({ rows, now, onOpen, past = false }: { rows: PhoneVideo[]; now: number; onOpen: (id: number) => void; past?: boolean }) {
  return (
    <ul className="cph-rows">
      {rows.map((v) => {
        const wait = waitFor(v.sentAt, now);
        const first = v.client.split(/\s+/)[0] || v.client;
        return (
          <li key={v.id}>
            <button type="button" className={`cph-video${past ? " past" : ""}`} onClick={() => onOpen(v.id)}>
              <span className="cph-thumb" aria-hidden="true">
                <Icon name={v.media === "photo" ? "photo" : "play"} />
              </span>
              <span className="cph-video-main">
                <b>{v.exercise}</b>
                <span className="cph-video-who">
                  <Avatar name={v.client} src={v.avatarPath} size={18} />
                  <Facts parts={[first, v.week]} />
                </span>
                <span className="cph-video-facts">
                  {past ? (
                    <Facts parts={[v.reply === "review" ? "Form review" : "Written reply", v.repliedAt ? dayMonth(new Date(v.repliedAt)) : null]} />
                  ) : (
                    <Facts parts={[v.asked ? "Asked for" : "Sent unasked", v.media === "photo" ? "Photo" : null, <span key="w" className={wait.late ? "late" : undefined}>{wait.text}</span>]} />
                  )}
                </span>
              </span>
              {!past && <span className="cph-act">Review</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
