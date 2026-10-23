"use client";

import "./demo-video.css";
import { useEffect, useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth } from "../../../lib/dayMonth";
import { Sep, SepJoin } from "../Sep";

// The demo video on an exercise (15 Oct), in the admin hairline style (20 Oct,
// Alex): the exercise name, one quiet fact line, the demo as clients see it,
// then a new source: a link, a file (dropped or chosen, with progress), or one
// of the coach's own videos. No explanations. The demo belongs to the library
// exercise: set once, every client's sheet with it shows it. Prefix dmvh-.

const PLAY = "M8 5v14l11-7z";
export type DemoCurrent = { url: string; source: "library" | "row" } | null;
export type CoachClip = { id: number; path: string; name: string; at: string; bytes: number | null };
type Tab = "link" | "file" | "mine";
const TAB_KEY = "norcoach:demo-tab";
const MAX_BYTES = 200 * 1024 * 1024;

const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const isUpload = (url: string) => url.startsWith("/uploads/");
const validUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim()) || isUpload(s.trim());
function providerOf(url: string): "YouTube" | "YouTube Shorts" | "Vimeo" | "Drive" | "Link" | "Uploaded file" {
  if (isUpload(url)) return "Uploaded file";
  if (/youtube\.com\/shorts\//i.test(url)) return "YouTube Shorts";
  if (ytId(url) || /youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/vimeo\.com/i.test(url)) return "Vimeo";
  if (/drive\.google\.com|docs\.google\.com/i.test(url)) return "Drive";
  return "Link";
}
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
const fileName = (path: string) => decodeURIComponent(path.split("?")[0].split("/").pop() ?? "video").replace(/\.[a-z0-9]+$/i, "");
const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** The poster for a source: YouTube's thumbnail, the clip's first frame, or the plain dark tile. */
function Poster({ url, onDuration }: { url: string; onDuration?: (s: number) => void }) {
  const id = ytId(url);
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
    );
  if (isUpload(url)) return <video src={`${url}#t=0.5`} preload="metadata" muted playsInline draggable={false} onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && onDuration?.(e.currentTarget.duration)} />;
  return null;
}

export default function DemoVideoDialog({
  exerciseName,
  clientsUsing,
  current,
  videos,
  onLink,
  onUpload,
  onRemove,
  onClose,
  startTab,
}: {
  /** The part it opens on (the Library's Add link / Add video, 21 Oct); else the one picked last. */
  startTab?: Tab;
  exerciseName: string;
  clientsUsing: number;
  current: DemoCurrent;
  /** The coach's own clips, from the library. */
  videos: CoachClip[];
  onLink: (url: string) => Promise<void>;
  onUpload: (file: File, onProgress: (share: number) => void) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(() => {
    if (startTab) return startTab;
    try {
      const t = window.localStorage.getItem(TAB_KEY);
      return t === "file" || t === "mine" ? t : "link";
    } catch {
      return "link";
    }
  });
  const pickTab = (t: Tab) => {
    setTab(t);
    try {
      window.localStorage.setItem(TAB_KEY, t);
    } catch {}
  };
  const [attached, setAttached] = useState<string | null>(current?.url ?? null);
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<{ state: "idle" | "uploading" | "done" | "error"; share: number; reason?: string }>({ state: "idle", share: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const trimmed = link.trim();
  const linkOk = !!trimmed && validUrl(trimmed);
  const linkBad = !!trimmed && !linkOk;
  // What the clients would see: the new source when there is one, else the current demo.
  const preview = tab === "link" && linkOk ? trimmed : tab === "mine" && picked ? picked : attached;
  const isNew = !!preview && preview !== attached;
  const ready = (tab === "link" && linkOk && trimmed !== attached) || (tab === "file" && !!file && upload.state !== "uploading" && upload.state !== "error") || (tab === "mine" && !!picked && picked !== attached);

  useEffect(() => {
    if (tab === "link") requestAnimationFrame(() => linkInput.current?.focus());
  }, [tab]);

  const takeFile = (f: File) => {
    setError(null);
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) return setUpload({ state: "error", share: 0, reason: "that isn’t a video" });
    if (f.size > MAX_BYTES) return setUpload({ state: "error", share: 0, reason: `${mb(f.size)} is over 200 MB` });
    setFile(f);
    setUpload({ state: "idle", share: 0 });
  };
  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (tab === "link") await onLink(trimmed);
      else if (tab === "file" && file) {
        setUpload({ state: "uploading", share: 0 });
        await onUpload(file, (share) => setUpload({ state: "uploading", share }));
        setUpload({ state: "done", share: 1 });
      } else if (tab === "mine" && picked) await onLink(picked);
    } catch (e) {
      setBusy(false);
      if (tab === "file") setUpload({ state: "error", share: 0, reason: e instanceof Error && e.message ? e.message : "it didn’t go through" });
      else setError("That didn’t save. Try again.");
    }
  };
  const remove = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      await onRemove();
      setAttached(null);
    } catch {
      setError("That didn’t remove. Try again.");
    }
    setBusy(false);
  };

  const sortedVideos = [...videos]
    .filter((v) => !q.trim() || v.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.path === attached) - Number(a.path === attached) || (a.at < b.at ? 1 : -1));
  const [all, setAll] = useState(false);
  const shownVideos = all ? sortedVideos : sortedVideos.slice(0, 8);

  const previewTitle = preview ? (isUpload(preview) ? fileName(preview) : `${exerciseName} demo`) : "";
  const previewProvider = preview ? providerOf(preview) : null;
  const clip = preview && isUpload(preview) ? videos.find((v) => v.path === preview) ?? null : null;
  const previewMeta = !preview ? null : <SepJoin parts={isUpload(preview) ? ["Uploaded", clip ? dayMonth(clip.at) : null, clip?.bytes ? mb(clip.bytes) : null] : [previewProvider, shortUrl(preview)]} />;

  return (
    <DialogContent className="dmvh" aria-describedby={undefined} aria-label={`${exerciseName} demo video`} onOpenAutoFocus={(ev) => ev.preventDefault()}>
      <div className="dmvh-head">
        <DialogTitle className="dmvh-title">{exerciseName}</DialogTitle>
        <button type="button" className="dmvh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {/* No "Demo video" under the title (23 Oct, Alex): only the fact worth saying, how many clients have it; else words for a screen reader. */}
      {clientsUsing > 1 ? (
        <DialogDescription className="dmvh-what">{clientsUsing} clients</DialogDescription>
      ) : (
        <DialogDescription className="sr-only">Demo video</DialogDescription>
      )}

      <div className="dmvh-body">
        {preview && previewProvider && (
          <section className="dmvh-section">
            <span className="dmvh-label">{isNew ? "New" : "Current"}</span>
            <div className="dmvh-card">
              <span className="dmvh-thumb">
                <Poster url={preview} onDuration={setDuration} />
                <i className="dmvh-playdisc" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
                    <path d={PLAY} />
                  </svg>
                </i>
                {duration != null && isUpload(preview) && <small className="dmvh-duration">{clock(duration)}</small>}
              </span>
              <span className="dmvh-info">
                <b className="dmvh-ptitle">{previewTitle}</b>
                <small className="dmvh-meta">{previewMeta}</small>
                <span className="dmvh-btns">
                  <button type="button" className="dmvh-play" onClick={() => setPlaying(preview)}>
                    <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" aria-hidden="true">
                      <path d={PLAY} />
                    </svg>
                    Play
                  </button>
                  {!isUpload(preview) && (
                    <a className="dmvh-open" href={preview} target="_blank" rel="noreferrer">
                      Open ↗
                    </a>
                  )}
                </span>
              </span>
            </div>
          </section>
        )}

        <section className="dmvh-section">
          <div className="dmvh-seg" role="tablist" aria-label="Source">
            {(
              [
                ["link", "Paste a link"],
                ["file", "Upload a file"],
                ["mine", "Your videos"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => pickTab(k)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "link" && (
            <div className="dmvh-panel" role="tabpanel">
              <label className={`dmvh-field${linkBad ? " bad" : ""}`}>
                <input
                  ref={linkInput}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="YouTube, Vimeo or Drive link"
                  aria-label="Link"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void save();
                    }
                  }}
                />
                {linkOk && (
                  <span className="dmvh-recognised" aria-live="polite">
                    ✓ {providerOf(trimmed) === "YouTube Shorts" ? "YouTube" : providerOf(trimmed)}
                  </span>
                )}
              </label>
              {linkBad && <span className="dmvh-bad">Not a link</span>}
            </div>
          )}

          {tab === "file" && (
            <div className="dmvh-panel" role="tabpanel">
              <button
                type="button"
                className={`dmvh-drop${dragOver ? " over" : ""}${upload.state === "done" ? " done" : upload.state === "error" ? " bad" : ""}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) takeFile(f);
                }}
                aria-live="polite"
              >
                {upload.state === "uploading" ? (
                  <>
                    <b>Uploading {Math.round(upload.share * 100)}%</b>
                    <i className="dmvh-progress" style={{ width: `${upload.share * 100}%` }} aria-hidden="true" />
                  </>
                ) : upload.state === "done" && file ? (
                  <>
                    <b>✓ {file.name}</b>
                    <small>Uploaded</small>
                  </>
                ) : upload.state === "error" ? (
                  <>
                    <b>
                      Couldn’t upload<Sep />
                      {upload.reason}
                    </b>
                    <small>Try again</small>
                  </>
                ) : file ? (
                  <>
                    <b>{file.name}</b>
                    <small>{mb(file.size)}</small>
                  </>
                ) : (
                  <>
                    <b>Drop or choose a video</b>
                    <small>
                      MP4 or MOV<Sep />
                      up to 200 MB
                    </small>
                  </>
                )}
              </button>
              <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v" hidden onChange={(e) => e.target.files?.[0] && takeFile(e.target.files[0])} />
            </div>
          )}

          {tab === "mine" && (
            <div className="dmvh-panel mine" role="tabpanel">
              {videos.length > 12 && <input className="dmvh-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search your videos" />}
              {videos.length === 0 ? (
                <p className="dmvh-none">None yet</p>
              ) : (
                <div className="dmvh-list" role="radiogroup" aria-label="Your videos">
                  {shownVideos.map((v) => {
                    const on = picked === v.path;
                    return (
                      <button key={v.id} type="button" role="radio" aria-checked={on} className={`dmvh-row${on ? " on" : ""}`} onClick={() => setPicked(on ? null : v.path)}>
                        <span className="dmvh-rthumb" aria-hidden="true">
                          <video src={`${v.path}#t=0.5`} preload="metadata" muted playsInline />
                        </span>
                        <span className="dmvh-rtext">
                          <b>{v.name}</b>
                          <small>
                            <SepJoin parts={[v.path === attached ? "Current" : null, dayMonth(v.at), v.bytes ? mb(v.bytes) : null]} />
                          </small>
                        </span>
                        {on && (
                          <i className="dmvh-tick" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l5 5 9-10" />
                            </svg>
                          </i>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {!all && sortedVideos.length > 8 && (
                <button type="button" className="dmvh-more" onClick={() => setAll(true)}>
                  See all {sortedVideos.length}
                </button>
              )}
            </div>
          )}
        </section>

        {error && <p className="dmvh-error">{error}</p>}
      </div>

      {attached && confirm ? (
        <div className="dmvh-foot">
          <span className="dmvh-ask">{clientsUsing > 1 ? `Remove for all ${clientsUsing} clients?` : "Remove the demo?"}</span>
          <button type="button" className="dmvh-cancel" onClick={() => setConfirm(false)}>
            Keep
          </button>
          <button type="button" className="dmvh-danger" onClick={() => void remove()}>
            Remove
          </button>
        </div>
      ) : (
        <div className="dmvh-foot">
          {attached && (
            <button type="button" className="dmvh-danger dmvh-remove" onClick={() => setConfirm(true)}>
              Remove
            </button>
          )}
          <span className="dmvh-spacer" />
          <button type="button" className="dmvh-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="dmvh-primary" disabled={!ready || busy} onClick={() => void save()}>
            {busy ? <span className="dmvh-spin" aria-hidden="true" /> : null}
            {attached ? "Replace" : "Add demo"}
          </button>
        </div>
      )}

      {playing && (
        <div className="dmvh-lightbox" role="dialog" aria-label="Playing the demo" onClick={() => setPlaying(null)}>
          <div className="dmvh-lightbox-box" onClick={(e) => e.stopPropagation()}>
            {ytId(playing) ? (
              <iframe src={`https://www.youtube.com/embed/${ytId(playing)}?autoplay=1`} title="Demo" allow="autoplay; fullscreen" allowFullScreen />
            ) : /vimeo\.com\/(\d+)/.test(playing) ? (
              <iframe src={`https://player.vimeo.com/video/${/vimeo\.com\/(\d+)/.exec(playing)![1]}?autoplay=1`} title="Demo" allow="autoplay; fullscreen" allowFullScreen />
            ) : isUpload(playing) ? (
              <video src={playing} controls autoPlay playsInline />
            ) : (
              <a className="dmvh-lightbox-open" href={playing} target="_blank" rel="noreferrer">
                Open the link ↗
              </a>
            )}
            <button type="button" className="dmvh-lightbox-x" onClick={() => setPlaying(null)} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
