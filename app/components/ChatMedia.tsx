"use client";

import { useEffect, useState } from "react";

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
  return <video className={className} src={own ? firstFrame(src) : src} poster={own ? undefined : poster!} controls={controls} muted={muted} playsInline preload="metadata" />;
}
