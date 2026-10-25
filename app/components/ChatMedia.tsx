"use client";

import { useEffect, useState } from "react";
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

/** Without a poster the video's own first frame shows, which iOS draws only when asked for a time (19 Oct). */
const firstFrame = (src: string) => (src.includes("#") ? src : `${src}#t=0.001`);

export function ChatVideo({ src, className, controls = true, muted = false }: { src: string; className?: string; controls?: boolean; muted?: boolean }) {
  const poster = posterOf(src);
  // No poster to be had (no ffmpeg on the server, a file it can't read): the old way, the video's own first frame.
  const [own, setOwn] = useState(!poster);
  useEffect(() => {
    if (!poster) return;
    const probe = new Image();
    probe.onerror = () => setOwn(true);
    probe.src = poster;
    return () => {
      probe.onerror = null;
    };
  }, [poster]);
  const [full, setFull] = useState(false);
  const shown = own ? firstFrame(src) : src;
  if (!controls) return <video className={className} src={shown} poster={own ? undefined : poster!} muted={muted} playsInline preload="metadata" />;
  // In a chat a video plays on the whole screen (25 Oct, Alex: "so the client can properly see… what the coach is
  // drawing"), an ✕ to leave it; in the message it is its first frame with the play mark. Every chat draws it so.
  return (
    <>
      <span className="cmv">
        <video className={className} src={shown} poster={own ? undefined : poster!} muted playsInline preload="metadata" />
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
      <video src={src} autoPlay controls playsInline />
      <button type="button" className="cmv-x" onClick={onClose} aria-label="Close the video">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
