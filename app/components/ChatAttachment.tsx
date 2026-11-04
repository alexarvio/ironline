"use client";

// A photo, video or file picked in a chat waits over the box until Send (4 Nov, Alex: "something in the middle, in
// between choosing a video and sending it… the small thumbnail appears… above the chat box, and then we press send").
// One for every chat: the client's (ChatComposeForm), and next the coach's phone (app/coach/ChatThread.tsx) and the
// laptop's panel (app/admin/redesign/messages/MessagesDraft.tsx). A voice message keeps its own flow and never comes here.
//
// API
//   const att = useChatAttachment(clientId);
//     att.current   the file waiting, or null: { file, kind ("photo" | "video" | "file"), thumb (an object URL or null),
//                   status ("uploading" | "ready" | "failed" | "refused"), error (the server's words when refused),
//                   nonce (a one-time key for its send, "nonce": a send whose answer was lost, tried again, posts once) }
//     att.pick(f)   puts f over the box (one at a time: another pick replaces it) and starts its upload to
//                   /api/upload at once, so Send only carries the handle
//     att.retry()   uploads it again after a failure (the row's own tap)
//     att.take()    for Send: waits for the upload (starting it again if it failed) and gives { upload, poster }; set
//                   fd "upload" to the handle, and "poster" (a video's first frame) when there is one, then call
//                   sendChatMessageAction with the words as "text", as one message. Throws when it can't be had.
//     att.failSend() the send itself failed once the upload was in: `Not sent. Try again` in rust on the row (a chat
//                   with its own error line, the coach's phone and the laptop, need not call it)
//     att.clear()   takes it away (the ✕, or once sent): the upload is stopped, the object URLs revoked; an upload the
//                   server has and nobody claims is swept after an hour
//   <ChatAttachmentRow att={att} sending={pending} />   the row itself, over the box: a 44px thumbnail (a photo itself,
//     a video's first frame with a small play mark, the video itself drawn still until that frame is had, else a file
//     glyph), `Video | 12.4 MB` (a file its name), a round ✕.
//     While it goes up (or Send waits for it) the thumbnail breathes; failed, `Not uploaded. Tap to try again` in rust.
//     Classes `chat-att-` (globals.css, the 4 Nov block at its end); `--chat-att-inset` lines it up with the box.

import { useCallback, useEffect, useRef, useState } from "react";
import { videoFrame } from "./ChatMedia";
import { uploadFileFirst } from "../lib/uploadFirst";
import { Bars } from "../client/Bars";

export type ChatAttachmentKind = "photo" | "video" | "file";
export type ChatAttachmentStatus = "uploading" | "ready" | "failed" | "refused";
export type ChatAttachmentState = {
  file: File;
  kind: ChatAttachmentKind;
  thumb: string | null;
  /** A video's own object URL, drawn as its thumbnail until (or unless) its first frame is had as a picture. */
  video: string | null;
  status: ChatAttachmentStatus;
  error: string | null;
  nonce: string;
  /** Uploaded, but the send itself didn't go (no connection): the row says so until Send goes again. */
  unsent: boolean;
};
export type ChatAttachment = {
  current: ChatAttachmentState | null;
  pick: (file: File) => void;
  retry: () => void;
  take: () => Promise<{ upload: string; poster: Blob | null }>;
  /** The send failed after the upload: `Not sent. Try again` in rust on the row (4 Nov, review: the client's chat
      said nothing, the row just stopped breathing). */
  failSend: () => void;
  clear: () => void;
};

class Refused extends Error {}

// The server sweeps an unclaimed upload after an hour: one older than this goes again on Send.
const STALE_MS = 50 * 60 * 1000;
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Job = {
  id: number;
  file: File;
  urls: string[];
  poster: Promise<Blob | null>;
  upload: Promise<string> | null;
  abort: AbortController | null;
  at: number;
};

export function kindOf(file: File): ChatAttachmentKind {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

/** `820 KB`, `12.4 MB`. */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 100 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function useChatAttachment(clientId: number): ChatAttachment {
  const [current, setCurrent] = useState<ChatAttachmentState | null>(null);
  const job = useRef<Job | null>(null);
  const seq = useRef(0);
  // Only the file still waiting may change the row: an old one's late answer is dropped.
  const patch = useCallback((id: number, p: Partial<ChatAttachmentState>) => {
    if (job.current?.id !== id) return;
    setCurrent((c) => (c ? { ...c, ...p } : c));
  }, []);

  const drop = useCallback(() => {
    const j = job.current;
    job.current = null;
    if (!j) return;
    j.abort?.abort();
    for (const u of j.urls) URL.revokeObjectURL(u);
  }, []);

  const startUpload = useCallback(
    (j: Job) => {
      const abort = new AbortController();
      j.abort = abort;
      j.at = Date.now();
      const up = uploadFileFirst(j.file, "chat", clientId, abort.signal).then((r) => {
        if ("refused" in r) throw new Refused(r.refused);
        return r.handle;
      });
      j.upload = up;
      patch(j.id, { status: "uploading", error: null });
      // Only the latest upload of this file may say how it went (4 Nov, review: a retry tapped while Send restarted
      // it left an older one's late failure over a newer one's success).
      up.then(
        () => {
          if (j.upload === up) patch(j.id, { status: "ready" });
        },
        (e) => {
          if (abort.signal.aborted || j.upload !== up) return;
          if (e instanceof Refused) patch(j.id, { status: "refused", error: e.message });
          else patch(j.id, { status: "failed", error: null });
        },
      );
      return up;
    },
    [clientId, patch],
  );

  const pick = useCallback(
    (file: File) => {
      drop();
      const id = ++seq.current;
      const kind = kindOf(file);
      const urls: string[] = [];
      const thumb = kind === "photo" ? URL.createObjectURL(file) : null;
      if (thumb) urls.push(thumb);
      // The video itself stands in as its thumbnail at once (4 Nov, Alex: "I want also the thumbnail of the video in
      // there"; a 114 MB camera-roll clip showed a grey tile, its frame never taken on the iPhone): Safari draws a
      // <video>'s first frame by itself. Its picture replaces it once had.
      const video = kind === "video" ? URL.createObjectURL(file) : null;
      if (video) urls.push(video);
      // A video's first frame, taken once: the thumbnail now and the message's poster on Send (25 Oct, as WhatsApp).
      const poster = kind === "video" ? videoFrame(file) : Promise.resolve(null);
      const j: Job = { id, file, urls, poster, upload: null, abort: null, at: 0 };
      job.current = j;
      setCurrent({ file, kind, thumb, video, status: "uploading", error: null, nonce: newKey(), unsent: false });
      if (kind === "video")
        void poster.then((b) => {
          if (!b || job.current?.id !== id) return;
          const u = URL.createObjectURL(b);
          j.urls.push(u);
          patch(id, { thumb: u });
        });
      void startUpload(j).catch(() => {});
    },
    [drop, patch, startUpload],
  );

  const retry = useCallback(() => {
    const j = job.current;
    if (j) void startUpload(j).catch(() => {});
  }, [startUpload]);

  const take = useCallback(async () => {
    const j = job.current;
    if (!j) throw new Error("Nothing attached");
    patch(j.id, { unsent: false });
    // Failed, or so old the server has swept it: it goes again now. Refused stays refused (its words thrown).
    const was = j.upload ? await j.upload.then(() => "ok", (e) => (e instanceof Refused ? "refused" : "failed")) : "failed";
    const up = was === "failed" || Date.now() - j.at > STALE_MS || !j.upload ? startUpload(j) : j.upload;
    const upload = await up;
    const poster = await j.poster;
    return { upload, poster };
  }, [patch, startUpload]);

  const failSend = useCallback(() => {
    const j = job.current;
    if (j) patch(j.id, { unsent: true });
  }, [patch]);

  const clear = useCallback(() => {
    drop();
    setCurrent(null);
  }, [drop]);

  // Leaving the chat throws it away (its object URLs with it), and so does another client's thread in the same screen
  // (4 Nov, review: the laptop's panel is reused without a key, and the upload is staged for the client it was picked
  // for, so the server would refuse it on another's thread and the message go without it).
  useEffect(
    () => () => {
      drop();
      setCurrent(null);
    },
    [clientId, drop],
  );

  return { current, pick, retry, take, failSend, clear };
}

export function ChatAttachmentRow({ att, sending = false }: { att: ChatAttachment; sending?: boolean }) {
  const a = att.current;
  const [broken, setBroken] = useState<string | null>(null);
  if (!a) return null;
  const busy = a.status === "uploading" || sending;
  const thumb = a.thumb && broken !== a.thumb ? a.thumb : null;
  const video = !thumb && a.kind === "video" && a.video && broken !== a.video ? a.video : null;
  const label = a.kind === "photo" ? "Photo" : a.kind === "video" ? "Video" : a.file.name || "File";
  const body = (
    <>
      <span className={`chat-att-thumb ${a.kind}${thumb || video ? " has" : ""}${busy ? " busy" : ""}`} aria-hidden="true">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" onError={() => setBroken(thumb)} />
        ) : video ? (
          // The video drawn still at 0.1 s as its own thumbnail until its frame is a picture (4 Nov, Alex).
          <video
            src={`${video}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            onError={() => setBroken(video)}
          />
        ) : a.kind === "file" || a.kind === "photo" ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8L14 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M14 3.5V8h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        ) : null}
        {a.kind === "video" && (
          <span className="chat-att-play">
            <svg viewBox="0 0 12 12" width="8" height="8">
              <path d="M3.5 2.2v7.6L9.6 6z" fill="currentColor" />
            </svg>
          </span>
        )}
      </span>
      <span className="chat-att-text">
        <span className="chat-att-name">
          <Bars parts={[<span key="n" className="chat-att-label">{label}</span>, fileSize(a.file.size)]} />
        </span>
        {a.status === "failed" && <span className="chat-att-err">Not uploaded. Tap to try again</span>}
        {a.status === "refused" && <span className="chat-att-err">{a.error || "Not uploaded"}</span>}
        {a.unsent && a.status === "ready" && !sending && <span className="chat-att-err">Not sent. Try again</span>}
      </span>
    </>
  );
  return (
    <div className={`chat-att${a.status === "failed" || a.status === "refused" ? " bad" : ""}`}>
      {a.status === "failed" ? (
        <button type="button" className="chat-att-main" onClick={att.retry} aria-label="Upload it again">
          {body}
        </button>
      ) : (
        <span className="chat-att-main" aria-busy={busy || undefined}>
          {body}
        </span>
      )}
      <button type="button" className="chat-att-x" onClick={att.clear} disabled={sending} aria-label={`Don't send this ${a.kind}`}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
