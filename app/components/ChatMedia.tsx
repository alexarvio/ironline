"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

// A chat's pictures and videos as both sides draw them (21 Oct, Alex: they
// loaded slowly): a picture at the size it is shown, never the phone's
// original, and a video behind its poster, so none of it is fetched until it
// plays. Shared by the client's chat, the coach's panel and the gallery.
// Deliberately does NOT import from ../lib/queries (see ChatComposeForm.tsx).

/** A picture at this width: the uploads route makes it at the send; a phone photo is several MB. */
export const sized = (src: string, w: number) => (src.startsWith("/uploads/") ? `${src}${src.includes("?") ? "&" : "?"}w=${w}` : src);

/** A video's first frame as a small picture, made at the send. */
const posterOf = (src: string) => (src.startsWith("/uploads/") ? `${src}${src.includes("?") ? "&" : "?"}poster=1` : null);

/** What a picture or video looks like before it loads (25 Oct, Alex: "as WhatsApp"): its size and a tiny blurry preview. */
export type MediaLook = { thumb?: string | null; w?: number | null; h?: number | null };
/** The bubble at its size from the start, the preview behind it until the picture is in, so a thread never jumps. */
const lookStyle = (look?: MediaLook | null): CSSProperties | undefined => {
  if (!look) return undefined;
  const s: CSSProperties = {};
  if (look.w && look.h) s.aspectRatio = `${look.w} / ${look.h}`;
  if (look.thumb) {
    s.backgroundImage = `url(${look.thumb})`;
    s.backgroundSize = "cover";
    s.backgroundPosition = "center";
  }
  return Object.keys(s).length ? s : undefined;
};

/** A chat's picture: 1080 wide, at its size from the start over its preview. */
export function ChatImage({ src, className, look }: { src: string; className?: string; look?: MediaLook | null }) {
  // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
  return <img className={className} src={sized(src, 1080)} alt="" decoding="async" style={lookStyle(look)} />;
}

// ---- A video on screen comes down before it is tapped (25 Oct, Alex: "as much smoothness as possible"): only its
// small web copy (a few MB, "-web.mp4"), through the app so the page may read it, kept as a blob the full screen plays
// at once. The last few only.
const ready = new Map<string, string>();
const coming = new Set<string>();
function preloadVideo(src: string) {
  if (ready.has(src) || coming.has(src) || !/-web\.mp4$/i.test(src)) return;
  coming.add(src);
  fetch(`${src}?stream=1`)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => {
      if (!b) return;
      ready.set(src, URL.createObjectURL(b));
      while (ready.size > 6) {
        const [oldest, url] = ready.entries().next().value as [string, string];
        URL.revokeObjectURL(url);
        ready.delete(oldest);
      }
    })
    .catch(() => {})
    .finally(() => coming.delete(src));
}

/** Without a poster the video's own first frame shows, which iOS draws only when asked for a time (19 Oct). */
const firstFrame = (src: string) => (src.includes("#") ? src : `${src}#t=0.001`);

export function ChatVideo({ src, className, controls = true, muted = false, look }: { src: string; className?: string; controls?: boolean; muted?: boolean; look?: MediaLook | null }) {
  const poster = posterOf(src);
  // No poster to be had (no ffmpeg on the server, a file it can't read): the old way, the video's own first frame.
  const [own, setOwn] = useState(!poster);
  const [full, setFull] = useState(false);
  // In the message only its poster, a small picture (25 Oct, Alex: "5 seconds for the media to load"; /api/timing
  // showed every video of the thread fetched from the bucket at once on opening, to draw a frame of each). The video
  // itself loads on a tap, playing on the whole screen. The poster failing, the video's own first frame, as before.
  const still = own ? (
    <video className={className} src={firstFrame(src)} muted={muted || controls} playsInline preload="metadata" style={lookStyle(look)} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
    <img className={className} src={poster!} alt="" decoding="async" onError={() => setOwn(true)} style={lookStyle(look)} />
  );
  // Once it is on screen, its small copy comes down, so a tap plays at once.
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !controls || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      preloadVideo(src);
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [src, controls]);
  if (!controls) return still;
  // In a chat a video plays on the whole screen (25 Oct, Alex: "so the client can properly see… what the coach is
  // drawing"), an ✕ to leave it; in the message it is its first frame with the play mark. Every chat draws it so.
  return (
    <>
      <span className="cmv" ref={box}>
        {still}
        <button
          type="button"
          className="cmv-play"
          onClick={(e) => {
            e.stopPropagation();
            setFull(true);
          }}
          aria-label="Play the video"
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </button>
      </span>
      {full && typeof document !== "undefined" && createPortal(<FullVideo src={src} onClose={() => setFull(false)} />, document.body)}
    </>
  );
}

/** A chat's video on the whole screen, playing, with its own controls and an ✕ (Esc too). */
function FullVideo({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="cmv-full" role="dialog" aria-modal="true" aria-label="Video" onClick={(e) => e.stopPropagation()}>
      <video src={ready.get(src) ?? src} autoPlay controls playsInline />
      <button type="button" className="cmv-x" onClick={onClose} aria-label="Close the video">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
