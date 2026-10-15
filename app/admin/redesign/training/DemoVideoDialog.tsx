"use client";

import { useEffect, useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";

// The demo video on an exercise (15 Oct), in the shared pop-up language:
// what the clients see now as a real preview (the poster, the source, the
// title, a short URL, Play and Open), then a new source: a link (YouTube,
// Vimeo, Drive, anything), a file (dropped or chosen, with progress), or one
// of the coach's own videos from the library. The demo belongs to the
// library exercise: set once, every client's sheet with it shows it.

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
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** The poster for a source: YouTube's thumbnail, the clip's first frame, or the gradient. */
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
}: {
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

  return (
    <DialogContent className="dmv" aria-describedby={undefined} aria-label={`${exerciseName} demo video`} onOpenAutoFocus={(ev) => ev.preventDefault()}>
      <span className="dmv-glow" aria-hidden="true" />
      <span className="dmv-wash" aria-hidden="true" />
      <div className="dmv-body">
        <header className="dmv-head">
          <span className="dmv-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={34} height={34} fill="currentColor">
              <path d={PLAY} />
            </svg>
          </span>
          <div className="dmv-head-text">
            <div className="dmv-pills">
              <span className="dmv-pill">Demo video</span>
              <span className={`dmv-state ${attached ? "on" : "off"}`}>{attached ? "Attached" : "No demo yet"}</span>
            </div>
            <DialogTitle className="dmv-title">{exerciseName}</DialogTitle>
            <DialogDescription className="dmv-sub">Set once, shows on every client’s sheet with this exercise{clientsUsing > 1 ? ` · ${clientsUsing} clients` : ""}</DialogDescription>
          </div>
          <button type="button" className="dmv-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {preview && previewProvider && (
          <div className="dmv-section">
            <span className="dmv-label">Clients see</span>
            <div className="dmv-card">
              <span className="dmv-thumb">
                <Poster url={preview} onDuration={setDuration} />
                <i className="dmv-playdisc" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                    <path d={PLAY} />
                  </svg>
                </i>
                {duration != null && isUpload(preview) && <small className="dmv-duration">{clock(duration)}</small>}
                {isNew && <small className="dmv-new">New</small>}
              </span>
              <span className="dmv-info">
                <span className={`dmv-source${previewProvider.startsWith("YouTube") ? " yt" : ""}`}>
                  <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {previewProvider === "Uploaded file" ? <path d="M12 16V4M6 10l6-6 6 6M4 20h16" /> : <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />}
                  </svg>
                  {previewProvider}
                </span>
                <b className="dmv-ptitle">{previewTitle}</b>
                <small className="dmv-purl">{isUpload(preview) ? `Uploaded ${clip ? shortDate(clip.at) : ""}${clip?.bytes ? ` · ${mb(clip.bytes)}` : ""}`.replace("Uploaded  ·", "Uploaded ·").trim() : shortUrl(preview)}</small>
                <span className="dmv-btns">
                  <button type="button" className="dmv-play" onClick={() => setPlaying(preview)}>
                    <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" aria-hidden="true">
                      <path d={PLAY} />
                    </svg>
                    Play
                  </button>
                  {!isUpload(preview) && (
                    <a className="dmv-open" href={preview} target="_blank" rel="noreferrer">
                      Open
                      <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                    </a>
                  )}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="dmv-section">
          <span className="dmv-label">{attached ? "Replace it with" : "Add a demo"}</span>
          <div className="dmv-seg" role="tablist" aria-label="Source">
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
            <div className="dmv-panel" role="tabpanel">
              <label className={`dmv-field${linkOk ? " ok" : linkBad ? " bad" : ""}`}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
                </svg>
                <input
                  ref={linkInput}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Paste a YouTube, Vimeo or Drive link"
                  aria-label="Link"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void save();
                    }
                  }}
                />
                {linkOk && (
                  <span className="dmv-recognised" aria-live="polite">
                    ✓ {providerOf(trimmed) === "YouTube Shorts" ? "YouTube" : providerOf(trimmed)}
                  </span>
                )}
              </label>
              {linkBad ? <span className="dmv-bad">That doesn’t look like a link</span> : <span className="dmv-help">Anything the client can open without signing in.</span>}
            </div>
          )}

          {tab === "file" && (
            <div className="dmv-panel" role="tabpanel">
              <button
                type="button"
                className={`dmv-drop${dragOver ? " over" : ""}${upload.state === "done" ? " done" : upload.state === "error" ? " bad" : ""}`}
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
                    <i className="dmv-progress" style={{ width: `${upload.share * 100}%` }} aria-hidden="true" />
                  </>
                ) : upload.state === "done" && file ? (
                  <>
                    <b>✓ {file.name}</b>
                    <small>Ready. It also goes into Your videos.</small>
                  </>
                ) : upload.state === "error" ? (
                  <>
                    <b>Couldn’t upload · {upload.reason}</b>
                    <small>Try again</small>
                  </>
                ) : file ? (
                  <>
                    <b>{file.name}</b>
                    <small>{mb(file.size)} · ready to add</small>
                  </>
                ) : (
                  <>
                    <b>Drop a video, or click to choose</b>
                    <small>MP4 or MOV · up to 200 MB</small>
                  </>
                )}
              </button>
              <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v" hidden onChange={(e) => e.target.files?.[0] && takeFile(e.target.files[0])} />
            </div>
          )}

          {tab === "mine" && (
            <div className="dmv-panel" role="tabpanel">
              {videos.length > 12 && <input className="dmv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your videos" aria-label="Search your videos" />}
              {videos.length === 0 ? (
                <p className="dmv-none">No videos in your library yet. Upload one and it lands there too.</p>
              ) : (
                <div className="dmv-grid" role="radiogroup" aria-label="Your videos">
                  {shownVideos.map((v) => {
                    const on = picked === v.path;
                    return (
                      <button key={v.id} type="button" role="radio" aria-checked={on} className={`dmv-clip${on ? " on" : ""}`} onClick={() => setPicked(on ? null : v.path)} aria-label={v.name}>
                        <video src={`${v.path}#t=0.5`} preload="metadata" muted playsInline />
                        <small>{v.name}</small>
                        {on && (
                          <i aria-hidden="true">
                            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
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
                <button type="button" className="dmv-more" onClick={() => setAll(true)}>
                  See all {sortedVideos.length}
                </button>
              )}
            </div>
          )}
        </div>

        {error && <p className="dmv-error">{error}</p>}
      </div>

      <footer className="dmv-foot">
        {attached &&
          (confirm ? (
            <span className="dmv-confirm">
              Remove for all {clientsUsing > 1 ? `${clientsUsing} clients` : "clients"}?
              <button type="button" className="dmv-danger" onClick={() => void remove()}>
                Yes, remove
              </button>
              <button type="button" className="dmv-keep" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="dmv-remove" onClick={() => setConfirm(true)}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
              Remove
            </button>
          ))}
        <span className="dmv-spacer" />
        <button type="button" className="dmv-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dmv-primary" disabled={!ready || busy} onClick={() => void save()}>
          {busy ? <span className="dmv-spin" aria-hidden="true" /> : null}
          {attached ? "Replace" : "Add demo"}
        </button>
      </footer>

      {playing && (
        <div className="dmv-lightbox" role="dialog" aria-label="Playing the demo" onClick={() => setPlaying(null)}>
          <div className="dmv-lightbox-box" onClick={(e) => e.stopPropagation()}>
            {ytId(playing) ? (
              <iframe src={`https://www.youtube.com/embed/${ytId(playing)}?autoplay=1`} title="Demo" allow="autoplay; fullscreen" allowFullScreen />
            ) : /vimeo\.com\/(\d+)/.test(playing) ? (
              <iframe src={`https://player.vimeo.com/video/${/vimeo\.com\/(\d+)/.exec(playing)![1]}?autoplay=1`} title="Demo" allow="autoplay; fullscreen" allowFullScreen />
            ) : isUpload(playing) ? (
              <video src={playing} controls autoPlay playsInline />
            ) : (
              <a className="dmv-open" href={playing} target="_blank" rel="noreferrer">
                Open the link ↗
              </a>
            )}
            <button type="button" className="dmv-lightbox-x" onClick={() => setPlaying(null)} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
