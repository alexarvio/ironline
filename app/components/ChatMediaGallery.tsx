"use client";

import { useState } from "react";
import { ChatVideo, sized } from "./ChatMedia";

// Everything sent in a chat, gathered (2 Oct): the photos and videos as a
// grid, and the files and voice messages as a list, newest first. Tapping
// one goes to it in the chat; ↗ opens the file itself. One view for both
// sides: the coach's chat (Messages and the panel) and the client's.
// Deliberately does NOT import from ../lib/queries (see ChatComposeForm.tsx).

export type GalleryItem = {
  id: number;
  /** Who sent it, as the viewer says it: "You", or the other side's name. */
  who: string;
  /** When, in words: "23 Sept, 14:02". */
  when: string;
  media: { path: string; type: "image" | "video" | "audio" | "file"; name?: string | null };
};

export default function ChatMediaGallery({ items, onShow, onClose }: { items: GalleryItem[]; onShow: (id: number) => void; onClose: () => void }) {
  const visual = items.filter((i) => i.media.type === "image" || i.media.type === "video");
  const files = items.filter((i) => i.media.type === "file" || i.media.type === "audio");
  const [tab, setTab] = useState<"media" | "files">(visual.length || !files.length ? "media" : "files");
  const show = (id: number) => {
    onClose();
    onShow(id);
  };
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
      <div className="cmg-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "media"} className={tab === "media" ? "on" : ""} onClick={() => setTab("media")}>
          Photos &amp; videos <small>{visual.length}</small>
        </button>
        <button type="button" role="tab" aria-selected={tab === "files"} className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}>
          Files &amp; voice <small>{files.length}</small>
        </button>
      </div>
      <div className="cmg-body">
        {tab === "media" ? (
          visual.length === 0 ? (
            <p className="cmg-empty">No photos or videos sent yet.</p>
          ) : (
            <div className="cmg-grid">
              {visual.map((i) => (
                <div key={i.id} className="cmg-tile">
                  <button type="button" className="cmg-thumb" onClick={() => show(i.id)} aria-label={`${i.media.type === "video" ? "Video" : "Photo"} from ${i.who}, ${i.when}: show it in the chat`} title={`${i.who} · ${i.when}`}>
                    {i.media.type === "video" ? (
                      <>
                        <ChatVideo src={i.media.path} controls={false} muted />
                        <span className="cmg-play" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                          </svg>
                        </span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- an upload from the chat
                      <img src={sized(i.media.path, 480)} alt="" loading="lazy" decoding="async" />
                    )}
                  </button>
                  <a className="cmg-open" href={i.media.path} target="_blank" rel="noreferrer" aria-label="Open it full size" title="Open">
                    ↗
                  </a>
                </div>
              ))}
            </div>
          )
        ) : files.length === 0 ? (
          <p className="cmg-empty">No files or voice messages sent yet.</p>
        ) : (
          <ul className="cmg-list">
            {files.map((i) => (
              <li key={i.id} className="cmg-file">
                <button type="button" className="cmg-file-main" onClick={() => show(i.id)} title="Show it in the chat">
                  <span className="cmg-file-icon" aria-hidden="true">
                    {/* The icon alone, line-drawn (24 Oct, Alex: the emoji were the old design). */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      {i.media.type === "audio" ? (
                        <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
                      ) : (
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" />
                      )}
                    </svg>
                  </span>
                  <span className="cmg-file-text">
                    <b>{i.media.type === "audio" ? "Voice message" : i.media.name ?? "File"}</b>
                    <small>
                      {i.who}
                      <i className="cmg-sep" aria-hidden="true" />
                      <span className="sr-only">, </span>
                      {i.when}
                    </small>
                  </span>
                </button>
                <a className="cmg-open static" href={i.media.path} target="_blank" rel="noreferrer" download={i.media.type === "file" ? i.media.name ?? undefined : undefined} aria-label="Open the file" title="Open">
                  ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
