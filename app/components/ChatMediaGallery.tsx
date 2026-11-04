"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChatVideo, FullImage, FullVideo, sized } from "./ChatMedia";

// Everything sent in a chat, gathered (2 Oct): the photos and videos as a
// grid, and the files and voice messages as a list, newest first. Tapping
// one goes to it in the chat; ↗ opens the file itself. One view for both
// sides: the coach's chat (Messages and the panel) and the client's.
// Since 27 Oct (Alex: "finding the form check from week three means scrolling past two months of chat") it finds
// things too: a search line over it reads every message's words and every file's name and exercise. The photos and
// videos are tiles alone (27 Oct, Alex: the ↗ did what a tap does; the chips by exercise taken out for now).
// Since 4 Nov (Alex: "if I click on a picture, I want to be able to just see the picture there. I don't need to be going
// to the chat"; "just photos, videos, and files"): Photos | Videos | Files as the capsule across the row (a voice message
// is a file), and a tap opens the thing right here: a photo on the whole screen, a video playing, a file itself. Only
// the search's words still go to their message in the chat.
// Deliberately does NOT import from ../lib/queries (see ChatComposeForm.tsx).

export type GalleryItem = {
  id: number;
  /** Who sent it, as the viewer says it: "You", or the other side's name. */
  who: string;
  /** When, in words: "23 Sept, 14:02". */
  when: string;
  /** What was sent with it, if anything (a message of words alone has none). */
  media?: { path: string; type: "image" | "video" | "audio" | "file"; name?: string | null } | null;
  /** Its words. */
  text?: string;
  /** The exercise it is about, when it was sent from one or linked to one ("Leg Press"). */
  about?: string | null;
};

/** The exercise a message's link names: "Leg Press · Lower, Week 4" → "Leg Press" (an exercise's link only). */
export const exerciseOf = (link: { kind?: string } | null | undefined, label: string | null | undefined) => (link?.kind === "exercise" && label ? label.split(" · ")[0].trim() || null : null);

const kindWord = (t: string) => (t === "image" ? "Photo" : t === "video" ? "Video" : t === "audio" ? "Voice message" : "File");

/** The words with what was searched for picked out (ink, 600), the rest as it is. */
function Marked({ text, q }: { text: string; q: string }) {
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || at < 0) return <>{text}</>;
  // Start a little before the match, so a long message still shows it.
  const from = Math.max(0, at - 40);
  return (
    <>
      {from > 0 && "…"}
      {text.slice(from, at)}
      <mark className="cmg-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

export default function ChatMediaGallery({ items, onShow, onClose }: { items: GalleryItem[]; onShow: (id: number) => void; onClose: () => void }) {
  const withMedia = items.filter((i) => i.media);
  const photos = withMedia.filter((i) => i.media!.type === "image");
  const videos = withMedia.filter((i) => i.media!.type === "video");
  const files = withMedia.filter((i) => i.media!.type === "file" || i.media!.type === "audio");
  const [tab, setTab] = useState<"photos" | "videos" | "files">(photos.length || (!videos.length && !files.length) ? "photos" : videos.length ? "videos" : "files");
  const [q, setQ] = useState("");
  // Opened on the whole screen, right here (4 Nov, Alex).
  const [open, setOpen] = useState<{ type: "image" | "video"; path: string } | null>(null);
  const show = (id: number) => {
    onClose();
    onShow(id);
  };
  // A search result: its media opens here, words go to their message.
  const showFound = (i: GalleryItem) => {
    if (i.media && (i.media.type === "image" || i.media.type === "video") && !i.text?.trim()) setOpen({ type: i.media.type, path: i.media.path });
    else show(i.id);
  };
  const grid = (list: GalleryItem[], empty: string) =>
    list.length === 0 ? (
      <p className="cmg-empty">{empty}</p>
    ) : (
      <div className="cmg-grid">
        {list.map((i) => (
          <div key={i.id} className="cmg-tile">
            <button type="button" className="cmg-thumb" onClick={() => setOpen({ type: i.media!.type as "image" | "video", path: i.media!.path })} aria-label={`${i.media!.type === "video" ? "Play the video" : "Open the photo"} from ${i.who}, ${i.when}${i.about ? `, ${i.about}` : ""}`} title={`${i.who} | ${i.when}${i.about ? ` | ${i.about}` : ""}`}>
              {i.media!.type === "video" ? (
                <>
                  <ChatVideo src={i.media!.path} controls={false} muted />
                  <span className="cmg-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                    </svg>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- an upload from the chat
                <img src={sized(i.media!.path, 480)} alt="" loading="lazy" decoding="async" />
              )}
            </button>
          </div>
        ))}
      </div>
    );
  const term = q.trim();
  const needle = term.toLowerCase();
  const found = term ? items.filter((i) => [i.text, i.about, i.media?.name, i.media ? kindWord(i.media.type) : null].some((w) => w && w.toLowerCase().includes(needle))) : [];
  return (
    <div className="cmg" role="dialog" aria-label="Media and files">
      <div className="cmg-head">
        <button type="button" className="cmg-back" onClick={onClose} aria-label="Back to the chat">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <b>Media and files</b>
        {/* Room the back button's width, so the title sits truly centred. */}
        <span className="cmg-head-end" aria-hidden="true" />
      </div>
      <label className="cmg-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the chat" aria-label="Search the chat" enterKeyHint="search" />
      </label>
      {term ? (
        <div className="cmg-body">
          {found.length === 0 ? (
            <p className="cmg-empty">Nothing found</p>
          ) : (
            <ul className="cmg-list cmg-found">
              {found.map((i) => (
                <li key={i.id} className="cmg-file">
                  <button type="button" className="cmg-file-main" onClick={() => showFound(i)} title={i.text?.trim() ? "Show it in the chat" : undefined}>
                    <span className="cmg-file-text">
                      <b className="cmg-found-text">{i.text?.trim() ? <Marked text={i.text} q={term} /> : i.media ? <Marked text={i.media.type === "file" ? (i.media.name ?? "File") : kindWord(i.media.type)} q={term} /> : null}</b>
                      <small>
                        {i.who}
                        <i className="cmg-sep" aria-hidden="true" />
                        <span className="sr-only">, </span>
                        {i.when}
                        {i.about && (
                          <>
                            <i className="cmg-sep" aria-hidden="true" />
                            <span className="sr-only">, </span>
                            {i.about}
                          </>
                        )}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* Photos | Videos | Files, the capsule across the whole row in three equal parts (4 Nov, Alex). */}
          <div className="cmg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "photos"} className={tab === "photos" ? "on" : ""} onClick={() => setTab("photos")}>
              Photos <small>{photos.length}</small>
            </button>
            <button type="button" role="tab" aria-selected={tab === "videos"} className={tab === "videos" ? "on" : ""} onClick={() => setTab("videos")}>
              Videos <small>{videos.length}</small>
            </button>
            <button type="button" role="tab" aria-selected={tab === "files"} className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}>
              Files <small>{files.length}</small>
            </button>
          </div>
          <div className="cmg-body">
            {tab === "photos" ? (
              grid(photos, "No photos yet")
            ) : tab === "videos" ? (
              grid(videos, "No videos yet")
            ) : files.length === 0 ? (
              <p className="cmg-empty">No files yet</p>
            ) : (
              <ul className="cmg-list">
                {files.map((i) => (
                  <li key={i.id} className="cmg-file">
                    {/* The row opens the file itself, a voice message playing (4 Nov, Alex: no going to the chat). */}
                    <a className="cmg-file-main" href={i.media!.path} target="_blank" rel="noreferrer" download={i.media!.type === "file" ? i.media!.name ?? undefined : undefined}>
                      <span className="cmg-file-icon" aria-hidden="true">
                        {/* The icon alone, line-drawn (24 Oct, Alex: the emoji were the old design). */}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          {i.media!.type === "audio" ? (
                            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
                          ) : (
                            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" />
                          )}
                        </svg>
                      </span>
                      <span className="cmg-file-text">
                        <b>{i.media!.type === "audio" ? "Voice message" : i.media!.name ?? "File"}</b>
                        <small>
                          {i.who}
                          <i className="cmg-sep" aria-hidden="true" />
                          <span className="sr-only">, </span>
                          {i.when}
                        </small>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(open.type === "video" ? <FullVideo src={open.path} onClose={() => setOpen(null)} /> : <FullImage src={open.path} onClose={() => setOpen(null)} />, document.body)}
    </div>
  );
}
